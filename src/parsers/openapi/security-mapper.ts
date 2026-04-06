import type { SecurityScheme } from "../../ir/index.js";

/**
 * Map OpenAPI securitySchemes to SecurityScheme IR types.
 */
export function mapSecuritySchemes(
  securitySchemes: Record<string, unknown> | undefined,
): Record<string, SecurityScheme> {
  if (!securitySchemes || typeof securitySchemes !== "object") {
    return {};
  }

  const result: Record<string, SecurityScheme> = {};

  for (const [name, schemeObj] of Object.entries(securitySchemes)) {
    const scheme = schemeObj as Record<string, unknown>;
    const type = scheme.type as string;

    if (type === "http") {
      result[name] = {
        type: "http",
        scheme: (scheme.scheme as "basic" | "bearer" | "digest") || "bearer",
        bearerFormat: scheme.bearerFormat as string | undefined,
        description: scheme.description as string | undefined,
      };
    } else if (type === "apiKey") {
      result[name] = {
        type: "apiKey",
        name: scheme.name as string,
        in: (scheme.in as "header" | "query" | "cookie") || "header",
        description: scheme.description as string | undefined,
      };
    } else if (type === "oauth2") {
      result[name] = {
        type: "oauth2",
        flows: mapOAuth2Flows(scheme.flows as Record<string, unknown> | undefined),
        description: scheme.description as string | undefined,
      };
    } else if (type === "openIdConnect") {
      result[name] = {
        type: "openIdConnect",
        openIdConnectUrl: scheme.openIdConnectUrl as string,
        description: scheme.description as string | undefined,
      };
    }
  }

  return result;
}

/**
 * Map OAuth2 flows from OpenAPI spec to IR format.
 */
function mapOAuth2Flows(flows: Record<string, unknown> | undefined) {
  if (!flows) {
    return {};
  }

  const result: Record<string, unknown> = {};

  if (flows.authorizationCode) {
    const flow = flows.authorizationCode as Record<string, unknown>;
    result.authorizationCode = {
      authorizationUrl: flow.authorizationUrl as string | undefined,
      tokenUrl: (flow.tokenUrl as string) || "",
      refreshUrl: flow.refreshUrl as string | undefined,
      scopes: (flow.scopes as Record<string, string>) || {},
    };
  }

  if (flows.implicit) {
    const flow = flows.implicit as Record<string, unknown>;
    result.implicit = {
      authorizationUrl: (flow.authorizationUrl as string) || "",
      refreshUrl: flow.refreshUrl as string | undefined,
      scopes: (flow.scopes as Record<string, string>) || {},
    };
  }

  if (flows.password) {
    const flow = flows.password as Record<string, unknown>;
    result.password = {
      tokenUrl: (flow.tokenUrl as string) || "",
      refreshUrl: flow.refreshUrl as string | undefined,
      scopes: (flow.scopes as Record<string, string>) || {},
    };
  }

  if (flows.clientCredentials) {
    const flow = flows.clientCredentials as Record<string, unknown>;
    result.clientCredentials = {
      tokenUrl: (flow.tokenUrl as string) || "",
      refreshUrl: flow.refreshUrl as string | undefined,
      scopes: (flow.scopes as Record<string, string>) || {},
    };
  }

  return result;
}

/**
 * Map security requirements from OpenAPI spec.
 */
export function mapSecurityRequirements(
  security: Record<string, unknown>[] | undefined,
): Record<string, string[]>[] {
  if (!security || !Array.isArray(security)) {
    return [];
  }

  return security.map((req) => {
    const result: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(req)) {
      result[key] = Array.isArray(value) ? (value as string[]) : [];
    }
    return result;
  });
}
