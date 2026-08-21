// ─── Collection ────────────────────────────────────────────────────────────
export type { CollectionIR, CollectionInfo, Server, ServerVariable, Tag } from "./collection.js";
export type { RequestTransport } from "./transport.js";

// ─── Endpoint ──────────────────────────────────────────────────────────────
export type { EndpointIR, HttpMethod } from "./endpoint.js";

// ─── Parameter ─────────────────────────────────────────────────────────────
export type { ParameterIR, ParameterLocation } from "./parameter.js";

// ─── Schema ────────────────────────────────────────────────────────────────
export type { SchemaIR, SchemaType, DiscriminatorObject } from "./schema.js";

// ─── Response ──────────────────────────────────────────────────────────────
export type {
  ResponseIR,
  MediaTypeIR,
  HeaderIR,
  ExampleObject,
  LinkObject,
  EncodingObject,
} from "./response.js";

// ─── Request Body ──────────────────────────────────────────────────────────
export type { RequestBodyIR } from "./request-body.js";

// ─── Security ──────────────────────────────────────────────────────────────
export type {
  SecurityScheme,
  HttpSecurityScheme,
  ApiKeySecurityScheme,
  OAuth2SecurityScheme,
  OAuth2Flows,
  OAuth2Flow,
  OAuth2ImplicitFlow,
  OpenIdConnectSecurityScheme,
  SecurityRequirement,
} from "./security.js";

// ─── GraphQL ───────────────────────────────────────────────────────────────
export type { GraphQLEndpointExtension, GraphQlArgumentIR } from "./graphql.js";

// ─── gRPC ──────────────────────────────────────────────────────────────────
export type { GrpcEndpointExtension } from "./grpc.js";

// ─── WebSocket ─────────────────────────────────────────────────────────────
export type { WebSocketEndpointExtension, WebSocketMessageIR } from "./websocket.js";

// ─── Validation ────────────────────────────────────────────────────────────
export type { ValidationError, ValidationResult, Warning, WarningSeverity } from "./validation.js";
