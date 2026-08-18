import { describe, it, expect } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OpenApiParser } from "./OpenApiParser.js";

describe("OpenApiParser", () => {
  const parser = new OpenApiParser();

  describe("canParse", () => {
    it("returns true for OpenAPI 3.0", () => {
      expect(parser.canParse({ openapi: "3.0.0" })).toBe(true);
      expect(parser.canParse({ openapi: "3.0.3" })).toBe(true);
    });

    it("returns true for OpenAPI 3.1", () => {
      expect(parser.canParse({ openapi: "3.1.0" })).toBe(true);
    });

    it("returns false for Swagger 2.0", () => {
      expect(parser.canParse({ swagger: "2.0" })).toBe(false);
    });

    it("returns false for unknown format", () => {
      expect(parser.canParse({})).toBe(false);
    });
  });

  describe("parse", () => {
    it("parses YAML and file input and rejects an unsupported document", async () => {
      await expect(
        parser.parse({
          content: "openapi: 3.0.0\ninfo:\n  title: YAML API\n  version: '1'\npaths: {}\n",
        }),
      ).resolves.toMatchObject({ info: { title: "YAML API" } });

      const dir = await mkdtemp(join(tmpdir(), "gen-bruno-openapi-"));
      const file = join(dir, "api.json");
      await writeFile(
        file,
        JSON.stringify({ openapi: "3.0.0", info: { title: "File API", version: "1" }, paths: {} }),
      );
      await expect(parser.parse({ filePath: file })).resolves.toMatchObject({
        info: { title: "File API" },
      });
      await expect(parser.validate({ filePath: file })).resolves.toMatchObject({ valid: true });
      await rm(dir, { recursive: true, force: true });
      await expect(parser.parse({ content: { swagger: "2.0" } })).rejects.toThrow(
        "Not an OpenAPI 3.x spec",
      );
    });

    it("parses a minimal OpenAPI 3.0 spec", async () => {
      const spec = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        servers: [{ url: "https://api.example.com" }],
        paths: {
          "/users": {
            get: {
              operationId: "getUsers",
              summary: "List users",
              responses: { "200": { description: "Success" } },
            },
          },
        },
      };

      const ir = await parser.parse({ content: JSON.stringify(spec) });

      expect(ir.info.title).toBe("Test API");
      expect(ir.info.version).toBe("1.0.0");
      expect(ir.servers).toHaveLength(1);
      expect(ir.servers[0].url).toBe("https://api.example.com");
      expect(ir.endpoints).toHaveLength(1);
      expect(ir.endpoints[0].id).toBe("getUsers");
      expect(ir.endpoints[0].method).toBe("get");
      expect(ir.endpoints[0].path).toBe("/users");
    });

    it("parses parameters", async () => {
      const spec = {
        openapi: "3.0.0",
        info: { title: "Test", version: "1.0.0" },
        paths: {
          "/users/{id}": {
            get: {
              operationId: "getUser",
              parameters: [
                {
                  name: "id",
                  in: "path",
                  required: true,
                  schema: { type: "string" },
                },
              ],
              responses: { "200": { description: "Success" } },
            },
          },
        },
      };

      const ir = await parser.parse({ content: JSON.stringify(spec) });
      expect(ir.endpoints[0].parameters).toHaveLength(1);
      expect(ir.endpoints[0].parameters[0].name).toBe("id");
      expect(ir.endpoints[0].parameters[0].in).toBe("path");
      expect(ir.endpoints[0].parameters[0].required).toBe(true);
    });

    it("parses requestBody", async () => {
      const spec = {
        openapi: "3.0.0",
        info: { title: "Test", version: "1.0.0" },
        paths: {
          "/users": {
            post: {
              operationId: "createUser",
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: { name: { type: "string" } },
                    },
                  },
                },
              },
              responses: { "201": { description: "Created" } },
            },
          },
        },
      };

      const ir = await parser.parse({ content: JSON.stringify(spec) });
      expect(ir.endpoints[0].requestBody).toBeDefined();
      expect(ir.endpoints[0].requestBody?.required).toBe(true);
      expect(ir.endpoints[0].requestBody?.content).toHaveProperty("application/json");
    });

    it("parses security schemes", async () => {
      const spec = {
        openapi: "3.0.0",
        info: { title: "Test", version: "1.0.0" },
        components: {
          securitySchemes: {
            bearerAuth: { type: "http", scheme: "bearer" },
            apiKey: { type: "apiKey", name: "X-API-Key", in: "header" },
          },
        },
        paths: {},
      };

      const ir = await parser.parse({ content: JSON.stringify(spec) });
      expect(ir.securitySchemes).toHaveProperty("bearerAuth");
      expect(ir.securitySchemes.bearerAuth.type).toBe("http");
      expect(ir.securitySchemes).toHaveProperty("apiKey");
      expect(ir.securitySchemes.apiKey.type).toBe("apiKey");
    });
  });
});
