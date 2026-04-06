/**
 * Auth block generation for all security scheme types.
 * Maps IR security schemes to Bruno auth blocks.
 */

import type {
  SecurityScheme,
  SecurityRequirement,
  HttpSecurityScheme,
  ApiKeySecurityScheme,
  OAuth2SecurityScheme,
  OpenIdConnectSecurityScheme,
} from "../ir/index.js";
import { formatBlock } from "./bru-serializer.js";

/**
 * Generate auth block for a specific security scheme.
 * @param scheme - The security scheme to generate auth for
 * @param varPrefix - Prefix for environment variables (e.g., "bearerAuth" → "bearerAuthToken")
 * @returns Bruno auth block string
 */
function generateAuthBlock(scheme: SecurityScheme, varPrefix: string): string {
  switch (scheme.type) {
    case "http":
      return generateHttpAuthBlock(scheme, varPrefix);
    case "apiKey":
      return generateApiKeyAuthBlock(scheme, varPrefix);
    case "oauth2":
      return generateOAuth2AuthBlock(scheme, varPrefix);
    case "openIdConnect":
      return generateOIDCAuthBlock(scheme, varPrefix);
    default:
      return "";
  }
}

/**
 * Generate HTTP auth block (bearer, basic, digest).
 */
function generateHttpAuthBlock(scheme: HttpSecurityScheme, varPrefix: string): string {
  switch (scheme.scheme) {
    case "bearer":
      return `auth:bearer {\n  token: {{${varPrefix}Token}}\n}`;
    case "basic":
      return `auth:basic {\n  username: {{${varPrefix}Username}}\n  password: {{${varPrefix}Password}}\n}`;
    case "digest":
      return `auth:digest {\n  username: {{${varPrefix}Username}}\n  password: {{${varPrefix}Password}}\n}`;
    default:
      return "";
  }
}

/**
 * Generate API key auth block.
 */
function generateApiKeyAuthBlock(scheme: ApiKeySecurityScheme, varPrefix: string): string {
  const entries: Record<string, unknown> = {
    key: scheme.name,
    value: `{{${varPrefix}Value}}`,
    placement: scheme.in,
  };
  return formatBlock("auth:apikey", entries);
}

/**
 * Generate OAuth2 auth block.
 */
function generateOAuth2AuthBlock(scheme: OAuth2SecurityScheme, varPrefix: string): string {
  // Find the first available flow
  const flow =
    scheme.flows.authorizationCode ||
    scheme.flows.implicit ||
    scheme.flows.password ||
    scheme.flows.clientCredentials;

  if (!flow) {
    return `auth:oauth2 { }`;
  }

  const isImplicit = scheme.flows.implicit === flow;
  const grantType = isImplicit
    ? "implicit"
    : scheme.flows.authorizationCode
      ? "authorization_code"
      : scheme.flows.password
        ? "password"
        : "client_credentials";

  const entries: Record<string, unknown> = {
    grant_type: grantType,
  };

  if ("authorizationUrl" in flow && flow.authorizationUrl) {
    entries.authorization_url = flow.authorizationUrl;
  }

  if ("tokenUrl" in flow && flow.tokenUrl) {
    entries.access_token_url = flow.tokenUrl;
  }

  if (flow.refreshUrl) {
    entries.refresh_url = flow.refreshUrl;
  }

  entries.client_id = `{{${varPrefix}ClientId}}`;
  entries.client_secret = `{{${varPrefix}ClientSecret}}`;

  if (flow.scopes && Object.keys(flow.scopes).length > 0) {
    entries.scope = Object.values(flow.scopes).join(" ");
  }

  // PKCE is recommended for public clients
  if (isImplicit) {
    entries.pkce = false;
  } else {
    entries.pkce = true;
  }

  return formatBlock("auth:oauth2", entries);
}

/**
 * Generate OpenID Connect auth block (maps to OAuth2 with placeholder URLs).
 */
