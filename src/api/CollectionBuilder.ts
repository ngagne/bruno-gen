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

interface BuilderSource {
  specPath?: string;
  ir?: CollectionIR;
  cachedIR?: Promise<CollectionIR>;
}

/**
 * Fluent builder for generating Bruno collections.
 * Supports both file-based (fromSpec) and IR-based (fromIR) construction.
 * Caches parsed IR for reuse across multiple .generate() calls.
 */
class CollectionBuilder {
  private readonly _source: BuilderSource;
  private readonly _options: Partial<BuilderOptions>;

  private constructor(source: BuilderSource, options: Partial<BuilderOptions>) {
    this._source = source;
    this._options = options;
  }

  /** Create a builder from a spec file path. The spec is parsed on first .generate() call. */
  static fromSpec(specPath: string): CollectionBuilder {
    return new CollectionBuilder({ specPath }, {});
  }

  /** Create a builder from an already-parsed CollectionIR (advanced use). */
  static fromIR(ir: CollectionIR): CollectionBuilder {
    return new CollectionBuilder({ ir }, {});
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
    if (opts.plugins !== undefined) merged.plugins = opts.plugins;
    return new CollectionBuilder(this._source, merged);
  }

  /**
   * Add plugins. Returns a **new** builder instance (immutable).
   * Plugins are appended to the existing plugin array.
   */
  withPlugins(plugins: Plugin[]): CollectionBuilder {
    return new CollectionBuilder(this._source, {
      ...this._options,
      plugins: [...(this._options.plugins ?? []), ...plugins],
    });
  }

  /**
   * Generate the Bruno collection to the specified output directory.
   * Parses the spec (if fromSpec) on first call, then caches the IR for reuse.
   */
  async generate(outputDir = this._options.outputDir): Promise<GenerateResult> {
    // Resolve IR
    const ir = await this._resolveIR();

    // Build generate options
    const resolvedConfig: ResolvedConfig = {
      format: this._options.grouping,
      tests: this._options.generateTests,
      force: this._options.force,
    };

    const generateOptions: GenerateOptions = {
      outputDir: outputDir ?? missingOutputDir(),
      force: this._options.force,
      grouping: this._options.grouping,
      generateTests: this._options.generateTests,
      plugins: this._options.plugins,
      specPath: this._source.specPath,
      resolvedConfig,
    };

    return generate(ir, generateOptions);
  }

  /** Resolve the IR, parsing from spec file if needed (with caching). */
  private async _resolveIR(): Promise<CollectionIR> {
    if (this._source.ir) {
      return this._source.ir;
    }

    if (!this._source.specPath) {
      throw new Error("No IR or spec path available. Use fromSpec() or fromIR().");
    }

    if (!this._source.cachedIR) {
      this._source.cachedIR = parse(this._source.specPath).catch((error: unknown) => {
        this._source.cachedIR = undefined;
        throw error;
      });
    }
    return this._source.cachedIR;
  }

  /** Get the current options (read-only). */
  get options(): Readonly<Partial<BuilderOptions>> {
    return { ...this._options };
  }

  /** Get the current plugins (read-only copy). */
  get plugins(): readonly Plugin[] {
    return [...(this._options.plugins ?? [])];
  }
}

function missingOutputDir(): never {
  throw new Error(
    "No output directory provided. Pass generate(outputDir) or set outputDir with withOptions().",
  );
}

export { CollectionBuilder };
export type { BuilderOptions };
