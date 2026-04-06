import type { SchemaIR, SchemaType } from "../../ir/index.js";

/**
 * Map an OpenAPI 3.x Schema Object to SchemaIR.
 * Handles recursive mapping of nested schemas (properties, items, allOf, etc.).
 */
export function mapSchema(schema: Record<string, unknown>, $ref?: string): SchemaIR {
  if (!schema || typeof schema !== "object") {
    return {};
  }

  const ir: SchemaIR = {};

  // Track reference info
  if ($ref) {
    ir.$ref = $ref;
    ir.resolvedName = extractComponentName($ref);
  }

  // Type handling (OpenAPI 3.1 allows type as array, e.g. ["string", "null"])
  if (schema.type) {
    if (Array.isArray(schema.type)) {
      const types = schema.type as SchemaType[];
      const hasNull = types.includes("null" as SchemaType);
      const nonNullTypes = types.filter((t) => t !== "null");
      if (hasNull) {
        ir.nullable = true;
      }
      if (nonNullTypes.length === 1) {
        ir.type = nonNullTypes[0];
      } else if (nonNullTypes.length > 1) {
        ir.type = nonNullTypes[0]; // Take first non-null type
      }
    } else {
      ir.type = schema.type as SchemaType;
    }
  }

  // Format
  if (typeof schema.format === "string") {
    ir.format = schema.format;
  }

  // Metadata
  if (typeof schema.title === "string") {
    ir.title = schema.title;
  }
  if (typeof schema.description === "string") {
    ir.description = schema.description;
  }
  if (schema.nullable === true) {
    ir.nullable = true;
  }
  if (schema.readOnly === true) {
    ir.readOnly = true;
  }
  if (schema.writeOnly === true) {
    ir.writeOnly = true;
  }
  if (schema.deprecated === true) {
    ir.deprecated = true;
  }

  // Scalar values
  if (Array.isArray(schema.enum)) {
    ir.enum = schema.enum;
  }
  if ("default" in schema) {
    ir.default = schema.default;
  }
  if ("example" in schema) {
    ir.example = schema.example;
  }

  // String constraints
  if (typeof schema.minLength === "number") {
    ir.minLength = schema.minLength;
  }
  if (typeof schema.maxLength === "number") {
    ir.maxLength = schema.maxLength;
  }
  if (typeof schema.pattern === "string") {
    ir.pattern = schema.pattern;
  }

  // Numeric constraints
  if (typeof schema.minimum === "number") {
    ir.minimum = schema.minimum;
  }
  if (typeof schema.maximum === "number") {
    ir.maximum = schema.maximum;
  }
  if ("exclusiveMinimum" in schema) {
    ir.exclusiveMinimum = schema.exclusiveMinimum as number | boolean;
  }
  if ("exclusiveMaximum" in schema) {
    ir.exclusiveMaximum = schema.exclusiveMaximum as number | boolean;
  }
  if (typeof schema.multipleOf === "number") {
    ir.multipleOf = schema.multipleOf;
  }

  // Array
  if (schema.items && typeof schema.items === "object") {
    ir.items = mapSchema(schema.items as Record<string, unknown>);
  }
  if (typeof schema.minItems === "number") {
    ir.minItems = schema.minItems;
  }
  if (typeof schema.maxItems === "number") {
    ir.maxItems = schema.maxItems;
  }
  if (typeof schema.uniqueItems === "boolean") {
    ir.uniqueItems = schema.uniqueItems;
  }

  // Object
  if (schema.properties && typeof schema.properties === "object") {
    ir.properties = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      ir.properties[key] = mapSchema(value as Record<string, unknown>);
    }
  }
  if (Array.isArray(schema.required)) {
    ir.required = schema.required as string[];
  }
  if (typeof schema.additionalProperties === "boolean") {
    ir.additionalProperties = schema.additionalProperties;
  } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    ir.additionalProperties = mapSchema(schema.additionalProperties as Record<string, unknown>);
  }
  if (typeof schema.minProperties === "number") {
    ir.minProperties = schema.minProperties;
  }
  if (typeof schema.maxProperties === "number") {
    ir.maxProperties = schema.maxProperties;
  }

  // Composition
  if (Array.isArray(schema.allOf)) {
    ir.allOf = schema.allOf.map((s) => mapSchema(s as Record<string, unknown>));
  }
  if (Array.isArray(schema.oneOf)) {
    ir.oneOf = schema.oneOf.map((s) => mapSchema(s as Record<string, unknown>));
  }
  if (Array.isArray(schema.anyOf)) {
    ir.anyOf = schema.anyOf.map((s) => mapSchema(s as Record<string, unknown>));
  }

  // Discriminator
  if (schema.discriminator && typeof schema.discriminator === "object") {
    const disc = schema.discriminator as Record<string, unknown>;
    ir.discriminator = {
      propertyName: (disc.propertyName as string) || "discriminator",
      mapping: disc.mapping as Record<string, string> | undefined,
    };
  }

  return ir;
}

/**
 * Extract component name from a $ref path.
 * E.g., "#/components/schemas/User" → "User"
 */
function extractComponentName($ref: string): string | undefined {
  const match = $ref.match(/\/([^/]+)$/);
  return match ? match[1] : undefined;
}
