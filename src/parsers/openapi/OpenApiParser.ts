import SwaggerParser from "@apidevtools/swagger-parser";
import yaml from "js-yaml";
import type {
  CollectionIR,
  Server,
  Tag,
  ParameterIR,
  ResponseIR,
  RequestBodyIR,
  SchemaIR,
} from "../../ir/index.js";
import type { SpecInput } from "../types.js";
import type { ValidationResult } from "../../ir/validation.js";
import { loadSpec } from "../utils/spec-loader.js";
import { validateOpenAPI } from "../utils/spec-validator.js";
import { mapEndpoints } from "./endpoint-mapper.js";
import { mapSchema } from "./schema-mapper.js";
import { mapSecuritySchemes, mapSecurityRequirements } from "./security-mapper.js";

type UnknownObj = Record<string, unknown>;

export class OpenApiParser {
  canParse(data: UnknownObj): boolean {
    if (typeof data.openapi !== "string") return false;
    return /^3\.[01]\./.test(data.openapi as string);
  }

  async parse(input: SpecInput): Promise<CollectionIR> {
    const { data } = await this.load(input);

    if (!this.canParse(data)) {
      throw new Error(`Not an OpenAPI 3.x spec. Found openapi field: "${data.openapi}"`);
    }

    let resolved: unknown;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolved = await SwaggerParser.dereference(data as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to dereference OpenAPI spec: ${message}`);
    }

    return this.buildCollectionIR(resolved as UnknownObj);
  }

  async validate(input: SpecInput): Promise<ValidationResult> {
    const { data, source } = await this.load(input);
    return validateOpenAPI(data, source);
  }

  private async load(input: SpecInput): Promise<{ data: UnknownObj; source: string }> {
    if ("filePath" in input) {
      return loadSpec(input.filePath);
    }

    const raw = input.content;
    let data: UnknownObj;
    if (typeof raw === "string") {
      try {
        data = JSON.parse(raw);
      } catch {
        data = yaml.load(raw) as UnknownObj;
      }
    } else {
      data = raw as UnknownObj;
    }
    return { data, source: "inline" };
  }

  private buildCollectionIR(spec: UnknownObj): CollectionIR {
    const info = (spec.info as UnknownObj) || {};
    const servers = ((spec.servers as UnknownObj[]) || []).map((s) => ({
      url: (s?.url as string) || "",
      description: s?.description as string | undefined,
      variables: (s?.variables as Record<string, unknown>) || {},
    }));

    const securitySchemes = mapSecuritySchemes(
      (spec.components as UnknownObj)?.securitySchemes as UnknownObj | undefined,
    );
    const defaultSecurity = mapSecurityRequirements(spec.security as UnknownObj[] | undefined);
    const tags = ((spec.tags as UnknownObj[]) || []).map((t) => ({
      name: (t?.name as string) || "",
      description: t?.description as string | undefined,
      externalDocs: t?.externalDocs as Tag["externalDocs"],
    }));

    const endpoints = mapEndpoints(
      (spec.paths as UnknownObj) || {},
      (spec.produces as string[]) || [],
      (spec.consumes as string[]) || [],
    );

    const components = (spec.components as UnknownObj) || {};
    const schemas: Record<string, SchemaIR> = {};
    if (components.schemas) {
      for (const [name, schemaObj] of Object.entries(components.schemas as UnknownObj)) {
        schemas[name] = mapSchema(schemaObj as UnknownObj, `#/components/schemas/${name}`);
      }
    }

    const parameters = (components.parameters as Record<string, ParameterIR>) || {};
    const responses = (components.responses as Record<string, ResponseIR>) || {};
    const requestBodies = (components.requestBodies as Record<string, RequestBodyIR>) || {};

    return {
      info: {
        title: (info.title as string) || "Untitled API",
        description: info.description as string | undefined,
        version: (info.version as string) || "1.0.0",
        contact: info.contact as CollectionIR["info"]["contact"],
        license: info.license as CollectionIR["info"]["license"],
      },
      servers: servers as Server[],
      securitySchemes,
      defaultSecurity,
      tags: tags as Tag[],
      endpoints,
      components: { schemas, parameters, responses, requestBodies },
      extensions: {},
    };
  }
}
