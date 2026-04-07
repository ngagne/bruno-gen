# Phase 6: Publishing & Polish — Verification

**Date:** 2026-04-06

## Wave 1: README.md ✓
- [x] README.md exists at project root (329 lines)
- [x] Contains "## Installation" section
- [x] Contains CLI flags table with all 7 flags
- [x] Contains 3+ CLI usage examples
- [x] Contains complete `brunogen.config.yml` example with all fields
- [x] Contains `generate(` function example
- [x] Contains `CollectionBuilder` example
- [x] Contains Plugin interface example
- [x] Contains Plugin section with < 10 line minimal example
- [x] Contains Troubleshooting section
- [x] Contains Contributing section
- [x] All code examples are syntactically valid

## Wave 2: Real-World Fixtures & Integration Tests ✓
- [x] `test/fixtures/stripe-like/openapi.yaml` exists (340 lines)
  - Contains both apiKey and OAuth2 security schemes
  - Contains nested $ref references (3 levels deep)
  - Contains pagination headers
- [x] `test/fixtures/github-like/openapi.yaml` exists (380 lines)
  - Contains path parameters with multiple segments (`/repos/{owner}/{repo}/issues/{id}`)
  - Contains multiple response types (200, 201, 404, 401)
  - Contains HTTP bearer auth
- [x] `test/fixtures/petstore/openapi.yaml` exists (350 lines)
  - Contains 10+ endpoints with tags (pet, store, user)
  - Classic Petstore-style API
- [x] `test/fixtures/fixtures.test.ts` exists with 6 tests (2 per fixture)
  - All tests parse successfully
  - All tests generate output to temp directory
  - All tests verify collection.bru exists
  - All tests verify request .bru files exist
  - All tests verify environments/ directory exists with env file
- [x] `scripts/refresh-fixtures.sh` exists and is executable

## Wave 3: Package.json Polish & Context Fixes ✓
- [x] package.json contains `repository` field
- [x] package.json contains `bugs` field
- [x] package.json contains `homepage` field
- [x] package.json contains `files` field: `["dist/", "README.md", "LICENSE"]`
- [x] copilot-instructions.md contains "Vitest" (no Jest references)
- [x] ROADMAP.md Phase Summary Table updated with note about 76 total requirements
- [x] vitest.config.ts contains 80% coverage thresholds (lines, branches, functions, statements)
- [x] `npm run lint` passes
- [x] `npm run format:check` passes

## Wave 4: Publish Dry Run & Final Validation ✓
- [x] `npm pack --dry-run` succeeds (22 files, 876.7 kB unpacked)
- [x] Tarball contents limited to `dist/`, `README.md`, `package.json`
- [x] All 195 tests pass (24 test files)
- [x] Build completes with no errors
- [x] Lint passes with no errors
- [x] CLI `--help` works and outputs usage information
- [x] ESM import works: `import('./dist/index.js')` exports 11 names
- [x] CJS require works: `require('./dist/index.cjs')` exports 11 names
- [x] Exports include: generate, CollectionBuilder, loadConfig, parse, validate, detectFormat, loadSpec, OpenApiParser, SwaggerParser, GraphQLParser, DirectoryParser

## Publishing Requirements Status
- [x] **PUB-01**: Package ready for npm — tarball verified, installable
- [x] **PUB-02**: package.json has correct `bin` field (`bruno-gen` → `./dist/cli.js`)
- [x] **PUB-03**: package.json has correct `main`, `module`, `types`, `exports` for dual CJS/ESM
- [x] **PUB-04**: README.md with installation, usage, examples, and API documentation

## Bug Fixes Applied
1. **folder-generator.ts**: Fixed empty `ir.tags` array causing no folders to be created. Changed `ir.tags ? ...` to `(ir.tags && ir.tags.length > 0) ? ...` to properly fall back to discovered endpoint tags.
2. **tsup.config.ts**: Changed `bundle: false` to `bundle: true` for library build. Without bundling, the ESM output referenced non-existent `./parsers/index.js` files in dist/.

---

*Phase 6 verified: 2026-04-06*
