/**
 * Collection-level IR types — the root container for all generated Bruno content.
 */

import type { EndpointIR } from "./endpoint.js";
import type { ParameterIR } from "./parameter.js";
import type { RequestBodyIR } from "./request-body.js";
import type { ResponseIR } from "./response.js";
import type { SecurityRequirement, SecurityScheme } from "./security.js";
import type { SchemaIR } from "./schema.js";

/** Top-level metadata about the collection. */
interface CollectionInfo {
  title: string;
  description?: string;
  version: string;
  contact?: {
    name?: string;
    email?: string;
    url?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
}

/** A server URL with optional template variables. */
interface Server {
  url: string;
  description?: string;
  variables: Record<string, ServerVariable>;
}

/** A template variable within a server URL. */
interface ServerVariable {
  default: string;
  enum?: string[];
  description?: string;
}

/** An OpenAPI tag used to group endpoints. */
interface Tag {
  name: string;
  description?: string;
  externalDocs?: {
    url: string;
    description?: string;
  };
}

/** The root Intermediate Representation for an entire API collection. */
interface CollectionIR {
  info: CollectionInfo;
  servers: Server[];
  securitySchemes: Record<string, SecurityScheme>;
  defaultSecurity: SecurityRequirement[];
  tags: Tag[];
  endpoints: EndpointIR[];
  webhooks?: EndpointIR[];
  components: {
    schemas: Record<string, SchemaIR>;
    parameters: Record<string, ParameterIR>;
    responses: Record<string, ResponseIR>;
    requestBodies: Record<string, RequestBodyIR>;
  };
  extensions: Record<string, unknown>;
}

export type { CollectionIR, CollectionInfo, Server, ServerVariable, Tag };
