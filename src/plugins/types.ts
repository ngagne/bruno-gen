/**
 * Plugin system types — interfaces for the plugin architecture.
 */

import type { CollectionIR } from "../ir/collection.js";
import type { EndpointIR } from "../ir/endpoint.js";
import type { ResolvedConfig } from "../config/types.js";

/** Context passed to transformIR hooks. */
interface PluginContext {
  specPath: string;
  options: ResolvedConfig;
}

/** Context passed to preOutput hooks. */
interface PreOutputContext {
  filePath: string;
  endpoint?: EndpointIR;
  folder?: string;
}

/** Available plugin hooks. */
interface PluginHooks {
  /** Transform the CollectionIR after parsing, before generation. */
  transformIR?: (ir: CollectionIR, ctx: PluginContext) => Promise<CollectionIR>;
  /** Transform file content right before writing. */
  preOutput?: (content: string, ctx: PreOutputContext) => Promise<string>;
}

/** A bruno-gen plugin. */
interface Plugin {
  name: string;
  hooks: PluginHooks;
}

export type { Plugin, PluginHooks, PluginContext, PreOutputContext };
