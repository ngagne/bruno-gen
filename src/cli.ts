/**
 * CLI entry point for gen-bruno.
 * Commander.js program with all flags and error handling.
 */

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "./parsers/parse.js";
import { generate } from "./generators/orchestrator.js";
import { formatSummary, createSpinner, formatError, printDryRunTree } from "./cli/output.js";
import { loadConfig, mergeConfig } from "./config/index.js";
import { loadPlugin } from "./plugins/load.js";
import type { Plugin } from "./plugins/types.js";

interface CliOptions {
  format: "tag" | "path" | "flat";
  tests: boolean;
  dryRun: boolean;
  config?: string;
  verbose: boolean;
}

/** Default generation options. */
const DEFAULTS = {
  format: "tag" as const,
  tests: false,
  force: false,
  outputDir: "./bruno-output",
};

function main(): void {
  const program = new Command();
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

  program
    .name("gen-bruno")
    .description(
      "Convert OpenAPI, Swagger, GraphQL, gRPC, and AsyncAPI specs into Bruno collections",
    )
    .version(pkg.version, "-V, --version")
    .argument("[spec]", "Path to an OpenAPI, Swagger, GraphQL, gRPC, or AsyncAPI spec file")
    .argument("[output]", "Output directory for the Bruno collection")
    .option("--format <tag|path|flat>", "Folder grouping strategy", "tag")
    .option("--tests", "Generate post-response test assertions")
    .option("--dry-run", "Print generated tree to stdout without writing files")
    .option("--config <path>", "Path to config file")
    .option("--verbose", "Include stack traces in error output")
    .action(async (spec: string | undefined, output: string | undefined, opts: CliOptions) => {
      const startTime = Date.now();

      // Validate format option
      if (!["tag", "path", "flat"].includes(opts.format)) {
        process.stderr.write(
          `Error: Invalid format "${opts.format}". Must be one of: tag, path, flat\n`,
        );
        process.exit(1);
      }

      // Step 1: Load config file
      const configFile = await loadConfig(process.cwd(), opts.config);

      // Step 2: Merge defaults < config < CLI flags
      const cliFlags = {
        format: opts.format,
        tests: opts.tests,
        outputDir: output,
      };
      const resolved = mergeConfig(DEFAULTS, configFile, cliFlags);

      // Step 3: Resolve spec path (CLI arg > config.spec)
      const specPath = spec ? resolve(spec) : resolved.spec ? resolve(resolved.spec) : undefined;
      if (!specPath) {
        process.stderr.write(
          "Error: No spec file provided. Provide a <spec> argument or set 'spec' in your config file.\n",
        );
        process.exit(1);
      }

      // Step 4: Resolve output dir
      const outputDir = resolve(resolved.outputDir ?? DEFAULTS.outputDir);

      // Step 5: Load plugins from config
      const loadedPlugins: Plugin[] = [];
      if (resolved.plugins && resolved.plugins.length > 0) {
        const pluginSpinner = createSpinner("Loading plugins...");
        pluginSpinner.start();
        try {
          for (const pluginSource of resolved.plugins) {
            const plugin = await loadPlugin(pluginSource);
            loadedPlugins.push(plugin);
          }
          pluginSpinner.succeed(`Loaded ${loadedPlugins.length} plugin(s)`);
        } catch (error) {
          pluginSpinner.fail("Failed to load plugins");
          process.stderr.write(formatError(error as Error, opts.verbose));
          process.exit(1);
        }
      }

      // Dry-run mode
      if (opts.dryRun) {
        const spinner = createSpinner("Parsing spec...");
        spinner.start();
        try {
          const ir = await parse(specPath);
          spinner.succeed("Spec parsed successfully");

          printDryRunTree(ir, {
            format: resolved.format ?? opts.format,
            generateTests: resolved.tests ?? opts.tests,
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
          grouping: resolved.format ?? opts.format,
          generateTests: resolved.tests ?? opts.tests,
          force: resolved.force,
          plugins: loadedPlugins.length > 0 ? loadedPlugins : undefined,
          specPath,
          resolvedConfig: resolved,
        });

        if (!result.success && result.warnings.length > 0) {
          // Check if it's a plugin error (success: false with warnings)
          const isPluginError = result.warnings.some(
            (w) => w.includes("Plugin") && w.includes("failed"),
          );
          if (isPluginError) {
            genSpinner.fail("Generation failed");
            for (const warning of result.warnings) {
              process.stderr.write(`Error: ${warning}\n`);
            }
            process.exit(1);
          }
        }

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
