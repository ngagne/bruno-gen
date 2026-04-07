# Phase 4 Plan: CLI Interface & Test Assertions

**Phase number:** 04
**Dependencies:** Phase 3 complete ✓ (generators exist and work)
**Research:** Not needed — CLI framework and Bruno test APIs are well-documented; context in 04-CONTEXT.md is sufficient

## Scope

Build the Commander.js CLI entry point (`src/cli.ts`) and test assertion generator (`src/generators/test-generator.ts`). Wire `--tests` flag through the existing request generator. Add dependencies: `commander`, `chalk`, `ora`, `cli-table3`.

**In scope:** CLI command surface, all 4 flags, exit codes, TTY-aware output formatting, test assertion generation (Tier 2: status code + required fields + example value), dry-run tree printing
**Out of scope:** Config file discovery/merging (Phase 5), plugin hooks (Phase 5), library API changes (Phase 5), `validate`/`init` subcommands (deferred)

## Requirements

CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06, CLI-07, CLI-08, CLI-09, CLI-10, TEST-01, TEST-02, TEST-03, TEST-04

## Success Criteria

1. `bruno-gen ./openapi.yaml ./output` generates a complete Bruno collection with exit code 0
2. `bruno-gen ./schema.graphql ./output --tests` generates collection with post-response test scripts
3. `bruno-gen ./openapi.yaml ./output --dry-run` prints generated output to stdout without writing files
4. `bruno-gen ./invalid.yaml ./output` exits with code 1 and reports validation errors
5. `bruno-gen ./openapi.yaml ./output --format path` groups requests by URL path instead of tag
6. Non-TTY output is clean (no spinners, no ANSI colors) for CI/CD compatibility
7. Warnings for unsupported features displayed without halting generation (exit 0)

## Context Files

- `04-CONTEXT.md` — 19 decisions (D-01 through D-19) covering CLI architecture, test assertion design, flags, output formatting, exit codes
- `src/generators/request-generator.ts` — Must be extended to accept `generateTests` option and append `post-response` blocks
- `src/generators/orchestrator.ts` — `generate()` function must accept `generateTests` in options and pass through
- `src/generators/folder-generator.ts` — Must support `format` option (`tag` | `path` | `flat`)
- `src/parsers/parse.ts` — Existing `parse()` function, called by CLI
- `src/ir/` — ResponseIR (statusCode, required fields, examples), SchemaIR (required array, properties)

---

## Wave 1: CLI Entry Point, tsup Config, Dependencies

### Task 1.1: Add CLI dependencies and update tsup config

Install runtime dependencies: `commander`, `chalk`, `ora`, `cli-table3`

Update `tsup.config.ts` to add a second entry point: `src/cli.ts → dist/cli.js` (CLI needs its own entry so `package.json` bin field resolves correctly). Keep `src/index.ts` as the library entry.

