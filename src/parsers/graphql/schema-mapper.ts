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
export function mapGraphQLTypeToSchema(
  type: GraphQLType,
  visited = new Set<string>(),
): SchemaIR | null {
  if (isScalarType(type)) {
    return mapScalarType(type);
  }
  if (isObjectType(type)) {
    return visited.has(type.name)
      ? { type: "object", title: type.name }
      : mapObjectType(type, new Set(visited).add(type.name));
  }
  if (isInputObjectType(type)) {
    return visited.has(type.name)
      ? { type: "object", title: type.name }
      : mapInputObjectType(type, new Set(visited).add(type.name));
  }
  if (isInterfaceType(type)) {
    return visited.has(type.name)
      ? { type: "object", title: type.name }
      : mapInterfaceType(type, new Set(visited).add(type.name));
  }
  if (isUnionType(type)) {
    return visited.has(type.name)
      ? { type: "object", title: type.name }
      : mapUnionType(type, new Set(visited).add(type.name));
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
export function mapGraphQLTypeToSchemaField(
  type: GraphQLType,
  visited = new Set<string>(),
): SchemaIR {
  if (isNonNullType(type)) {
    return mapGraphQLTypeToSchemaField(type.ofType, visited);
  }
  if (isListType(type)) {
    return {
      type: "array",
      items: mapGraphQLTypeToSchemaField(type.ofType, visited),
    };
  }

  return mapGraphQLTypeToSchema(type, visited) || { type: "string" };
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
function mapObjectType(type: GraphQLObjectType<any, any>, visited: Set<string>): SchemaIR {
  const fields = type.getFields();
  const properties: Record<string, SchemaIR> = {};
  const required: string[] = [];

  for (const [name, field] of Object.entries(fields)) {
    properties[name] = mapGraphQLTypeToSchemaField(field.type, visited);
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

function mapInputObjectType(type: GraphQLInputObjectType, visited: Set<string>): SchemaIR {
  const fields = type.getFields();
  const properties: Record<string, SchemaIR> = {};
  const required: string[] = [];

  for (const [name, field] of Object.entries(fields)) {
    properties[name] = mapGraphQLTypeToSchemaField(field.type, visited);
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

function mapInterfaceType(type: GraphQLInterfaceType, visited: Set<string>): SchemaIR {
  const fields = type.getFields();
  const properties: Record<string, SchemaIR> = {};
  const required: string[] = [];

  for (const [name, field] of Object.entries(fields)) {
    properties[name] = mapGraphQLTypeToSchemaField(field.type, visited);
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

function mapUnionType(type: GraphQLUnionType, visited: Set<string>): SchemaIR {
  const types = type.getTypes();
  return {
    oneOf: types.map((t) => mapGraphQLTypeToSchema(t, visited) || { type: "object" }),
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
