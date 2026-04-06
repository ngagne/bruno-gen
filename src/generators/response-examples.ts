/**
 * Generate response examples and post-response vars.
 * Extracts response examples from EndpointIR.responses.
 */

import type { ResponseIR } from "../ir/index.js";
import { generateExample, generateExampleFields } from "./example-generator.js";

/**
 * Generate markdown documentation with response examples.
 * Used inside the docs { } block of a request.bru file.
 * @param responses - Array of response IRs
 * @returns Markdown string with response examples
 */
function generateResponseDocs(responses: ResponseIR[]): string {
  if (!responses || responses.length === 0) {
    return "";
  }

  const sections: string[] = ["## Responses", ""];

  for (const response of responses) {
    const statusCode = response.statusCode;
    const description = response.description || "";

    sections.push(`### ${statusCode} ${description}`);
    sections.push("");

    // Generate examples for each media type
    for (const [mediaType, mediaTypeIR] of Object.entries(response.content)) {
      sections.push(`**Content-Type:** \`${mediaType}\``);
      sections.push("");

      if (mediaTypeIR.example) {
        sections.push("```json");
        sections.push(JSON.stringify(mediaTypeIR.example, null, 2));
        sections.push("```");
        sections.push("");
      } else if (mediaTypeIR.examples) {
        // Use first named example
        const firstExample = Object.values(mediaTypeIR.examples)[0];
        if (firstExample && firstExample.value !== undefined) {
          sections.push("```json");
          sections.push(JSON.stringify(firstExample.value, null, 2));
          sections.push("```");
          sections.push("");
        }
      } else if (mediaTypeIR.schema) {
        // Generate example from schema
        const generatedExample = generateExample(mediaTypeIR.schema);
        sections.push("```json");
        sections.push(JSON.stringify(generatedExample, null, 2));
        sections.push("```");
        sections.push("");
      }
    }
  }

  return sections.join("\n");
}

/**
 * Generate vars:post-response block extracting common response fields.
 * Only generates for successful (2xx) responses with object bodies.
 * @param responses - Array of response IRs
 * @returns Bruno vars:post-response block string
 */
function generatePostResponseVars(responses: ResponseIR[]): string {
  // Find first successful response (2xx)
  const successResponse = responses.find((r) => {
    const code = parseInt(r.statusCode, 10);
    return code >= 200 && code < 300;
  });

  if (!successResponse) {
    return "";
  }

  // Find first JSON media type
  const jsonMediaType = Object.values(successResponse.content).find(
    (mt) => mt.schema && (mt.schema.type === "object" || mt.example)
  );

  if (!jsonMediaType || !jsonMediaType.schema) {
    return "";
  }

  // Extract example or generate from schema
  let exampleData: unknown;
  if (jsonMediaType.example) {
    exampleData = jsonMediaType.example;
  } else if (jsonMediaType.examples) {
    const firstExample = Object.values(jsonMediaType.examples)[0];
    exampleData = firstExample?.value;
  } else {
    exampleData = generateExample(jsonMediaType.schema);
  }

  // Only generate vars for object responses
  if (typeof exampleData !== "object" || exampleData === null || Array.isArray(exampleData)) {
    return "";
  }

  // Extract top-level fields
  const fields = generateExampleFields(jsonMediaType.schema);
  const varKeys = Object.keys(fields);

  if (varKeys.length === 0) {
    return "";
  }

  const lines = varKeys.map((key) => `  ${key}: $res.body.${key}`);
  return `vars:post-response {\n${lines.join("\n")}\n}`;
}

export { generateResponseDocs, generatePostResponseVars };
