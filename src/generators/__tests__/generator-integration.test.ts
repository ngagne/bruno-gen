import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { generate } from "../orchestrator.js";
import type { CollectionIR, SecurityScheme } from "../../ir/index.js";
import { mkdir, rm, readFile } from "fs/promises";
import { join } from "path";

describe("generator integration tests", () => {
  const testOutputDir = join(process.cwd(), "test-output-integration");

  beforeAll(async () => {
    await mkdir(testOutputDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      await rm(testOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("generates a complete Bruno collection from simple IR", async () => {
    const ir: CollectionIR = {
      info: {
        title: "Test API",
        version: "1.0.0",
        description: "A test API collection",
      },
      servers: [
        {
          url: "https://api.example.com/v1",
          description: "Production server",
          variables: {},
        },
      ],
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
      defaultSecurity: [{ bearerAuth: [] }],
      tags: [{ name: "users", description: "User management" }],
      endpoints: [
        {
          id: "GetUsers",
          method: "get",
          path: "/users",
          summary: "List users",
          description: "Get all users",
          tags: ["users"],
          deprecated: false,
          parameters: [
            {
              name: "page",
              in: "query",
              required: false,
              deprecated: false,
              description: "Page number",
              schema: { type: "integer", example: 1 },
              example: 1,
            },
          ],
          responses: [
            {
              statusCode: "200",
              description: "Successful response",
              headers: {},
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      id: { type: "integer" },
                      name: { type: "string" },
                    },
                  },
                  example: { id: 1, name: "John Doe" },
                },
              },
            },
          ],
          consumesContentTypes: [],
        },
      ],
      components: {
        schemas: {},
        parameters: {},
        responses: {},
        requestBodies: {},
      },
      extensions: {},
    };

    const result = await generate(ir, { outputDir: testOutputDir });

    expect(result.success).toBe(true);
    expect(result.filesWritten.length).toBeGreaterThan(0);
    expect(result.warnings).toHaveLength(0);

    // Verify bruno.json is in the files written
    expect(result.filesWritten.some((f) => f.endsWith("bruno.json"))).toBe(true);

    // Verify collection.bru was created
    const collectionBruPath = join(testOutputDir, "collection.bru");
    const collectionContent = await readFile(collectionBruPath, "utf-8");
    expect(collectionContent).toContain("meta {");
    expect(collectionContent).toContain('"Test API"');
    expect(collectionContent).toContain("version: 1.0.0");
    expect(collectionContent).toContain("auth {");
    expect(collectionContent).toContain("mode: bearer");

    // Verify environment file was created
    const envBruPath = join(testOutputDir, "environments", "default.bru");
    const envContent = await readFile(envBruPath, "utf-8");
    expect(envContent).toContain("vars {");
    expect(envContent).toContain("baseUrl: https://api.example.com/v1");
    expect(envContent).toContain("bearerAuthToken");

    // Verify bruno.json was created (required for valid Bruno collection)
    const brunoJsonPath = join(testOutputDir, "bruno.json");
    const brunoJsonContent = await readFile(brunoJsonPath, "utf-8");
    const brunoJson = JSON.parse(brunoJsonContent);
    expect(brunoJson.type).toBe("collection");
    expect(brunoJson.name).toBe("Test API");
    expect(brunoJson.version).toBe("1.0.0");
    expect(brunoJson.description).toBe("A test API collection");
    expect(brunoJson.scripts.filesystemAccess.allow).toBe(false);

    // Verify folder was created
    const usersFolder = join(testOutputDir, "users");
    const folderBruPath = join(usersFolder, "folder.bru");
    const folderContent = await readFile(folderBruPath, "utf-8");
    expect(folderContent).toContain("meta {");
    expect(folderContent).toContain("name: users");

    // Verify request file was created
    const requestBruFiles = result.filesWritten.filter(
      (f) =>
        f.endsWith(".bru") &&
        !f.includes("collection.bru") &&
        !f.includes("folder.bru") &&
        !f.includes("default.bru"),
    );
    expect(requestBruFiles.length).toBeGreaterThan(0);
  });

  it("handles endpoints with no tags (ungrouped)", async () => {
    const ir: CollectionIR = {
      info: { title: "Ungrouped API", version: "1.0.0" },
      servers: [{ url: "https://api.test.com", variables: {} }],
      securitySchemes: {},
      defaultSecurity: [],
      tags: [],
      endpoints: [
        {
          id: "HealthCheck",
          method: "get",
          path: "/health",
          tags: [],
          deprecated: false,
          parameters: [],
          responses: [],
          consumesContentTypes: [],
        },
      ],
      components: { schemas: {}, parameters: {}, responses: {}, requestBodies: {} },
      extensions: {},
    };

    const ungroupedDir = join(testOutputDir, "ungrouped-test");
    await mkdir(ungroupedDir, { recursive: true });

    const result = await generate(ir, { outputDir: ungroupedDir });

    expect(result.success).toBe(true);
    // Should have ungrouped folder
    const ungroupedFolder = join(ungroupedDir, "ungrouped");
    const folderBruPath = join(ungroupedFolder, "folder.bru");
    const folderContent = await readFile(folderBruPath, "utf-8");
    expect(folderContent).toContain("name: Ungrouped");
  });

  it("generates auth blocks for different security schemes", async () => {
    const schemes: SecurityScheme[] = [
      { type: "http", scheme: "basic" },
      { type: "apiKey", name: "X-API-Key", in: "header" },
    ];

    for (const scheme of schemes) {
      const ir: CollectionIR = {
        info: { title: `Auth Test - ${scheme.type}`, version: "1.0.0" },
        servers: [{ url: "https://auth.test.com", variables: {} }],
        securitySchemes: { authScheme: scheme },
        defaultSecurity: [{ authScheme: [] }],
        tags: [],
        endpoints: [],
        components: { schemas: {}, parameters: {}, responses: {}, requestBodies: {} },
        extensions: {},
      };

      const authDir = join(testOutputDir, `auth-test-${scheme.type}`);
      await mkdir(authDir, { recursive: true });

      const result = await generate(ir, { outputDir: authDir });
      expect(result.success).toBe(true);

      const collectionContent = await readFile(join(authDir, "collection.bru"), "utf-8");
      expect(collectionContent).toContain("auth {");
    }
  });
});
