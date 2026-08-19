import type { CollectionIR } from "../ir/collection.js";
import type { ValidationResult } from "../ir/validation.js";

/** Input to a parser — either a file path or raw content string. */
export type SpecInput =
  | { filePath: string }
  | { content: string; format?: "openapi" | "swagger" | "graphql" | "grpc" };

/** Options for parsing a spec. */
export interface ParseOptions {
  /** Skip validation checks. Default: false. */
  skipValidation?: boolean;
  /** Warn on unsupported features instead of failing. Default: true. */
  warnOnUnsupported?: boolean;
}

/** Interface all spec parsers must implement. */
export interface SpecParser {
  /** Check if this parser can handle the given spec data. */
  canParse(data: Record<string, unknown>): boolean;

  /** Parse the spec and return the CollectionIR. */
  parse(input: SpecInput): Promise<CollectionIR>;

  /** Validate the spec and return validation result. */
  validate(input: SpecInput): Promise<ValidationResult>;
}