Create `src/cli.ts` with:
- Commander program definition
- `.command('bruno-gen')` with positional args `<spec>` and `[output]` (default: `./bruno-output`)
- All flag definitions: `--format <tag|path|flat>`, `--tests`, `--dry-run`, `--config <path>`, `--verbose`, `-V/--version`, `-h/--help`
- `.action()` handler that:
  1. Validates spec path exists (exit 1 if not)
  2. Creates output directory if needed (exit 1 if can't)
  3. Calls `parse(specPath)` from existing parser
  4. Calls `generate(ir, outputDir, { format, generateTests })` from existing orchestrator
  5. Prints summary (file count, warning count, generation time)
  6. Exits with code 0

### Task 1.2: package.json bin field verification

Confirm `package.json` `"bin": { "bruno-gen": "./dist/cli.js" }` is present. Add `"preferGlobal": true` if not already present. Ensure `dist/cli.js` will have proper shebang (`#!/usr/bin/env node`) — tsup can add this via banner config or a wrapper.

**Tests:**
- Unit test for CLI argument parsing (commander setup) — mock `process.argv`, verify parsed options
- Integration test: run `bruno-gen` against an existing test fixture spec, verify exit code 0 and output directory created with expected files

---

## Wave 2: TTY-Aware Output Formatting

Create `src/cli/output.ts` module with:

- `isInteractive()` — returns true when `process.stdout.isTTY` AND no `CI` env var AND no `NO_COLOR` env var
- `formatSummary(stats)` — TTY mode: `cli-table3` table with colors. Non-TTY mode: plain key-value lines
- `createSpinner(message)` — TTY mode: returns `ora` spinner. Non-TTY mode: returns no-op object with `.start()` and `.succeed()` that do nothing
- `formatError(error, verbose)` — TTY or verbose: include stack trace. Non-verbose: clean message with file path
- `printDryRunTree(structure)` — ASCII tree structure (like the example in CONTEXT.md) printed to stdout

**TTY behavior rules:**
- `process.stdout.isTTY === true` → colors, spinner, table
- `process.stdout.isTTY === false` → plain text, no spinners
- `CI=true` env var → always plain text (overrides TTY)
- `NO_COLOR` env var → always plain text (overrides TTY)

**Tests:**
- Unit test: `isInteractive()` returns correct value for each env combination (mock `process.stdout`, `process.env`)
- Unit test: `formatSummary()` produces expected table structure
- Unit test: `formatError()` includes/excludes stack trace based on verbose flag

---

## Wave 3: Exit Codes and Error Handling

Implement in `src/cli.ts` action handler:

- `try/catch` around parse + generate pipeline
- Catch blocks:
  - `ENOENT` (spec file not found) → exit 1, error message: `"Spec file not found: <path>"`
  - Parser validation error → exit 1, error message with validation details
  - Generator error (output dir can't be created) → exit 1, error message
  - Generic error → exit 1, error message (stack trace if `--verbose`)
- Warning collection: parsers and generators may return `{ ir, warnings }` or similar. CLI collects warnings and prints them in summary. Exit code stays 0 if only warnings present.

**Tests:**
- Integration test: run `bruno-gen ./nonexistent.yaml ./out` → exit code 1, stderr contains "Spec file not found"
- Integration test: run `bruno-gen ./invalid.yaml ./out` (malformed spec) → exit code 1, stderr contains validation error
- Integration test: run against valid spec with a known warning (e.g., unsupported security scheme) → exit code 0, warning printed

---

## Wave 4: `--format` Flag Wiring

The `--format` flag controls folder grouping: `tag` (default), `path`, `flat`.

Update `src/generators/folder-generator.ts` to accept a `format` option in its options parameter:
- `tag` (default): group by OpenAPI tag or GraphQL type (query/mutation) — current behavior
- `path`: group by first URL path segment (e.g., `/users/123` → `users/` folder, `/pets/456` → `pets/` folder)
- `flat`: no folder grouping, all requests at collection root level

Wire the `--format` flag from CLI through `generate()` orchestrator options down to folder generator.

**Tests:**
- Unit test: folder generator with `format: 'path'` produces correct folder structure for a multi-path spec
- Unit test: folder generator with `format: 'flat'` produces no folder.bru files, all requests at root
- Integration test: `bruno-gen spec.yaml ./out --format path` → verify folder structure matches path grouping
- Integration test: `bruno-gen spec.yaml ./out --format flat` → verify no subdirectories created

---

## Wave 5: Test Assertion Generator

Create `src/generators/test-generator.ts`:

**Input:** ResponseIR array from EndpointIR (each response has statusCode, content schema, optional example)

**Output:** Bruno `post-response { ... }` block string

**Assertion tiers (Tier 2):**
1. Status code assertion: `expect(res.getStatus()).to.equal(<statusCode>, "expected status <code>")`
2. Required fields presence: For each field in `responseSchema.required[]`, generate `expect(res.getBody()).to.have.property("<field>", "required field '<field>' missing")`
3. Example value bonus assertion: When spec provides a response example value, generate `expect(res.getBody().<field>).to.equal(<exampleValue>, "expected example value '<value>'")` — pick the first example field

**Rules:**
- Only generate for 2xx responses (success responses)
- Only generate for responses with a JSON content type (`application/json`)
- If no required fields and no example, generate status-only assertion
- Use Bruno's native `expect()` and `res` APIs

**Tests:**
- Unit test: test generator with status code only (no required fields, no example)
- Unit test: test generator with required fields — verifies property assertions generated
- Unit test: test generator with response example — verifies bonus example assertion generated
- Unit test: test generator filters out non-2xx and non-JSON responses
- Unit test: test generator handles multiple 2xx responses (generates tests for each)

---

## Wave 6: Wire `--tests` Flag Through Pipeline

1. Add `generateTests?: boolean` to the `GenerateOptions` type (in orchestrator or shared options type)
2. Update `src/generators/orchestrator.ts` `generate()` function:
   - When `generateTests` is true, import and call `test-generator.ts` for each endpoint's responses
   - Pass test block string to `request-generator.ts` as part of the request data
3. Update `src/generators/request-generator.ts`:
   - Accept optional `postResponse` block string in request data
   - Append `post-response { ... }` block to the generated `.bru` content when present
4. Update CLI action handler: pass `generateTests: opts.tests` (from `--tests` flag) through to `generate()`

**Tests:**
- Integration test: `bruno-gen spec.yaml ./out --tests` → verify each request .bru file contains `post-response` block
- Integration test: `bruno-gen spec.yaml ./out` (no `--tests`) → verify NO `post-response` blocks in any .bru file (TEST-04)
- Integration test: `bruno-gen spec.yaml ./out --tests --dry-run` → verify dry-run output includes test block content
- Golden file test: generate with `--tests` against a known spec, compare output .bru files to expected fixtures

---

## Verification Checklist

- [ ] CLI-01: `bruno-gen ./openapi.yaml ./output` works with exit code 0
- [ ] CLI-02: Output directory argument works (positional `[output]`)
- [ ] CLI-03: `--format tag|path|flat` all produce different folder structures
- [ ] CLI-04: `--tests` generates post-response blocks
- [ ] CLI-05: `--dry-run` prints tree without writing files
- [ ] CLI-06: `--config` flag accepted (wired through, full integration Phase 5)
- [ ] CLI-07: Exit code 0 with warnings
- [ ] CLI-08: Exit code 1 on invalid spec
- [ ] CLI-09: Warnings logged without halting
- [ ] CLI-10: Non-TTY output is clean (test with `CI=true`)
- [ ] TEST-01: Status code assertions generated
- [ ] TEST-02: Required fields presence assertions generated
- [ ] TEST-03: Example value assertions generated when spec provides examples
- [ ] TEST-04: No test code generated without `--tests` flag
- [ ] `npm run build` passes (tsup produces both `dist/index.js` and `dist/cli.js`)
- [ ] `npm run lint` passes
- [ ] `npm test` passes with 80%+ coverage
- [ ] All 14 requirements traceable to passing tests

## Dependencies to Add

```json
{
  "dependencies": {
    "commander": "^12.x",
    "chalk": "^5.x",
    "ora": "^8.x",
    "cli-table3": "^0.6.x"
  }
}
```

## New/Modified Files

### New files
- `src/cli.ts` — CLI entry point with Commander program
- `src/cli/output.ts` — TTY-aware formatting utilities
- `src/generators/test-generator.ts` — Bruno post-response test block generator

### Modified files
- `tsup.config.ts` — Add `src/cli.ts` entry point
- `package.json` — Add dependencies, verify bin field
- `src/generators/orchestrator.ts` — Add `generateTests` option, wire test generation
- `src/generators/request-generator.ts` — Accept and append `post-response` block
- `src/generators/folder-generator.ts` — Accept `format` option for grouping strategy

### Test files
- `src/cli.test.ts` — CLI argument parsing, exit codes, error handling
- `src/cli/output.test.ts` — TTY detection, formatting functions
- `src/generators/test-generator.test.ts` — Test block generation unit tests
- `src/generators/request-generator.test.ts` — Updated: post-response block integration
- `src/generators/folder-generator.test.ts` — Updated: format option tests
- `src/generators/__fixtures__/` — Test fixture specs for CLI integration tests
