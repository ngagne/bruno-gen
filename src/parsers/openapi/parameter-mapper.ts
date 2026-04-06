import type { ParameterIR, ParameterLocation } from "../../ir/index.js";
import { mapSchema } from "./schema-mapper.js";

/**
 * Map OpenAPI parameters to ParameterIR[].
 * Handles path-level and operation-level parameters.
 */
export function mapParameters(parameters: Record<string, unknown>[]): ParameterIR[] {
  return parameters
    .filter((p) => {
      // Filter out $ref placeholders (should be resolved already)
      return !p.$ref || typeof p.schema === "object";
    })
    .map((param) => {
      const location = (param.in as ParameterLocation) || "query";
      const schema = (param.schema as Record<string, unknown>) || {};

      return {
        name: (param.name as string) || "unknown",
        in: location,
        required: param.required === true,
        description: typeof param.description === "string" ? param.description : undefined,
        deprecated: param.deprecated === true,
        schema: mapSchema(schema),
        example: param.example,
        examples: param.examples as Record<string, unknown> | undefined,
      };
    });
}

/**
 * Merge path-level and operation-level parameters.
 * Operation-level parameters override path-level ones with the same name+in.
 */
export function mergeParameters(pathParams: ParameterIR[], opParams: ParameterIR[]): ParameterIR[] {
  const merged = [...pathParams];

  for (const opParam of opParams) {
    const existingIndex = merged.findIndex((p) => p.name === opParam.name && p.in === opParam.in);
    if (existingIndex >= 0) {
      merged[existingIndex] = opParam; // Override
    } else {
      merged.push(opParam);
    }
  }

  return merged;
}
