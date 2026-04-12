---
wave: 1
depends_on: []
files_modified: [README.md]
autonomous: true
requirements: [PUB-04]
---

# Phase 6: Publishing & Polish

## Overview

Prepare the package for npm publication: comprehensive README documentation, real-world spec validation, package.json polish, and publish readiness verification.

## Requirements

- **PUB-01**: Package published to npm registry as public package
- **PUB-02**: package.json has correct `bin` field for CLI
- **PUB-03**: package.json has correct `main`, `module`, `types`, `exports` for dual CJS/ESM library
- **PUB-04**: README.md with installation, usage, examples, and API documentation

## Success Criteria

1. README includes: installation, CLI usage with examples, library API docs, config file docs, plugin docs
2. Tool successfully generates valid Bruno collections from real-world specs (stripe-like, github-like, petstore fixtures)
3. package.json has repository, bugs, homepage, keywords, engines, files field
4. `npm pack` produces clean tarball with only necessary files

## Wave 1: README.md (PUB-04)

### Task 1.1: Write README.md

<read_first>
- `.planning/phases/06-publishing-polish/06-CONTEXT.md` — All decisions D-01 through D-16
- `package.json` — Current package metadata (name, version, bin, exports, dependencies)
- `src/index.ts` — All library exports (generate, CollectionBuilder, loadConfig, mergeConfig, parse, Plugin interface)
- `src/cli.ts` — All CLI flags and their behavior
- `src/config/types.ts` — Config file format
- `src/plugins/types.ts` — Plugin interface
- `.planning/REQUIREMENTS.md` — Full requirement list for reference
</read_first>

Create a comprehensive `README.md` at the project root. The README must be production-quality, copy-pasteable, and serve as the complete documentation for the package.

**Structure (per D-02):**

1. **Header** — Project name, one-line description, npm install command
2. **Quick Start** — Minimal CLI example that works immediately (3 lines max)
3. **Installation** — `npm install bruno-gen` with node version requirement
4. **CLI Reference** — Complete flags table:
   | Flag | Description | Default |
   |------|-------------|---------|
   | `<spec>` | Path to OpenAPI/Swagger/GraphQL spec file | (required, or config `spec:`) |
   | `[output]` | Output directory | `./bruno-output` or config value |
   | `--format <tag\|path\|flat>` | Folder grouping strategy | `tag` |
   | `--tests` | Generate post-response test assertions | off |
   | `--dry-run` | Print tree to stdout without writing files | off |
   | `--config <path>` | Path to config file | auto-discover |
   | `--verbose` | Include stack traces in error output | off |

   Include 3 full CLI examples:
   ```bash
   # OpenAPI spec to Bruno collection
   bruno-gen ./openapi.yaml ./output

   # GraphQL with test assertions
   bruno-gen ./schema.graphql ./output --tests

   # Dry run to preview output
   bruno-gen ./openapi.yaml ./output --dry-run
   ```

5. **Config File** — Complete `brunogen.config.yml` example with ALL fields shown and commented (per D-04):
   ```yaml
   # brunogen.config.yml
   spec: ./openapi.yaml        # Default spec path (CLI <spec> overrides)
   output: ./bruno-output      # Default output directory
   format: tag                 # Folder grouping: tag | path | flat
   tests: false                # Generate test assertions
   verbose: false              # Include stack traces
   ```
   Explain merge priority: defaults < config file < CLI flags.

6. **Library API** — Document every export with copy-pasteable examples (per D-01):
   - `generate(ir, options)` — Main function with full example
   - `parse(input)` — Unified spec parser
   - `CollectionBuilder.fromSpec(path).withOptions(opts).withPlugins(plugins).generate(dir)` — Fluent builder
   - `loadConfig(cwd?, configPath?)` — Config loading
   - `mergeConfig(defaults, configFile, cliFlags)` — Three-layer merge
   - Each example must be a complete, runnable snippet (not just type signatures — per D-01)

7. **Plugins** — "10-line treatment" (per D-03):
   - Concept explanation (what hooks do, when they run)
   - Plugin interface shown inline
   - Minimal example: a plugin that adds a custom header to every request (< 10 lines)
   - Real-world example: a plugin that injects authentication headers
   - How to use: via config file `plugins:` array or `.withPlugins()` in builder API

8. **Troubleshooting** — Common issues:
   - "No output generated" — check spec file path
   - "Invalid Bruno output" — verify spec validity
   - "Module not found" — ensure Node.js 24+
   - "Plugin not loaded" — check plugin path and exports

