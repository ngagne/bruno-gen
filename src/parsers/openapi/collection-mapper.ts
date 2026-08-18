/** Map an OpenAPI-shaped document (including normalized Swagger) into the IR. */

import type {
  CollectionIR,
  ParameterIR,
  RequestBodyIR,
  ResponseIR,
  SchemaIR,
  Server,
  Tag,
} from "../../ir/index.js";
import { mapEndpoints } from "./endpoint-mapper.js";
import { mapSchema } from "./schema-mapper.js";
import { mapSecurityRequirements, mapSecuritySchemes } from "./security-mapper.js";

type UnknownObj = Record<string, unknown>;

/**
 * Create the shared HTTP collection IR after format-specific normalization and
 * dereferencing. Format adapters only need to supply an OpenAPI-shaped object.
 */
function mapOpenApiDocument(spec: UnknownObj): CollectionIR {
  const info = (spec.info as UnknownObj) || {};
  const components = (spec.components as UnknownObj) || {};
  const servers = ((spec.servers as UnknownObj[]) || []).map((server) => ({
    url: (server?.url as string) || "",
    description: server?.description as string | undefined,
    variables: (server?.variables as Server["variables"]) || {},
  }));
  const tags = ((spec.tags as UnknownObj[]) || []).map((tag) => ({
    name: (tag?.name as string) || "",
    description: tag?.description as string | undefined,
    externalDocs: tag?.externalDocs as Tag["externalDocs"],
  }));
  const schemas: Record<string, SchemaIR> = {};

  if (components.schemas) {
    for (const [name, schema] of Object.entries(components.schemas as UnknownObj)) {
      schemas[name] = mapSchema(schema as UnknownObj, `#/components/schemas/${name}`);
    }
  }

  return {
    info: {
      title: (info.title as string) || "Untitled API",
      description: info.description as string | undefined,
      version: (info.version as string) || "1.0.0",
      contact: info.contact as CollectionIR["info"]["contact"],
      license: info.license as CollectionIR["info"]["license"],
    },
    servers,
    securitySchemes: mapSecuritySchemes(components.securitySchemes as UnknownObj | undefined),
    defaultSecurity: mapSecurityRequirements(spec.security as UnknownObj[] | undefined),
    tags,
    endpoints: mapEndpoints(
      (spec.paths as UnknownObj) || {},
      ((spec._rootProduces ?? spec.produces) as string[]) || [],
      ((spec._rootConsumes ?? spec.consumes) as string[]) || [],
    ),
    components: {
      schemas,
      parameters: (components.parameters as Record<string, ParameterIR>) || {},
      responses: (components.responses as Record<string, ResponseIR>) || {},
      requestBodies: (components.requestBodies as Record<string, RequestBodyIR>) || {},
    },
    extensions: {},
  };
}

export { mapOpenApiDocument };
