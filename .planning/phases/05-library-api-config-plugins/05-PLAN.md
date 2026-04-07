# Phase 5: Library API, Config & Plugins — PLAN

**Phase:** 05
**Milestone:** v1.0
**Requirements:** LIB-01 through LIB-06, CFG-01 through CFG-06 (12 total)
**Success Criteria:** 7 (see ROADMAP.md Phase 5)
**Context:** `05-CONTEXT.md` (18 decisions captured)
**Depends on:** Phase 4 complete (CLI, test assertions, exit codes all working)

---

## Implementation Approach

**6 waves** executed sequentially (each wave builds on prior):

| Wave | Plan | Focus |
|------|------|-------|
| 1 | 05-01 | Library API — `generate()` enhanced with plugins, `CollectionBuilder` fluent class |
| 2 | 05-02 | Config system — file discovery, YAML/JSON parsing, 3-layer merge |
| 3 | 05-03 | Plugin system — interfaces, loading, validation, `transformIR` + `preOutput` execution |
| 4 | 05-04 | CLI wiring — integrate `loadConfig()` into CLI flow, merge defaults < config < flags |
| 5 | 05-05 | Dual exports verification — ensure CJS+ESM+TypeScript types work for all new exports |
| 6 | 05-06 | End-to-end tests — library API tests, config tests, plugin tests, integration tests |

**Execution strategy:** Waves 1-3 are the core library work (sequential dependencies). Wave 4 wires it into CLI. Wave 5 verifies exports. Wave 6 tests everything end-to-end.

---

## Wave 1: Library API — `generate()` + `CollectionBuilder`

**Goal:** Enhance `generate()` to accept plugins, create `CollectionBuilder` fluent class.

### Steps

1. **Extend `GenerateOptions` in `orchestrator.ts`**
   - Add `plugins?: Plugin[]` field
   - Import `Plugin` type from new `src/plugins/types.ts` (create in Wave 3, forward-ref here as `any` temporarily, fix in Wave 3)
   - Keep existing fields: `outputDir`, `force`, `grouping`, `generateTests`

2. **Create `CollectionBuilder` class at `src/api/CollectionBuilder.ts`**
   - `static fromSpec(specPath: string): CollectionBuilder` — accepts file path, calls `loadSpec()` + `parse()` internally
   - `static fromIR(ir: CollectionIR): CollectionBuilder` — for advanced users with pre-parsed IR
   - `.withOptions(opts: Partial<GenerateOptions>): CollectionBuilder` — returns **new** builder instance (immutable)
   - `.withPlugins(plugins: Plugin[]): CollectionBuilder` — returns **new** builder instance (immutable)
   - `async generate(outputDir: string): Promise<GenerateResult>` — executes parse (if not already parsed) → calls `generate()` orchestrator with merged options
   - Private fields: `_specPath?: string`, `_ir?: CollectionIR`, `_options: Partial<GenerateOptions>`, `_plugins: Plugin[]`
   - Caches parsed IR so `.withOptions(opts1).generate(dir1)` and `.withOptions(opts2).generate(dir2)` reuse the same parse

3. **Wire `CollectionBuilder` into `src/index.ts`**
   - Add `export { CollectionBuilder } from "./api/CollectionBuilder.js"`
   - Also export `GenerateOptions` and `GenerateResult` types (already exported, verify)

4. **Plugin hook execution in `generate()` (orchestrator.ts)**
   - After IR is available (before file generation), run `transformIR` hooks sequentially (waterfall)
   - Before each file write, run `preOutput` hooks sequentially (waterfall)
   - Pass appropriate context objects to each hook
   - If a plugin hook throws, generation halts with descriptive error

### Verification
- `generate(ir, { outputDir, plugins: [...] })` works
- `CollectionBuilder.fromSpec("./openapi.yaml").withOptions({ grouping: "path" }).generate("./out")` works
- Builder `.withOptions()` returns new instance (immutability test)
- IR caching test: same builder, two `.generate()` calls = one parse

---

## Wave 2: Config System

**Goal:** Config file discovery, parsing, 3-layer merge.

### Steps

1. **Create `src/config/load-config.ts`**
   - `loadConfig(cwd?: string, configPath?: string): Promise<ResolvedConfig>`
   - If `configPath` provided, load that file directly
   - Otherwise, discover from CWD in order: `brunogen.config.yml`, `brunogen.config.yaml`, `brunogen.config.json`
   - First match wins; return empty defaults if no file found (no error)
   - Parse YAML with `js-yaml` (already in deps), JSON with `JSON.parse`

