import { describe, expect, it } from "vitest";
import { validateGraphQL, validateOpenAPI } from "./spec-validator.js";

describe("spec validation", () => {
  it("validates valid and invalid OpenAPI input", async () => {
    expect(
      (
        await validateOpenAPI(
          { openapi: "3.0.0", info: { title: "API", version: "1" }, paths: {} },
          "api.yaml",
        )
      ).valid,
    ).toBe(true);
    const result = await validateOpenAPI({ openapi: "3.0.0", info: {}, paths: {} }, "broken.yaml");
    expect(result).toMatchObject({
      valid: false,
      errors: [expect.objectContaining({ file: "broken.yaml", code: "OPENAPI_VALIDATION_ERROR" })],
    });
  });

  it("reports GraphQL syntax errors and accepts valid schemas", () => {
    expect(validateGraphQL("type Query { ping: String! }", "schema.graphql").valid).toBe(true);
    expect(validateGraphQL("type Query {", "schema.graphql")).toMatchObject({
      valid: false,
      errors: [expect.objectContaining({ code: "GRAPHQL_PARSE_ERROR" })],
    });
  });
});
