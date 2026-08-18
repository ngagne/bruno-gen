import { describe, it, expect } from "vitest";
import { generateRequestBru } from "../request-generator.js";
import type { EndpointIR, CollectionIR } from "../../ir/index.js";
import { bruToJsonV2 } from "@usebruno/lang";

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

      expect(result).toContain("tests {");
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

      expect(result).toContain("res.body.id");
      expect(result).toContain("42");
    });

    it("renders GraphQL metadata as Bruno GraphQL query and variables blocks", () => {
      const endpoint = makeEndpoint({
        id: "user",
        method: "post",
        path: "/graphql",
        graphql: {
          operationType: "query",
          operationName: "user",
          description: undefined,
          directives: [],
          arguments: [
            {
              name: "id",
              graphqlType: "ID!",
              type: { type: "string" },
              directives: [],
            },
          ],
          returnType: { type: "object", properties: { id: { type: "string" } } },
        },
      });

      const result = generateRequestBru(endpoint, makeCollection(), { seq: 1 });
      const request = bruToJsonV2(result) as {
        http: { body: string };
        body: { graphql: { query: string; variables: string } };
      };

      expect(request.http.body).toBe("graphql");
      expect(request.body.graphql.query).toContain("query user($id: ID!)");
      expect(request.body.graphql.query).toContain("user(id: $id) { id }");
      expect(JSON.parse(request.body.graphql.variables)).toHaveProperty("id");
    });
  });
});
