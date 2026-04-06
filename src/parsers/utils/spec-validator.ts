import SwaggerParser from "@apidevtools/swagger-parser";
import { parse as gqlParse, buildSchema, validateSchema } from "graphql";
import type { ValidationError, ValidationResult, Warning } from "../../ir/validation.js";

/**
 * Validate an OpenAPI or Swagger spec using swagger-parser.
 */
export async function validateOpenAPI(
  data: Record<string, unknown>,
  source: string,
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: Warning[] = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await SwaggerParser.validate(data as any);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Try to extract line/column info from error message
    const lineMatch = message.match(/line\s+(\d+)/i);
    const colMatch = message.match(/column\s+(\d+)/i);

    errors.push({
      file: source,
      line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
      column: colMatch ? parseInt(colMatch[1], 10) : undefined,
      message,
      code: "OPENAPI_VALIDATION_ERROR",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a GraphQL SDL string.
 */
export function validateGraphQL(sdl: string, source: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: Warning[] = [];

  try {
    // Parse the SDL first to catch syntax errors
    gqlParse(sdl);

    // Build schema and validate
    const schema = buildSchema(sdl, { assumeValid: true });
    const validationErrors = validateSchema(schema);

    for (const err of validationErrors) {
      // Skip errors that are just warnings (assumeValid swallows some)
      if (err.message.includes("Unknown type")) {
        errors.push({
          file: source,
          message: err.message,
          code: "GRAPHQL_VALIDATION_ERROR",
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push({
      file: source,
      message,
      code: "GRAPHQL_PARSE_ERROR",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
