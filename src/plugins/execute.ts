/**
 * Plugin hook execution — sequential waterfall for transformIR and preOutput.
 */

import type { CollectionIR } from "../ir/collection.js";
import type { EndpointIR } from "../ir/endpoint.js";
import type { Plugin, PluginContext } from "./types.js";

/**
 * Execute transformIR hooks as a sequential waterfall.
 * Each plugin receives the output of the previous plugin.
 * @param ir - The CollectionIR to transform
 * @param plugins - Array of plugins to execute
 * @param context - Plugin context (specPath, options)
 * @returns Transformed CollectionIR
 */
async function executeTransformIR(
  ir: CollectionIR,
  plugins: Plugin[],
  context: PluginContext,
): Promise<CollectionIR> {
  let current = ir;
  for (const plugin of plugins) {
    if (plugin.hooks.transformIR) {
      try {
        current = await plugin.hooks.transformIR(current, context);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Plugin '${plugin.name}' transformIR hook failed: ${message}`);
      }
    }
  }
  return current;
}

/** Context passed to preOutput hooks. */
interface PreOutputContext {
  filePath: string;
  endpoint?: EndpointIR;
  folder?: string;
}

/**
 * Execute preOutput hooks as a sequential waterfall.
 * Each plugin receives the content output of the previous plugin.
 * @param content - The file content to transform
 * @param context - PreOutput context (filePath, endpoint, folder)
 * @param plugins - Array of plugins to execute
 * @returns Transformed file content
 */
async function executePreOutput(
  content: string,
  context: PreOutputContext,
  plugins: Plugin[],
): Promise<string> {
  let current = content;
  for (const plugin of plugins) {
    if (plugin.hooks.preOutput) {
      try {
        current = await plugin.hooks.preOutput(current, context);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Plugin '${plugin.name}' preOutput hook failed: ${message}`);
      }
    }
  }
  return current;
}

export { executeTransformIR, executePreOutput };
