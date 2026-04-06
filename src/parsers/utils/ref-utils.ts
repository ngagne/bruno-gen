import path from "node:path";

/**
 * Check if a $ref is an internal reference (starts with #/).
 */
export function isInternalRef(ref: string): boolean {
  return ref.startsWith("#/");
}

/**
 * Check if a $ref is a file reference (relative or absolute path).
 */
export function isFileRef(ref: string): boolean {
  return !isInternalRef(ref) && !isRemoteRef(ref);
}

/**
 * Check if a $ref is a remote reference (http:// or https://).
 */
export function isRemoteRef(ref: string): boolean {
  return ref.startsWith("http://") || ref.startsWith("https://");
}

/**
 * Resolve a relative file $ref path relative to the spec file's directory.
 * Returns null for internal refs (#/...) and remote refs (https://...).
 *
 * @param ref - The $ref value (e.g., "./models/User.yaml", "../common/Error.yaml")
 * @param specFilePath - Absolute path to the spec file
 * @returns Absolute path to the referenced file, or null if not a file ref
 */
export function resolveRefPath(ref: string, specFilePath: string): string | null {
  if (isInternalRef(ref) || isRemoteRef(ref)) {
    return null;
  }

  const specDir = path.dirname(specFilePath);
  const resolved = path.resolve(specDir, ref);
  return resolved;
}

/**
 * Extract the schema name from a $ref path.
 * E.g., "#/components/schemas/User" → "User"
 *      "./models/User.yaml" → "User"
 */
export function extractRefName(ref: string): string | null {
  // Internal ref: #/components/schemas/User
  const internalMatch = ref.match(/#\/(?:components\/schemas|definitions)\/(.+)$/);
  if (internalMatch) {
    return internalMatch[1];
  }

  // File ref: ./models/User.yaml → User
  const fileMatch = ref.match(/\/([^/]+)\.(?:yaml|yml|json)$/);
  if (fileMatch) {
    return fileMatch[1];
  }

  return null;
}
