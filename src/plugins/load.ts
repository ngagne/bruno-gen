/**
 * Plugin loader — validates and loads plugins (inline objects or file paths).
 */

import { pathToFileURL } from "node:url";
import type { Plugin } from "./types.js";

const RECOGNIZED_HOOKS = ["transformIR", "preOutput"] as const;

/**
 * Load and validate a plugin from an inline object or file path.
 * @param source - Plugin object or file path/package name
 * @returns Validated Plugin object
 */
async function loadPlugin(source: string | Plugin): Promise<Plugin> {
  // Inline plugin object — validate and return
  if (typeof source !== "string") {
    validatePlugin(source);
    return source;
  }

  // String: file path or package name — dynamic import
  let imported: unknown;
  try {
    // Use file:// URL for absolute paths to work on all platforms
    const importPath =
      source.startsWith("/") || /^[A-Za-z]:/.test(source) ? pathToFileURL(source).href : source;
    imported = await import(importPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load plugin from "${source}": ${message}`);
  }

  // Handle default export (ESM) or module.exports (CJS)
  const plugin =
    imported && typeof imported === "object" && "default" in imported
      ? (imported as { default: unknown }).default
      : imported;

  if (typeof plugin !== "object" || plugin === null || Array.isArray(plugin)) {
    throw new Error(`Plugin "${source}" did not export a valid plugin object`);
  }

  validatePlugin(plugin as Plugin);
  return plugin as Plugin;
}

/** Validate a plugin object has required fields. */
function validatePlugin(plugin: Plugin): void {
  // Must have name
  if (typeof plugin.name !== "string" || plugin.name.trim() === "") {
    throw new Error(`Plugin is invalid: missing or empty "name" (expected non-empty string)`);
  }

  // Must have hooks object
  if (typeof plugin.hooks !== "object" || plugin.hooks === null) {
    throw new Error(
      `Plugin '${plugin.name}' is invalid: missing hooks (expected object with at least one recognized hook)`,
    );
  }

  // Must have at least one recognized hook
  const hasRecognizedHook = RECOGNIZED_HOOKS.some(
    (hook) => typeof plugin.hooks[hook] === "function",
  );
  if (!hasRecognizedHook) {
    throw new Error(
      `Plugin '${plugin.name}' is invalid: no recognized hooks (expected one of: ${RECOGNIZED_HOOKS.join(", ")})`,
    );
  }
}

export { loadPlugin };
