/**
 * Generate Bruno post-response test assertion blocks from ResponseIR.
 *
 * Assertion tiers:
 * 1. Status code assertion for 2xx responses
 * 2. Required fields presence assertions
 * 3. Example value bonus assertions when spec provides examples
 *
 * Rules:
 * - Only generate for 2xx responses (success responses)
 * - Only generate for responses with JSON content type
 * - If no required fields and no example, generate status-only assertion
 */

import type { ResponseIR } from "../ir/index.js";

/**
 * Generate a complete Bruno tests block for all responses.
 * Returns empty string if no eligible responses found.
 */
function generatePostResponseTests(responses: ResponseIR[]): string {
  const testSections: string[] = [];

  for (const response of responses) {
    const statusCode = response.statusCode;

    // Only 2xx responses
    if (!isSuccessStatus(statusCode)) {
      continue;
    }

    // Only JSON content type
    const jsonMediaType = findJsonMediaType(response);
    if (!jsonMediaType) {
      continue;
    }

    const assertions = generateAssertions(response, jsonMediaType);
    if (assertions.length === 0) {
      continue;
    }

    // Build a Bruno test for this response.
    const statusLabel = response.description ? `${statusCode} ${response.description}` : statusCode;
    testSections.push(`test("${escapeQuotes(statusLabel)}", function() {`);
    testSections.push(...assertions.map((assertion) => `  ${assertion}`));
    testSections.push("});");
  }

  if (testSections.length === 0) {
    return "";
  }

  return formatBlock("tests", testSections.join("\n"));
}

/**
 * Generate individual assertions for a single response.
 */
function generateAssertions(
  response: ResponseIR,
  mediaType: NonNullable<ReturnType<typeof findJsonMediaType>>,
): string[] {
  const assertions: string[] = [];

  // Tier 1: Status code assertion
  assertions.push(
    `expect(res.status).to.equal(${response.statusCode}, "expected status ${response.statusCode}");`,
  );

  // Tier 2: Required fields presence
  const requiredFields = getRequiredFields(mediaType);
  for (const field of requiredFields) {
    assertions.push(
      `expect(res.body).to.have.property("${escapeQuotes(field)}", "required field '${escapeQuotes(field)}' missing");`,
    );
  }

  // Tier 3: Example value assertions
  const exampleAssertions = generateExampleAssertions(response, mediaType);
  assertions.push(...exampleAssertions);

  return assertions;
}

/**
 * Generate example value assertions when spec provides response examples.
 * Picks the first example field for a bonus assertion.
 */
function generateExampleAssertions(
  response: ResponseIR,
  mediaType: NonNullable<ReturnType<typeof findJsonMediaType>>,
): string[] {
  const assertions: string[] = [];

  // Check for explicit example value
  if (
    mediaType.example !== undefined &&
    typeof mediaType.example === "object" &&
    mediaType.example !== null
  ) {
    const firstKey = Object.keys(mediaType.example as Record<string, unknown>)[0];
    if (firstKey) {
      const exampleValue = (mediaType.example as Record<string, unknown>)[firstKey];
      assertions.push(
        `expect(res.body.${firstKey}).to.equal(${formatExpectedValue(exampleValue)}, "expected example value '${escapeQuotes(String(exampleValue))}'");`,
      );
    }
  }

  // Check for named examples
  if (!mediaType.example && mediaType.examples) {
    const firstExample = Object.values(mediaType.examples)[0];
    if (
      firstExample?.value !== undefined &&
      typeof firstExample.value === "object" &&
      firstExample.value !== null
    ) {
      const firstKey = Object.keys(firstExample.value as Record<string, unknown>)[0];
      if (firstKey) {
        const exampleValue = (firstExample.value as Record<string, unknown>)[firstKey];
        assertions.push(
          `expect(res.body.${firstKey}).to.equal(${formatExpectedValue(exampleValue)}, "expected example value '${escapeQuotes(String(exampleValue))}'");`,
        );
      }
    }
  }

  return assertions;
}

/**
 * Check if a status code is a 2xx success code.
 */
function isSuccessStatus(statusCode: string): boolean {
  const numeric = parseInt(statusCode, 10);
  return numeric >= 200 && numeric < 300;
}

/**
 * Find the first JSON media type in the response content.
 */
function findJsonMediaType(response: ResponseIR): {
  schema: unknown;
  example?: unknown;
  examples?: Record<string, { summary?: string; description?: string; value: unknown }>;
} | null {
  if (!response.content) {
    return null;
  }

  for (const [contentType, mediaType] of Object.entries(response.content)) {
    if (contentType.includes("application/json") || contentType.includes("+json")) {
      return mediaType;
    }
  }

  return null;
}

/**
 * Get required field names from the media type schema.
 */
function getRequiredFields(mediaType: { schema: unknown }): string[] {
  const schema = mediaType.schema as { required?: string[] } | undefined;
  if (schema?.required && Array.isArray(schema.required)) {
    return schema.required.filter((f): f is string => typeof f === "string");
  }
  return [];
}

/**
 * Format a JavaScript value as a Bruno test expectation literal.
 */
function formatExpectedValue(value: unknown): string {
  if (typeof value === "string") {
    return `"${escapeQuotes(value)}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null) {
    return "null";
  }
  return JSON.stringify(value);
}

/**
 * Escape double quotes in a string.
 */
function escapeQuotes(str: string): string {
  return str.replace(/"/g, '\\"');
}

/**
 * Format assertions into a Bruno post-response block.
 */
function formatBlock(type: string, content: string): string {
  return `${type} {\n${content}\n}`;
}

export {
  generatePostResponseTests,
  generateAssertions,
  isSuccessStatus,
  findJsonMediaType,
  getRequiredFields,
  formatExpectedValue,
};
