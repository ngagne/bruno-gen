import type { CollectionIR } from "../ir/index.js";
import type { SpecInput, ParseOptions } from "./types.js";
import type { ValidationResult } from "../ir/validation.js";
import { loadSpec } from "./utils/spec-loader.js";
import { detectFormat } from "./utils/auto-detector.js";
import { OpenApiParser } from "./openapi/OpenApiParser.js";
import { SwaggerParser } from "./swagger/SwaggerParser.js";
import { GraphQLParser } from "./graphql/GraphQLParser.js";
import { DirectoryParser } from "./graphql/DirectoryParser.js";
import fs from "node:fs";

/**
 * Unified parse function — auto-detects format and parses.
 *
 * @param input - File path or inline content
 * @param options - Parse options
 * @returns CollectionIR
 */
export async function parse(
  input: SpecInput | string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options?: ParseOptions,
): Promise<CollectionIR> {
  // Normalize string input to SpecInput
  const specInput: SpecInput = typeof input === "string" ? { filePath: input } : input;

  // Check if input is a directory
  if ("filePath" in specInput && fs.existsSync(specInput.filePath)) {
    const stat = fs.statSync(specInput.filePath);
    if (stat.isDirectory()) {
      const dirParser = new DirectoryParser();
      return dirParser.parse({ dirPath: specInput.filePath });
    }
  }

  // Load spec if from file
  let data: Record<string, unknown>;

  if ("filePath" in specInput) {
    const loaded = loadSpec(specInput.filePath);
    data = loaded.data;
  } else {
    data = specInput.content as unknown as Record<string, unknown>;
  }

  // Auto-detect format
  const format = detectFormat(data, "filePath" in specInput ? specInput.filePath : undefined);

  // Route to appropriate parser
  switch (format) {
    case "openapi": {
      const parser = new OpenApiParser();
      return parser.parse(specInput);
    }
    case "swagger": {
      const parser = new SwaggerParser();
      return parser.parse(specInput);
    }
    case "graphql": {
      const parser = new GraphQLParser();
      return parser.parse(specInput);
    }
    default:
      throw new Error(`Unknown spec format. Could not detect OpenAPI, Swagger, or GraphQL.`);
  }
}

/**
 * Validate a spec — auto-detects format and validates.
 */
export async function validate(input: SpecInput | string): Promise<ValidationResult> {
  const specInput: SpecInput = typeof input === "string" ? { filePath: input } : input;

  if ("filePath" in specInput && fs.existsSync(specInput.filePath)) {
    const stat = fs.statSync(specInput.filePath);
    if (stat.isDirectory()) {
      const dirParser = new DirectoryParser();
      return dirParser.validate({ dirPath: specInput.filePath });
    }
  }

  let data: Record<string, unknown>;
  let source: string;

  if ("filePath" in specInput) {
    const loaded = loadSpec(specInput.filePath);
    data = loaded.data;
    source = loaded.source;
  } else {
    data = specInput.content as unknown as Record<string, unknown>;
    source = "inline";
  }

  const format = detectFormat(data, "filePath" in specInput ? specInput.filePath : undefined);

  switch (format) {
    case "openapi":
    case "swagger": {
      const { validateOpenAPI } = await import("./utils/spec-validator.js");
      return validateOpenAPI(data, source);
    }
    case "graphql": {
      if ("filePath" in specInput) {
        const fs = await import("node:fs");
        const content = fs.readFileSync(specInput.filePath, "utf-8");
        const { validateGraphQL } = await import("./utils/spec-validator.js");
        return validateGraphQL(content, source);
      } else {
        const { validateGraphQL } = await import("./utils/spec-validator.js");
        return validateGraphQL(specInput.content, source);
      }
    }
    default:
      return {
        valid: false,
        errors: [{ file: source, message: "Unknown spec format", code: "UNKNOWN_FORMAT" }],
        warnings: [],
      };
  }
}
