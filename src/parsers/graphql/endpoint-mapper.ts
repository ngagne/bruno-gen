import type { EndpointIR, GraphQLEndpointExtension, GraphQlArgumentIR } from "../../ir/index.js";
import type { GraphQLArgument, GraphQLField, GraphQLSchema, GraphQLOutputType } from "graphql";
import { getNamedType, isCompositeType, isNonNullType } from "graphql";
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
        graphqlType: arg.type.toString(),
        defaultValue: arg.defaultValue,
        description: arg.description || undefined,
        directives: [],
      }),
    ),
    returnType,
    selectionSet: createSelectionSet(field.type as GraphQLOutputType),
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
    transport: { kind: "graphql" },
    graphql: extension,
    extensions: {
      graphql: extension,
    },
  };
}

function createSelectionSet(
  type: GraphQLOutputType,
  depth = 0,
  visited = new Set<string>(),
): string {
  const namedType = getNamedType(type);
  if (!isCompositeType(namedType)) return "";
  if (depth >= 4 || visited.has(namedType.name)) return "{ __typename }";

  const nextVisited = new Set(visited).add(namedType.name);
  const fields = Object.values(namedType.getFields())
    .filter((field) =>
      field.args.every(
        (argument) => !isNonNullType(argument.type) || argument.defaultValue !== undefined,
      ),
    )
    .map((field) => {
      const selection = createSelectionSet(field.type, depth + 1, nextVisited);
      return `${field.name}${selection ? ` ${selection}` : ""}`;
    });

  return fields.length > 0 ? `{ ${fields.join(" ")} }` : "{ __typename }";
}
