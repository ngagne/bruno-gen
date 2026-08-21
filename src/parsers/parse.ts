import type { CollectionIR } from "../ir/index.js";
import type { ValidationResult } from "../ir/validation.js";
import { AsyncApiParser } from "./asyncapi/AsyncApiParser.js";
import { DirectoryParser } from "./graphql/DirectoryParser.js";
import { GraphQLParser } from "./graphql/GraphQLParser.js";
import { GrpcParser } from "./grpc/GrpcParser.js";
import { OpenApiParser } from "./openapi/OpenApiParser.js";
import { SwaggerParser } from "./swagger/SwaggerParser.js";
import type { ParseOptions, SpecInput } from "./types.js";
import { detectFormat, type SpecFormat } from "./utils/auto-detector.js";
import { loadSpec } from "./utils/spec-loader.js";
import fs from "node:fs";
import path from "node:path";

interface ParserAction {
  parse(): Promise<CollectionIR>;
  validate(): Promise<ValidationResult>;
}

const parsers: Record<Exclude<SpecFormat, "unknown">, (input: SpecInput) => ParserAction> = {
  openapi: (input) => bindParser(new OpenApiParser(), input),
  swagger: (input) => bindParser(new SwaggerParser(), input),
  graphql: (input) => bindParser(new GraphQLParser(), input),
  grpc: (input) => bindParser(new GrpcParser(), input),
  asyncapi: (input) => bindParser(new AsyncApiParser(), input),
};

/** Unified parse function — resolves the input once, then delegates to its parser. */
export async function parse(
  input: SpecInput | string,
  _options?: ParseOptions,
): Promise<CollectionIR> {
  // Kept for backwards-compatible callers while parser-specific options are introduced.
  void _options;
  return (await resolveParserAction(input)).parse();
}

/** Validate a spec using the same input resolution and parser selection as parse(). */
export async function validate(input: SpecInput | string): Promise<ValidationResult> {
  try {
    return (await resolveParserAction(input)).validate();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unknown spec format.")) {
      const specInput = normalizeInput(input);
      return {
        valid: false,
        errors: [
          {
            file: "filePath" in specInput ? specInput.filePath : "inline",
            message: "Unknown spec format",
            code: "UNKNOWN_FORMAT",
          },
        ],
        warnings: [],
      };
    }
    throw error;
  }
}

async function resolveParserAction(input: SpecInput | string): Promise<ParserAction> {
  const specInput = normalizeInput(input);

  if ("filePath" in specInput && fs.existsSync(specInput.filePath)) {
    if (fs.statSync(specInput.filePath).isDirectory()) {
      const parser = new DirectoryParser();
      return {
        parse: () => parser.parse({ dirPath: specInput.filePath }),
        validate: () => parser.validate({ dirPath: specInput.filePath }),
      };
    }

    const extensionFormat = formatFromExtension(specInput.filePath);
    if (extensionFormat) return createParserAction(extensionFormat, specInput);
  }

  const format =
    ("content" in specInput ? specInput.format : undefined) ?? detectInputFormat(specInput);
  if (format === "unknown") {
    throw new Error(
      "Unknown spec format. Could not detect OpenAPI, Swagger, GraphQL, gRPC, or AsyncAPI.",
    );
  }
  return createParserAction(format, specInput);
}

function normalizeInput(input: SpecInput | string): SpecInput {
  return typeof input === "string" ? { filePath: input } : input;
}

function detectInputFormat(input: SpecInput): SpecFormat {
  if ("filePath" in input) {
    const { data } = loadSpec(input.filePath);
    return detectFormat(data, input.filePath);
  }
  return detectFormat(input.content as unknown as Record<string, unknown>);
}

function formatFromExtension(filePath: string): "graphql" | "grpc" | undefined {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".graphql" || extension === ".gql") return "graphql";
  if (extension === ".proto") return "grpc";
  return undefined;
}

function createParserAction(
  format: Exclude<SpecFormat, "unknown">,
  input: SpecInput,
): ParserAction {
  return parsers[format](input);
}

function bindParser(
  parser: {
    parse(input: SpecInput): Promise<CollectionIR>;
    validate(input: SpecInput): Promise<ValidationResult>;
  },
  input: SpecInput,
): ParserAction {
  return {
    parse: () => parser.parse(input),
    validate: () => parser.validate(input),
  };
}
