/**
 * TTY-aware output formatting utilities.
 *
 * Behavior rules:
 * - process.stdout.isTTY === true → colors, spinner, table
 * - process.stdout.isTTY === false → plain text, no spinners
 * - CI=true env var → always plain text (overrides TTY)
 * - NO_COLOR env var → always plain text (overrides TTY)
 */

import type TableConstructor from "cli-table3";
import type { CollectionIR } from "../ir/index.js";
import { planCollection } from "../generators/collection-plan.js";

// Static imports — modules exist at runtime
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";

/**
 * Check if we're running in an interactive terminal.
 */
function isInteractive(): boolean {
  const hasTTY = typeof process !== "undefined" && process.stdout?.isTTY === true;
  const isCI = typeof process !== "undefined" && process.env?.CI === "true";
  const noColor =
    typeof process !== "undefined" &&
    (process.env?.NO_COLOR === "true" || process.env?.NO_COLOR === "1");

  return hasTTY && !isCI && !noColor;
}

/**
 * Create a spinner in TTY mode, or a no-op object in non-TTY mode.
 */
function createSpinner(message: string): {
  start(): { succeed(): void; fail(): void };
  succeed(): void;
  fail(): void;
} {
  if (!isInteractive()) {
    return {
      start() {
        return {
          succeed() {
            // no-op
          },
          fail() {
            // no-op
          },
        };
      },
      succeed() {
        // no-op
      },
      fail() {
        // no-op
      },
    };
  }

  const spinner = ora({ text: message, spinner: "dots" });
  return {
    start() {
      spinner.start();
      return {
        succeed(msg?: string) {
          spinner.succeed(msg);
        },
        fail(msg?: string) {
          spinner.fail(msg);
        },
      };
    },
    succeed(msg?: string) {
      spinner.succeed(msg);
    },
    fail(msg?: string) {
      spinner.fail(msg);
    },
  };
}

interface SummaryStats {
  endpoints: number;
  filesWritten: number;
  warnings: number;
  elapsed: number;
}

/**
 * Format a summary table for the generation results.
 */
function formatSummary(stats: SummaryStats): string {
  if (isInteractive()) {
    const table = new (Table as TableConstructor)({
      head: [chalk.cyan("Metric"), chalk.cyan("Value")],
      colWidths: [20, 15],
    });
    table.push(
      ["Endpoints", stats.endpoints.toString()],
      ["Files written", stats.filesWritten.toString()],
      ["Warnings", stats.warnings.toString()],
      ["Time", `${stats.elapsed}ms`],
    );
    return `\n${table.toString()}\n`;
  }

  // Plain text fallback
  return [
    "",
    `Endpoints: ${stats.endpoints}`,
    `Files written: ${stats.filesWritten}`,
    `Warnings: ${stats.warnings}`,
    `Time: ${stats.elapsed}ms`,
    "",
  ].join("\n");
}

/**
 * Format an error message. Includes stack trace only in verbose mode.
 */
function formatError(error: Error, verbose: boolean): string {
  if (verbose && error.stack) {
    return `Error: ${error.message}\n${error.stack}\n`;
  }
  return `Error: ${error.message}\n`;
}

interface DryRunOptions {
  format: "tag" | "path" | "flat";
  generateTests: boolean;
}

/**
 * Print the exact files the generator would write, without touching disk.
 */
function printDryRunTree(ir: CollectionIR, opts: DryRunOptions): void {
  const plan = planCollection(ir, { grouping: opts.format, generateTests: opts.generateTests });
  const lines = [".", ...plan.files.map((file) => `├── ${file.relativePath}`)];

  if (opts.generateTests) {
    lines.push("");
    lines.push("(post-response test assertions will be generated)");
  }

  process.stdout.write(lines.join("\n") + "\n");
}

export { isInteractive, formatSummary, createSpinner, formatError, printDryRunTree };
