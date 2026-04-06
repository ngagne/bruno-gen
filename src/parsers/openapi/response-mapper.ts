import type { ResponseIR } from "../../ir/index.js";
import { mapSchema } from "./schema-mapper.js";

/**
 * Map OpenAPI responses to ResponseIR[].
 */
export function mapResponses(responses: Record<string, unknown> | undefined): ResponseIR[] {
  if (!responses || typeof responses !== "object") {
    return [];
  }

  const result: ResponseIR[] = [];

  for (const [statusCode, responseObj] of Object.entries(responses)) {
    const response = responseObj as Record<string, unknown>;

    // Skip $ref placeholders
    if (response.$ref && !response.description) {
      continue;
    }

    const content: Record<string, unknown> = {};

    if (response.content && typeof response.content === "object") {
      for (const [mediaType, mediaTypeObj] of Object.entries(response.content)) {
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

    const headers: Record<string, unknown> = {};
    if (response.headers && typeof response.headers === "object") {
      for (const [headerName, headerObj] of Object.entries(response.headers)) {
        const header = headerObj as Record<string, unknown>;
        const schema = (header.schema as Record<string, unknown>) || {};
        headers[headerName] = {
          description: typeof header.description === "string" ? header.description : undefined,
          required: header.required === true,
          schema: mapSchema(schema),
        };
      }
    }

    result.push({
      statusCode,
      description: (response.description as string) || "",
      headers,
      content,
      links: response.links as Record<string, unknown> | undefined,
    });
  }

  return result;
}