function generateOIDCAuthBlock(scheme: OpenIdConnectSecurityScheme, varPrefix: string): string {
  const entries: Record<string, unknown> = {
    grant_type: "authorization_code",
    authorization_url: `{{${varPrefix}AuthorizationUrl}}`,
    access_token_url: `{{${varPrefix}TokenUrl}}`,
    client_id: `{{${varPrefix}ClientId}}`,
    client_secret: `{{${varPrefix}ClientSecret}}`,
    scope: "openid profile email",
    pkce: true,
  };

  return formatBlock("auth:oauth2", entries);
}

/**
 * Generate auth mode string for collection-level default.
 * Determines the primary auth mode from security schemes.
 */
function generateAuthMode(schemes: Record<string, SecurityScheme>): string {
  const schemeList = Object.values(schemes);
  if (schemeList.length === 0) {
    return "none";
  }

  const firstScheme = schemeList[0];
  switch (firstScheme.type) {
    case "http":
      return firstScheme.scheme;
    case "apiKey":
      return "apikey";
    case "oauth2":
      return "oauth2";
    case "openIdConnect":
      return "oauth2";
    default:
      return "none";
  }
}

/**
 * Determine auth mode for a specific endpoint.
 * @param endpointSecurity - Endpoint-level security override
 * @param collectionSecurity - Collection-level default security
 * @returns Auth mode string ("none", "bearer", "basic", etc.)
 */
function getEndpointAuthMode(
  endpointSecurity: SecurityRequirement[] | undefined,
  collectionSecurity: SecurityRequirement[]
): string {
  // Empty array means no auth for this endpoint
  if (endpointSecurity !== undefined && endpointSecurity.length === 0) {
    return "none";
  }

  // Undefined means inherit collection default
  const securityToUse = endpointSecurity !== undefined ? endpointSecurity : collectionSecurity;

  if (securityToUse.length === 0) {
    return "none";
  }

  // Use the first security requirement
  const firstRequirement = securityToUse[0];
  const schemeName = Object.keys(firstRequirement)[0];

  // We'll determine the actual mode from the scheme type
  // This is simplified - in practice, we'd look up the scheme definition
  return schemeName;
}

/**
 * Generate auth variable names for environment file.
 * Maps security scheme to environment variable names.
 */
function generateAuthVarNames(scheme: SecurityScheme, name: string): Record<string, string> {
  const varNames: Record<string, string> = {};

  switch (scheme.type) {
    case "http":
      if (scheme.scheme === "bearer") {
        varNames[`${name}Token`] = "your-bearer-token-here";
      } else if (scheme.scheme === "basic" || scheme.scheme === "digest") {
        varNames[`${name}Username`] = "your-username";
        varNames[`${name}Password`] = "your-password";
      }
      break;

    case "apiKey":
      varNames[`${name}Value`] = "your-api-key";
      break;

    case "oauth2": {
      varNames[`${name}ClientId`] = "your-client-id";
      varNames[`${name}ClientSecret`] = "your-client-secret";
      // Get scopes from first flow
      const oauth2Flow =
        scheme.flows.authorizationCode ||
        scheme.flows.implicit ||
        scheme.flows.password ||
        scheme.flows.clientCredentials;
      if (oauth2Flow && oauth2Flow.scopes && Object.keys(oauth2Flow.scopes).length > 0) {
        varNames[`${name}Scope`] = Object.values(oauth2Flow.scopes).join(" ");
      } else {
        varNames[`${name}Scope`] = "read write";
      }
      break;
    }

    case "openIdConnect":
      varNames[`${name}AuthorizationUrl`] = "https://auth.example.com/authorize";
      varNames[`${name}TokenUrl`] = "https://auth.example.com/token";
      varNames[`${name}ClientId`] = "your-client-id";
      varNames[`${name}ClientSecret`] = "your-client-secret";
      varNames[`${name}Scope`] = "openid profile email";
      break;
  }

  return varNames;
}

export {
  generateAuthBlock,
  generateAuthMode,
  getEndpointAuthMode,
  generateAuthVarNames,
  generateHttpAuthBlock,
  generateApiKeyAuthBlock,
  generateOAuth2AuthBlock,
  generateOIDCAuthBlock,
};
