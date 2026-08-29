import { describe, it, expect } from "vitest";
import {
  generateAuthBlock,
  generateAuthMode,
  generateAuthVarNames,
  generateOAuth2AuthBlock,
} from "../auth-generator.js";
import { generateAuthConfigBlock } from "../collection-generator.js";
import type { SecurityScheme } from "../../ir/index.js";

describe("auth-generator", () => {
  describe("generateAuthBlock", () => {
    it("uses the same renderer for collection and request auth", () => {
      const scheme: SecurityScheme = {
        type: "oauth2",
        flows: {
          clientCredentials: {
            tokenUrl: "https://auth.example.com/token",
            scopes: { read: "Read access" },
          },
        },
      };

      expect(generateAuthConfigBlock(scheme, "oauth")).toBe(generateAuthBlock(scheme, "oauth"));
    });

    it("generates bearer auth block", () => {
      const scheme: SecurityScheme = { type: "http", scheme: "bearer" };
      const result = generateAuthBlock(scheme, "bearerAuth");
      expect(result).toContain("auth:bearer");
      expect(result).toContain("token: {{bearerAuthToken}}");
    });

    it("generates basic auth block", () => {
      const scheme: SecurityScheme = { type: "http", scheme: "basic" };
      const result = generateAuthBlock(scheme, "basicAuth");
      expect(result).toContain("auth:basic");
      expect(result).toContain("username: {{basicAuthUsername}}");
      expect(result).toContain("password: {{basicAuthPassword}}");
    });

    it("generates api key auth block for header", () => {
      const scheme: SecurityScheme = { type: "apiKey", name: "X-API-Key", in: "header" };
      const result = generateAuthBlock(scheme, "apiKeyAuth");
      expect(result).toContain("auth:apikey");
      expect(result).toContain("key: X-API-Key");
      expect(result).toContain("value: {{apiKeyAuthValue}}");
      expect(result).toContain("placement: header");
    });

    it("generates api key auth block for query", () => {
      const scheme: SecurityScheme = { type: "apiKey", name: "api_key", in: "query" };
      const result = generateAuthBlock(scheme, "apiKeyAuth");
      expect(result).toContain("placement: query");
    });

    it("generates oauth2 auth block", () => {
      const scheme: SecurityScheme = {
        type: "oauth2",
        flows: {
          authorizationCode: {
            authorizationUrl: "https://auth.example.com/authorize",
            tokenUrl: "https://auth.example.com/token",
            scopes: { read: "Read access", write: "Write access" },
          },
        },
      };
      const result = generateAuthBlock(scheme, "oauth2");
      expect(result).toContain("auth:oauth2");
      expect(result).toContain("grant_type: authorization_code");
      expect(result).toContain("client_id: {{oauth2ClientId}}");
      expect(result).toContain("scope: Read access Write access");
    });

    it("generates OIDC auth block with placeholder URLs", () => {
      const scheme: SecurityScheme = {
        type: "openIdConnect",
        openIdConnectUrl: "https://auth.example.com/.well-known/openid-configuration",
      };
      const result = generateAuthBlock(scheme, "oidc");
      expect(result).toContain("auth:oauth2");
      expect(result).toContain("authorization_url: {{oidcAuthorizationUrl}}");
      expect(result).toContain("scope: openid profile email");
      expect(result).toContain("pkce: true");
    });

    it("supports digest auth and rejects unsupported HTTP schemes", () => {
      expect(generateAuthBlock({ type: "http", scheme: "digest" }, "digest")).toContain(
        "auth:digest",
      );
      expect(
        generateAuthBlock(
          { type: "http", scheme: "negotiate" } as unknown as SecurityScheme,
          "unsupported",
        ),
      ).toBe("");
    });

    it("renders each OAuth flow with its flow-specific settings", () => {
      const implicit = generateOAuth2AuthBlock(
        {
          type: "oauth2",
          flows: {
            implicit: {
              authorizationUrl: "https://auth.example.com/authorize",
              refreshUrl: "https://auth.example.com/refresh",
              scopes: {},
            },
          },
        },
        "implicit",
      );
      expect(implicit).toContain("grant_type: implicit");
      expect(implicit).toContain("authorization_url: https://auth.example.com/authorize");
      expect(implicit).toContain("refresh_url: https://auth.example.com/refresh");
      expect(implicit).toContain("pkce: false");
      expect(implicit).not.toContain("scope:");

      const password = generateOAuth2AuthBlock(
        {
          type: "oauth2",
          flows: {
            password: { tokenUrl: "https://auth.example.com/token", scopes: {} },
          },
        },
        "password",
      );
      expect(password).toContain("grant_type: password");
      expect(password).toContain("access_token_url: https://auth.example.com/token");
      expect(password).toContain("pkce: true");

      const clientCredentials = generateOAuth2AuthBlock(
        {
          type: "oauth2",
          flows: {
            clientCredentials: { tokenUrl: "https://auth.example.com/token", scopes: {} },
          },
        },
        "client",
      );
      expect(clientCredentials).toContain("grant_type: client_credentials");
    });

    it("returns an empty OAuth block when no flow is configured", () => {
      expect(generateOAuth2AuthBlock({ type: "oauth2", flows: {} }, "oauth")).toBe(
        "auth:oauth2 { }",
      );
    });
  });

  describe("generateAuthMode", () => {
    it("returns bearer for HTTP bearer scheme", () => {
      const schemes = { bearerAuth: { type: "http", scheme: "bearer" } as SecurityScheme };
      expect(generateAuthMode(schemes)).toBe("bearer");
    });

    it("returns basic for HTTP basic scheme", () => {
      const schemes = { basicAuth: { type: "http", scheme: "basic" } as SecurityScheme };
      expect(generateAuthMode(schemes)).toBe("basic");
    });

    it("returns apikey for apiKey scheme", () => {
      const schemes = {
        apiKeyAuth: { type: "apiKey", name: "X-API-Key", in: "header" } as SecurityScheme,
      };
      expect(generateAuthMode(schemes)).toBe("apikey");
    });

    it("returns oauth2 for oauth2 scheme", () => {
      const schemes = {
        oauth2: {
          type: "oauth2",
          flows: { clientCredentials: { tokenUrl: "https://auth.example.com/token", scopes: {} } },
        } as SecurityScheme,
      };
      expect(generateAuthMode(schemes)).toBe("oauth2");
    });

    it("maps OpenID Connect to oauth2", () => {
      expect(
        generateAuthMode({
          oidc: {
            type: "openIdConnect",
            openIdConnectUrl: "https://auth.example.com/.well-known/openid-configuration",
          },
        }),
      ).toBe("oauth2");
    });

    it("returns none for empty schemes", () => {
      expect(generateAuthMode({})).toBe("none");
    });
  });

  describe("generateAuthVarNames", () => {
    it("generates var names for bearer auth", () => {
      const scheme: SecurityScheme = { type: "http", scheme: "bearer" };
      const vars = generateAuthVarNames(scheme, "bearerAuth");
      expect(vars).toHaveProperty("bearerAuthToken", "your-bearer-token-here");
    });

    it("generates var names for basic auth", () => {
      const scheme: SecurityScheme = { type: "http", scheme: "basic" };
      const vars = generateAuthVarNames(scheme, "basicAuth");
      expect(vars).toHaveProperty("basicAuthUsername", "your-username");
      expect(vars).toHaveProperty("basicAuthPassword", "your-password");
    });

    it("generates var names for api key auth", () => {
      const scheme: SecurityScheme = { type: "apiKey", name: "X-API-Key", in: "header" };
      const vars = generateAuthVarNames(scheme, "apiKeyAuth");
      expect(vars).toHaveProperty("apiKeyAuthValue", "your-api-key");
    });

    it("generates var names for oauth2", () => {
      const scheme: SecurityScheme = {
        type: "oauth2",
        flows: {
          authorizationCode: {
            tokenUrl: "https://auth.example.com/token",
            scopes: { read: "Read" },
          },
        },
      };
      const vars = generateAuthVarNames(scheme, "oauth2");
      expect(vars).toHaveProperty("oauth2ClientId", "your-client-id");
      expect(vars).toHaveProperty("oauth2ClientSecret", "your-client-secret");
      expect(vars).toHaveProperty("oauth2Scope");
    });

    it("generates digest, OIDC, and fallback OAuth variables", () => {
      expect(generateAuthVarNames({ type: "http", scheme: "digest" }, "digest")).toEqual({
        digestUsername: "your-username",
        digestPassword: "your-password",
      });

      expect(
        generateAuthVarNames(
          {
            type: "openIdConnect",
            openIdConnectUrl: "https://auth.example.com/.well-known/openid-configuration",
          },
          "oidc",
        ),
      ).toMatchObject({
        oidcAuthorizationUrl: "https://auth.example.com/authorize",
        oidcTokenUrl: "https://auth.example.com/token",
        oidcScope: "openid profile email",
      });

      expect(generateAuthVarNames({ type: "oauth2", flows: {} }, "oauth")).toMatchObject({
        oauthClientId: "your-client-id",
        oauthClientSecret: "your-client-secret",
        oauthScope: "read write",
      });
    });
  });
});
