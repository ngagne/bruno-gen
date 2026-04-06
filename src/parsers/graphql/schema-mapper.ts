import type { SchemaIR } from "../../ir/index.js";
import type {
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLType,
  GraphQLOutputType,
} from "graphql";
import {
  isScalarType,
  isObjectType,
  isInputObjectType,
  isInterfaceType,
  isUnionType,
  isEnumType,
  isListType,
  isNonNullType,
} from "graphql";

/**
 * Map GraphQL types to SchemaIR for the components.schemas registry.
 */
export function mapGraphQLTypeToSchema(type: GraphQLType): SchemaIR | null {
  if (isScalarType(type)) {
    return mapScalarType(type);
  }
  if (isObjectType(type)) {
    return mapObjectType(type);
  }
  if (isInputObjectType(type)) {
    return mapInputObjectType(type);
  }
  if (isInterfaceType(type)) {
    return mapInterfaceType(type);
  }
  if (isUnionType(type)) {
    return mapUnionType(type);
  }
  if (isEnumType(type)) {
    return mapEnumType(type);
  }

  return null;
}

/**
 * Map a GraphQL type (used in fields/args) to SchemaIR.
 * Handles wrapping types (NonNull, List).
 */
export function mapGraphQLTypeToSchemaField(type: GraphQLType): SchemaIR {
  if (isNonNullType(type)) {
    return mapGraphQLTypeToSchemaField(type.ofType);
  }
  if (isListType(type)) {
    return {
      type: "array",
      items: mapGraphQLTypeToSchemaField(type.ofType),
    };
  }

  return mapGraphQLTypeToSchema(type) || { type: "string" };
}

function mapScalarType(type: GraphQLScalarType): SchemaIR {
  const builtinScalars: Record<string, SchemaIR> = {
    String: { type: "string" },
    Int: { type: "integer" },
    Float: { type: "number" },
    Boolean: { type: "boolean" },
    ID: { type: "string", format: "id" },
  };

  if (builtinScalars[type.name]) {
    return { ...builtinScalars[type.name] };
  }

  // Custom scalar
  return { type: "string", format: `custom-scalar-${type.name.toLowerCase()}` };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapObjectType(type: GraphQLObjectType<any, any>): SchemaIR {
  const fields = type.getFields();
  const properties: Record<string, SchemaIR> = {};
  const required: string[] = [];

  for (const [name, field] of Object.entries(fields)) {
    properties[name] = mapGraphQLTypeToSchemaField(field.type);
    if (isNonNullType(field.type)) {
      required.push(name);
    }
  }

  return {
    type: "object",
    title: type.name,
    description: type.description || undefined,
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

function mapInputObjectType(type: GraphQLInputObjectType): SchemaIR {
  const fields = type.getFields();
  const properties: Record<string, SchemaIR> = {};
  const required: string[] = [];

  for (const [name, field] of Object.entries(fields)) {
    properties[name] = mapGraphQLTypeToSchemaField(field.type);
    if (isNonNullType(field.type)) {
      required.push(name);
    }
  }

  return {
    type: "object",
    title: type.name,
    description: type.description || undefined,
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

function mapInterfaceType(type: GraphQLInterfaceType): SchemaIR {
  const fields = type.getFields();
  const properties: Record<string, SchemaIR> = {};
  const required: string[] = [];

  for (const [name, field] of Object.entries(fields)) {
    properties[name] = mapGraphQLTypeToSchemaField(field.type);
    if (isNonNullType(field.type)) {
      required.push(name);
    }
  }

  return {
    type: "object",
    title: type.name,
    description: type.description || undefined,
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

function mapUnionType(type: GraphQLUnionType): SchemaIR {
  const types = type.getTypes();
  return {
    oneOf: types.map((t) => mapGraphQLTypeToSchema(t) || { type: "object" }),
  };
}

function mapEnumType(type: GraphQLEnumType): SchemaIR {
  const values = type.getValues().map((v) => v.name);
  return {
    type: "string",
    enum: values,
    title: type.name,
    description: type.description || undefined,
  };
}

/**
 * Map GraphQL output type to SchemaIR for response schemas.
 */
export function mapGraphQLOutputTypeToSchema(type: GraphQLOutputType): SchemaIR {
  return mapGraphQLTypeToSchemaField(type as GraphQLType);
}
