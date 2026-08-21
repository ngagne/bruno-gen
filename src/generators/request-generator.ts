/**
 * Generate individual request.bru files from EndpointIR.
 * Includes meta, method, params, headers, body, auth, docs, vars blocks.
 */

import type {
  EndpointIR,
  CollectionIR,
  ParameterIR,
  RequestTransport,
  SchemaIR,
} from "../ir/index.js";
import { formatBlock, formatBlockWithContent, serializeValue } from "./bru-serializer.js";
import { generateExample } from "./example-generator.js";
import { generateAuthBlock, getEndpointAuthMode } from "./auth-generator.js";
import { generateResponseDocs } from "./response-examples.js";
import { generatePostResponseTests } from "./test-generator.js";
import { generateGraphQLBody } from "./graphql-generator.js";

interface RequestBruOptions {
  /** Request ordering sequence number. */
  seq?: number;
  /** Base URL template to use (default: '{{baseUrl}}'). */
  baseUrl?: string;
  /** Generate post-response test assertions. */
  generateTests?: boolean;
  /** Proto file path relative to this request, for native Bruno gRPC requests. */
  grpcProtoPath?: string;
}

/**
 * Generate a complete request.bru file from EndpointIR.
 * @param endpoint - The endpoint IR
 * @param collection - The collection IR (for servers, auth context)
 * @param options - Optional configuration
 * @returns The request.bru file content
 */
function generateRequestBru(
  endpoint: EndpointIR,
  collection: CollectionIR,
  options?: RequestBruOptions,
): string {
  const seq = options?.seq ?? 1;
  const baseUrl = options?.baseUrl ?? "{{baseUrl}}";
  const blocks: string[] = [];
  const transport = getRequestTransport(endpoint);

  // Meta block
  const metaEntries: Record<string, unknown> = {
    name: endpoint.id,
    type: transport.kind === "grpc" ? "grpc" : transport.kind === "websocket" ? "ws" : "http",
    seq,
  };
  if (endpoint.tags && endpoint.tags.length > 0) {
    metaEntries.tags = endpoint.tags;
  }
  if (endpoint.deprecated) {
    metaEntries.deprecated = true;
  }
  blocks.push(formatBlock("meta", metaEntries));

  // HTTP method block
  const methodBlock =
    transport.kind === "grpc"
      ? generateGrpcBlock(endpoint, baseUrl, options?.grpcProtoPath)
      : transport.kind === "websocket"
        ? generateWebSocketBlock(baseUrl)
        : generateMethodBlock(endpoint, baseUrl);
  blocks.push(methodBlock);

  // Path parameters
  const pathParams = endpoint.parameters.filter((p) => p.in === "path");
  if (pathParams.length > 0) {
    blocks.push(generatePathParams(endpoint));
  }

  // Query parameters
  const queryParams = endpoint.parameters.filter((p) => p.in === "query");
  if (queryParams.length > 0) {
    blocks.push(generateQueryParams(endpoint));
  }

  // Headers
  const headers = generateHeaders(endpoint);
  if (headers) {
    blocks.push(headers);
  }

  // Auth block for this request
  const authBlock = generateRequestAuthBlock(endpoint, collection);
  if (authBlock) {
    blocks.push(authBlock);
  }

  // Request body
  if (transport.kind !== "http" || endpoint.requestBody) {
    const bodyBlock = generateBody(endpoint);
    if (bodyBlock) {
      blocks.push(bodyBlock);
    }
  }

  // Post-response test assertions (when --tests flag is used)
  if (options?.generateTests && endpoint.responses && endpoint.responses.length > 0) {
    const testsBlock = generatePostResponseTests(endpoint.responses);
    if (testsBlock) {
      blocks.push(testsBlock);
    }
  }

  // Docs block
  const docsContent = generateRequestDocs(endpoint);
  if (docsContent) {
    blocks.push(formatBlockWithContent("docs", docsContent));
  }

  // Settings block
  blocks.push(generateSettingsBlock());

  return blocks.join("\n\n") + "\n";
}

/**
 * Generate the HTTP method block (get, post, etc.).
 */
function generateMethodBlock(endpoint: EndpointIR, baseUrl: string): string {
  const url = buildUrl(endpoint.path, baseUrl);

  // Determine body type
  let bodyType = "none";
  if (endpoint.graphql) {
    bodyType = "graphql";
  } else if (endpoint.requestBody) {
    const contentTypes = Object.keys(endpoint.requestBody.content);
    if (contentTypes.includes("application/json")) {
      bodyType = "json";
    } else if (
      contentTypes.includes("application/graphql") ||
      contentTypes.includes("application/graphql-response+json")
    ) {
      bodyType = "graphql";
    } else if (contentTypes.includes("application/x-www-form-urlencoded")) {
      bodyType = "form-urlencoded";
    } else if (contentTypes.includes("multipart/form-data")) {
      bodyType = "multipart-form";
    } else if (contentTypes.includes("application/xml")) {
      bodyType = "xml";
    } else if (contentTypes.length > 0) {
      bodyType = "json"; // Default to json
    }
  }

  // Determine auth mode
  const authMode = "inherit"; // Will be overridden by explicit auth block if needed

  const entries: Record<string, unknown> = {
    url,
    body: bodyType,
    auth: authMode,
  };

  return formatBlock(endpoint.method, entries);
}

