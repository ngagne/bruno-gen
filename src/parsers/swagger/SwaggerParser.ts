import SwaggerParser from "@apidevtools/swagger-parser";
import yaml from "js-yaml";
import type { CollectionIR } from "../../ir/index.js";
import type { SpecInput } from "../types.js";
import type { ValidationResult } from "../../ir/validation.js";
import { loadSpec } from "../utils/spec-loader.js";
import { validateOpenAPI } from "../utils/spec-validator.js";
import { normalizeSwaggerToOpenAPI3 } from "./normalizer.js";
import { mapOpenApiDocument } from "../openapi/collection-mapper.js";

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
    return mapOpenApiDocument(normalized as UnknownObj);
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

}

export { SwaggerParser_ as SwaggerParser };
