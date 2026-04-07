/**
 * Config loader — discovers and parses config files from CWD.
 *
 * Discovery order (first match wins):
 *   1. brunogen.config.yml
 *   2. brunogen.config.yaml
 *   3. brunogen.config.json
 *
 * If configPath is provided explicitly, it overrides auto-discovery.
 * Returns empty defaults if no config file is found (no error).
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import yaml from "js-yaml";
import type { ResolvedConfig } from "./types.js";

const CONFIG_FILENAMES = ["brunogen.config.yml", "brunogen.config.yaml", "brunogen.config.json"];

/**
 * Load configuration from file or return empty defaults.
 * @param cwd - Working directory for auto-discovery (default: process.cwd())
 * @param configPath - Explicit config file path (overrides auto-discovery)
 * @returns Resolved config object (empty defaults if no file found)
 */
async function loadConfig(cwd?: string, configPath?: string): Promise<ResolvedConfig> {
  const searchDir = configPath ? undefined : resolve(cwd ?? process.cwd());

  // If explicit path provided, load it directly
  if (configPath) {
    const absolutePath = resolve(configPath);
    if (!existsSync(absolutePath)) {
      return {}; // No file, no error
    }
    return parseConfigFile(absolutePath);
  }

  // Auto-discover
  if (searchDir) {
    for (const filename of CONFIG_FILENAMES) {
      const fullPath = join(searchDir, filename);
      if (existsSync(fullPath)) {
        return parseConfigFile(fullPath);
      }
    }
  }

  return {};
}

/** Parse a config file by extension. */
function parseConfigFile(filePath: string): ResolvedConfig {
  const content = readFileSync(filePath, "utf-8");
  const ext = filePath.toLowerCase().split(".").pop();

  try {
    if (ext === "json") {
      return JSON.parse(content) as ResolvedConfig;
    }
    if (ext === "yaml" || ext === "yml") {
      return yaml.load(content) as ResolvedConfig;
    }
    // Unknown extension — try JSON first, then YAML
    try {
      return JSON.parse(content) as ResolvedConfig;
    } catch {
      return yaml.load(content) as ResolvedConfig;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse config file ${filePath}: ${message}`);
  }
}

export { loadConfig };
