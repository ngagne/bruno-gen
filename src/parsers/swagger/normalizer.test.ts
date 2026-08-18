import { describe, expect, it } from "vitest";
import { normalizeSwaggerToOpenAPI3 } from "./normalizer.js";

describe("normalizeSwaggerToOpenAPI3", () => {
  it("normalizes server, component, security, reference, and operation variants", () => {
    const normalized = normalizeSwaggerToOpenAPI3({
      info: { title: "Pets", version: "1" },
      host: "api.example.com",
      basePath: "/v1",
      schemes: ["https", "http"],
      definitions: { Pet: { properties: { owner: { $ref: "#/definitions/User" } } }, User: {} },
      parameters: { Trace: { name: "trace", in: "header", type: "string" } },
      responses: { Error: { description: "error" } },
      securityDefinitions: {
        basic: { type: "basic", description: "Basic auth" },
        key: { type: "apiKey", name: "X-Key", in: "header" },
        code: {
          type: "oauth2",
          flow: "accessCode",
          authorizationUrl: "https://auth",
          tokenUrl: "https://token",
          scopes: { read: "Read" },
        },
        implicit: {
          type: "oauth2",
          flow: "implicit",
          authorizationUrl: "https://auth",
          scopes: {},
        },
        password: { type: "oauth2", flow: "password", tokenUrl: "https://token", scopes: {} },
        app: { type: "oauth2", flow: "application", tokenUrl: "https://token", scopes: {} },
      },
      tags: [{ name: "pets" }],
      produces: ["application/json"],
      consumes: ["application/json"],
      paths: {
        "/pets": {
          parameters: [{ name: "tenant", in: "header", type: "string" }],
          get: { responses: {} },
          post: {
            parameters: [
              { name: "title", in: "formData", type: "string", required: true },
              { name: "file", in: "formData", type: "file" },
              { name: "page", in: "query", type: "integer" },
            ],
            responses: {},
          },
          summary: "not an operation",
        },
      },
    });

    expect(normalized.servers).toEqual([
      { url: "https://api.example.com/v1" },
      { url: "http://api.example.com/v1" },
    ]);
    expect(normalized.components).toMatchObject({
      schemas: { Pet: { properties: { owner: { $ref: "#/components/schemas/User" } } } },
      securitySchemes: {
        code: { flows: { authorizationCode: {} } },
        implicit: { flows: { implicit: {} } },
        password: { flows: { password: {} } },
        app: { flows: { clientCredentials: {} } },
      },
    });
    expect(normalized.paths).toMatchObject({
      "/pets": {
        get: { produces: ["application/json"] },
        post: {
          requestBody: { content: { "multipart/form-data": {} } },
          parameters: [{ name: "page", in: "query", type: "integer" }],
        },
      },
    });
  });

  it("uses basePath without a host and supports urlencoded form data", () => {
    const normalized = normalizeSwaggerToOpenAPI3({
      basePath: "/api",
      paths: {
        "/login": {
          post: {
            produces: ["text/plain"],
            consumes: ["application/x-www-form-urlencoded"],
            parameters: [{ name: "email", in: "formData", required: true }],
          },
        },
      },
    });
    expect(normalized.servers).toEqual([{ url: "/api" }]);
    expect(normalized.paths).toMatchObject({
      "/login": {
        post: {
          produces: ["text/plain"],
          requestBody: {
            content: {
              "application/x-www-form-urlencoded": {
                schema: { properties: { email: { type: "string" } } },
              },
            },
          },
        },
      },
    });
  });

  it("uses defaults for omitted optional Swagger fields", () => {
    expect(normalizeSwaggerToOpenAPI3({})).toMatchObject({
      openapi: "3.0.0",
      info: { title: "API", version: "1.0.0" },
      paths: {},
    });
  });
});
