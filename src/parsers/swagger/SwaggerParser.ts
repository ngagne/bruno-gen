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
import { normalizeSwaggerToOpenAPI3 } from "./normalizer.js";
import { mapEndpoints } from "../openapi/endpoint-mapper.js";
import { mapSchema } from "../openapi/schema-mapper.js";
import { mapSecuritySchemes, mapSecurityRequirements } from "../openapi/security-mapper.js";

type UnknownObj = Record<string, unknown>;

export class SwaggerParser_ {
  canParse(data: UnknownObj): boolean {
    return data.swagger === "2.0";
  }

  async parse(input: SpecInput): Promise<CollectionIR> {
    let data: UnknownObj;

    if ("filePath" in input) {
      const loaded = loadSpec(input.filePath);
      data = loaded.data;
    } else {
      const raw = input.content;
      if (typeof raw === "string") {
        try {
          data = JSON.parse(raw);
        } catch {
          data = yaml.load(raw) as UnknownObj;
        }
      } else {
        data = raw as UnknownObj;
      }
    }

    if (!this.canParse(data)) {
      throw new Error(`Not a Swagger 2.0 spec. Found swagger field: "${data.swagger}"`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolved: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolved = await SwaggerParser.dereference(data as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to dereference Swagger spec: ${message}`);
    }

    const normalized = normalizeSwaggerToOpenAPI3(resolved);
    return this.buildCollectionIR(normalized as UnknownObj);
  }

  async validate(input: SpecInput): Promise<ValidationResult> {
    let data: UnknownObj;
    let source: string;

    if ("filePath" in input) {
      const loaded = loadSpec(input.filePath);
      data = loaded.data;
      source = loaded.source;
    } else {
      data = input.content as unknown as UnknownObj;
      source = "inline";
    }

    return validateOpenAPI(data, source);
  }

  private buildCollectionIR(spec: UnknownObj): CollectionIR {
    const info = (spec.info as UnknownObj) || {};
    const servers = (spec.servers as Server[]) || [];

    const components = (spec.components as UnknownObj) || {};
    const securitySchemes = mapSecuritySchemes(
      components.securitySchemes as UnknownObj | undefined,
    );
    const defaultSecurity = mapSecurityRequirements(spec.security as UnknownObj[] | undefined);
    const tags = ((spec.tags as UnknownObj[]) || []).map((t) => ({
      name: (t?.name as string) || "",
      description: t?.description as string | undefined,
      externalDocs: t?.externalDocs as Tag["externalDocs"],
    }));

    const rootProduces = ((spec as UnknownObj)._rootProduces as string[] | undefined) || [];
    const rootConsumes = ((spec as UnknownObj)._rootConsumes as string[] | undefined) || [];

    const endpoints = mapEndpoints((spec.paths as UnknownObj) || {}, rootProduces, rootConsumes);

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
      servers,
      securitySchemes,
      defaultSecurity,
      tags,
      endpoints,
      components: { schemas, parameters, responses, requestBodies },
      extensions: {},
    };
  }
}

export { SwaggerParser_ as SwaggerParser };
