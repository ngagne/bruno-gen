import type { EndpointIR, GraphQLEndpointExtension, GraphQlArgumentIR } from "../../ir/index.js";
import type { GraphQLArgument, GraphQLField, GraphQLSchema, GraphQLOutputType } from "graphql";
import { isNonNullType } from "graphql";
import { mapGraphQLOutputTypeToSchema, mapGraphQLTypeToSchemaField } from "./schema-mapper.js";

/**
 * Map GraphQL Query and Mutation operations to EndpointIR[].
 * All operations are mapped to POST /graphql with args in requestBody.
 */
export function mapGraphQLEndpoints(schema: GraphQLSchema): EndpointIR[] {
  const endpoints: EndpointIR[] = [];

  // Map Query type fields
  const queryType = schema.getQueryType();
  if (queryType) {
    const fields = queryType.getFields();
    for (const [name, field] of Object.entries(fields)) {
      endpoints.push(
        createEndpointFromField(name, field as GraphQLField<unknown, unknown>, "query"),
      );
    }
  }

  // Map Mutation type fields
  const mutationType = schema.getMutationType();
  if (mutationType) {
    const fields = mutationType.getFields();
    for (const [name, field] of Object.entries(fields)) {
      endpoints.push(
        createEndpointFromField(name, field as GraphQLField<unknown, unknown>, "mutation"),
      );
    }
  }

  return endpoints;
}

function createEndpointFromField(
  name: string,
  field: GraphQLField<unknown, unknown>,
  operationType: "query" | "mutation",
): EndpointIR {
  // Map arguments to requestBody
  const args = field.args || [];
  const requestBody =
    args.length > 0
      ? {
          required: false,
          description: `Arguments for the ${name} ${operationType}`,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                properties: Object.fromEntries(
                  args.map((arg: GraphQLArgument) => [
                    arg.name,
                    mapGraphQLTypeToSchemaField(arg.type),
                  ]),
                ),
                required: args
                  .filter((arg: GraphQLArgument) => isNonNullType(arg.type))
                  .map((arg: GraphQLArgument) => arg.name),
              },
            },
          },
        }
      : undefined;

  // Map return type to response schema
  const returnType = mapGraphQLOutputTypeToSchema(field.type as GraphQLOutputType);

  const responses = [
    {
      statusCode: "200",
      description: field.description || `${name} response`,
      headers: {},
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            properties: {
              data: {
                type: "object" as const,
                properties: {
                  [name]: returnType,
                },
              },
            },
          },
        },
      },
    },
  ];

  // Build extension
  const extension: GraphQLEndpointExtension = {
    operationType,
    operationName: name,
    arguments: args.map(
      (arg: GraphQLArgument): GraphQlArgumentIR => ({
        name: arg.name,
        type: mapGraphQLTypeToSchemaField(arg.type),
        defaultValue: arg.defaultValue,
        description: arg.description || undefined,
        directives: [],
      }),
    ),
    returnType,
    description: field.description || undefined,
    directives: [],
  };

  return {
    id: name,
    method: "post",
    path: "/graphql",
    summary: field.description || undefined,
    description: field.description || undefined,
    tags: [operationType],
    deprecated: false,
    parameters: [],
    requestBody,
    responses,
    producesContentType: "application/json",
    consumesContentTypes: ["application/json"],
    extensions: {
      graphql: extension,
    },
  };
}
