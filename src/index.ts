// Library entry point — re-exports all public IR types and parser API.
// Consumers: import { CollectionIR } from "bruno-collection-generator";

export type {
  CollectionIR,
  CollectionInfo,
  Server,
  ServerVariable,
  Tag,
  EndpointIR,
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
} from "./parsers/index.js";
export type { SpecParser, ParseOptions, SpecInput } from "./parsers/index.js";
