import { describe, expect, it } from "vitest";
import { mapSecurityRequirements, mapSecuritySchemes } from "./security-mapper.js";

describe("security mapper", () => {
  it("maps every security scheme and OAuth flow", () => {
    expect(
      mapSecuritySchemes({
        bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Token" },
        basic: { type: "http" },
        key: { type: "apiKey", name: "X-Key", in: "query" },
        oauth: {
          type: "oauth2",
          flows: {
            authorizationCode: {
              authorizationUrl: "https://auth",
              tokenUrl: "https://token",
              scopes: { read: "Read" },
            },
            implicit: { authorizationUrl: "https://auth", scopes: {} },
            password: { tokenUrl: "https://token", scopes: {} },
            clientCredentials: { tokenUrl: "https://token", scopes: {} },
          },
        },
        oidc: {
          type: "openIdConnect",
          openIdConnectUrl: "https://issuer/.well-known/openid-configuration",
        },
      }),
    ).toMatchObject({
      bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      basic: { type: "http", scheme: "bearer" },
      key: { type: "apiKey", in: "query" },
      oauth: {
        type: "oauth2",
        flows: { authorizationCode: {}, implicit: {}, password: {}, clientCredentials: {} },
      },
      oidc: { type: "openIdConnect" },
    });
  });

  it("handles omitted security values", () => {
    expect(mapSecuritySchemes()).toEqual({});
    expect(mapSecuritySchemes({ oauth: { type: "oauth2" } })).toEqual({
      oauth: { type: "oauth2", flows: {}, description: undefined },
    });
    expect(
      mapSecuritySchemes({
        key: { type: "apiKey", name: "X-Key" },
        oauth: {
          type: "oauth2",
          flows: {
            authorizationCode: {},
            implicit: {},
            password: {},
            clientCredentials: {},
          },
        },
      }),
    ).toMatchObject({
      key: { in: "header" },
      oauth: {
        flows: {
          authorizationCode: { tokenUrl: "", scopes: {} },
          implicit: { authorizationUrl: "", scopes: {} },
          password: { tokenUrl: "", scopes: {} },
          clientCredentials: { tokenUrl: "", scopes: {} },
        },
      },
    });
    expect(mapSecurityRequirements([{ oauth: ["read"], anonymous: "invalid" }])).toEqual([
      { oauth: ["read"], anonymous: [] },
    ]);
    expect(mapSecurityRequirements()).toEqual([]);
  });
});
