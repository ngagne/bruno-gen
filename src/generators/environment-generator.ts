/**
 * Generate environments/default.bru from CollectionIR.
 * Includes {{baseUrl}}, auth variables, and server variable defaults.
 */

import type { CollectionIR, SecurityScheme } from "../ir/index.js";
import { generateAuthVarNames } from "./auth-generator.js";
import { formatBlock } from "./bru-serializer.js";

interface EnvironmentVariableOptions {
  /** Include the collection's resolved base URL. Defaults to true. */
  includeBaseUrl?: boolean;
  /** Include editable placeholders for required endpoint parameters. */
  includeRequiredParameters?: boolean;
}

/**
 * Generate environment file content (default.bru).
 * @param ir - The collection IR
 * @returns The environment.bru file content
 */
function generateEnvironmentBru(
  ir: CollectionIR,
  options: EnvironmentVariableOptions = {},
): string {
  return formatBlock("vars", collectEnvironmentVars(ir, options));
}

/** Collect environment values shared by planned and standalone environment output. */
function collectEnvironmentVars(
  ir: CollectionIR,
  options: EnvironmentVariableOptions = {},
): Record<string, unknown> {
  const vars: Record<string, unknown> = { ...generateAuthVars(ir.securitySchemes) };

  if (options.includeBaseUrl !== false) {
    vars.baseUrl = extractBaseUrl(ir);
  }

  for (const [key, serverVar] of Object.entries(ir.servers[0]?.variables ?? {})) {
    if (serverVar.default) vars[key] = serverVar.default;
  }

  if (options.includeRequiredParameters) {
    for (const endpoint of ir.endpoints) {
      for (const parameter of endpoint.parameters) {
        if (parameter.required && vars[parameter.name] === undefined) {
          vars[parameter.name] = String(parameter.example ?? parameter.schema.default ?? "");
        }
      }
    }
  }

  return vars;
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

export { generateEnvironmentBru, collectEnvironmentVars, extractBaseUrl, generateAuthVars };
export type { EnvironmentVariableOptions };
