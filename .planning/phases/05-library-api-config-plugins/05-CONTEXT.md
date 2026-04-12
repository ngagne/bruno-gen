# Phase 5: Library API, Config & Plugins — Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Expose the existing `generate()` pipeline as a polished library API (CJS+ESM) with full TypeScript types, a `CollectionBuilder` fluent class, a config file discovery/merge system, and a plugin architecture with `transformIR` and `preOutput` hooks.

**Inputs:** Spec file path or `CollectionIR`, config file (optional), plugin array (optional), generation options
**Outputs:** Same `.bru` files as before, but now with config-driven defaults and plugin-modified IR/output

**Requirements covered:** LIB-01 through LIB-06, CFG-01 through CFG-06 (12 total)

**Not in scope:** npm publishing docs (Phase 6), subcommands like `brunogen validate` (future), named config profiles (future), watch mode (v2).

</domain>

<decisions>
## Implementation Decisions

### Library API Surface
- **D-01: `generate()` is the primary entry point** — Already exists in `orchestrator.ts`. Enhanced to accept a `plugins` array in options. Signature: `generate(ir: CollectionIR, options: GenerateOptions) → Promise<GenerateResult>`
- **D-02: `CollectionBuilder` fluent class** — `CollectionBuilder.fromSpec(spec)` accepts a file path string and internally calls `loadSpec()` + `parse()` to produce the IR. Caches the parsed IR so `.withOptions(opts1).generate(dir1)` and `.withOptions(opts2).generate(dir2)` reuse the same parse. Also supports `CollectionBuilder.fromIR(ir)` for advanced users who already have a `CollectionIR`. `.withOptions()` returns a **new builder instance** (immutable).
- **D-03: Dual CJS/ESM already works** — tsup config from Phase 1 already produces `.cjs` + `.js` + `.d.ts`. No changes needed to build pipeline. Only need to ensure new exports are wired correctly.
- **D-04: `GenerateOptions` extended** — Add `plugins?: Plugin[]` field to existing interface. All CLI flags (`grouping`, `generateTests`) already available programmatically.

### Config File System
- **D-05: File discovery** — Auto-discover `brunogen.config.yml`, `brunogen.config.yaml`, `brunogen.config.json` from CWD. First match wins. `--config <path>` flag overrides auto-discovery with explicit path.
- **D-06: Config content** — Supports `spec` (default input file path) AND generation options (`format`, `generateTests`, `force`, `grouping`). Enables running `brunogen` with no args when config has `spec` set.
- **D-07: Three-layer merge** — defaults < config file < CLI flags. CLI positional/flag values always win. Deep merge for nested objects.
- **D-08: `loadConfig()` module** — Standalone `src/config/load-config.ts` with `loadConfig(cwd?, configPath?) → Promise<ResolvedConfig>`. Both CLI and library API call it. Returns merged config object or empty defaults if no file found.
- **D-09: No named profiles in v1** — Single flat config file. Profiles/environments deferred to future if users request.

### Plugin System
- **D-10: Plugin format** — Plugins are npm packages (or local file paths) that export a default object: `{ name: string, hooks: { transformIR?, preOutput? } }`. Loaded via dynamic `import()` — supports both CJS and ESM plugin files.
- **D-11: Plugin validation on load** — Must have `name` (string) and `hooks` (object with at least one recognized hook). Invalid plugin throws descriptive error and halts generation.
- **D-12: Hook execution — async waterfall** — Both `transformIR` and `preOutput` are **async** hooks. Plugins execute **sequentially** (waterfall): each plugin's hook receives the output of the previous plugin. Order = order in plugins array.
- **D-13: `transformIR` hook** — Signature: `(ir: CollectionIR, context: { specPath: string, options: ResolvedConfig }) => Promise<CollectionIR>`. Runs *after* parsing, *before* generation. Use cases: inject headers, modify auth, add/remove endpoints.
- **D-14: `preOutput` hook** — Signature: `(content: string, context: { filePath: string, endpoint?: EndpointIR, folder?: string }) => Promise<string>`. Runs for each `.bru` file, right before writing. Use cases: inject comments, add custom headers to file, modify test scripts.
- **D-15: Plugin error handling** — If a plugin hook throws, generation halts with an error message naming the plugin and hook. No try/catch-and-continue — plugins are trusted code.
- **D-16: Plugin config sources** — Plugins configured via `plugins` array in config file OR passed programmatically via `GenerateOptions.plugins` or `CollectionBuilder.withPlugins([...])`. Both sources merge (programmatic wins on conflict).

### Integration Point
- **D-17: Config + plugins wired inside `generate()`** — The `generate()` function in `orchestrator.ts` is the single orchestration point. It runs `transformIR` plugins after receiving IR (before file generation), and `preOutput` plugins for each file (before writing). The CLI calls `loadConfig()`, merges with CLI flags, then passes merged options (including `plugins` array) to `generate()`.
- **D-18: CLI flow updated** — CLI calls `loadConfig()` early → merges with Commander defaults → resolves spec path → calls `parse()` → calls `generate(ir, mergedOptions)`. The `generate()` function handles plugin execution internally.

### the agent's Discretion
- Exact `ResolvedConfig` interface field names and types
- Config merge implementation (deep vs shallow merge strategy for each field)
- Error message copywriting for plugin validation failures
- Internal module organization within `src/config/` and `src/plugins/`
- `CollectionBuilder` internal state representation (private fields vs class properties)

</decisions>

<canonical_refs>
## Canonical References