2. **Define `ResolvedConfig` interface at `src/config/types.ts`**
   ```ts
   interface ResolvedConfig {
     spec?: string;           // default input file path
     outputDir?: string;      // default output directory
     format?: "tag" | "path" | "flat";
     tests?: boolean;
     force?: boolean;
     plugins?: (string | Plugin)[];  // paths or inline plugin objects
   }
   ```

3. **Merge strategy function `mergeConfig()` in `src/config/merge.ts`**
   - Three layers: `defaults < configFile < cliFlags`
   - CLI flags always win (shallow merge for scalars)
   - `plugins` arrays: concat (config plugins + CLI plugins)
   - Unknown fields: pass through (forward-compatible)

4. **Export from `src/config/index.ts`**
   - `export { loadConfig } from "./load-config.js"`
   - `export type { ResolvedConfig } from "./types.js"`

5. **Wire into `src/index.ts`**
   - `export { loadConfig } from "./config/index.js"`
   - `export type { ResolvedConfig } from "./config/index.js"`

### Verification
- Auto-discovery finds `brunogen.config.yml` in CWD
- `--config` flag overrides auto-discovery
- Missing config file returns empty defaults (no crash)
- Merge test: CLI flag overrides config value, config value overrides default

---

## Wave 3: Plugin System

**Goal:** Plugin interfaces, loading, validation, hook execution.

### Steps

1. **Create `src/plugins/types.ts`**
   - `Plugin` interface: `{ name: string, hooks: PluginHooks }`
   - `PluginHooks`: `{ transformIR?, preOutput? }`
   - `PluginContext`: `{ specPath: string, options: ResolvedConfig }`
   - `PreOutputContext`: `{ filePath: string, endpoint?: EndpointIR, folder?: string }`

2. **Create `src/plugins/load.ts`**
   - `loadPlugin(source: string | Plugin): Promise<Plugin>`
   - If `Plugin` object (inline), validate and return
   - If `string` (file path or package name), `import()` it
   - Validate: must have `name` (string) and `hooks` (object with at least one recognized hook)
   - Invalid plugin throws descriptive error: `"Plugin '${name}' is invalid: missing hooks"`

3. **Create `src/plugins/execute.ts`**
   - `async executeTransformIR(ir: CollectionIR, plugins: Plugin[], context: PluginContext): Promise<CollectionIR>`
   - Waterfall: each plugin receives output of previous
   - `async executePreOutput(content: string, context: PreOutputContext, plugins: Plugin[]): Promise<string>`
   - Sequential execution, no parallelism

4. **Export from `src/plugins/index.ts`**
   - `export { loadPlugin, executeTransformIR, executePreOutput } from "./load.js"` (and execute)
   - `export type { Plugin, PluginHooks, PluginContext, PreOutputContext } from "./types.js"`

5. **Wire plugin types into `src/index.ts`**
   - Export `Plugin`, `PluginHooks`, `PluginContext`, `PreOutputContext`

### Verification
- Valid inline plugin passes validation
- Invalid plugin (missing hooks) throws descriptive error
- `transformIR` waterfall: plugin A adds header, plugin B adds another → both present
- `preOutput` waterfall: plugin A adds comment, plugin B modifies → both applied
- Plugin hook error halts generation with plugin name in error message

---

## Wave 4: CLI Wiring

**Goal:** Integrate `loadConfig()` into CLI, merge defaults < config < flags.

### Steps

1. **Update `src/cli.ts`**
   - Import `loadConfig` from `./config/load-config.js`
   - In `.action()`:
     1. Parse CLI args (Commander) — these become `cliFlags`
     2. `loadConfig(process.cwd(), flags.config)` → `configFile`
     3. `mergeConfig(defaults, configFile, cliFlags)` → `resolved`
     4. Resolve spec path: CLI arg > `resolved.spec` (error if neither)
     5. Resolve output dir: CLI arg > `resolved.outputDir` > `"./bruno-output"`
     6. Load plugins from `resolved.plugins` array via `loadPlugin()` for each
     7. Call `generate(ir, { outputDir, grouping: resolved.format, generateTests: resolved.tests, plugins: loadedPlugins })`

2. **Remove `--config` "reserved" comment** — now functional

3. **Error handling updates**
   - Config file parse error → exit 1 with message
   - No spec path (neither CLI nor config) → exit 1 with usage message

