import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "node:path";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { parse } from "../parsers/parse.js";
import { generate } from "../generators/orchestrator.js";
import { CollectionBuilder } from "../api/CollectionBuilder.js";
import type { Plugin } from "../plugins/types.js";
import type { CollectionIR, EndpointIR } from "../ir/index.js";

const fixturesDir = join(process.cwd(), "test-fixtures-e2e");

describe("Library API E2E", () => {
  let testIR: CollectionIR;

  beforeAll(async () => {
    mkdirSync(fixturesDir, { recursive: true });

    writeFileSync(
      join(fixturesDir, "spec.yaml"),
      `openapi: "3.0.0"\ninfo:\n  title: E2E Test API\n  version: "1.0.0"\npaths:\n  /users:\n    get:\n      operationId: listUsers\n      summary: List users\n      responses:\n        "200":\n          description: A list of users\n          content:\n            application/json:\n              schema:\n                type: array\n                items:\n                  type: object\n                  properties:\n                    id:\n                      type: integer\n                      example: 1\n                    name:\n                      type: string\n                      example: Alice\n  /users/{id}:\n    get:\n      operationId: getUser\n      summary: Get user by ID\n      parameters:\n        - name: id\n          in: path\n          required: true\n          schema:\n            type: integer\n      responses:\n        "200":\n          description: A single user\n`,
    );

    testIR = await parse(join(fixturesDir, "spec.yaml"));
  });

  afterAll(() => {
    try {
      rmSync(fixturesDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("generate(ir, { outputDir, plugins }) writes files with plugin modifications", async () => {
    const modifyTitlePlugin: Plugin = {
      name: "modify-title",
      hooks: {
        async transformIR(ir) {
          return { ...ir, info: { ...ir.info, title: "Plugin-Modified Title" } };
        },
      },
    };

    const outputDir = join(fixturesDir, "out-plugin-e2e");
    const result = await generate(testIR, {
      outputDir,
      plugins: [modifyTitlePlugin],
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(outputDir, "collection.bru"))).toBe(true);

    const collectionBru = readFileSync(join(outputDir, "collection.bru"), "utf-8");
    expect(collectionBru).toContain("Plugin-Modified Title");
  });

  it("generate with preOutput plugin modifies .bru file content", async () => {
    const commentPlugin: Plugin = {
      name: "add-comment",
      hooks: {
        async preOutput(content) {
          return `// Generated at ${new Date().toISOString()}\n\n${content}`;
        },
      },
    };

    const outputDir = join(fixturesDir, "out-preoutput-e2e");
    const result = await generate(testIR, {
      outputDir,
      plugins: [commentPlugin],
    });

    expect(result.success).toBe(true);
    expect(result.filesWritten.length).toBeGreaterThan(0);

    // Check at least one request file has the comment (not collection.bru, folder.bru, or environment)
    const requestFiles = result.filesWritten.filter(
      (f) =>
        f.endsWith(".bru") &&
        !f.endsWith("collection.bru") &&
        !f.endsWith("folder.bru") &&
        !f.includes("/environments/"),
    );
    expect(requestFiles.length).toBeGreaterThan(0);

    const content = readFileSync(requestFiles[0], "utf-8");
    expect(content).toMatch(/Generated at/);
  });

  it("CollectionBuilder.fromSpec().withOptions().withPlugins().generate() works", async () => {
    const headerPlugin: Plugin = {
      name: "add-version-header",
      hooks: {
        async transformIR(ir) {
          // Add a header to every endpoint
          const modifiedEndpoints = ir.endpoints.map((ep: EndpointIR) => ({
            ...ep,
            headers: [
              ...(ep.headers || []),
              { name: "X-Plugin-Version", value: "2.0", required: false },
            ],
          }));
          return { ...ir, endpoints: modifiedEndpoints };
        },
      },
    };

    const outputDir = join(fixturesDir, "out-builder-e2e");
    const result = await CollectionBuilder.fromSpec(join(fixturesDir, "spec.yaml"))
      .withOptions({ grouping: "path", generateTests: true })
      .withPlugins([headerPlugin])
      .generate(outputDir);

    expect(result.success).toBe(true);
    expect(existsSync(join(outputDir, "collection.bru"))).toBe(true);

    // Verify path grouping created folders
    const userFolder = join(outputDir, "users");
    const userIdFolder = join(outputDir, "users-id");
    // At least one of these should exist depending on path grouping
    expect(existsSync(userFolder) || existsSync(userIdFolder)).toBe(true);
  });

  it("multiple plugins execute in order — both transformIR and preOutput", async () => {
    const plugins: Plugin[] = [
      {
        name: "title-modifier",
        hooks: {
          async transformIR(ir) {
            return { ...ir, info: { ...ir.info, title: ir.info.title + " [T1]" } };
          },
        },
      },
      {
        name: "content-appender",
        hooks: {
          async preOutput(content) {
            return `${content}\n// [P1]`;
          },
        },
      },
      {
        name: "title-modifier-2",
        hooks: {
          async transformIR(ir) {
            return { ...ir, info: { ...ir.info, title: ir.info.title + " [T2]" } };
          },
          async preOutput(content) {
            return `${content}\n// [P2]`;
          },
        },
      },
    ];

    const outputDir = join(fixturesDir, "out-multi-plugin");
    const result = await generate(testIR, { outputDir, plugins });

    expect(result.success).toBe(true);

    const collectionBru = readFileSync(join(outputDir, "collection.bru"), "utf-8");
    expect(collectionBru).toContain("[T1]");
    expect(collectionBru).toContain("[T2]");
    // T1 applied first, then T2
    expect(collectionBru.indexOf("[T1]")).toBeLessThan(collectionBru.indexOf("[T2]"));
  });
});