/** Generate Bruno's native gRPC request block. */
function generateGrpcBlock(endpoint: EndpointIR, baseUrl: string, protoPath?: string): string {
  if (!endpoint.grpc)
    throw new Error("gRPC block requested for an endpoint without gRPC metadata.");
  return formatBlock("grpc", {
    url: baseUrl,
    method: endpoint.grpc.method,
    body: "grpc",
    protoPath: protoPath ?? `protos/${endpoint.grpc.proto.fileName}`,
    auth: "inherit",
    methodType: endpoint.grpc.methodType,
  });
}

/** Generate Bruno's native WebSocket connection block. */
function generateWebSocketBlock(baseUrl: string): string {
  return formatBlock("ws", { url: baseUrl });
}

/**
 * Build URL with Bruno variable interpolation.
 * Replaces {paramName} with {{paramName}} and prepends baseUrl.
 */
function buildUrl(path: string, baseUrl: string): string {
  // Replace OpenAPI-style path params {param} with Bruno {{param}}
  const brunoPath = path.replace(/\{([^}]+)\}/g, "{{$1}}");
  return `${baseUrl}${brunoPath}`;
}

/** Infer the transport for legacy IR while allowing new parsers to declare it explicitly. */
function getRequestTransport(endpoint: EndpointIR): RequestTransport {
  return (
    endpoint.transport ??
    (endpoint.grpc
      ? { kind: "grpc" }
      : endpoint.websocket
        ? { kind: "websocket" }
        : endpoint.graphql
          ? { kind: "graphql" }
          : { kind: "http" })
  );
}

/**
 * Generate params:path block.
 */
function generatePathParams(endpoint: EndpointIR): string {
  const pathParams = endpoint.parameters.filter((p) => p.in === "path");
  return generateParameterBlock("params:path", pathParams);
}

/**
 * Generate params:query block.
 */
function generateQueryParams(endpoint: EndpointIR): string {
  const queryParams = endpoint.parameters.filter((p) => p.in === "query");
  return generateParameterBlock("params:query", queryParams);
}

function generateParameterBlock(name: string, parameters: ParameterIR[]): string {
  const lines: string[] = [];
  for (const parameter of parameters) {
    lines.push(`  ${parameter.name}: ${generateParamValue(parameter)}`);
  }
  return `${name} {\n${lines.join("\n")}\n}`;
}

/**
 * Generate a parameter value (example or schema-derived).
 */
function generateParamValue(param: ParameterIR): string {
  // Required values are inputs, not examples to silently send. Keeping them in
  // an environment makes the request immediately editable in Bruno.
  if (param.required) {
    return `{{${param.name}}}`;
  }
  // Use explicit example
  if (param.example !== undefined) {
    return serializeValue(param.example);
  }
  if (param.examples) {
    const firstExample = Object.values(param.examples)[0];
    if (firstExample?.value !== undefined) {
      return serializeValue(firstExample.value);
    }
  }

  // Generate from schema
  if (param.schema) {
    const example = generateExample(param.schema);
    return serializeValue(example);
  }

  // Fallback to placeholder
  return `{{${param.name}}}`;
}

/**
 * Generate headers block.
 */
function generateHeaders(endpoint: EndpointIR): string | null {
  const headers: Record<string, string> = {};

  for (const parameter of endpoint.parameters.filter((p) => p.in === "header")) {
    headers[parameter.name] = generateParamValue(parameter);
  }

  const cookieParams = endpoint.parameters.filter((p) => p.in === "cookie");
  if (cookieParams.length > 0) {
    headers.Cookie = cookieParams.map((p) => `${p.name}=${generateParamValue(p)}`).join("; ");
  }

  // Content-Type from request body
  if (endpoint.requestBody && Object.keys(endpoint.requestBody.content).length > 0) {
    const contentType = Object.keys(endpoint.requestBody.content)[0];
    headers["Content-Type"] = contentType;
  }

  // Accept from responses
  if (endpoint.responses && endpoint.responses.length > 0) {
    const firstResponse = endpoint.responses[0];
    const responseContentType = Object.keys(firstResponse.content)[0];
    if (responseContentType) {
      headers["Accept"] = responseContentType;
    }
  }

  // Add produces/consumes content types
  if (endpoint.producesContentType) {
    headers["Accept"] = endpoint.producesContentType;
  }
  if (endpoint.consumesContentTypes && endpoint.consumesContentTypes.length > 0) {
    headers["Content-Type"] = endpoint.consumesContentTypes[0];
  }

  if (Object.keys(headers).length === 0) {
    return null;
  }

  return formatBlock("headers", headers);
}

/**
 * Generate auth block for this specific request.
 */