### Verification
- CLI with no args + config file with `spec:` → works
- CLI with `--config custom.yml` → loads custom file
- CLI flag `--format path` overrides config `format: tag`
- Config with plugins → plugins execute during generation

---

## Wave 5: Dual Exports Verification

**Goal:** Ensure CJS + ESM + TypeScript types work for all new exports.

### Steps

1. **Review `package.json` exports field** — already structured for dual CJS/ESM
2. **Review `tsup.config.ts`** — already configured `dts: true`, `format: ["esm", "cjs"]`
3. **Verify `src/index.ts` exports all new types:**
   - `CollectionBuilder`
   - `loadConfig`
   - `ResolvedConfig`
   - `Plugin`, `PluginHooks`, `PluginContext`, `PreOutputContext`
   - `GenerateOptions`, `GenerateResult` (already exported)
4. **Build and inspect `dist/` output:**
   - `dist/index.js` (ESM)
   - `dist/index.cjs` (CJS)
   - `dist/index.d.ts` (types)
   - `dist/index.d.cts` (CJS types)
5. **Quick smoke test:** `node -e "const x = require('./dist/index.cjs'); console.log(Object.keys(x))"`

### Verification
- `npm run build` succeeds with no errors
- `dist/index.d.ts` contains all exported types
- `dist/index.cjs` has `exports.CollectionBuilder`, `exports.loadConfig`, etc.

---

## Wave 6: End-to-End Tests

**Goal:** Comprehensive tests covering library API, config, plugins, and integration.

### Steps

1. **Create `src/api/__tests__/CollectionBuilder.test.ts`**
   - `fromSpec()` parses and caches IR
   - `fromIR()` accepts pre-parsed IR
   - `withOptions()` returns new instance, doesn't mutate original
   - `generate()` produces same output as direct `generate()` call
   - Reuse cached IR: two `.generate()` calls = one parse

2. **Create `src/config/__tests__/load-config.test.ts`**
   - Auto-discovery finds config file in CWD
   - Explicit path overrides auto-discovery
   - Missing config returns empty defaults
   - YAML and JSON parsing both work
   - Invalid YAML/JSON throws parse error

3. **Create `src/config/__tests__/merge.test.ts`**
   - CLI flag overrides config value
   - Config value overrides default
   - Plugin arrays concatenate
   - Unknown fields pass through

4. **Create `src/plugins/__tests__/load.test.ts`**
   - Valid inline plugin passes
   - Invalid plugin (no hooks) throws
   - Invalid plugin (no name) throws
   - File path plugin loads via `import()`

5. **Create `src/plugins/__tests__/execute.test.ts`**
   - `transformIR` waterfall: multiple plugins chain correctly
   - `preOutput` waterfall: multiple plugins chain correctly
   - Plugin hook error halts with plugin name in message

6. **Create `src/__tests__/library-api-e2e.test.ts`**
   - Full E2E: `generate(ir, { outputDir, plugins: [...] })` → verify files written
   - Full E2E: `CollectionBuilder.fromSpec().withOptions().withPlugins().generate()` → verify files
   - Plugin `transformIR` modifies IR → reflected in generated .bru files
   - Plugin `preOutput` modifies content → reflected in written .bru files

### Verification
- All tests pass: `npm test`
- Coverage threshold met: `npm run test:coverage`
- Build clean: `npm run build`
- Lint clean: `npm run lint`
- Format clean: `npm run format:check`

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| Plugin `import()` fails for CJS plugin files in ESM context | Use `import()` with fallback: try dynamic import, catch and try `require()` via `createRequire` |
| Config merge complexity for nested objects | Start with shallow merge for scalars, concat for arrays; deep merge deferred |
| `CollectionBuilder` immutability overhead | Only options + plugins arrays are immutable; IR cache is shared reference |
| `preOutput` hook called for every file (perf concern) | Sequential is fine for v1; parallel deferred to future if needed |

## Dependencies

- **External:** `js-yaml` (already in package.json) — for YAML config parsing
- **Internal:** All Phase 1-4 modules (IR types, parsers, generators, CLI output)

## Out of Scope (Phase 5)

- Named config profiles (staging/production)
- `brunogen validate` subcommand
- `brunogen init` subcommand
- `postOutput` hook (after file write)
- Plugin sandboxing / error recovery
- Plugin marketplace / discovery
- Watch mode / incremental generation

---

*Plan created: 2026-04-06*
*Ready for execution via `/808-execute-phase 5`*
