import type { SchemaIR } from "./schema.js";

/** GraphQL-specific extension for an endpoint. */
interface GraphQLEndpointExtension {
  operationType: "query" | "mutation" | "subscription";
  operationName: string;
  arguments: GraphQlArgumentIR[];
  returnType: SchemaIR;
  description?: string;
  directives: string[];
}

/** A single argument on a GraphQL operation. */
interface GraphQlArgumentIR {
  name: string;
  type: SchemaIR;
  defaultValue?: unknown;
  description?: string;
  directives: string[];
}

export type { GraphQLEndpointExtension, GraphQlArgumentIR };
