/**
 * CLI entry point for bruno-collection-generator.
 * Commander.js program with all flags and error handling.
 */

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "./parsers/parse.js";
import { generate } from "./generators/orchestrator.js";
import { formatSummary, createSpinner, formatError, printDryRunTree } from "./cli/output.js";

interface CliOptions {
  format: "tag" | "path" | "flat";
  tests: boolean;
  dryRun: boolean;
  config?: string;
  verbose: boolean;
}

function main(): void {
  const program = new Command();
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

  program
    .name("bruno-gen")
    .description("Convert OpenAPI, Swagger, and GraphQL specs into Bruno API collections")
    .version(pkg.version, "-V, --version")
    .argument("<spec>", "Path to OpenAPI, Swagger, or GraphQL spec file")
    .argument("[output]", "Output directory for the Bruno collection", "./bruno-output")
    .option("--format <tag|path|flat>", "Folder grouping strategy", "tag")
    .option("--tests", "Generate post-response test assertions")
    .option("--dry-run", "Print generated tree to stdout without writing files")
    .option("--config <path>", "Path to config file (reserved for Phase 5)")
    .option("--verbose", "Include stack traces in error output")
    .action(async (spec: string, output: string, opts: CliOptions) => {
      const startTime = Date.now();

      // Validate format option
      if (!["tag", "path", "flat"].includes(opts.format)) {
        process.stderr.write(
          `Error: Invalid format "${opts.format}". Must be one of: tag, path, flat\n`,
        );
        process.exit(1);
      }

      const specPath = resolve(spec);
      const outputDir = resolve(output);

      // Check spec file exists
      try {
        await import("node:fs").then((fs) => {
          fs.statSync(specPath);
        });
      } catch {
        process.stderr.write(`Spec file not found: ${specPath}\n`);
        process.exit(1);
      }

      // Dry-run mode
      if (opts.dryRun) {
        const spinner = createSpinner("Parsing spec...");
        spinner.start();
        try {
          const ir = await parse(specPath);
          spinner.succeed("Spec parsed successfully");

          printDryRunTree(ir, {
            format: opts.format,
            generateTests: opts.tests,
          });

          const elapsed = Date.now() - startTime;
          process.stdout.write(`\n(dry run — no files written)\n`);
          process.stdout.write(`Parsed ${ir.endpoints.length} endpoint(s) in ${elapsed}ms\n`);
          process.exit(0);
        } catch (error) {
          process.stderr.write(formatError(error as Error, opts.verbose));
          process.exit(1);
        }
        return;
      }

      // Full generation mode
      const parseSpinner = createSpinner("Parsing spec...");
      parseSpinner.start();
      try {
        const ir = await parse(specPath);
        parseSpinner.succeed("Spec parsed successfully");

        const genSpinner = createSpinner("Generating Bruno collection...");
        genSpinner.start();

        const result = await generate(ir, {
          outputDir,
          grouping: opts.format,
          generateTests: opts.tests,
        });

        genSpinner.succeed("Collection generated successfully");

        const elapsed = Date.now() - startTime;
        const summary = formatSummary({
          endpoints: ir.endpoints.length,
          filesWritten: result.filesWritten.length,
          warnings: result.warnings.length,
          elapsed,
        });
        process.stdout.write(summary);

        // Print warnings if any (exit 0 if only warnings)
        if (result.warnings.length > 0) {
          process.stdout.write("\nWarnings:\n");
          for (const warning of result.warnings) {
            process.stdout.write(`  ⚠ ${warning}\n`);
          }
        }

        process.exit(0);
      } catch (error) {
        process.stderr.write(formatError(error as Error, opts.verbose));
        process.exit(1);
      }
    });

  program.parse();
}

main();
