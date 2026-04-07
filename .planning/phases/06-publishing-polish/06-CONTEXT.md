# Phase 6: Publishing & Polish — Context

**Gathered:** 2026-04-06
**Status:** Ready for planning
**Prior decisions:** All Phases 1-5 complete (189 tests, build/lint/format clean)

<domain>
## Phase Boundary

Prepare the package for npm publication: comprehensive README documentation, real-world spec validation, CI workflow, and package.json polish. No new functional code — this is docs, testing, and distribution readiness.

**Inputs:** All existing code (Phases 1-5), real-world API specs for validation
**Outputs:** README.md, CI workflow (.github/workflows), test fixtures for real-world specs, polished package.json, publish-ready tarball

**Requirements covered:** PUB-01 through PUB-04 (4 total)

**Not in scope:** New features, plugin marketplace, watch mode, `brunogen validate` subcommand, `brunogen init` subcommand.

</domain>

<decisions>
## Implementation Decisions

### README Scope & Structure
- **D-01: Full working examples for every API surface** — Every function, class, and plugin gets a copy-pasteable code snippet. Not just type signatures.
- **D-02: README structure** — Installation → Quick Start (CLI) → CLI Reference (flags table) → Config File (example + fields) → Library API (generate, CollectionBuilder, loadConfig) → Plugins (concept + minimal example + real-world example) → Troubleshooting → Contributing.
- **D-03: Plugin docs get "10-line" treatment** — A user must be able to write their first plugin in under 10 lines after reading the plugin section.
- **D-04: Config file section includes a complete `brunogen.config.yml` example** with all fields shown and commented.

### Real-World Spec Validation
- **D-05: Hand-crafted minimal "inspired-by" fixtures in-repo** — Not full downloads. 200-500 line subsets that exercise edge cases (multiple auth types, $refs, deeply nested schemas, path params, pagination headers).
- **D-06: Three fixtures**: `stripe-like` (apiKey + oauth2, nested $refs), `github-like` (path params, multiple response types, pagination), `petstore` (classic OpenAPI example, simple but complete).
- **D-07: Fixtures committed to repo** for reproducible CI — no flaky external HTTP calls.
- **D-08: Integration tests** parse + generate from each fixture, verify .bru output is non-empty and structurally valid.
- **D-09: A `scripts/refresh-fixtures.sh`** script included for pulling fresh real-world specs when needed (not run in CI).

### Package Version & Publish
- **D-10: Keep version `0.1.0`** for initial release — zero-major signals "API may change" honestly. Bump to `1.0.0` after real-world feedback.
- **D-11: package.json additions**: `repository` (GitHub URL), `bugs` (issues URL), `homepage` (README URL), `files` field to limit published tarball to `dist/` + root types.
- **D-12: `files` field**: `["dist/", "README.md", "LICENSE"]` — minimal published package.

### Outstanding Items From Earlier Phases
- **D-13: GitHub Actions CI workflow** — Standard `npm install && npm run build && npm run lint && npm test` on push/PR to main. Node 24 required.
- **D-14: Fix `copilot-instructions.md`** — Jest → Vitest (project uses Vitest, not Jest).
- **D-15: Fix ROADMAP.md totals** — Update 64 → 76 requirements (added LIB-01 through LIB-06, CFG-01 through CFG-06).
- **D-16: Verify 80% coverage threshold** is enforced in vitest config and currently met.

### the agent's Discretion
- README visual style and markdown formatting details
- Exact fixture content (as long as they cover the required edge cases)
- CI workflow name, exact structure, and badge placement
- Specific troubleshooting entries in README
- Contributing guidelines content

</decisions>

<canonical_refs>
## Canonical References

### Existing Code (builds on)
- `src/index.ts` — Library entry point (all exports documented in README)
- `src/cli.ts` — CLI entry point (all flags documented in README)
- `src/config/load-config.ts` — Config system (documented in README)
- `src/plugins/types.ts` — Plugin interface (documented in README)
- `package.json` — Needs repository, bugs, homepage, fields additions
- `vitest.config.ts` — Coverage thresholds to verify

### Planning Artifacts
- `.planning/ROADMAP.md` — Phase 6 goals and success criteria
- `.planning/REQUIREMENTS.md` — PUB-01 through PUB-04
- `.planning/STATE.md` — Current project state

### External References
- Bruno collection format (`.bru` DSL) — for validating output in README examples
- Stripe API (OpenAPI), GitHub API (OpenAPI), Swagger Petstore — inspiration for fixtures

</canonical_refs>

<code_context>
## Current Project Stats
- **78 source files** across src/
- **23 test files**
- **~3700 lines of TypeScript**
- **189 tests passing**
- **Build**: tsup dual CJS/ESM + DTS
- **Lint**: eslint + prettier
- **Test runner**: Vitest with v8 coverage

## CLI Flags to Document
- `<spec>` — Path to spec file (now optional if config has `spec:`)
- `[output]` — Output directory (optional, defaults to `./bruno-output` or config value)
- `--format <tag|path|flat>` — Folder grouping strategy (default: tag)
- `--tests` — Generate post-response test assertions
- `--dry-run` — Print tree to stdout without writing files
- `--config <path>` — Path to config file
- `--verbose` — Include stack traces in error output

## Library API Surface to Document
- `generate(ir, options)` — Main function
- `parse(input)` — Unified spec parser
- `CollectionBuilder.fromSpec(path)` — Fluent builder from file
- `CollectionBuilder.fromIR(ir)` — Fluent builder from IR
- `.withOptions(opts)` — Set generation options (immutable)
- `.withPlugins(plugins)` — Add plugins (immutable)
- `.generate(outputDir)` — Execute generation
- `loadConfig(cwd?, configPath?)` — Load and merge config
- `mergeConfig(defaults, configFile, cliFlags)` — Three-layer merge

## Plugin Interface to Document
```ts
interface Plugin {
  name: string;
  hooks: {
    transformIR?: (ir: CollectionIR, ctx: PluginContext) => Promise<CollectionIR>;
    preOutput?: (content: string, ctx: PreOutputContext) => Promise<string>;
  };
}
```

## Config File Format to Document
```yaml
spec: ./openapi.yaml
format: tag
tests: true
force: true
plugins:
  - ./plugins/add-headers.js
```

</code_context>

<deferred>
## Deferred Ideas

- **npm publish to actual registry** — This phase prepares the tarball but doesn't publish. Publishing is a user action.
- **Badge placement in README** — CI status, coverage, npm version badges deferred until CI is running and package is published.
- **`brunogen validate` subcommand** — Validate specs without generating. v2 feature.
- **`brunogen init` subcommand** — Scaffold a config file. v2 feature.
- **Plugin marketplace** — Curated list of community plugins. Future concern.
- **Watch mode / incremental generation** — v2 feature.
- **Named config profiles** — `config.staging`, `config.production`. Flat config for v1.
- **CHANGELOG.md** — Useful after v1.0, not needed for initial release.

</deferred>

---

*Phase: 06-publishing-polish*
*Context gathered: 2026-04-06*
