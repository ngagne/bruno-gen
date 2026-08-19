import { describe, it, expect } from "vitest";
import { detectFormat } from "./auto-detector.js";

describe("auto-detector", () => {
  it("detects OpenAPI from content field", () => {
    expect(detectFormat({ openapi: "3.0.0" })).toBe("openapi");
    expect(detectFormat({ openapi: "3.1.0" })).toBe("openapi");
  });

  it("detects Swagger from content field", () => {
    expect(detectFormat({ swagger: "2.0" })).toBe("swagger");
  });

  it("detects AsyncAPI from content field", () => {
    expect(detectFormat({ asyncapi: "3.0.0" })).toBe("asyncapi");
  });

  it("detects GraphQL from file extension", () => {
    expect(detectFormat({}, "schema.graphql")).toBe("graphql");
    expect(detectFormat({}, "schema.gql")).toBe("graphql");
  });

  it("detects GraphQL from content inspection", () => {
    const data = { _raw: "type Query { users: [User] }" };
    expect(detectFormat(data as Record<string, unknown>)).toBe("graphql");
  });

  it("returns unknown for unrecognized formats", () => {
    expect(detectFormat({})).toBe("unknown");
    expect(detectFormat({ random: "data" })).toBe("unknown");
  });

  it("prioritizes extension over content", () => {
    // .graphql extension should win even with no GraphQL content
    expect(detectFormat({}, "file.graphql")).toBe("graphql");
  });

  it("prioritizes content field over extension for OpenAPI/Swagger", () => {
    expect(detectFormat({ openapi: "3.0.0" }, "file.json")).toBe("openapi");
    expect(detectFormat({ swagger: "2.0" }, "file.yaml")).toBe("swagger");
  });
});
