/** Allowed JSON Schema types (OpenAPI 3.1 allows arrays). */
type SchemaType = "string" | "number" | "integer" | "boolean" | "array" | "object" | "null";

/** Discriminator mapping for polymorphic schemas. */
interface DiscriminatorObject {
  propertyName: string;
  mapping?: Record<string, string>;
}

/**
 * Unified schema type — captures all JSON Schema / OpenAPI schema fields
 * needed for Bruno request body and response generation.
 * Version-agnostic: works for Swagger 2.0, OpenAPI 3.x, and GraphQL.
 */
interface SchemaIR {
  type?: SchemaType | SchemaType[];
  format?: string;
  title?: string;
  description?: string;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;

  // Scalar constraints
  enum?: unknown[];
  default?: unknown;
  example?: unknown;

  // String constraints
  minLength?: number;
  maxLength?: number;
  pattern?: string;

  // Numeric constraints
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  multipleOf?: number;

  // Array constraints
  items?: SchemaIR;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;

  // Object constraints
  properties?: Record<string, SchemaIR>;
  required?: string[];
  additionalProperties?: boolean | SchemaIR;
  minProperties?: number;
  maxProperties?: number;

  // Composition / polymorphism
  allOf?: SchemaIR[];
  oneOf?: SchemaIR[];
  anyOf?: SchemaIR[];
  discriminator?: DiscriminatorObject;

  // Reference tracking (resolved at parse time)
  /** Original $ref path, if this schema was dereferenced. */
  $ref?: string;
  /** Resolved component name, e.g. "User" from "#/components/schemas/User". */
  resolvedName?: string;
}

export type { SchemaIR, SchemaType, DiscriminatorObject };
