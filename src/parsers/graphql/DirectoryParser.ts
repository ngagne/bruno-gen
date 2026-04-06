import fs from "node:fs";
import path from "node:path";
import type { CollectionIR } from "../../ir/index.js";
import type { SpecInput } from "../types.js";
import type { ValidationResult, ValidationError, Warning } from "../../ir/validation.js";
import { GraphQLParser } from "./GraphQLParser.js";

// Directories to skip when scanning for .graphql files
const SKIP_DIRS = ["node_modules", "__tests__", "test", "tests", ".git", "dist", "build"];

export class DirectoryParser {
  private graphqlParser: GraphQLParser;

  constructor() {
    this.graphqlParser = new GraphQLParser();
  }

  /**
   * Check if the input is a directory containing .graphql files.
   */
  canParse(data: Record<string, unknown>): boolean {
    const dirPath = data._dirPath as string | undefined;
    if (!dirPath || !fs.existsSync(dirPath)) return false;

    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) return false;

    // Check if directory contains at least one .graphql file
    return this.findGraphqlFiles(dirPath).length > 0;
  }

  /**
   * Parse all .graphql files in a directory and return merged CollectionIR.
   */
  async parse(input: SpecInput | { dirPath: string }): Promise<CollectionIR> {
    const dirPath = "dirPath" in input ? input.dirPath : "";

    if (!fs.existsSync(dirPath)) {
      throw new Error(`Directory not found: ${dirPath}`);
    }

    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      throw new Error(`Not a directory: ${dirPath}`);
    }

    // Find all .graphql files
    const files = this.findGraphqlFiles(dirPath);

    if (files.length === 0) {
      throw new Error(`No .graphql or .gql files found in: ${dirPath}`);
    }

    // Read and merge all files (sorted by path for determinism)
    files.sort();
    const mergedSdl = files.map((f) => fs.readFileSync(f, "utf-8")).join("\n\n");

    // Delegate to GraphQLParser
    return this.graphqlParser.parse({ content: mergedSdl });
  }

  /**
   * Validate each .graphql file in a directory.
   */
  async validate(input: SpecInput | { dirPath: string }): Promise<ValidationResult> {
    const dirPath = "dirPath" in input ? input.dirPath : "";
    const files = this.findGraphqlFiles(dirPath);

    const allErrors: ValidationError[] = [];
    const allWarnings: Warning[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const result = await this.graphqlParser.validate({ content, format: "graphql" });
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  /**
   * Recursively find all .graphql and .gql files in a directory.
   */
  private findGraphqlFiles(dirPath: string): string[] {
    const results: string[] = [];

    const scan = (currentPath: string) => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(currentPath, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          // Skip known directories
          if (SKIP_DIRS.includes(entry.name)) continue;
          scan(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ext === ".graphql" || ext === ".gql") {
            results.push(fullPath);
          }
        }
      }
    };

    scan(dirPath);
    return results;
  }
}
