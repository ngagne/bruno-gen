/**
 * Generate environments/default.bru from CollectionIR.
 * Includes {{baseUrl}}, auth variables, and server variable defaults.
 */

import type { CollectionIR, SecurityScheme } from "../ir/index.js";
import { generateAuthVarNames } from "./auth-generator.js";
import { formatBlock } from "./bru-serializer.js";

/**
 * Generate environment file content (default.bru).
 * @param ir - The collection IR
 * @returns The environment.bru file content
 */
function generateEnvironmentBru(ir: CollectionIR): string {
  const vars: Record<string, unknown> = {};

  // Base URL from first server
  const baseUrl = extractBaseUrl(ir);
  vars.baseUrl = baseUrl;

  // Auth variables from all security schemes
  const authVars = generateAuthVars(ir.securitySchemes);
  Object.assign(vars, authVars);

  // Server variable defaults
  if (ir.servers && ir.servers.length > 0 && ir.servers[0].variables) {
    const serverVars = ir.servers[0].variables;
    for (const [key, serverVar] of Object.entries(serverVars)) {
      if (serverVar.default) {
        vars[key] = serverVar.default;
      }
    }
  }

  return formatBlock("vars", vars);
}

/**
 * Extract base URL from first server, substituting variable defaults.
 */
function extractBaseUrl(ir: CollectionIR): string {
  if (!ir.servers || ir.servers.length === 0) {
    return "https://api.example.com";
  }

  let url = ir.servers[0].url;

  // Substitute server variables with defaults
  if (ir.servers[0].variables) {
    for (const [key, serverVar] of Object.entries(ir.servers[0].variables)) {
      if (serverVar.default) {
        url = url.replace(`{${key}}`, serverVar.default);
      }
    }
  }

  return url;
}

/**
 * Generate auth variable names and values from security schemes.
 */
function generateAuthVars(schemes: Record<string, SecurityScheme>): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const [name, scheme] of Object.entries(schemes)) {
    const schemeVars = generateAuthVarNames(scheme, name);
    Object.assign(vars, schemeVars);
  }

  return vars;
}

export { generateEnvironmentBru, extractBaseUrl, generateAuthVars };
