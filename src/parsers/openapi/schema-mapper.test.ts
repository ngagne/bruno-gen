import { describe, expect, it } from "vitest";
import { mapSchema } from "./schema-mapper.js";

describe("mapSchema", () => {
  it("maps scalar metadata, constraints, and references", () => {
    expect(
      mapSchema(
        {
          type: ["string", "null"],
          format: "email",
          title: "Email",
          description: "A contact address",
          readOnly: true,
          writeOnly: true,
          deprecated: true,
          enum: ["work", "home"],
          default: "work",
          example: "me@example.com",
          minLength: 3,
          maxLength: 254,
          pattern: ".+@.+",
        },
        "#/components/schemas/Email",
      ),
    ).toMatchObject({
      $ref: "#/components/schemas/Email",
      resolvedName: "Email",
      type: "string",
      nullable: true,
      format: "email",
      title: "Email",
      description: "A contact address",
      readOnly: true,
      writeOnly: true,
      deprecated: true,
      enum: ["work", "home"],
      default: "work",
      example: "me@example.com",
      minLength: 3,
      maxLength: 254,
      pattern: ".+@.+",
    });
  });

  it("maps numeric, array, object, composition, and discriminator forms", () => {
    expect(
      mapSchema({
        type: "object",
        nullable: true,
        minimum: 1,
        maximum: 10,
        exclusiveMinimum: 1,
        exclusiveMaximum: true,
        multipleOf: 2,
        properties: { tags: { type: "array", items: { type: "integer" } } },
        required: ["tags"],
        additionalProperties: { type: "string" },
        minProperties: 1,
        maxProperties: 3,
        allOf: [{ type: "string" }],
        oneOf: [{ type: "number" }],
        anyOf: [{ type: "boolean" }],
        discriminator: { propertyName: "kind", mapping: { cat: "#/Cat" } },
      }),
    ).toMatchObject({
      type: "object",
      nullable: true,
      minimum: 1,
      maximum: 10,
      exclusiveMinimum: 1,
      exclusiveMaximum: true,
      multipleOf: 2,
      properties: { tags: { type: "array", items: { type: "integer" } } },
      required: ["tags"],
      additionalProperties: { type: "string" },
      minProperties: 1,
      maxProperties: 3,
      allOf: [{ type: "string" }],
      oneOf: [{ type: "number" }],
      anyOf: [{ type: "boolean" }],
      discriminator: { propertyName: "kind", mapping: { cat: "#/Cat" } },
    });
  });

  it("preserves false and zero constraints and uses the default discriminator name", () => {
    expect(
      mapSchema({
        minItems: 0,
        maxItems: 0,
        uniqueItems: false,
        additionalProperties: false,
        discriminator: {},
      }),
    ).toMatchObject({
      minItems: 0,
      maxItems: 0,
      uniqueItems: false,
      additionalProperties: false,
      discriminator: { propertyName: "discriminator" },
    });
  });

  it("returns an empty schema for invalid input", () => {
    expect(mapSchema(null as unknown as Record<string, unknown>)).toEqual({});
  });
});