function generateRequestAuthBlock(endpoint: EndpointIR, collection: CollectionIR): string | null {
  const authMode = getEndpointAuthMode(endpoint.security, collection.defaultSecurity);

  if (authMode === "none") {
    return null;
  }

  // Look up the security scheme definition
  const scheme = collection.securitySchemes[authMode];
  if (!scheme) {
    return null;
  }

  return generateAuthBlock(scheme, authMode);
}

/**
 * Generate body block (body:json, body:graphql, etc.).
 */
function generateBody(endpoint: EndpointIR): string | null {
  if (endpoint.grpc) {
    const content = JSON.stringify(endpoint.grpc.requestExample, null, 2)
      .split("\n")
      .map((line) => `    ${line}`)
      .join("\n");
    return `body:grpc {\n  name: message\n  content: '''\n${content}\n  '''\n}`;
  }
  if (endpoint.graphql) {
    return generateGraphQLBody(endpoint.graphql);
  }
  if (endpoint.websocket) {
    return endpoint.websocket.messages.map(generateWebSocketMessage).join("\n\n");
  }

  if (!endpoint.requestBody) {
    return null;
  }

  const contentTypes = Object.keys(endpoint.requestBody.content);
  if (contentTypes.length === 0) {
    return null;
  }

  const contentType = contentTypes[0];
  const mediaType = endpoint.requestBody.content[contentType];

  let bodyContent: string;

  // Use explicit example
  if (mediaType.example !== undefined) {
    bodyContent = JSON.stringify(mediaType.example, null, 2);
  } else if (mediaType.examples) {
    const firstExample = Object.values(mediaType.examples)[0];
    bodyContent = JSON.stringify(firstExample?.value ?? {}, null, 2);
  } else if (mediaType.schema) {
    // Generate from schema
    const generatedExample = generateExample(mediaType.schema);
    bodyContent = JSON.stringify(generatedExample, null, 2);
  } else {
    return null;
  }

  // Bruno form bodies are dictionaries, not JSON text blocks.
  if (contentType.includes("form-urlencoded") || contentType.includes("multipart")) {
    const formData = extractFormData(mediaType.example, mediaType.examples, mediaType.schema);
    if (!formData) return null;
    return formatBlock(
      contentType.includes("multipart") ? "body:multipart-form" : "body:form-urlencoded",
      formData,
    );
  }

  // Determine body block type
  let blockType = "body:json";
  if (contentType.includes("graphql")) {
    blockType = "body:graphql";
  } else if (contentType.includes("xml")) {
    blockType = "body:xml";
  } else if (!contentType.includes("json")) {
    blockType = "body:text";
  }

  return formatBlockWithContent(blockType, bodyContent);
}

function generateWebSocketMessage(
  message: NonNullable<EndpointIR["websocket"]>["messages"][number],
): string {
  const content = message.content
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n")
    .replace(/'''/g, "\\'\\'\\'");
  const selected = message.selected ? "\n  selected: true" : "";
  return `body:ws {\n  name: ${serializeValue(message.name)}\n  type: ${message.type}${selected}\n  content: '''\n${content}\n  '''\n}`;
}

function extractFormData(
  example: unknown,
  examples: Record<string, { value: unknown }> | undefined,
  schema: SchemaIR | undefined,
): Record<string, unknown> | null {
  const value =
    example ??
    Object.values(examples ?? {})[0]?.value ??
    (schema ? generateExample(schema) : undefined);
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Generate docs content for the request.
 */
function generateRequestDocs(endpoint: EndpointIR): string | null {
  const sections: string[] = [];

  // Summary/description
  if (endpoint.summary) {
    sections.push(`# ${endpoint.summary}`);
    sections.push("");
  }
  if (endpoint.description) {
    sections.push(endpoint.description);
    sections.push("");
  }

  if (endpoint.parameters.length > 0) {
    sections.push("## Parameters");
    sections.push("");
    for (const parameter of endpoint.parameters) {
      const required = parameter.required ? "required" : "optional";
      const description = parameter.description ? ` — ${parameter.description}` : "";
      sections.push(`- \`${parameter.name}\` (${parameter.in}, ${required})${description}`);
    }
    sections.push("");
  }

  // Response examples
  if (endpoint.responses && endpoint.responses.length > 0) {
    const responseDocs = generateResponseDocs(endpoint.responses);
    if (responseDocs) {
      sections.push(responseDocs);
    }
  }

  return sections.length > 0 ? sections.join("\n") : null;
}

/**
 * Generate settings block with default settings.
 */
function generateSettingsBlock(): string {
  const entries: Record<string, unknown> = {
    timeout: 30000,
    followRedirects: true,
    encodeUrl: true,
  };
  return formatBlock("settings", entries);
}

export {
  generateRequestBru,
  generateMethodBlock,
  generateGrpcBlock,
  generateWebSocketBlock,
  getRequestTransport,
  buildUrl,
  generatePathParams,
  generateQueryParams,
  generateHeaders,
  generateBody,
  generateWebSocketMessage,
  generateRequestDocs,
};
export type { RequestBruOptions };
