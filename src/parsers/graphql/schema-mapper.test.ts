import { buildSchema } from "graphql";
import { describe, expect, it } from "vitest";
import {
  mapGraphQLOutputTypeToSchema,
  mapGraphQLTypeToSchema,
  mapGraphQLTypeToSchemaField,
} from "./schema-mapper.js";

describe("GraphQL schema mapper", () => {
  const schema = buildSchema(`
    scalar DateTime
    interface Node { id: ID! }
    type User implements Node { id: ID!, name: String, scores: [Float!]! }
    input Filter { required: Int!, optional: Boolean }
    union SearchResult = User
    enum Role { ADMIN USER }
    type Query { user(filter: Filter): User }
  `);
  const getType = (name: string) => {
    const type = schema.getType(name);
    if (!type) throw new Error(`Missing test type: ${name}`);
    return type;
  };

  it("maps each supported named GraphQL type", () => {
    expect(mapGraphQLTypeToSchema(getType("DateTime"))).toEqual({
      type: "string",
      format: "custom-scalar-datetime",
    });
    expect(mapGraphQLTypeToSchema(getType("User"))).toMatchObject({
      type: "object",
      title: "User",
      required: ["id", "scores"],
      properties: { scores: { type: "array", items: { type: "number" } } },
    });
    expect(mapGraphQLTypeToSchema(getType("Filter"))).toMatchObject({
      type: "object",
      title: "Filter",
      required: ["required"],
    });
    expect(mapGraphQLTypeToSchema(getType("Node"))).toMatchObject({
      type: "object",
      title: "Node",
    });
    expect(mapGraphQLTypeToSchema(getType("SearchResult"))).toEqual({
      oneOf: [expect.objectContaining({ title: "User" })],
    });
    expect(mapGraphQLTypeToSchema(getType("Role"))).toMatchObject({
      type: "string",
      enum: ["ADMIN", "USER"],
      title: "Role",
    });
  });

  it("unwraps non-null and list field types and maps output types", () => {
    const user = getType("User");
    if (!("getFields" in user)) throw new Error("User must have fields");
    const scores = user.getFields().scores;
    if (!scores) throw new Error("User must have scores");
    expect(mapGraphQLTypeToSchemaField(scores.type)).toEqual({
      type: "array",
      items: { type: "number" },
    });
    expect(mapGraphQLOutputTypeToSchema(scores.type)).toEqual({
      type: "array",
      items: { type: "number" },
    });
  });
});
