import { describe, it, expect } from "vitest";
import {
  buildUrl,
  generateBody,
  generateGrpcBlock,
  generateHeaders,
  generateMethodBlock,
  generateRequestBru,
  generateRequestDocs,
  generateWebSocketMessage,
  getRequestTransport,
} from "../request-generator.js";
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
  describe("getRequestTransport", () => {
    it("infers transport for legacy IR and honors an explicit transport", () => {
      expect(getRequestTransport(makeEndpoint())).toEqual({ kind: "http" });
      expect(getRequestTransport(makeEndpoint({ graphql: {} as EndpointIR["graphql"] }))).toEqual({
        kind: "graphql",
      });
      expect(getRequestTransport(makeEndpoint({ grpc: {} as EndpointIR["grpc"] }))).toEqual({
        kind: "grpc",
      });
      expect(
        getRequestTransport(makeEndpoint({ websocket: {} as EndpointIR["websocket"] })),
      ).toEqual({ kind: "websocket" });
      expect(getRequestTransport(makeEndpoint({ transport: { kind: "websocket" } }))).toEqual({
        kind: "websocket",
      });
    });

    it("includes metadata, parameters, auth, docs, and default options", () => {
      const endpoint = makeEndpoint({
        tags: ["users"],
        deprecated: true,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "limit", in: "query", required: false, example: 10 },
        ],
        security: [{ bearer: [] }],
      });
      const result = generateRequestBru(
        endpoint,
        makeCollection({
          securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
        }),
      );

      expect(result).toContain("seq: 1");
      expect(result).toMatch(/tags: \[\s+users\s+\]/);
      expect(result).toContain("deprecated: true");
      expect(result).toContain("id: {{id}}");
      expect(result).toContain("limit: 10");
      expect(result).toContain("auth:bearer");
      expect(result).toContain("## Parameters");
    });
  });

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

  describe("request blocks", () => {
    it("builds Bruno URLs and chooses supported body modes", () => {
      expect(buildUrl("/users/{userId}", "https://api.example.com")).toBe(
        "https://api.example.com/users/{{userId}}",
      );

      const contentTypes: [string, string][] = [
        ["application/json", "json"],
        ["application/graphql", "graphql"],
        ["application/graphql-response+json", "graphql"],
        ["application/x-www-form-urlencoded", "form-urlencoded"],
        ["multipart/form-data", "multipart-form"],
        ["application/xml", "xml"],
        ["text/plain", "json"],
      ];
      for (const [contentType, body] of contentTypes) {
        expect(
          generateMethodBlock(
            makeEndpoint({
              method: "post",
              requestBody: { required: false, content: { [contentType]: {} } },
            }),
            "{{baseUrl}}",
          ),
        ).toContain(`body: ${body}`);
      }
      expect(generateMethodBlock(makeEndpoint(), "{{baseUrl}}")).toContain("body: none");
    });

    it("generates native gRPC blocks and rejects missing metadata", () => {
      const endpoint = makeEndpoint({
        grpc: {
          method: "example.Greeter/SayHello",
          methodType: "unary",
          requestExample: {},
          proto: { fileName: "greeter.proto", content: "" },
        },
      });
      expect(generateGrpcBlock(endpoint, "localhost:50051", "../greeter.proto")).toContain(
        "protoPath: ../greeter.proto",
      );
      expect(generateGrpcBlock(endpoint, "localhost:50051")).toContain(
        "protoPath: protos/greeter.proto",
      );
      expect(() => generateGrpcBlock(makeEndpoint(), "localhost:50051")).toThrow(
        "without gRPC metadata",
      );
    });

    it("combines explicit, generated, cookie, and content negotiation headers", () => {
      const result = generateHeaders(
        makeEndpoint({
          parameters: [
            { name: "X-Trace", in: "header", required: false, example: "trace-1" },
            { name: "session", in: "cookie", required: true },
          ],
          requestBody: { required: false, content: { "application/json": {} } },
          responses: [
            {
              statusCode: "200",
              description: "OK",
              headers: {},
              content: { "application/json": {} },
              links: {},
            },
          ],
          producesContentType: "application/problem+json",
          consumesContentTypes: ["application/vnd.example+json"],
        }),
      );
      expect(result).toContain("X-Trace: trace-1");
      expect(result).toContain("Cookie: session={{session}}");
      expect(result).toContain("Accept: application/problem+json");
      expect(result).toContain("Content-Type: application/vnd.example+json");
      expect(generateHeaders(makeEndpoint())).toBeNull();
    });

    it("uses parameter named examples, schemas, and placeholders", () => {
      const result = generateRequestBru(
        makeEndpoint({
          parameters: [
            {
              name: "sort",
              in: "query",
              required: false,
              examples: { ascending: { value: "asc" } },
            },
            { name: "active", in: "query", required: false, schema: { type: "boolean" } },
            { name: "cursor", in: "query", required: false },
          ],
        }),
        makeCollection(),
      );
      expect(result).toContain("sort: asc");
      expect(result).toContain("active: true");
      expect(result).toContain("cursor: {{cursor}}");
    });
  });

  describe("request bodies and docs", () => {
    const bodyEndpoint = (contentType: string, mediaType: Record<string, unknown>) =>
      makeEndpoint({
        method: "post",
        requestBody: {
          required: false,
          content: { [contentType]: mediaType },
        } as EndpointIR["requestBody"],
      });

    it("renders JSON, GraphQL, XML, and text examples", () => {
      expect(generateBody(bodyEndpoint("application/json", { example: { id: 1 } }))).toContain(
        '"id": 1',
      );
      expect(
        generateBody(
          bodyEndpoint("application/graphql", { examples: { first: { value: { id: 2 } } } }),
        ),
      ).toContain("body:graphql");
      expect(generateBody(bodyEndpoint("application/xml", { example: "<item />" }))).toContain(
        "body:xml",
      );
      expect(generateBody(bodyEndpoint("text/plain", { example: "hello" }))).toContain("body:text");
    });

    it("renders form bodies only from object-shaped data", () => {
      expect(
        generateBody(
          bodyEndpoint("application/x-www-form-urlencoded", {
            schema: { type: "object", properties: { name: { type: "string" } } },
          }),
        ),
      ).toContain("name:");
      expect(
        generateBody(bodyEndpoint("multipart/form-data", { example: { file: "avatar.png" } })),
      ).toContain("body:multipart-form");
      expect(
        generateBody(bodyEndpoint("multipart/form-data", { example: ["not", "a", "map"] })),
      ).toBeNull();
    });

    it("returns no body when content or examples are absent", () => {
      expect(generateBody(makeEndpoint())).toBeNull();
      expect(
        generateBody(
          makeEndpoint({
            requestBody: { required: false, content: {} } as EndpointIR["requestBody"],
          }),
        ),
      ).toBeNull();
      expect(generateBody(bodyEndpoint("application/json", {}))).toBeNull();
    });

    it("renders WebSocket messages safely", () => {
      expect(
        generateWebSocketMessage({
          name: "quote",
          type: "text",
          content: "first\n'''second",
          selected: true,
        }),
      ).toContain("selected: true");
      expect(
        generateWebSocketMessage({ name: "plain", type: "text", content: "hello" }),
      ).not.toContain("selected:");
    });

    it("omits docs for undocumented requests and includes parameter descriptions", () => {
      expect(
        generateRequestDocs(
          makeEndpoint({ summary: undefined, description: undefined, parameters: [] }),
        ),
      ).toBeNull();
      expect(
        generateRequestDocs(
          makeEndpoint({
            summary: undefined,
            parameters: [
              {
                name: "locale",
                in: "query",
                required: false,
                description: "Requested locale",
              },
            ],
          }),
        ),
      ).toContain("optional) — Requested locale");
    });
  });
});
