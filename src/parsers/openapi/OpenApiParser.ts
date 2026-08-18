import SwaggerParser from "@apidevtools/swagger-parser";
import yaml from "js-yaml";
import type { CollectionIR } from "../../ir/index.js";
import type { SpecInput } from "../types.js";
import type { ValidationResult } from "../../ir/validation.js";
import { loadSpec } from "../utils/spec-loader.js";
import { validateOpenAPI } from "../utils/spec-validator.js";
import { mapOpenApiDocument } from "./collection-mapper.js";

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

    return mapOpenApiDocument(resolved as UnknownObj);
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

}
