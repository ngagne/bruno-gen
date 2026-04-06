import type { EndpointIR, HttpMethod } from "../../ir/index.js";
import type { ParameterIR } from "../../ir/index.js";
import { mapParameters, mergeParameters } from "./parameter-mapper.js";
import { mapRequestBody } from "./request-body-mapper.js";
import { mapResponses } from "./response-mapper.js";
import { mapSecurityRequirements } from "./security-mapper.js";

const HTTP_METHODS: HttpMethod[] = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
  "trace",
];

/**
 * Map OpenAPI paths and operations to EndpointIR[].
 */
export function mapEndpoints(
  paths: Record<string, unknown>,
  rootProduces: string[] = [],
  rootConsumes: string[] = [],
): EndpointIR[] {
  const endpoints: EndpointIR[] = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;

    const pathObj = pathItem as Record<string, unknown>;

    // Path-level parameters
    const pathParams: ParameterIR[] = Array.isArray(pathObj.parameters)
      ? mapParameters(pathObj.parameters as Record<string, unknown>[])
      : [];

    // Path-level summary/description (OpenAPI 3.1)
    const pathSummary = typeof pathObj.summary === "string" ? pathObj.summary : undefined;
    const pathDescription =
      typeof pathObj.description === "string" ? pathObj.description : undefined;

    for (const method of HTTP_METHODS) {
      const operation = pathObj[method] as Record<string, unknown> | undefined;
      if (!operation || typeof operation !== "object") continue;

      // Skip if it's a $ref
      if (operation.$ref) continue;

      // Generate ID
      const operationId =
        typeof operation.operationId === "string"
          ? operation.operationId
          : `${method}-${path.replace(/[{}/]/g, "-").replace(/^-+|-+$/g, "")}`;

      // Merge parameters
      const opParams = Array.isArray(operation.parameters)
        ? mapParameters(operation.parameters as Record<string, unknown>[])
        : [];
      const parameters = mergeParameters(pathParams, opParams);

      // Request body
      const requestBody = mapRequestBody(
        operation.requestBody as Record<string, unknown> | undefined,
      );

      // Responses
      const responses = mapResponses(operation.responses as Record<string, unknown> | undefined);

      // Security
      const security =
        operation.security !== undefined
          ? mapSecurityRequirements(operation.security as Record<string, unknown>[])
          : undefined;

      // Tags
      const tags = Array.isArray(operation.tags) ? (operation.tags as string[]) : [];

      // Content types
      const produces = operation.produces ? (operation.produces as string[]) : rootProduces;
      const consumes = operation.consumes ? (operation.consumes as string[]) : rootConsumes;

      const endpoint: EndpointIR = {
        id: operationId,
        method,
        path,
        summary: (operation.summary as string) || pathSummary,
        description: (operation.description as string) || pathDescription,
        tags,
        deprecated: operation.deprecated === true,
        parameters,
        requestBody,
        responses,
        security,
        producesContentType: produces[0],
        consumesContentTypes: consumes,
      };

      endpoints.push(endpoint);
    }
  }

  return endpoints;
}
