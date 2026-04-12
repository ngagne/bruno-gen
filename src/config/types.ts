/**
 * Config system types — resolved configuration after merging defaults, file, and CLI flags.
 */

/** A bruno-gen plugin (forward-declared to avoid circular import). */
interface _Plugin {
  name: string;
  hooks: Record<string, unknown>;
}

/** Resolved configuration after three-layer merge (defaults < config file < CLI flags). */
interface ResolvedConfig {
  /** Default input spec file path. */
  spec?: string;
  /** Default output directory. */
  outputDir?: string;
  /** Folder grouping strategy. */
  format?: "tag" | "path" | "flat";
  /** Generate test assertions. */
  tests?: boolean;
  /** Force regeneration. */
  force?: boolean;
  /** Plugin file paths or inline plugin objects. */
  plugins?: (string | _Plugin)[];
}

export type { ResolvedConfig };
