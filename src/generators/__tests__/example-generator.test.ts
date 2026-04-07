import { describe, it, expect } from "vitest";
import { generateExample, generateExampleFields } from "../example-generator.js";
import type { SchemaIR } from "../../ir/index.js";

describe("example-generator", () => {
  describe("generateExample", () => {
    it("uses explicit example when provided", () => {
      const schema: SchemaIR = { type: "string", example: "test-value" };
      expect(generateExample(schema)).toBe("test-value");
    });

    it("uses default when no example", () => {
      const schema: SchemaIR = { type: "string", default: "default-value" };
      expect(generateExample(schema)).toBe("default-value");
    });

    it("uses first enum value", () => {
      const schema: SchemaIR = { type: "string", enum: ["active", "inactive"] };
      expect(generateExample(schema)).toBe("active");
    });

    it("generates string examples from format", () => {
      expect(generateExample({ type: "string", format: "email" })).toBe("user@example.com");
      expect(generateExample({ type: "string", format: "uuid" })).toBe(
        "00000000-0000-0000-0000-000000000000",
      );
      expect(generateExample({ type: "string", format: "date-time" })).toBe("2026-01-01T00:00:00Z");
      expect(generateExample({ type: "string", format: "uri" })).toBe("https://example.com");
    });

    it("generates placeholder string when no format", () => {
      expect(generateExample({ type: "string" })).toBe("string");
    });

    it("generates number examples from minimum", () => {
      expect(generateExample({ type: "integer", minimum: 1 })).toBe(1);
      expect(generateExample({ type: "number" })).toBe(0);
    });

    it("generates boolean example", () => {
      expect(generateExample({ type: "boolean" })).toBe(true);
    });

    it("generates array with one example item", () => {
      const schema: SchemaIR = { type: "array", items: { type: "string" } };
      expect(generateExample(schema)).toEqual(["string"]);
    });

    it("generates empty array when no items schema", () => {
      expect(generateExample({ type: "array" })).toEqual([]);
    });

    it("generates object with properties", () => {
      const schema: SchemaIR = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "integer" },
        },
      };
      expect(generateExample(schema)).toEqual({ name: "string", age: 0 });
    });

    it("handles nullable schemas", () => {
      expect(generateExample({ type: "string", nullable: true })).toBe(null);
    });

    it("respects depth limit to prevent infinite recursion", () => {
      const recursiveSchema: SchemaIR = {
        type: "object",
        properties: {
          children: {
            type: "array",
            items: { type: "object" }, // Will hit depth limit
          },
        },
      };
      const result = generateExample(recursiveSchema);
      expect(result).toHaveProperty("children");
    });
  });

  describe("generateExampleFields", () => {
    it("extracts flat fields from object schema", () => {
      const schema: SchemaIR = {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
        },
      };
      const fields = generateExampleFields(schema);
      expect(fields).toHaveProperty("id", "$res.body.id");
      expect(fields).toHaveProperty("name", "$res.body.name");
    });

    it("extracts nested fields", () => {
      const schema: SchemaIR = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              id: { type: "integer" },
              name: { type: "string" },
            },
          },
        },
      };
      const fields = generateExampleFields(schema);
      expect(fields).toHaveProperty("user.id", "$res.body.user.id");
      expect(fields).toHaveProperty("user.name", "$res.body.user.name");
    });

    it("returns empty for non-object schemas", () => {
      expect(generateExampleFields({ type: "string" })).toEqual({});
      expect(generateExampleFields({ type: "array" })).toEqual({});
    });
  });
});
