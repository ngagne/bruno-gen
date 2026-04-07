/**
 * CollectionBuilder — fluent API for programmatic collection generation.
 *
 * Usage:
 *   CollectionBuilder.fromSpec("./openapi.yaml")
 *     .withOptions({ grouping: "path", generateTests: true })
 *     .withPlugins([myPlugin])
 *     .generate("./output");
 *
 *   // Reuse cached IR for different outputs
 *   const builder = CollectionBuilder.fromSpec("./openapi.yaml");
 *   await builder.withOptions({ grouping: "tag" }).generate("./out-tag");
 *   await builder.withOptions({ grouping: "flat" }).generate("./out-flat");
 */

import { parse } from "../parsers/parse.js";
import type { CollectionIR } from "../ir/collection.js";
import { generate } from "../generators/orchestrator.js";
import type { GenerateOptions, GenerateResult } from "../generators/orchestrator.js";
import type { Plugin } from "../plugins/types.js";
import type { ResolvedConfig } from "../config/types.js";

/** Options that can be set on the builder. */
interface BuilderOptions {
  outputDir?: string;
  force?: boolean;
  grouping?: "tag" | "path" | "flat";
  generateTests?: boolean;
  plugins?: Plugin[];
}

/**
 * Fluent builder for generating Bruno collections.
 * Supports both file-based (fromSpec) and IR-based (fromIR) construction.
 * Caches parsed IR for reuse across multiple .generate() calls.
 */
class CollectionBuilder {
  private readonly _specPath?: string;
  private readonly _ir?: CollectionIR;
  private readonly _options: Partial<BuilderOptions>;
  private readonly _plugins: Plugin[];
  private _cachedIR?: CollectionIR;

  private constructor(
    specPath: string | undefined,
    ir: CollectionIR | undefined,
    options: Partial<BuilderOptions>,
    plugins: Plugin[],
  ) {
    this._specPath = specPath;
    this._ir = ir;
    this._options = options;
    this._plugins = plugins;
  }

  /** Create a builder from a spec file path. The spec is parsed on first .generate() call. */
  static fromSpec(specPath: string): CollectionBuilder {
    return new CollectionBuilder(specPath, undefined, {}, []);
  }

  /** Create a builder from an already-parsed CollectionIR (advanced use). */
  static fromIR(ir: CollectionIR): CollectionBuilder {
    return new CollectionBuilder(undefined, ir, {}, []);
  }

  /**
   * Set generation options. Returns a **new** builder instance (immutable).
   * Options are merged shallowly with existing options.
   */
  withOptions(opts: Partial<GenerateOptions>): CollectionBuilder {
    const merged: Partial<BuilderOptions> = { ...this._options };

    if (opts.outputDir !== undefined) merged.outputDir = opts.outputDir;
    if (opts.force !== undefined) merged.force = opts.force;
    if (opts.grouping !== undefined) merged.grouping = opts.grouping;
    if (opts.generateTests !== undefined) merged.generateTests = opts.generateTests;
    if (opts.plugins !== undefined) {
      // Replace plugins (caller can use withPlugins instead for explicit control)
      merged.plugins = opts.plugins;
    }

    return new CollectionBuilder(this._specPath, this._ir, merged, merged.plugins ?? this._plugins);
  }

  /**
   * Add plugins. Returns a **new** builder instance (immutable).
   * Plugins are appended to the existing plugin array.
   */
  withPlugins(plugins: Plugin[]): CollectionBuilder {
    const mergedPlugins = [...this._plugins, ...plugins];
    return new CollectionBuilder(
      this._specPath,
      this._ir,
      { ...this._options, plugins: mergedPlugins },
      mergedPlugins,
    );
  }

  /**
   * Generate the Bruno collection to the specified output directory.
   * Parses the spec (if fromSpec) on first call, then caches the IR for reuse.
   */
  async generate(outputDir: string): Promise<GenerateResult> {
    // Resolve IR
    const ir = await this._resolveIR();

    // Build generate options
    const resolvedConfig: ResolvedConfig = {
      format: this._options.grouping,
      tests: this._options.generateTests,
      force: this._options.force,
    };

    const generateOptions: GenerateOptions = {
      outputDir,
      force: this._options.force,
      grouping: this._options.grouping,
      generateTests: this._options.generateTests,
      plugins: this._plugins.length > 0 ? this._plugins : undefined,
      specPath: this._specPath,
      resolvedConfig,
    };

    return generate(ir, generateOptions);
  }

  /** Resolve the IR, parsing from spec file if needed (with caching). */
  private async _resolveIR(): Promise<CollectionIR> {
    if (this._ir) {
      return this._ir;
    }

    if (!this._specPath) {
      throw new Error("No IR or spec path available. Use fromSpec() or fromIR().");
    }

    // Cache check
    if (this._cachedIR) {
      return this._cachedIR;
    }

    // Parse spec
    const ir = await parse(this._specPath);
    this._cachedIR = ir;
    return ir;
  }

  /** Get the current options (read-only). */
  get options(): Readonly<Partial<BuilderOptions>> {
    return { ...this._options };
  }

  /** Get the current plugins (read-only copy). */
  get plugins(): readonly Plugin[] {
    return [...this._plugins];
  }
}

export { CollectionBuilder };
export type { BuilderOptions };
