/** Render GraphQL operation metadata as Bruno's GraphQL request blocks. */

import type { GraphQLEndpointExtension, SchemaIR } from "../ir/index.js";
import { generateExample } from "./example-generator.js";
import { formatBlockWithContent } from "./bru-serializer.js";

/** Generate the query and variables blocks for a GraphQL endpoint. */
function generateGraphQLBody(operation: GraphQLEndpointExtension): string {
  const argumentsDefinition = operation.arguments
    .map(
      (argument) =>
        `$${argument.name}: ${argument.graphqlType ?? graphQLTypeForSchema(argument.type)}`,
    )
    .join(", ");
  const argumentsUse = operation.arguments
    .map((argument) => `${argument.name}: $${argument.name}`)
    .join(", ");
  const operationHeader = `${operation.operationType} ${operation.operationName}${argumentsDefinition ? `(${argumentsDefinition})` : ""}`;
  const field = `${operation.operationName}${argumentsUse ? `(${argumentsUse})` : ""}`;
  const selection = operation.selectionSet ?? generateSelectionSet(operation.returnType);
  const query = `${operationHeader} {\n  ${field}${selection ? ` ${selection}` : ""}\n}`;
  const blocks = [formatBlockWithContent("body:graphql", query)];

  if (operation.arguments.length > 0) {
    const variables = Object.fromEntries(
      operation.arguments.map((argument) => [
        argument.name,
        argument.defaultValue ?? generateExample(argument.type),
      ]),
    );
    blocks.push(formatBlockWithContent("body:graphql:vars", JSON.stringify(variables, null, 2)));
  }

  return blocks.join("\n\n");
}

function generateSelectionSet(schema: SchemaIR, depth = 0): string {
  const unwrapped = schema.type === "array" && schema.items ? schema.items : schema;
  if (depth >= 4 || unwrapped.type !== "object") return "";

  const properties = Object.entries(unwrapped.properties ?? {});
  if (properties.length === 0) return "{ __typename }";

  const fields = properties.map(([name, property]) => {
    const child = generateSelectionSet(property, depth + 1);
    return child ? `${name} ${child}` : name;
  });
  return `{ ${fields.join(" ")} }`;
}

/** Best-effort compatibility fallback for caller-supplied GraphQL metadata. */
function graphQLTypeForSchema(schema: SchemaIR): string {
  if (schema.type === "array") {
    return `[${graphQLTypeForSchema(schema.items ?? {})}]`;
  }

  switch (schema.type) {
    case "integer":
      return "Int";
    case "number":
      return "Float";
    case "boolean":
      return "Boolean";
    case "object":
      return schema.title ?? "JSON";
    default:
      return schema.format === "id" ? "ID" : "String";
  }
}

export { generateGraphQLBody };
