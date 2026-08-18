import { describe, expect, it } from "vitest";
import { generateGraphQLBody } from "../graphql-generator.js";

describe("graphql-generator", () => {
  it("renders an argument-free scalar operation without a variables block", () => {
    const result = generateGraphQLBody({
      operationType: "query",
      operationName: "ping",
      arguments: [],
      returnType: { type: "string" },
      directives: [],
    });

    expect(result).toContain("query ping {");
    expect(result).toContain("ping");
    expect(result).not.toContain("body:graphql:vars");
  });

  it("infers variable types for legacy caller-supplied metadata", () => {
    const result = generateGraphQLBody({
      operationType: "query",
      operationName: "search",
      arguments: [
        { name: "count", type: { type: "integer" }, directives: [] },
        { name: "ratio", type: { type: "number" }, directives: [] },
        { name: "enabled", type: { type: "boolean" }, directives: [] },
        { name: "filter", type: { type: "object", title: "Filter" }, directives: [] },
        { name: "ids", type: { type: "array", items: { format: "id" } }, directives: [] },
        { name: "name", type: { type: "string" }, defaultValue: "all", directives: [] },
      ],
      returnType: { type: "object" },
      directives: [],
    });

    expect(result).toContain("$count: Int, $ratio: Float, $enabled: Boolean, $filter: Filter");
    expect(result).toContain("$ids: [ID], $name: String");
    expect(result).toContain('"name": "all"');
    expect(result).toContain("search(count: $count, ratio: $ratio, enabled: $enabled");
    expect(result).toContain("{ __typename }");
  });
});
