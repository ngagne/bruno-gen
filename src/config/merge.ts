/**
 * Config merge strategy — three-layer merge: defaults < config file < CLI flags.
 *
 * Rules:
 * - CLI flags always win (shallow merge for scalars)
 * - Plugin arrays: concat (config plugins + CLI plugins)
 * - Unknown fields: pass through (forward-compatible)
 */

import type { ResolvedConfig } from "./types.js";

/** Shallow merge with array concat for plugins. */
function mergeConfig(
  defaults: Partial<ResolvedConfig>,
  configFile: Partial<ResolvedConfig>,
  cliFlags: Partial<ResolvedConfig>,
): ResolvedConfig {
  // Layer 1: defaults
  const merged: Partial<ResolvedConfig> = { ...defaults };

  // Layer 2: config file overrides defaults
  for (const key of Object.keys(configFile) as (keyof ResolvedConfig)[]) {
    const value = configFile[key];
    if (value !== undefined) {
      if (key === "plugins" && Array.isArray(value)) {
        // Concat plugin arrays
        merged.plugins = [...(merged.plugins ?? []), ...value];
      } else {
        (merged as Record<string, unknown>)[key] = value;
      }
    }
  }

  // Layer 3: CLI flags always win
  for (const key of Object.keys(cliFlags) as (keyof ResolvedConfig)[]) {
    const value = cliFlags[key];
    if (value !== undefined) {
      if (key === "plugins" && Array.isArray(value)) {
        // Concat plugin arrays
        merged.plugins = [...(merged.plugins ?? []), ...value];
      } else {
        (merged as Record<string, unknown>)[key] = value;
      }
    }
  }

  return merged as ResolvedConfig;
}

export { mergeConfig };
