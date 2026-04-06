/** ─── HTTP Security ─── */

interface HttpSecurityScheme {
  type: "http";
  scheme: "basic" | "bearer" | "digest";
  bearerFormat?: string;
  description?: string;
}

/** ─── API Key Security ─── */

interface ApiKeySecurityScheme {
  type: "apiKey";
  name: string;
  in: "header" | "query" | "cookie";
  description?: string;
}

/** ─── OAuth2 ─── */

interface OAuth2Flow {
  authorizationUrl?: string;
  tokenUrl: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

interface OAuth2ImplicitFlow {
  authorizationUrl: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

interface OAuth2Flows {
  authorizationCode?: OAuth2Flow;
  implicit?: OAuth2ImplicitFlow;
  password?: OAuth2Flow;
  clientCredentials?: OAuth2Flow;
}

interface OAuth2SecurityScheme {
  type: "oauth2";
  flows: OAuth2Flows;
  description?: string;
}

/** ─── OpenID Connect ─── */

interface OpenIdConnectSecurityScheme {
  type: "openIdConnect";
  openIdConnectUrl: string;
  description?: string;
}

/** ─── Union & helpers ─── */

/** All supported security scheme types (discriminated union on `type`). */
type SecurityScheme =
  | HttpSecurityScheme
  | ApiKeySecurityScheme
  | OAuth2SecurityScheme
  | OpenIdConnectSecurityScheme;

/** A security requirement: scheme name → required scopes. */
type SecurityRequirement = Record<string, string[]>;

export type {
  SecurityScheme,
  HttpSecurityScheme,
  ApiKeySecurityScheme,
  OAuth2SecurityScheme,
  OAuth2Flows,
  OAuth2Flow,
  OAuth2ImplicitFlow,
  OpenIdConnectSecurityScheme,
  SecurityRequirement,
};
