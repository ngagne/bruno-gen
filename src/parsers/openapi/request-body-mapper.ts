import type { RequestBodyIR } from "../../ir/index.js";
import { mapSchema } from "./schema-mapper.js";

/**
 * Map OpenAPI requestBody to RequestBodyIR.
 */
export function mapRequestBody(
  requestBody: Record<string, unknown> | undefined,
): RequestBodyIR | undefined {
  if (!requestBody || typeof requestBody !== "object") {
    return undefined;
  }

  // Check for $ref — should be resolved already
  if (requestBody.$ref && typeof requestBody.content !== "object") {
    return undefined;
  }

  const content: Record<string, unknown> = {};

  if (requestBody.content && typeof requestBody.content === "object") {
    for (const [mediaType, mediaTypeObj] of Object.entries(requestBody.content)) {
      const media = mediaTypeObj as Record<string, unknown>;
      const schema = (media.schema as Record<string, unknown>) || {};

      content[mediaType] = {
        schema: mapSchema(schema),
        example: media.example,
        examples: media.examples as Record<string, unknown> | undefined,
        encoding: media.encoding as Record<string, unknown> | undefined,
      };
    }
  }

  if (Object.keys(content).length === 0) {
    return undefined;
  }

  return {
    description: typeof requestBody.description === "string" ? requestBody.description : undefined,
    required: requestBody.required === true,
    content,
  };
}
