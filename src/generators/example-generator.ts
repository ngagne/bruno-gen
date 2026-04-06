/**
 * Generate concrete example values from SchemaIR.
 * Used for request body generation, parameter examples, and response examples.
 */

import type { SchemaIR } from "../ir/index.js";

const MAX_DEPTH = 3;

/**
 * Generate a concrete example value from a schema.
 * @param schema - The schema to generate an example for
 * @param depth - Current recursion depth (prevents infinite loops)
 * @returns A concrete example value matching the schema type
 */
function generateExample(schema: SchemaIR, depth = 0): unknown {
  // Prevent infinite recursion on circular refs
  if (depth > MAX_DEPTH) {
    if (schema.type === "array" || (Array.isArray(schema.type) && schema.type.includes("array"))) {
      return [];
    }
    return {};
  }

  // Use explicit example if provided
  if (schema.example !== undefined) {
    return schema.example;
  }

  // Use default if provided
  if (schema.default !== undefined) {
    return schema.default;
  }

  // Handle enum → first value
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0];
  }

  // Handle nullable
  if (schema.nullable) {
    return null;
  }

  // Handle array types (OpenAPI 3.1 allows multiple types)
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];

  // Determine primary type
  const primaryType = types.length > 0 ? types[0] : undefined;

  switch (primaryType) {
    case "string":
      return generateStringExample(schema);
    case "integer":
    case "number":
      return generateNumberExample(schema);
    case "boolean":
      return generateBooleanExample();
    case "array":
      return generateArrayExample(schema, depth);
    case "object":
      return generateObjectExample(schema, depth);
    case "null":
      return null;
    default:
      // Unknown type → return generic placeholder
      return "unknown";
  }
}

/**
 * Generate a flat map of field paths to example values.
 * Used for vars:post-response extraction.
 * @param schema - The schema to extract fields from
 * @param prefix - Optional prefix for nested paths
 * @returns Record of field paths to example values
 */
function generateExampleFields(schema: SchemaIR, prefix = ""): Record<string, string> {
  const fields: Record<string, string> = {};

  // Only process object types with properties
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  const primaryType = types.length > 0 ? types[0] : undefined;

  if (primaryType !== "object" || !schema.properties) {
    return fields;
  }

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const value = generateExample(propSchema);

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      // Recurse into nested objects
      Object.assign(fields, generateExampleFields(propSchema, path));
    } else {
      // Leaf field → add to fields
      fields[path] = `$res.body.${path}`;
    }
  }

  return fields;
}

/**
 * Generate a string example based on format and constraints.
 */
function generateStringExample(schema: SchemaIR): string {
  if (schema.format) {
    switch (schema.format) {
      case "email":
        return "user@example.com";
      case "date-time":
        return "2026-01-01T00:00:00Z";
      case "date":
        return "2026-01-01";
      case "uuid":
        return "00000000-0000-0000-0000-000000000000";
      case "uri":
      case "url":
        return "https://example.com";
      case "hostname":
        return "api.example.com";
      case "ipv4":
        return "127.0.0.1";
      case "ipv6":
        return "::1";
      case "byte":
        return "YmFzZTY0LWVuY29kZWQ=";
      case "binary":
        return "binary-data";
      default:
        return schema.format;
    }
  }

  // Use property name hint if available
  if (schema.title) {
    return schema.title.toLowerCase().replace(/\s+/g, "-");
  }

  return "string";
}

/**
 * Generate a number example based on constraints.
 */
function generateNumberExample(schema: SchemaIR): number {
  if (schema.minimum !== undefined) {
    return schema.minimum;
  }
  if (schema.default !== undefined) {
    return Number(schema.default);
  }
  if (schema.example !== undefined) {
    return Number(schema.example);
  }
  return 0;
}

/**
 * Generate a boolean example.
 */
function generateBooleanExample(): boolean {
  return true;
}

/**
 * Generate an array example with sample items.
 */
function generateArrayExample(schema: SchemaIR, depth: number): unknown[] {
  if (schema.items) {
    // Generate one example item
    return [generateExample(schema.items, depth + 1)];
  }
  return [];
}

/**
 * Generate an object example with all properties.
 */
function generateObjectExample(schema: SchemaIR, depth: number): Record<string, unknown> {
  const obj: Record<string, unknown> = {};

  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      obj[key] = generateExample(propSchema, depth + 1);
    }
  }

  return obj;
}

export { generateExample, generateExampleFields, MAX_DEPTH };
