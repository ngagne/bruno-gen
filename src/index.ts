// Library entry point — re-exports all public IR types, parser API, and generator API.
// Consumers: import { CollectionIR, generate } from "gen-bruno";

export type {
  CollectionIR,
  CollectionInfo,
  Server,
  ServerVariable,
  Tag,
  EndpointIR,
  RequestTransport,
  HttpMethod,
  ParameterIR,
  ParameterLocation,
  SchemaIR,
  SchemaType,
  DiscriminatorObject,
  ResponseIR,
  MediaTypeIR,
  HeaderIR,
  ExampleObject,
  LinkObject,
  EncodingObject,
  RequestBodyIR,
  SecurityScheme,
  HttpSecurityScheme,
  ApiKeySecurityScheme,
  OAuth2SecurityScheme,
  OAuth2Flows,
  OAuth2Flow,
  OAuth2ImplicitFlow,
  OpenIdConnectSecurityScheme,
  SecurityRequirement,
  GraphQLEndpointExtension,
  GraphQlArgumentIR,
  WebSocketEndpointExtension,
  WebSocketMessageIR,
  ValidationError,
  ValidationResult,
  Warning,
  WarningSeverity,
} from "./ir/index.js";

// Parser layer
export {
  parse,
  validate,
  detectFormat,
  loadSpec,
  OpenApiParser,
  SwaggerParser,
  GraphQLParser,
  DirectoryParser,
  AsyncApiParser,
} from "./parsers/index.js";
export type { SpecParser, ParseOptions, SpecInput } from "./parsers/index.js";

// Generator layer
export { generate } from "./generators/index.js";
export type { GenerateOptions, GenerateResult } from "./generators/index.js";

// Library API
export { CollectionBuilder } from "./api/CollectionBuilder.js";
export type { BuilderOptions } from "./api/CollectionBuilder.js";

// Config layer
export { loadConfig } from "./config/index.js";
export type { ResolvedConfig } from "./config/index.js";

// Plugin system
export type { Plugin, PluginHooks, PluginContext, PreOutputContext } from "./plugins/index.js";
