/**
 * Auto-detect the format of a spec based on file extension and content inspection.
 */

import path from "node:path";

export type SpecFormat = "openapi" | "swagger" | "graphql" | "unknown";

/**
 * Detect the spec format from file extension and/or content.
 *
 * Priority: file extension → content fields → content inspection
 *
 * @param data - Parsed spec object (for content inspection)
 * @param filePath - Optional file path (for extension-based detection)
 * @returns Detected format
 */
export function detectFormat(data: Record<string, unknown>, filePath?: string): SpecFormat {
  // Step 1: Check file extension
  if (filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".graphql" || ext === ".gql") {
      return "graphql";
    }
  }

  // Step 2: Check content fields
  if (typeof data.openapi === "string") {
    const version = data.openapi as string;
    if (version.startsWith("3.")) {
      return "openapi";
    }
  }

  if (typeof data.swagger === "string") {
    if (data.swagger === "2.0") {
      return "swagger";
    }
  }

  // Step 3: Content inspection for GraphQL SDL
  if (isGraphQLSdl(data)) {
    return "graphql";
  }

  return "unknown";
}

/**
 * Check if the data looks like GraphQL SDL (string content with GraphQL syntax).
 */
function isGraphQLSdl(data: Record<string, unknown>): boolean {
  // If data is a string (raw SDL content), check for GraphQL syntax
  if (typeof data === "string" || typeof (data as Record<string, unknown>)._raw === "string") {
    const content =
      typeof data === "string" ? data : ((data as Record<string, unknown>)._raw as string);
    return looksLikeGraphQLSdl(content);
  }

  // If data has a `content` or `sdl` field, check that
  for (const key of ["content", "sdl", "_raw"]) {
    if (typeof (data as Record<string, unknown>)[key] === "string") {
      const content = (data as Record<string, unknown>)[key] as string;
      if (looksLikeGraphQLSdl(content)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a string looks like GraphQL SDL.
 */
function looksLikeGraphQLSdl(content: string): boolean {
  const graphqlPatterns = [
    /\btype\s+Query\b/i,
    /\btype\s+Mutation\b/i,
    /\btype\s+Subscription\b/i,
    /\bscalar\s+\w+/i,
    /\binterface\s+\w+/i,
    /\benum\s+\w+/i,
    /\bunion\s+\w+/i,
    /\binput\s+\w+/i,
  ];

  return graphqlPatterns.some((pattern) => pattern.test(content));
}