9. **Contributing** — Brief: fork, branch, test, PR

**Style:** Professional, direct, no filler. Every code block must be complete and runnable. Use markdown tables, code blocks, and clear headings.

<acceptance_criteria>
1. README.md exists at project root and is > 200 lines
2. README contains "## Installation" section
3. README contains CLI flags table with all 7 flags (<spec>, [output], --format, --tests, --dry-run, --config, --verbose)
4. README contains at least 3 CLI usage examples
5. README contains a complete `brunogen.config.yml` example with all fields
6. README contains `generate(` function example
7. README contains `CollectionBuilder` example
8. README contains Plugin interface example
9. README contains Plugin section with < 10 line minimal example
10. README contains Troubleshooting section
11. README contains Contributing section
12. All code examples in README are syntactically valid (can be copy-pasted and run)
</acceptance_criteria>

## Wave 2: Real-World Fixtures & Integration Tests (PUB-01, PUB-04)

### Task 2.1: Create test fixtures

<read_first>
- `.planning/phases/06-publishing-polish/06-CONTEXT.md` — Decisions D-05 through D-09
- `src/parsers/parse.ts` — How specs are parsed
- `src/generators/orchestrator.ts` — How IR is converted to .bru files
- `test/fixtures/` — Check if directory exists already
- `src/__tests__/library-api-e2e.test.ts` — Existing e2e test patterns
</read_first>

Create 3 hand-crafted OpenAPI spec fixtures in `test/fixtures/`. These are minimal but complete-enough specs that exercise real-world edge cases. Each fixture is ~200-500 lines of YAML.

**Fixture 1: `test/fixtures/stripe-like/openapi.yaml`**
- API with 5-8 endpoints (charges, customers, subscriptions)
- Multiple auth types: apiKey in header + OAuth2 security scheme
- Nested `$ref` references (schemas reference other schemas, 2-3 levels deep)
- Request/response bodies with example values
- Path parameters and query parameters
- Pagination headers in responses

**Fixture 2: `test/fixtures/github-like/openapi.yaml`**
- API with 5-8 endpoints (repos, issues, users)
- Path parameters with multiple segments (`/repos/{owner}/{repo}/issues/{id}`)
- Multiple response types (200 with array, 201 with object, 404, 401)
- Pagination via Link header
- HTTP bearer auth
- Example request bodies

**Fixture 3: `test/fixtures/petstore/openapi.yaml`**
- Classic Petstore-style API (pets CRUD operations)
- Simple but complete: list, create, get, update, delete
- Tags for grouping (pet, store, user)
- Basic response schemas with examples
- Server URL defined

### Task 2.2: Create integration tests

<read_first>
- `src/__tests__/library-api-e2e.test.ts` — Existing e2e test patterns
- `vitest.config.ts` — Test configuration
- `test/fixtures/` — The fixtures created in Task 2.1
</read_first>

Create `test/fixtures/fixtures.test.ts` with integration tests that:
1. Parse each fixture spec successfully
2. Generate a Bruno collection from each fixture
3. Verify output directory contains: `collection.bru`, at least 1 `.bru` request file, `environments/` directory with env file
4. Verify `.bru` files contain expected method names (GET, POST, etc.)
5. Verify environment file contains `{{baseUrl}}` variable

Also create `scripts/refresh-fixtures.sh` — a shell script that can pull fresh real-world specs from public URLs (Stripe, GitHub, Petstore OpenAPI specs) to update fixtures. This script is NOT run in CI.

<acceptance_criteria>
1. `test/fixtures/stripe-like/openapi.yaml` exists and is valid YAML with > 50 lines
2. `test/fixtures/github-like/openapi.yaml` exists and is valid YAML with > 50 lines
3. `test/fixtures/petstore/openapi.yaml` exists and is valid YAML with > 50 lines
4. stripe-like fixture contains both apiKey and OAuth2 security schemes
5. github-like fixture contains path parameters with multiple segments
6. petstore fixture contains at least 4 endpoints with tags
7. `test/fixtures/fixtures.test.ts` exists with tests for all 3 fixtures
8. Fixture tests parse each fixture without errors
9. Fixture tests generate output to temp directory
10. Fixture tests verify collection.bru exists in output
11. Fixture tests verify at least 1 .bru request file in output
12. Fixture tests verify environments/ directory exists with env file
13. `scripts/refresh-fixtures.sh` exists and is executable
14. All fixture tests pass when run with `npm test`
</acceptance_criteria>

