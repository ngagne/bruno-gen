import { describe, it, expect } from "vitest";
import { SwaggerParser } from "./SwaggerParser.js";

describe("SwaggerParser", () => {
  const parser = new SwaggerParser();

  describe("canParse", () => {
    it("returns true for Swagger 2.0", () => {
      expect(parser.canParse({ swagger: "2.0" })).toBe(true);
    });

    it("returns false for OpenAPI 3.x", () => {
      expect(parser.canParse({ openapi: "3.0.0" })).toBe(false);
    });
  });

  describe("parse", () => {
    it("parses a minimal Swagger 2.0 spec", async () => {
      const spec = {
        swagger: "2.0",
        info: { title: "Test API", version: "1.0.0" },
        host: "api.example.com",
        basePath: "/v1",
        schemes: ["https"],
        paths: {
          "/users": {
            get: {
              operationId: "getUsers",
              responses: { "200": { description: "Success" } },
            },
          },
        },
      };

      const ir = await parser.parse({ content: JSON.stringify(spec) });

      expect(ir.info.title).toBe("Test API");
      expect(ir.servers).toHaveLength(1);
      expect(ir.servers[0].url).toBe("https://api.example.com/v1");
      expect(ir.endpoints).toHaveLength(1);
      expect(ir.endpoints[0].id).toBe("getUsers");
    });

    it("normalizes definitions to components.schemas", async () => {
      const spec = {
        swagger: "2.0",
        info: { title: "Test", version: "1.0.0" },
        host: "api.example.com",
        definitions: {
          User: {
            type: "object",
            properties: { name: { type: "string" } },
          },
        },
        paths: {},
      };

      const ir = await parser.parse({ content: JSON.stringify(spec) });
      expect(ir.components.schemas).toHaveProperty("User");
      expect(ir.components.schemas.User.type).toBe("object");
    });

    it("normalizes securityDefinitions", async () => {
      const spec = {
        swagger: "2.0",
        info: { title: "Test", version: "1.0.0" },
        host: "api.example.com",
        securityDefinitions: {
          basicAuth: { type: "basic" },
          apiKey: { type: "apiKey", name: "X-API-Key", in: "header" },
        },
        paths: {},
      };

      const ir = await parser.parse({ content: JSON.stringify(spec) });
      expect(ir.securitySchemes).toHaveProperty("basicAuth");
      expect(ir.securitySchemes.basicAuth.type).toBe("http");
      expect(ir.securitySchemes.basicAuth.scheme).toBe("basic");
    });

    it("converts formData params to requestBody", async () => {
      const spec = {
        swagger: "2.0",
        info: { title: "Test", version: "1.0.0" },
        host: "api.example.com",
        paths: {
          "/upload": {
            post: {
              operationId: "upload",
              parameters: [
                { name: "title", in: "formData", type: "string", required: true },
                { name: "file", in: "formData", type: "file" },
              ],
              responses: { "200": { description: "OK" } },
            },
          },
        },
      };

      const ir = await parser.parse({ content: JSON.stringify(spec) });
      expect(ir.endpoints[0].requestBody).toBeDefined();
      expect(ir.endpoints[0].requestBody?.content).toHaveProperty("multipart/form-data");
    });
  });
});