### Existing Code (builds on)
- `src/generators/orchestrator.ts` — `generate()` function — receives plugin integration
- `src/index.ts` — Library entry point — needs `CollectionBuilder` and `loadConfig` exports
- `src/cli.ts` — CLI entry point — needs config loading before `generate()` call
- `package.json` — Already has `exports` field with CJS+ESM, `types` field
- `tsup.config.ts` — Already configured for dual format + dts generation

### IR Types (plugins read/modify these)
- `src/ir/endpoint.ts` — `EndpointIR` — what `transformIR` receives and returns
- `src/ir/collection.ts` — `CollectionIR` — top-level IR that plugins transform

### Prior Decisions
- `.planning/phases/01-project-scaffold-ir-types/1-CONTEXT.md` — D-01 through D-18 (project scaffold, tsup, exports)
- `.planning/phases/04-cli-interface-test-assertions/04-CONTEXT.md` — D-01 through D-19 (CLI architecture, flags, TTY handling)

### Requirements
- `.planning/REQUIREMENTS.md` — LIB-01 through LIB-06, CFG-01 through CFG-06
- `.planning/ROADMAP.md` — Phase 5 goals and success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Current `generate()` signature (orchestrator.ts)
```ts
interface GenerateOptions {
  outputDir: string;
  force?: boolean;
  grouping?: "tag" | "path" | "flat";
  generateTests?: boolean;
}
```
Needs: `plugins?: Plugin[]` added.

### Current tsup config (already dual CJS/ESM)
```ts
{
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  bundle: false,  // Important: not bundled, individual .d.ts files
}
```

### Current package.json exports (already structured)
```json
{
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  }
}
```

### CLI already installed dependencies
- `commander`, `chalk`, `ora`, `cli-table3` — all in package.json
- `js-yaml` — already available for config file parsing

</code_context>

<specifics>
## Specific Ideas

### Config file example
```yaml
# brunogen.config.yml
spec: ./openapi.yaml
format: tag
tests: true
force: true
plugins:
  - ./plugins/add-headers.js
  - bruno-plugin-cors
```

### Plugin example
```js
// plugins/add-headers.js
export default {
  name: "add-headers",
  hooks: {
    async transformIR(ir, ctx) {
      // Add X-API-Version header to every endpoint
      for (const ep of ir.endpoints) {
        ep.headers = ep.headers || [];
        ep.headers.push({ name: "X-API-Version", value: "v1", required: false });
      }
      return ir;
    },
    async preOutput(content, ctx) {
      // Add a comment header to every .bru file
      return `docs { Generated by gen-bruno }\n\n${content}`;
    },
  },
};
```

### CollectionBuilder usage
```ts
// ESM
import { CollectionBuilder } from "gen-bruno";

const builder = CollectionBuilder.fromSpec("./openapi.yaml");
await builder
  .withOptions({ grouping: "path", generateTests: true })
  .generate("./output");

// Reuse cached IR for different output
await builder.withOptions({ grouping: "flat" }).generate("./output-flat");

// Advanced: from existing IR
import { parse } from "gen-bruno";
const ir = await parse("./openapi.yaml");
const builder2 = CollectionBuilder.fromIR(ir);
```

### Updated GenerateOptions
```ts
interface GenerateOptions {
  outputDir: string;
  force?: boolean;
  grouping?: "tag" | "path" | "flat";
  generateTests?: boolean;
  plugins?: Plugin[];
}
```

### Plugin interface
```ts
interface PluginContext {
  specPath: string;
  options: ResolvedConfig;
}

interface PreOutputContext {
  filePath: string;
  endpoint?: EndpointIR;
  folder?: string;
}

interface PluginHooks {
  transformIR?: (ir: CollectionIR, ctx: PluginContext) => Promise<CollectionIR>;
  preOutput?: (content: string, ctx: PreOutputContext) => Promise<string>;
}

interface Plugin {
  name: string;
  hooks: PluginHooks;
}
```

### ResolvedConfig interface
```ts
interface ResolvedConfig {
  spec?: string;
  outputDir?: string;
  format?: "tag" | "path" | "flat";
  tests?: boolean;
  force?: boolean;
  plugins?: (string | Plugin)[]; // paths or inline plugin objects
}
```

### CLI flow after Phase 5
```
1. Parse CLI args (Commander)
2. loadConfig(cwd, flags.config) → ResolvedConfig
3. Merge: defaults < config < CLI flags
4. Resolve spec path (CLI arg > config.spec)
5. parse(spec) → CollectionIR
6. generate(ir, { outputDir, plugins: resolvedPlugins, ... }) 
   → transformIR hooks run
   → file generation
   → preOutput hooks run per file
   → files written
7. Print summary
```

</specifics>

<deferred>
## Deferred Ideas

- **Named config profiles** — `config.staging`, `config.production` etc. Flat config for v1.
- **`brunogen validate` subcommand** — Validate specs without generating. Useful but not required for Phase 5.
- **`brunogen init` subcommand** — Scaffold a config file. Nice-to-have for v2.
- **`postOutput` hook** — Hook after file written (e.g., to run formatting). Not needed for v1 plugin system.
- **`onDone` hook** — Hook after all generation complete. Can be added later.
- **Plugin marketplace/index** — Curated list of community plugins. Future Phase 6+ concern.
- **Sync-only plugin mode** — For performance. Async covers all use cases for now.
- **Plugin sandboxing/error recovery** — try/catch around individual plugins and continue. Not needed — plugins are trusted code.

</deferred>

---

*Phase: 05-library-api-config-plugins*
*Context gathered: 2026-04-06*
