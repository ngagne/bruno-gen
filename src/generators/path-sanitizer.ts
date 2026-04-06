/**
 * Convert operationId or method+path to safe filesystem filename.
 * Handles special characters, spaces, reserved words, and ensures uniqueness.
 */

import type { EndpointIR } from "../ir/index.js";

// Windows reserved words that cannot be used as filenames
const RESERVED_WORDS = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

/**
 * Core sanitization: remove/replace unsafe chars, collapse separators.
 */
function sanitizeName(raw: string): string {
  let result = raw
    // Replace URL-specific characters
    .replace(/[?#&=:]/g, "-")
    // Remove braces
    .replace(/[{}]/g, "")
    // Replace spaces and slashes with dashes
    .replace(/[/\\ ]/g, "-")
    // Replace any remaining non-alphanumeric chars (except dashes and dots)
    .replace(/[^a-zA-Z0-9\-.]/g, "-")
    // Collapse multiple dashes
    .replace(/-+/g, "-")
    // Trim leading/trailing dashes
    .replace(/^-+|-+$/g, "")
    // Lowercase for consistency
    .toLowerCase();

  // Handle Windows reserved words
  if (RESERVED_WORDS.has(result)) {
    result = `_${result}`;
  }

  return result;
}

/**
 * Convert an endpoint identifier to a safe .bru filename.
 * @param endpoint - The endpoint to generate a filename for
 * @param usedNames - Set of already-used filenames (for deduplication)
 * @returns A safe .bru filename (e.g., "get-users-id.bru")
 */
function sanitizeRequestFilename(
  endpoint: EndpointIR,
  usedNames: Set<string> = new Set<string>()
): string {
  // Try operationId first, fall back to method-path
  const rawName = endpoint.id || `${endpoint.method}-${endpoint.path}`;

  let filename = sanitizeName(rawName);

  // Ensure .bru extension
  if (!filename.endsWith(".bru")) {
    filename = `${filename}.bru`;
  }

  // Handle duplicates
  if (usedNames.has(filename)) {
    const baseName = filename.replace(/\.bru$/, "");
    let counter = 2;
    let newName = `${baseName}_${counter}.bru`;
    while (usedNames.has(newName)) {
      counter++;
      newName = `${baseName}_${counter}.bru`;
    }
    filename = newName;
  }

  usedNames.add(filename);
  return filename;
}

/**
 * Convert a tag name to a safe directory name.
 * @param tag - The tag name to sanitize
 * @returns A safe directory name (e.g., "users-api")
 */
function sanitizeFolderName(tag: string): string {
  return sanitizeName(tag);
}

export { sanitizeRequestFilename, sanitizeFolderName, sanitizeName, RESERVED_WORDS };