## Wave 3: Package.json Polish & Context Fixes (PUB-02, PUB-03, D-14, D-15, D-16)

### Task 3.1: Update package.json

<read_first>
- `package.json` — Current state
- `src/index.ts` — Exports to verify
- `tsup.config.ts` — Build output paths
</read_first>

Add the following fields to `package.json`:
- `repository`: `{ "type": "git", "url": "https://github.com/<user>/bruno-gen" }` (placeholder URL — user will replace)
- `bugs`: `{ "url": "https://github.com/<user>/bruno-gen/issues" }`
- `homepage`: `https://github.com/<user>/bruno-gen#readme`
- `files`: `["dist/", "README.md", "LICENSE"]`

Verify existing fields are correct:
- `bin`: `{"bruno-gen": "./dist/cli.js"}` ✓
- `main`, `module`, `types`, `exports`: already correct from Phase 5
- `engines`: `{"node": ">=24"}` ✓

### Task 3.2: Fix copilot-instructions.md

<read_first>
- `copilot-instructions.md` — Current content
- `vitest.config.ts` — Current test runner config
</read_first>

Update `copilot-instructions.md` to replace all Jest references with Vitest references. The project uses Vitest (QUAL-03 was updated from Jest to Vitest).

### Task 3.3: Fix ROADMAP.md requirement totals

<read_first>
- `.planning/ROADMAP.md` — Current totals table
- `.planning/REQUIREMENTS.md` — Actual requirement count (76 total including LIB and CFG)
</read_first>

Update the Phase Summary Table in ROADMAP.md to reflect the correct total requirements count. The table currently shows 64 total but there are actually 76 (64 original + 12 new: LIB-01 through LIB-06, CFG-01 through CFG-06).

### Task 3.4: Verify coverage threshold

<read_first>
- `vitest.config.ts` — Coverage configuration
</read_first>

Verify that vitest.config.ts has 80% coverage threshold enforced. If not present, add it.

<acceptance_criteria>
1. package.json contains `repository` field
2. package.json contains `bugs` field
3. package.json contains `homepage` field
4. package.json contains `files` field with value `["dist/", "README.md", "LICENSE"]`
5. copilot-instructions.md contains "vitest" (case-insensitive) and no "jest" references (except in historical context)
6. ROADMAP.md Phase Summary Table shows correct total requirements (76)
7. vitest.config.ts contains coverage threshold of 80% or higher
8. `npm run lint` passes
9. `npm run format:check` passes
</acceptance_criteria>

## Wave 4: Publish Dry Run & Final Validation (PUB-01)

### Task 4.1: Verify publish readiness

<read_first>
- `package.json` — Final state after Wave 3
- `.planning/ROADMAP.md` — Phase 6 success criteria
</read_first>

Run the following verification:
1. `npm pack --dry-run` — Check what would be published
2. Verify tarball contains only: `dist/` files, `README.md`, `LICENSE` (no source files, no `.planning/`, no `test/`)
3. `npm test` — All tests pass
4. `npm run build` — Clean build
5. `npm run lint` — No lint errors
6. `node dist/cli.js --help` — CLI accessible
7. Test ESM import: `node -e "import('./dist/index.js').then(m => console.log(Object.keys(m)))"`
8. Test CJS require: `node -e "console.log(Object.keys(require('./dist/index.cjs')))"`

Document results in `.planning/phases/06-publishing-polish/06-VERIFY.md`.

<acceptance_criteria>
1. `npm pack --dry-run` succeeds with no errors
2. Tarball contents are limited to `dist/`, `README.md`, `LICENSE`
3. All 189+ tests pass
4. Build completes with no errors
5. Lint passes with no errors
6. CLI `--help` works and outputs usage information
7. ESM import works and exports include: generate, CollectionBuilder, loadConfig, mergeConfig, parse
8. CJS require works and exports include: generate, CollectionBuilder, loadConfig, mergeConfig, parse
9. `.planning/phases/06-publishing-polish/06-VERIFY.md` exists with verification results
</acceptance_criteria>

## Verification

After all waves complete:
1. `npm run build` — clean build
2. `npm run lint` — no errors
3. `npm run format:check` — formatted
4. `npm test` — all tests pass (189+ including new fixture tests)
5. `npm pack --dry-run` — clean tarball
6. README.md renders correctly on GitHub
7. All 4 publishing requirements (PUB-01 through PUB-04) satisfied
