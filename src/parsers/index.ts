// Parser layer entry point — re-exports all parser types and functions.

// SpecParser interface and types
export type { SpecParser, ParseOptions, SpecInput } from "./types.js";

// Unified parse and validate functions
export { parse, validate } from "./parse.js";

// Individual parsers
export { OpenApiParser } from "./openapi/OpenApiParser.js";
export { SwaggerParser } from "./swagger/SwaggerParser.js";
export { GraphQLParser } from "./graphql/GraphQLParser.js";
export { DirectoryParser } from "./graphql/DirectoryParser.js";
export { GrpcParser } from "./grpc/GrpcParser.js";
export { AsyncApiParser } from "./asyncapi/AsyncApiParser.js";

// Utilities
export { detectFormat } from "./utils/auto-detector.js";
export { loadSpec } from "./utils/spec-loader.js";
export { validateOpenAPI, validateGraphQL } from "./utils/spec-validator.js";
export {
  isInternalRef,
  isFileRef,
  isRemoteRef,
  resolveRefPath,
  extractRefName,
} from "./utils/ref-utils.js";
