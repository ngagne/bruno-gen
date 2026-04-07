import { describe, it, expect } from "vitest";
import { generateRequestBru } from "../request-generator.js";
import type { EndpointIR, CollectionIR } from "../../ir/index.js";

function makeEndpoint(overrides: Partial<EndpointIR> = {}): EndpointIR {
  return {
    id: "test-endpoint",
    method: "get",
    path: "/test",
    parameters: [],
    responses: [],
    security: [],
    tags: [],
    summary: "Test endpoint",
    description: "",
    deprecated: false,
    ...overrides,
  } as EndpointIR;
}

function makeCollection(overrides: Partial<CollectionIR> = {}): CollectionIR {
  return {
    info: { title: "Test API", version: "1.0.0" },
    servers: [{ url: "https://api.example.com" }],
    endpoints: [],
    securitySchemes: {},
    tags: [],
    ...overrides,
  } as CollectionIR;
}

describe("request-generator", () => {
  describe("generateRequestBru", () => {
    it("generates basic request.bru without tests", () => {
      const endpoint = makeEndpoint();
      const collection = makeCollection();
      const result = generateRequestBru(endpoint, collection, { seq: 1 });

      expect(result).toContain("meta {");
      expect(result).toContain("get {");
      expect(result).toContain("name: test-endpoint");
    });

    it("generates post-response block when generateTests is true", () => {
      const endpoint = makeEndpoint({
        responses: [
          {
            statusCode: "200",
            description: "OK",
            headers: {},
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
            links: {},
          },
        ],
      });
      const collection = makeCollection();
      const result = generateRequestBru(endpoint, collection, {
        seq: 1,
        generateTests: true,
      });

      expect(result).toContain("post-response {");
      expect(result).toContain("expected status 200");
    });

    it("does NOT generate post-response block when generateTests is false", () => {
      const endpoint = makeEndpoint({
        responses: [
          {
            statusCode: "200",
            description: "OK",
            headers: {},
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
            links: {},
          },
        ],
      });
      const collection = makeCollection();
      const result = generateRequestBru(endpoint, collection, {
        seq: 1,
        generateTests: false,
      });

      expect(result).not.toContain("post-response {");
    });

    it("does NOT generate post-response block when generateTests is undefined", () => {
      const endpoint = makeEndpoint({
        responses: [
          {
            statusCode: "200",
            description: "OK",
            headers: {},
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
            links: {},
          },
        ],
      });
      const collection = makeCollection();
      const result = generateRequestBru(endpoint, collection, { seq: 1 });

      expect(result).not.toContain("post-response {");
    });

    it("generates tests with required fields assertions", () => {
      const endpoint = makeEndpoint({
        responses: [
          {
            statusCode: "200",
            description: "OK",
            headers: {},
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["id", "name"],
                },
              },
            },
            links: {},
          },
        ],
      });
      const collection = makeCollection();
      const result = generateRequestBru(endpoint, collection, {
        seq: 1,
        generateTests: true,
      });

      expect(result).toContain('have.property("id"');
      expect(result).toContain('have.property("name"');
    });

    it("generates tests with example value assertions", () => {
      const endpoint = makeEndpoint({
        responses: [
          {
            statusCode: "200",
            description: "OK",
            headers: {},
            content: {
              "application/json": {
                schema: { type: "object" },
                example: { id: 42 },
              },
            },
            links: {},
          },
        ],
      });
      const collection = makeCollection();
      const result = generateRequestBru(endpoint, collection, {
        seq: 1,
        generateTests: true,
      });

      expect(result).toContain("res.getBody().id");
      expect(result).toContain("42");
    });
  });
});
