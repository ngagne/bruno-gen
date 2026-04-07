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

// Static imports — modules exist at runtime
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { sanitizeFolderName } from "../generators/path-sanitizer.js";

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

interface DryRunGroup {
  folderName: string | null;
  endpoints: { id: string; method: string; path: string }[];
}

/**
 * Print an ASCII tree of the generated collection structure to stdout.
 */
function printDryRunTree(ir: CollectionIR, opts: DryRunOptions): void {
  const lines: string[] = [];
  lines.push(".");
  lines.push("├── collection.bru");
  lines.push("├── environments/");
  lines.push("│   └── default.bru");

  const groups = groupEndpointsForDryRun(ir, opts.format);

  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    const isLastGroup = g === groups.length - 1;

    if (group.folderName) {
      const folderPrefix = isLastGroup ? "└── " : "├── ";
      const childPrefix = isLastGroup ? "    " : "│   ";
      lines.push(`${folderPrefix}${group.folderName}/`);
      lines.push(`${childPrefix}└── folder.bru`);

      for (let e = 0; e < group.endpoints.length; e++) {
        const ep = group.endpoints[e];
        const isLastEp = e === group.endpoints.length - 1;
        const epPrefix = isLastEp ? "    └── " : "    ├── ";
        const filename = ep.id || `${ep.method}-${ep.path}`;
        lines.push(`${childPrefix}${epPrefix}${filename}.bru`);
      }
    } else {
      // Flat mode — all at root
      for (let e = 0; e < group.endpoints.length; e++) {
        const ep = group.endpoints[e];
        const isLastEp = e === group.endpoints.length - 1;
        const epPrefix = isLastEp ? "└── " : "├── ";
        const filename = ep.id || `${ep.method}-${ep.path}`;
        lines.push(`${epPrefix}${filename}.bru`);
      }
    }
  }

  if (opts.generateTests) {
    lines.push("");
    lines.push("(post-response test assertions will be generated)");
  }

  process.stdout.write(lines.join("\n") + "\n");
}

function groupEndpointsForDryRun(ir: CollectionIR, format: "tag" | "path" | "flat"): DryRunGroup[] {
  if (format === "flat") {
    return [{ folderName: null, endpoints: ir.endpoints }];
  }

  if (format === "path") {
    const pathMap = new Map<string, typeof ir.endpoints>();
    for (const ep of ir.endpoints) {
      const firstSegment = ep.path.split("/").filter(Boolean)[0] ?? "root";
      const existing = pathMap.get(firstSegment) ?? [];
      existing.push(ep);
      pathMap.set(firstSegment, existing);
    }
    const groups: DryRunGroup[] = [];
    for (const [segment, endpoints] of pathMap) {
      groups.push({ folderName: sanitizeFolderName(segment), endpoints });
    }
    return groups;
  }

  // Default: tag-based grouping
  const tagMap = new Map<string, typeof ir.endpoints>();
  const ungrouped: typeof ir.endpoints = [];
  for (const ep of ir.endpoints) {
    if (ep.tags && ep.tags.length > 0) {
      const tag = ep.tags[0];
      const existing: typeof ir.endpoints = tagMap.get(tag) ?? [];
      existing.push(ep);
      tagMap.set(tag, existing);
    } else {
      ungrouped.push(ep);
    }
  }
  const groups: DryRunGroup[] = [];
  for (const [tag, endpoints] of tagMap) {
    groups.push({ folderName: sanitizeFolderName(tag), endpoints });
  }
  if (ungrouped.length > 0) {
    groups.push({ folderName: "ungrouped", endpoints: ungrouped });
  }
  return groups;
}

export { isInteractive, formatSummary, createSpinner, formatError, printDryRunTree };
