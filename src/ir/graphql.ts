import type { SchemaIR } from "./schema.js";

/** GraphQL-specific extension for an endpoint. */
interface GraphQLEndpointExtension {
  operationType: "query" | "mutation" | "subscription";
  operationName: string;
  arguments: GraphQlArgumentIR[];
  returnType: SchemaIR;
  /** Precomputed selection set that excludes fields requiring arguments. */
  selectionSet?: string;
  description?: string;
  directives: string[];
}

/** A single argument on a GraphQL operation. */
interface GraphQlArgumentIR {
  name: string;
  type: SchemaIR;
  /** GraphQL type syntax, preserving list and non-null wrappers for variables. */
  graphqlType?: string;
  defaultValue?: unknown;
  description?: string;
  directives: string[];
}

export type { GraphQLEndpointExtension, GraphQlArgumentIR };
