/**
 * Public API for the Bruno generator layer.
 * Re-exports the main generate() function and types.
 */

export { generate } from "./orchestrator.js";
export type { GenerateOptions, GenerateResult } from "./orchestrator.js";

// Sub-generator functions (for advanced usage and testing)
export { generateCollectionBru } from "./collection-generator.js";
export type { CollectionBruOptions } from "./collection-generator.js";

export {
  generateEnvironmentBru,
  extractBaseUrl,
  generateAuthVars,
} from "./environment-generator.js";

export { generateBrunoJson } from "./bruno-json-generator.js";
export type { BrunoJson } from "./bruno-json-generator.js";

export { generateFolderGroups, generateFolderBru } from "./folder-generator.js";
export type { FolderGroup } from "./folder-generator.js";

export { generateRequestBru } from "./request-generator.js";
export type { RequestBruOptions } from "./request-generator.js";

export { generateAuthBlock, generateAuthMode, generateAuthVarNames } from "./auth-generator.js";

export { generateResponseDocs, generatePostResponseVars } from "./response-examples.js";

export { generateExample, generateExampleFields } from "./example-generator.js";

export { sanitizeRequestFilename, sanitizeFolderName, sanitizeName } from "./path-sanitizer.js";

export {
  serializeValue,
  escapeKey,
  formatBlock,
  formatBlockWithContent,
  formatMultiline,
  formatComment,
  formatDisabledField,
  formatLocalVar,
} from "./bru-serializer.js";

export { ensureDir, writeBruFile, prepareOutputDir, readBruFile } from "./file-writer.js";
export type { WriteResult } from "./file-writer.js";
