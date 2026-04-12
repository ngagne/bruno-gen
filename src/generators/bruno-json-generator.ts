/**
 * Generates bruno.json collection manifest.
 *
 * bruno.json is required for a valid Bruno collection. It contains
 * collection-level configuration for scripting and advanced settings.
 */

import type { CollectionIR } from "../ir/index.js";

/** Bruno collection manifest schema. */
interface BrunoJson {
  /** Collection type */
  type: "collection";
  /** Collection name — displayed in Bruno UI */
  name: string;
  /** Collection version */
  version: string;
  /** Collection description (optional) */
  description?: string;
  /** Script execution settings */
  scripts?: {
    /** Node.js modules allowed in Bruno's sandboxed scripts */
    moduleWhitelist?: string[];
    /** File system permissions for scripts */
    filesystemAccess?: {
      allow: boolean;
    };
    /** Relative paths to directories whitelisted for script access */
    additionalContextRoots?: string[];
  };
}

/**
 * Generate bruno.json content from CollectionIR.
 * @param ir - The collection IR
 * @returns JSON string for bruno.json
 */
function generateBrunoJson(ir: CollectionIR): string {
  const brunoJson: BrunoJson = {
    type: "collection",
    name: ir.info.title,
    // Bruno's schema requires the literal string "1" for the version field.
    // This is the Bruno collection format version, not the API version.
    version: "1",
  };

  // Add description if available
  if (ir.info.description) {
    brunoJson.description = ir.info.description;
  }

  // Add scripts configuration with sensible defaults
  // Scripts are disabled by default for security
  brunoJson.scripts = {
    filesystemAccess: {
      allow: false,
    },
  };

  return JSON.stringify(brunoJson, null, 2) + "\n";
}

export { generateBrunoJson };
export type { BrunoJson };
