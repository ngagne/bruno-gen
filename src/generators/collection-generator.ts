/**
 * Generate collection.bru from CollectionIR.
 * Includes meta, auth, docs blocks.
 */

import type { CollectionIR } from "../ir/index.js";
import { formatBlock, formatBlockWithContent } from "./bru-serializer.js";
import { generateAuthMode } from "./auth-generator.js";

interface CollectionBruOptions {
  /** Override default auth mode. */
  authMode?: string;
}

/**
 * Generate collection.bru content from IR.
 * @param ir - The collection IR
 * @param options - Optional overrides
 * @returns The collection.bru file content
 */
function generateCollectionBru(ir: CollectionIR, options?: CollectionBruOptions): string {
  const blocks: string[] = [];

  // Meta block
  const metaEntries: Record<string, unknown> = {
    name: ir.info.title,
    version: ir.info.version,
  };
  blocks.push(formatBlock("meta", metaEntries));

  // Auth mode block
  const authMode = options?.authMode || generateAuthMode(ir.securitySchemes);
  blocks.push(formatBlock("auth", { mode: authMode }));

  // Auth config block (if not "none")
  if (authMode !== "none" && Object.keys(ir.securitySchemes).length > 0) {
    const firstSchemeName = Object.keys(ir.securitySchemes)[0];
    const firstScheme = ir.securitySchemes[firstSchemeName];
    // Generate auth config based on scheme type
    const authConfigBlock = generateAuthConfigBlock(firstScheme, firstSchemeName);
    if (authConfigBlock) {
      blocks.push(authConfigBlock);
    }
  }

  // Docs block
  if (ir.info.description || ir.info.contact || ir.info.license) {
    const docsContent = generateDocsContent(ir);
    blocks.push(formatBlockWithContent("docs", docsContent));
  }

  return blocks.join("\n\n") + "\n";
}

/**
 * Generate auth config block for a specific security scheme.
 */
function generateAuthConfigBlock(scheme: CollectionIR["securitySchemes"][string], name: string): string | null {
  switch (scheme.type) {
    case "http":
      if (scheme.scheme === "bearer") {
        return `auth:bearer {\n  token: {{${name}Token}}\n}`;
      } else if (scheme.scheme === "basic") {
        return `auth:basic {\n  username: {{${name}Username}}\n  password: {{${name}Password}}\n}`;
      }
      break;
    case "apiKey":
      return `auth:apikey {\n  key: ${scheme.name}\n  value: {{${name}Value}}\n  placement: ${scheme.in}\n}`;
    case "oauth2":
      // OAuth2 config is complex - use placeholder vars
      return `auth:oauth2 {\n  grant_type: authorization_code\n  client_id: {{${name}ClientId}}\n  client_secret: {{${name}ClientSecret}}\n  scope: read write\n}`;
    case "openIdConnect":
      return `auth:oauth2 {\n  grant_type: authorization_code\n  authorization_url: {{${name}AuthorizationUrl}}\n  access_token_url: {{${name}TokenUrl}}\n  client_id: {{${name}ClientId}}\n  client_secret: {{${name}ClientSecret}}\n  scope: openid profile email\n  pkce: true\n}`;
  }
  return null;
}

/**
 * Generate docs block content with collection info.
 */
function generateDocsContent(ir: CollectionIR): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${ir.info.title}`);
  lines.push("");

  // Description
  if (ir.info.description) {
    lines.push(ir.info.description);
    lines.push("");
  }

  // Contact info
  if (ir.info.contact) {
    lines.push("## Contact");
    if (ir.info.contact.name) {
      lines.push(`**Name:** ${ir.info.contact.name}`);
    }
    if (ir.info.contact.email) {
      lines.push(`**Email:** ${ir.info.contact.email}`);
    }
    if (ir.info.contact.url) {
      lines.push(`**URL:** ${ir.info.contact.url}`);
    }
    lines.push("");
  }

  // License info
  if (ir.info.license) {
    lines.push("## License");
    lines.push(`**Name:** ${ir.info.license.name}`);
    if (ir.info.license.url) {
      lines.push(`**URL:** ${ir.info.license.url}`);
    }
    lines.push("");
  }

  // Servers
  if (ir.servers && ir.servers.length > 0) {
    lines.push("## Servers");
    for (const server of ir.servers) {
      lines.push(`- **${server.url}**${server.description ? ` - ${server.description}` : ""}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export { generateCollectionBru, generateDocsContent, generateAuthConfigBlock };
export type { CollectionBruOptions };
