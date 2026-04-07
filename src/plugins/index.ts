// Plugin system entry point
export { loadPlugin } from "./load.js";
export { executeTransformIR, executePreOutput } from "./execute.js";
export type { Plugin, PluginHooks, PluginContext, PreOutputContext } from "./types.js";
