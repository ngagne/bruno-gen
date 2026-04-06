/**
 * Normalize a Swagger 2.0 spec to OpenAPI 3.x equivalent structure.
 * This allows reusing the OpenAPI mappers for IR construction.
 */

export function normalizeSwaggerToOpenAPI3(spec: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {
    openapi: "3.0.0",
    info: spec.info || { title: "API", version: "1.0.0" },
    paths: spec.paths || {},
  };

  // Servers: host + basePath + schemes → servers array
  const host = (spec.host as string) || "";
  const basePath = (spec.basePath as string) || "";
  const schemes = (spec.schemes as string[]) || ["https"];

  if (host) {
    normalized.servers = schemes.map((scheme) => ({
      url: `${scheme}://${host}${basePath || ""}`,
    }));
  } else if (basePath) {
    normalized.servers = [{ url: basePath }];
  }

  // Schemas: definitions → components.schemas
  if (spec.definitions && typeof spec.definitions === "object") {
    normalized.components = normalized.components || {};
    (normalized.components as Record<string, unknown>).schemas = spec.definitions;

    // Rewrite $ref paths in schemas from #/definitions/X to #/components/schemas/X
    rewriteDefinitionRefs(normalized);
  }

  // Parameters: root-level parameters → components.parameters
  if (spec.parameters && typeof spec.parameters === "object") {
    normalized.components = normalized.components || {};
    (normalized.components as Record<string, unknown>).parameters = spec.parameters;
  }

  // Responses: root-level responses → components.responses
  if (spec.responses && typeof spec.responses === "object") {
    normalized.components = normalized.components || {};
    (normalized.components as Record<string, unknown>).responses = spec.responses;
  }

  // Security: securityDefinitions → components.securitySchemes
  if (spec.securityDefinitions && typeof spec.securityDefinitions === "object") {
    normalized.components = normalized.components || {};
    (normalized.components as Record<string, unknown>).securitySchemes =
      normalizeSecurityDefinitions(spec.securityDefinitions as Record<string, unknown>);
  }

  // Tags
  if (spec.tags && Array.isArray(spec.tags)) {
    normalized.tags = spec.tags;
  }

  // Store root-level produces/consumes for later use
  if (spec.produces && Array.isArray(spec.produces)) {
    (normalized as Record<string, unknown>)._rootProduces = spec.produces;
  }
  if (spec.consumes && Array.isArray(spec.consumes)) {
    (normalized as Record<string, unknown>)._rootConsumes = spec.consumes;
  }

  // Normalize paths: apply produces/consumes, convert formData params
  normalized.paths = normalizePaths(
    spec.paths as Record<string, unknown> | undefined,
    (spec.produces as string[]) || [],
    (spec.consumes as string[]) || [],
  );

  return normalized;
}

/**
 * Rewrite $ref paths from #/definitions/X to #/components/schemas/X.
 */
function rewriteDefinitionRefs(obj: unknown): void {
  if (!obj || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      rewriteDefinitionRefs(item);
    }
    return;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (key === "$ref" && typeof value === "string") {
      (obj as Record<string, unknown>)[key] = value.replace(
        /#\/definitions\//g,
        "#/components/schemas/",
      );
    } else if (typeof value === "object" && value !== null) {
      rewriteDefinitionRefs(value);
    }
  }
}

/**
 * Normalize Swagger security definitions to OpenAPI 3.x format.
 */
function normalizeSecurityDefinitions(defs: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [name, def] of Object.entries(defs)) {
    const scheme = def as Record<string, unknown>;
    const type = scheme.type as string;

    if (type === "basic") {
      result[name] = { type: "http", scheme: "basic", description: scheme.description };
    } else if (type === "apiKey") {
      result[name] = { ...def }; // Already compatible
    } else if (type === "oauth2") {
      result[name] = {
        type: "oauth2",
        description: scheme.description,
        flows: normalizeOAuth2Flows(scheme),
      };
    }
  }

  return result;
}

/**
 * Convert Swagger 2.0 OAuth2 to OpenAPI 3.x flows format.
 */
function normalizeOAuth2Flows(def: Record<string, unknown>): Record<string, unknown> {
  const flow = (def.flow as string) || "";
  const scopes = (def.scopes as Record<string, string>) || {};
  const flows: Record<string, unknown> = {};

  if (flow === "accessCode") {
    flows.authorizationCode = {
      authorizationUrl: def.authorizationUrl,
      tokenUrl: def.tokenUrl,
      scopes,
    };
  } else if (flow === "implicit") {
    flows.implicit = {
      authorizationUrl: def.authorizationUrl,
      scopes,
    };
  } else if (flow === "password") {
    flows.password = {
      tokenUrl: def.tokenUrl,
      scopes,
    };
  } else if (flow === "application") {
    flows.clientCredentials = {
      tokenUrl: def.tokenUrl,
      scopes,
    };
  }

  return flows;
}

/**
 * Normalize path operations: apply root produces/consumes, handle formData params.
 */
function normalizePaths(
  paths: Record<string, unknown> | undefined,
  rootProduces: string[],
  rootConsumes: string[],
): Record<string, unknown> {
  if (!paths) return {};

  const result: Record<string, unknown> = {};

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;

    const normalizedPathItem: Record<string, unknown> = {};

    // Copy path-level parameters
    if ((pathItem as Record<string, unknown>).parameters) {
      normalizedPathItem.parameters = (pathItem as Record<string, unknown>).parameters;
    }

    for (const [method, operation] of Object.entries(pathItem)) {
      if (!["get", "post", "put", "patch", "delete", "head", "options", "trace"].includes(method))
        continue;

      const op = operation as Record<string, unknown>;
      const normalizedOp = { ...op };

      // Apply root produces/consumes if not overridden
      if (!op.produces && rootProduces.length > 0) {
        normalizedOp.produces = rootProduces;
      }
      if (!op.consumes && rootConsumes.length > 0) {
        normalizedOp.consumes = rootConsumes;
      }

      // Handle formData parameters → requestBody
      const parameters = (op.parameters as Record<string, unknown>[]) || [];
      const formDataParams = parameters.filter((p) => p.in === "formData");
      const nonFormDataParams = parameters.filter((p) => p.in !== "formData");

      if (formDataParams.length > 0) {
        // Check if any param has type: file → use multipart/form-data
        const hasFile = formDataParams.some((p) => p.type === "file");
        const mediaType = hasFile ? "multipart/form-data" : "application/x-www-form-urlencoded";

        const schema: Record<string, unknown> = {
          type: "object",
          properties: {},
          required: [] as string[],
        };

        for (const param of formDataParams) {
          if (param.name) {
            (schema.properties as Record<string, unknown>)[param.name as string] = {
              type: param.type === "file" ? "string" : param.type || "string",
              format: param.type === "file" ? "binary" : param.format,
            };
            if (param.required) {
              (schema.required as string[]).push(param.name as string);
            }
          }
        }

        normalizedOp.requestBody = {
          required: formDataParams.some((p) => p.required),
          content: {
            [mediaType]: { schema },
          },
        };
        normalizedOp.parameters = nonFormDataParams;
      }

      normalizedPathItem[method] = normalizedOp;
    }

    result[path] = normalizedPathItem;
  }

  return result;
}
