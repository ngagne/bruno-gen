import { parse as gqlParse, buildSchema } from "graphql";
import type { GraphQLSchema } from "graphql";
import type { CollectionIR, SchemaIR } from "../../ir/index.js";
import type { SpecInput } from "../types.js";
import type { ValidationResult } from "../../ir/validation.js";
import { mapGraphQLTypeToSchema } from "./schema-mapper.js";
import { mapGraphQLEndpoints } from "./endpoint-mapper.js";
import { validateGraphQL } from "../utils/spec-validator.js";

export class GraphQLParser {
  /**
   * Check if this parser can handle the given content.
   * For GraphQL, we check the file extension or inspect content for SDL syntax.
   */
  canParse(data: Record<string, unknown>): boolean {
    // If data has a _filePath, check extension
    if (data._filePath && typeof data._filePath === "string") {
      const ext = (data._filePath as string).toLowerCase();
      if (ext.endsWith(".graphql") || ext.endsWith(".gql")) {
        return true;
      }
    }

    // Check for GraphQL SDL syntax in content
    if (typeof data._raw === "string") {
      return this.looksLikeGraphQLSdl(data._raw);
    }

    return false;
  }

  /**
   * Parse GraphQL SDL and return CollectionIR.
   */
  async parse(input: SpecInput): Promise<CollectionIR> {
    let sdl: string;

    if ("filePath" in input) {
      sdl = await this.loadFile(input.filePath);
    } else {
      sdl = input.content;
    }

    // Parse and build schema
    let schema: GraphQLSchema;
    try {
      gqlParse(sdl);
      schema = buildSchema(sdl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse GraphQL SDL: ${message}`);
    }

    return this.buildCollectionIR(schema);
  }

  /**
   * Validate GraphQL SDL.
   */
  async validate(input: SpecInput): Promise<ValidationResult> {
    let sdl: string;
    let source: string;

    if ("filePath" in input) {
      sdl = await this.loadFile(input.filePath);
      source = input.filePath;
    } else {
      sdl = input.content;
      source = "inline";
    }

    return validateGraphQL(sdl, source);
  }

  /**
   * Build CollectionIR from a GraphQL schema.
   */
  private buildCollectionIR(schema: GraphQLSchema): CollectionIR {
    // Endpoints from Query and Mutation types
    const endpoints = mapGraphQLEndpoints(schema);

    // Component schemas from all named types
    const schemas: Record<string, SchemaIR> = {};
    const typeMap = schema.getTypeMap();

    for (const [typeName, type] of Object.entries(typeMap)) {
      // Skip built-in types
      if (typeName.startsWith("__")) continue;
      if (["String", "Int", "Float", "Boolean", "ID"].includes(typeName)) continue;

      const rootTypes = [
        schema.getQueryType(),
        schema.getMutationType(),
        schema.getSubscriptionType(),
      ]
        .filter((type): type is NonNullable<typeof type> => type !== undefined)
        .map((type) => type.name);
      if (rootTypes.includes(typeName)) continue;

      const schemaIR = mapGraphQLTypeToSchema(type);
      if (schemaIR) {
        schemas[typeName] = schemaIR;
      }
    }

    return {
      info: {
        title: "GraphQL API",
        version: "1.0.0",
      },
      servers: [{ url: "http://localhost:4000", description: "GraphQL endpoint", variables: {} }],
      securitySchemes: {},
      defaultSecurity: [],
      tags: [
        { name: "query", description: "GraphQL query operations" },
        { name: "mutation", description: "GraphQL mutation operations" },
      ],
      endpoints,
      components: {
        schemas,
        parameters: {},
        responses: {},
        requestBodies: {},
      },
      extensions: {},
    };
  }

  /**
   * Load a file's content from disk.
   */
  private async loadFile(filePath: string): Promise<string> {
    const fs = await import("node:fs");
    return fs.readFileSync(filePath, "utf-8");
  }

  /**
   * Check if a string looks like GraphQL SDL.
   */
  private looksLikeGraphQLSdl(content: string): boolean {
    const patterns = [
      /\btype\s+Query\b/i,
      /\btype\s+Mutation\b/i,
      /\bscalar\s+\w+/i,
      /\benum\s+\w+/i,
      /\bunion\s+\w+/i,
      /\binput\s+\w+/i,
    ];
    return patterns.some((p) => p.test(content));
  }
}
