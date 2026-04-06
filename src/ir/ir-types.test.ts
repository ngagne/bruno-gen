import { describe, it, expect } from "vitest";
import type {
  CollectionIR,
  EndpointIR,
  SchemaIR,
  SecurityScheme,
  ValidationError,
  GraphQLEndpointExtension,
} from "../ir/index.js";

describe("IR types", () => {
  it("should allow creating a minimal CollectionIR object", () => {
    const collection: CollectionIR = {
      info: { title: "Test API", version: "1.0.0" },
      servers: [],
      securitySchemes: {},
      defaultSecurity: [],
      tags: [],
      endpoints: [],
      components: {
        schemas: {},
        parameters: {},
        responses: {},
        requestBodies: {},
      },
      extensions: {},
    };
    expect(collection.info.title).toBe("Test API");
  });

  it("should allow creating a minimal EndpointIR object", () => {
    const endpoint: EndpointIR = {
      id: "get-users",
      method: "get",
      path: "/users",
      tags: ["Users"],
      deprecated: false,
      parameters: [],
      responses: [],
      consumesContentTypes: ["application/json"],
    };
    expect(endpoint.method).toBe("get");
  });

  it("should allow creating a SchemaIR with nested properties", () => {
    const schema: SchemaIR = {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1 },
        age: { type: "integer", minimum: 0 },
      },
      required: ["name"],
    };
    expect(schema.type).toBe("object");
    expect(schema.properties?.name.type).toBe("string");
  });

  it("should accept all SecurityScheme variants", () => {
    const bearer: SecurityScheme = {
      type: "http",
      scheme: "bearer",
    };
    const apiKey: SecurityScheme = {
      type: "apiKey",
      name: "X-API-Key",
      in: "header",
    };
    const oauth2: SecurityScheme = {
      type: "oauth2",
      flows: {
        authorizationCode: {
          tokenUrl: "https://example.com/token",
          scopes: { read: "Read access" },
        },
      },
    };
    const oidc: SecurityScheme = {
      type: "openIdConnect",
      openIdConnectUrl: "https://example.com/.well-known/openid-configuration",
    };
    expect(bearer.type).toBe("http");
    expect(apiKey.type).toBe("apiKey");
    expect(oauth2.type).toBe("oauth2");
    expect(oidc.type).toBe("openIdConnect");
  });

  it("should allow ValidationError with source location", () => {
    const error: ValidationError = {
      file: "openapi.yaml",
      line: 42,
      column: 15,
      message: "Unknown field 'foobar'",
      code: "UNKNOWN_FIELD",
    };
    expect(error.line).toBe(42);
    expect(error.column).toBe(15);
  });

  it("should allow GraphQLEndpointExtension", () => {
    const gqlExt: GraphQLEndpointExtension = {
      operationType: "query",
      operationName: "GetUser",
      arguments: [{ name: "id", type: { type: "string" }, directives: [] }],
      returnType: { type: "object" },
      directives: ['@deprecated(reason: "Use v2")'],
    };
    expect(gqlExt.operationType).toBe("query");
  });
});
