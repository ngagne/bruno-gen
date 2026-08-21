import type { ParameterIR } from "./parameter.js";
import type { RequestBodyIR } from "./request-body.js";
import type { ResponseIR } from "./response.js";
import type { SecurityRequirement } from "./security.js";
import type { GraphQLEndpointExtension } from "./graphql.js";
import type { GrpcEndpointExtension } from "./grpc.js";
import type { WebSocketEndpointExtension } from "./websocket.js";
import type { RequestTransport } from "./transport.js";

/** Supported HTTP methods in the Bruno DSL. */
type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "head" | "options" | "trace";

/**
 * A single API endpoint represented as a Bruno request.
 * Version-agnostic — works for OpenAPI, Swagger, and GraphQL.
 */
interface EndpointIR {
  /** Unique identifier — operationId or generated "method-path". */
  id: string;
  method: HttpMethod;
  /** URL path, e.g. "/users/{id}". For GraphQL this is "/graphql". */
  path: string;
  summary?: string;
  description?: string;
  tags: string[];
  deprecated: boolean;

  /** Path, query, header, and cookie parameters. */
  parameters: ParameterIR[];

  /** Request body, if present. */
  requestBody?: RequestBodyIR;

  /** Endpoint-level security override (empty array = no auth). */
  security?: SecurityRequirement[];

  /** Expected responses keyed by status code or range. */
  responses: ResponseIR[];

  /** For request chaining — the content type this endpoint produces. */
  producesContentType?: string;
  /** Content types this endpoint accepts. */
  consumesContentTypes: string[];

  /** Optional explicit transport. Omitted legacy endpoints are inferred from their extensions. */
  transport?: RequestTransport;

  /** GraphQL operation metadata used to render a Bruno GraphQL request. */
  graphql?: GraphQLEndpointExtension;

  /** gRPC operation metadata used to render a native Bruno gRPC request. */
  grpc?: GrpcEndpointExtension;

  /** AsyncAPI metadata used to render a native Bruno WebSocket request. */
  websocket?: WebSocketEndpointExtension;

  /** Source-format metadata retained for consumers that need it. */
  extensions?: Record<string, unknown>;
}

export type { EndpointIR, HttpMethod };
