# Pitfalls: Bruno Collection Generator

> Research date: April 2026
> Purpose: Common failure modes, edge cases, and prevention strategies for building an API spec-to-Bruno-collection generator

---

## 1. OpenAPI Spec Edge Cases

### 1.1 `$ref` Resolution Failures

**Description:** OpenAPI specs use JSON Reference (`$ref`) to share definitions. References can be internal (`#/components/schemas/User`), relative (`./models/User.yaml`), or remote (`https://example.com/schemas/User.yaml`). Circular references occur when schema A references schema B which references schema A.

**Warning signs:**
- Parser throws `ENOENT` for relative file references
- Infinite recursion / stack overflow on circular refs
- Generated requests reference missing types
- Silent omission of referenced schemas in output

**Prevention strategy:**
- Use `@apidevtools/swagger-parser`'s `dereference()` method, which handles circular references by preserving them as special markers rather than infinite expansion
- Test against specs with known circular refs (e.g., self-referencing tree structures, parent-child relationships)
- Implement a reference resolution depth limit (e.g., max 20 levels) as a safety valve
- For relative file references, resolve paths relative to the spec file's directory

**Phase to address:** Phase 2 (OpenAPI Parser) — test with specs containing internal, relative, remote, and circular references.

---

### 1.2 `allOf` / `oneOf` / `anyOf` Composition

**Description:** OpenAPI 3.0+ supports schema composition via `allOf` (merge all schemas), `oneOf` (exactly one matches), and `anyOf` (one or more match). These are common in well-structured APIs but tricky to translate to Bruno request bodies and test assertions.

**Warning signs:**
- Generated request bodies are missing properties from composed schemas
- `oneOf` schemas generate only the first variant, losing alternatives
- `allOf` with conflicting property names produces invalid output
- Discriminator mappings are ignored

**Prevention strategy:**
- **`allOf`:** Merge all constituent schemas into a single flattened schema. Detect and report conflicting property names (same name, different types).
- **`oneOf`:** Generate the request body using the first variant. Add test assertions that check the response matches *one of* the variants. Document which variant was chosen in the request's `docs` block.
- **`anyOf`:** Similar to `oneOf` — use the first variant for the request body.
- **Discriminators:** When a `discriminator` object is present, use the `propertyName` to generate conditional test that verify the correct variant is returned.
- Store composition metadata in the IR's `$ref` and `resolvedName` fields for downstream use.

**Phase to address:** Phase 2 (OpenAPI Parser) for IR mapping; Phase 5 (Test Generation) for assertion handling.

---

### 1.3 Polymorphic Schemas and Inheritance

**Description:** OpenAPI 3.1 adopts JSON Schema 2020-12, which introduces `unevaluatedProperties`, `prefixItems` (tuple types), and `if`/`then`/`else` conditionals. These are not present in OpenAPI 3.0 and are impossible to represent in Swagger 2.0.

**Warning signs:**
- Properties silently dropped from schemas using `unevaluatedProperties`
- Array tuple types (`prefixItems`) rendered as simple arrays
- Conditional schemas (`if/then/else`) ignored entirely

**Prevention strategy:**
- Detect OpenAPI 3.1-specific JSON Schema features and emit warnings
- For `unevaluatedProperties: false`: treat as "no additional properties allowed" (same as `additionalProperties: false`)
- For `unevaluatedProperties: <schema>`: treat as `additionalProperties: <schema>` (best-effort mapping)
- For `prefixItems`: generate request body using the tuple schema but warn that Bruno doesn't validate tuple positions
- For `if/then/else`: use the `then` schema as the primary, log a warning
- Add a `--strict` flag that treats unsupported features as errors instead of warnings

**Phase to address:** Phase 2 (OpenAPI Parser) — handle during schema-to-IR mapping.

---

### 1.4 Missing or Empty Required Fields

**Description:** Some specs omit `required` arrays on objects, or declare `required: []`. This means all properties are optional, which affects whether the generator should include them in request bodies.

**Warning signs:**
- Generated request bodies are completely empty (all properties optional)
- Required path parameters not included in URLs
- Bruno collection fails to execute because required params are missing

**Prevention strategy:**
- When `required` is absent or empty, still include properties in the request body with fake/example values — but mark them as optional in the request's `docs` block
- Required path parameters are **always** included (they're part of the URL, not optional)
- Required query parameters with no default value: include with a placeholder value and a comment in the `docs` block
- Generate a warning in the output summary for specs with no `required` declarations

**Phase to address:** Phase 2 (OpenAPI Parser) and Phase 3 (Bruno Output Generator).

---

## 2. Swagger 2.0 → OpenAPI 3.x Differences

### 2.1 `basePath`, `host`, `schemes` → `servers`

**Description:** Swagger 2.0 splits the server URL into three fields (`host`, `basePath`, `schemes`). OpenAPI 3.x consolidates these into a `servers` array with full URLs.

**Warning signs:**
- Generated requests have URLs like `:/users/{id}` (missing host)
- Only `https` scheme is used when spec declares both `http` and `https`
- `basePath` is duplicated in request paths

**Prevention strategy:**
- Normalize Swagger 2.0 to OpenAPI 3.0 server format during parsing:
  ```
  servers = schemes.map(scheme => `${scheme}://${host}${basePath}`)
  ```
- Default to `https` if `schemes` is not specified (Swagger 2.0 default behavior)
- Default `basePath` to empty string if not specified
- Test with real Swagger 2.0 specs (e.g., older Petstore, GitHub API v3)

**Phase to address:** Phase 6 (Swagger 2.0 Support).

---

### 2.2 `produces` / `consumes` → `content`

**Description:** Swagger 2.0 defines `produces` (response MIME types) and `consumes` (request MIME types) at the root and operation levels. OpenAPI 3.x replaces these with per-operation `requestBody.content` and `responses.<code>.content`.

**Warning signs:**
- Generated requests have no `Content-Type` header
- Response content type not detected for test assertions
- Root-level `produces`/`consumes` not applied to operations that don't override them

**Prevention strategy:**
- Map `consumes` to `requestBody.content` with the appropriate media type keys
- Map `produces` to response `content` keys
- Apply root-level `produces`/`consumes` as defaults; operation-level values override
- Generate appropriate `Content-Type` and `Accept` headers from the mapped content types

**Phase to address:** Phase 6 (Swagger 2.0 Support).

---

### 2.3 `definitions` → `components/schemas`

**Description:** Swagger 2.0 stores reusable schemas in `definitions`. OpenAPI 3.x moves them to `components/schemas`.

**Warning signs:**
- Reusable schemas not found in generated collections
- `$ref` paths break after conversion

**Prevention strategy:**
- Direct mapping: `definitions` → `components/schemas`
- Rewrite `$ref` paths from `#/definitions/Foo` to `#/components/schemas/Foo`
- Also handle `parameters` → `components/parameters` and `responses` → `components/responses`

**Phase to address:** Phase 6 (Swagger 2.0 Support).

---

### 2.4 `formData` and `file` Parameters

**Description:** Swagger 2.0 has a special `in: formData` parameter type and `type: file` for file uploads. OpenAPI 3.x replaces these with `multipart/form-data` request bodies.

**Warning signs:**
- `formData` parameters not included in generated requests
- File upload parameters rendered as regular form fields
- Generated `body:form-urlencoded` when it should be `body:multipart-form`

**Prevention strategy:**
- If any parameter has `in: formData`, group all formData params into a single request body
- If any param has `type: file`, use `body:multipart-form` instead of `body:form-urlencoded`
- Map `type: file` params to multipart file fields with the `@file()` syntax

**Phase to address:** Phase 6 (Swagger 2.0 Support).

---

## 3. GraphQL Pitfalls

### 3.1 Union Types and Interfaces

**Description:** GraphQL union types (`union SearchResult = User | Post | Comment`) and interfaces (`interface Node { id: ID! }`) represent polymorphic data. When generating Bruno request bodies and test assertions, you cannot know which concrete type will be returned at runtime.

**Warning signs:**
- Generated test assertions only check for one concrete type
- Union fields are omitted from request bodies
- Interface fields not included in queries

**Prevention strategy:**
- For request generation: include `__typename` in query selections so the response indicates which type was returned
- For test assertions: generate tests that check for the presence of `__typename` and validate against the shared fields (interface fields)
- Document in the request's `docs` block which types are possible for union fields
- Map union types to `oneOf` in SchemaIR for downstream handling

**Phase to address:** Phase 7 (GraphQL Support).

---

### 3.2 Custom Scalars

**Description:** GraphQL allows custom scalar types (`scalar DateTime`, `scalar JSON`, `scalar Upload`). These have no inherent serialization format — it's defined by the server implementation.

**Warning signs:**
- Custom scalars rendered as empty objects in request bodies
- `DateTime` scalars formatted incorrectly
- `Upload` scalars not mapped to file upload syntax

**Prevention strategy:**
- Map known custom scalars to appropriate representations:
  - `DateTime`, `Date`, `Time` → `string` with ISO 8601 example value
  - `JSON`, `JSONObject` → `object` with empty example
  - `Upload` → multipart file field
  - `ID` → `string` with example `"12345"`
- For unknown custom scalars: use `string` type with a placeholder value and a `docs` note explaining the scalar name
- Allow config file overrides to define custom scalar mappings:
  ```yaml
  graphql:
    customScalars:
      BigInt: { type: number, example: 9007199254740991 }
      URL: { type: string, example: "https://example.com" }
  ```

**Phase to address:** Phase 7 (GraphQL Support).

---

### 3.3 Directives

**Description:** GraphQL directives (`@deprecated`, `@auth`, custom directives) modify schema behavior. `@deprecated(reason: "...")` is the only built-in directive with universal meaning.

**Warning signs:**
- Deprecated operations included in generated collections without warning
- Custom directives cause parse errors
- Required directives (e.g., `@auth`) not translated to Bruno auth

**Prevention strategy:**
- Handle `@deprecated`: mark the endpoint as deprecated in the IR. Optionally skip generating it (configurable via `includeDeprecated: false`).
- For custom directives: store them in the IR's extensions field. Do not attempt to interpret them, but make them available for plugin hooks.
- For `@skip` and `@include`: these are client-side query directives, not schema directives. They don't affect generation.

**Phase to address:** Phase 7 (GraphQL Support).

---

### 3.4 GraphQL Subscriptions

**Description:** GraphQL subscriptions use WebSocket (usually `graphql-ws` protocol), not HTTP POST. Bruno supports WebSocket requests (`type: ws-request`) but the `.bru` format for them is different.

**Warning signs:**
- Subscriptions generated as HTTP POST requests (they will fail at runtime)
- WebSocket `.bru` files have incorrect structure

**Prevention strategy:**
- Detect subscription operations in the GraphQL schema (they are defined on the `Subscription` root type)
- Generate them as WebSocket requests with `type: ws-request` in the meta block
- Use Bruno's WebSocket DSL format (research the exact syntax from Bruno docs — it may differ from HTTP requests)
- Add a config option `generateSubscriptions: false` to skip them entirely (many users don't need subscription testing)

**Phase to address:** Phase 7 (GraphQL Support).

---

## 4. Bruno Format Quirks

### 4.1 Undocumented DSL Behavior

**Description:** The `.bru` DSL is not formally specified with a grammar or schema. It is documented through examples, and the parser lives in the Bruno source code. This means:
- Edge cases in quoting/escaping are not documented
- Behavior with special characters in values is undefined
- The parser may be lenient on some things and strict on others

**Warning signs:**
- Generated `.bru` files fail to load in Bruno with cryptic errors
- Values containing colons, braces, or brackets are parsed incorrectly
- Multi-line values behave unexpectedly

**Prevention strategy:**
- **Test every generated file with `bru run`** — this is the ground truth for format validity
- Build a comprehensive test suite of edge-case values: strings with colons, braces, newlines, Unicode, emojis
- When a value might be ambiguous, err on the side of caution:
  - Avoid colons in dictionary values (use in text blocks instead)
  - Keep values on single lines for dictionary blocks
  - Use text blocks for multi-line content (JSON bodies, scripts)
- Monitor Bruno GitHub issues for DSL parser changes
- Contribute a formal grammar/spec to the Bruno project if possible

**Phase to address:** Phase 1 (foundation — build the escaping/quoting utilities), Phase 3 (generator — test output with Bruno CLI).

---

### 4.2 Format Changes Between Bruno Versions

**Description:** Bruno evolves rapidly. The `.bru` DSL format may change between major versions. Bruno 3.0 introduced OpenCollection YAML as an alternative format, and future versions may deprecate or modify the DSL.

**Warning signs:**
- Generated collections work in Bruno 2.x but fail in Bruno 3.x (or vice versa)
- New block types appear in Bruno that the generator doesn't produce
- Deprecation warnings in the Bruno app

**Prevention strategy:**
- Pin the Bruno version used for integration testing and document the minimum supported version
- Add a `--target-bruno-version` flag to the CLI that adjusts output format
- Monitor Bruno release notes for DSL changes
- Plan OpenCollection YAML support as a future output format (Phase 9+)
- Include a version comment in `collection.bru` to track which generator version produced it

**Phase to address:** Phase 9 (Library API & Polish) — version tracking; ongoing monitoring.

---

### 4.3 Variable Naming Conflicts

**Description:** Bruno variable resolution follows a specific precedence (request → environment → collection → system). If the generator creates variables that conflict with existing environment variables or system variables, unexpected behavior occurs.

**Warning signs:**
- `{{baseUrl}}` resolves to the wrong value
- Auth tokens not being set correctly
- Variables shadowing each other across environments

**Prevention strategy:**
- Use namespaced variable names for generated variables (e.g., `api_baseUrl` instead of `baseUrl`)
- Document the variables the generator creates in `collection.bru` docs
- Check for conflicts with Bruno built-in variables (`{{$uuid}}`, `{{$timestamp}}`, `{{$isoTimestamp}}`)
- Allow users to override variable names via config

**Phase to address:** Phase 3 (Bruno Output Generator).

---

## 5. File Path Sanitization

### 5.1 Special Characters in operationIds, URLs, Tag Names

**Description:** OpenAPI `operationId` values, URL paths, and tag names can contain characters that are invalid or problematic in file names: slashes, colons, angle brackets, pipes, question marks, Unicode, emojis.

**Warning signs:**
- File creation fails with `ENOENT` or `EINVAL`
- Generated filenames are unreadable (`GET__users_{id}.bru` vs `Get User by ID.bru`)
- Cross-platform issues (Windows forbids `<>:"/\|?*`, macOS is case-insensitive)

**Prevention strategy:**
```ts
function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "-")     // Replace forbidden chars
    .replace(/\s+/g, " ")              // Normalize whitespace
    .replace(/^\.+/, "")               // Strip leading dots
    .replace(/\.+$/, "")               // Strip trailing dots
    .trim()
    .slice(0, 255);                    // Max filename length
}
```
- Use the operation's `summary` or a human-readable name for the `.bru` filename, not the `operationId`
- For operations without a summary, generate one from the method and path: `"GET /users/{id}"` → `"Get User by ID"`
- Handle duplicate names by appending a sequence number: `"Create User.bru"`, `"Create User (2).bru"`
- Test on macOS (case-insensitive, most common dev platform) and Linux CI

**Phase to address:** Phase 1 (foundation — build the sanitizer utility).

---

## 6. Dual CJS/ESM Packaging Pitfalls

### 6.1 ESM-Only Dependencies in CJS Build

**Description:** `chalk` 5+, `ora` 8+, `figures` 6+ are ESM-only. If the CJS build of the library imports these, `require()` will fail.

**Warning signs:**
- `ERR_REQUIRE_ESM` error when users `require("gen-bruno")` in CommonJS
- CJS build works in dev but fails in production

**Prevention strategy:**
- Confine ESM-only dependencies to the CLI entry point (`src/cli.ts`), which is always run as ESM
- The library core (`src/index.ts` and all non-CLI modules) must use only dual-compatible or CJS-compatible packages
- Test both `import` and `require` entry points in CI
- Document the ESM/CJS split clearly in the README

**Phase to address:** Phase 9 (Library API & Polish) — build configuration.

---

### 6.2 `__dirname` and `import.meta.url`

**Description:** CJS uses `__dirname` and `__filename`; ESM uses `import.meta.url`. Code that uses `__dirname` will fail in ESM builds.

**Warning signs:**
- `ReferenceError: __dirname is not defined` in ESM build
- Path resolution fails when loading config files or templates

**Prevention strategy:**
- In ESM code, use:
  ```ts
  import { fileURLToPath } from "node:url";
  import { dirname } from "node:path";
  const __dirname = dirname(fileURLToPath(import.meta.url));
  ```
- Better: avoid `__dirname` entirely. Use `import.meta.url` directly for file URL resolution.
- Use a shared utility module for file path resolution that works in both modes.

**Phase to address:** Phase 1 (foundation) and Phase 9 (Library API & Polish).

---

### 6.3 Conditional Exports Mismatch

**Description:** If `package.json` `exports` map `import` and `require` to different files but those files have different behavior, users get inconsistent results depending on how they import.

**Warning signs:**
- ESM users see different default exports than CJS users
- TypeScript resolves types from one build but runtime uses the other
- Named exports work in ESM but not CJS (or vice versa)

**Prevention strategy:**
- Ensure both CJS and ESM entry points export the **same** API surface
- Use `tsup` or `tshy` which generate correct exports automatically
- Test both `import { generate }` and `const { generate } = require()` in CI
- Use `"exports"` field with both `import` and `require` conditions plus `types`

**Phase to address:** Phase 9 (Library API & Polish).

---

## 7. Large Spec Performance

### 7.1 1000+ Endpoints

**Description:** Real-world API specs (Stripe, GitHub, AWS) can have thousands of endpoints. Generating `.bru` files for all of them can be slow and produce very large output directories.

**Warning signs:**
- Generation takes >60 seconds for large specs
- Out-of-memory errors during spec parsing
- Generated collection has 10,000+ files
- File system operations are the bottleneck (not parsing)

**Prevention strategy:**
- **Parsing is fast** (swagger-parser loads even large specs in <5s). The bottleneck is file I/O.
- Use batched file writes with `Promise.all` and a concurrency limit (e.g., 50 concurrent writes)
- Offer a `--filter` flag to limit generation to specific tags or path patterns
- Offer a `--summary` flag that prints endpoint counts without writing files
- Consider grouping very large collections into sub-collections by tag
- Benchmark against real-world large specs: Stripe (v1.0), GitHub REST API, AWS API Gateway exports

**Phase to address:** Phase 4 (End-to-End Pipeline) — implement and benchmark; Phase 10 (Testing & Release) — performance testing.

---

## 8. Silent Data Loss

### 8.1 Spec Features Not Representable in Bruno

**Description:** Some OpenAPI/GraphQL features have no Bruno equivalent. If the generator silently drops these features, users get incomplete collections without knowing it.

**Warning signs:**
- Generated collections are missing data from the original spec
- Users report "missing endpoints" that were actually filtered out
- No warnings or errors in the output summary

**Prevention strategy:**
- **Never silently drop data.** Always emit a warning for unrepresentable features.
- Track all warnings in a `Warning` object with severity levels:
  - `info`: Non-critical, no action needed
  - `warn`: Data was approximated or partially represented
  - `error`: Data was dropped entirely, user should review
- Print a summary table at the end of generation:
  ```
  Generated: 142 requests, 3 environments, 8 folders
  Warnings:  5 (run with --verbose for details)
  Skipped:   2 deprecated endpoints
  Errors:    0
  ```
- With `--verbose`, print each warning with the spec location and reason
- With `--strict`, treat warnings as errors and exit with non-zero code

**Phase to address:** Phase 4 (End-to-End Pipeline) — implement warning tracking; all phases as data loss points are discovered.

---

### 8.2 Config Override Conflicts

**Description:** When multiple config overrides target the same operation, or when an override makes an endpoint invalid (e.g., removing a required path parameter), the generator must handle the conflict gracefully.

**Warning signs:**
- Override silently ignored because a later override matched the same operation
- Generated request is invalid (missing required params)
- Order-dependent config behavior

**Prevention strategy:**
- Config overrides are applied in declaration order (documented behavior)
- Later overrides win for scalar fields; arrays are merged
- Validate the IR after overrides are applied — if an override makes an endpoint invalid, emit a warning
- Allow overrides to target by multiple criteria (operationId + tag) with AND logic

**Phase to address:** Phase 4 (End-to-End Pipeline) — config merge and validation.

---

## 9. Testing Strategies for Code Generators

### 9.1 Golden File Tests

**Description:** Compare generated output against known-good fixture files. This is the single most important test strategy for a code generator.

**Warning signs of inadequate golden testing:**
- Bugs discovered only when running with Bruno CLI
- Output format regressions go unnoticed
- Different output on different platforms (line endings, sort order)

**Prevention strategy:**
- Store input specs in `test/fixtures/` (OpenAPI 3.x, Swagger 2.0, GraphQL)
- Store expected output in `test/golden/` (matching directory structure)
- Test runner: parse fixture → generate → compare output with golden files
- Use Vitest's `toMatchFileSnapshot()` for easy assertion
- Update golden files with a `--update` flag when intentional format changes are made
- **Include fixtures for every edge case:** circular refs, allOf/oneOf, deprecated endpoints, empty specs, specs with no security, specs with multiple auth schemes

**Phase to address:** Phase 2 (start building fixtures immediately), Phase 10 (comprehensive golden suite).

---

### 9.2 Snapshot Tests

**Description:** Similar to golden files but managed by the test framework. Useful for testing intermediate representations and error messages.

**Prevention strategy:**
- Snapshot the IR produced by each parser to ensure parsing is consistent
- Snapshot error messages for validation failures
- Snapshot the config merge result for various config combinations
- Review snapshot changes carefully — they are a code review step

**Phase to address:** Phase 2 (parser snapshots), Phase 4 (error message snapshots).

---

### 9.3 Integration Tests with Bruno CLI

**Description:** The ultimate test: generate a collection and run it with `bru run`. If Bruno can load and execute the collection, the format is correct.

**Warning signs:**
- Golden files pass but Bruno fails to load the collection
- Tests pass on CI but fail locally (different Bruno versions)

**Prevention strategy:**
- Install Bruno CLI in CI (use `npm i -g @usebruno/cli`)
- Generate a test collection and run `bru run --env dev` against a mock server
- Use a mock server (e.g., `msw` or a simple Express app) that returns predictable responses
- Validate that tests in the generated collection pass against the mock server
- Pin the Bruno CLI version in CI to avoid format drift

**Phase to address:** Phase 4 (end-to-end pipeline), Phase 10 (comprehensive integration suite).

---

### 9.4 Property-Based Tests

**Description:** Generate random but valid OpenAPI specs using `fast-check`, then verify that the generator produces valid output for all of them.

**Warning signs:**
- Only testing against hand-crafted specs (misses edge cases)
- Rare combinations of features cause failures

**Prevention strategy:**
- Use `fast-check` arbitraries to generate:
  - Random endpoint definitions (method + path + params + responses)
  - Random schema compositions (allOf, oneOf, anyOf, nested)
  - Random security scheme combinations
- Verify invariants:
  - Every endpoint produces a valid `.bru` file
  - Every generated file parses with the Bruno DSL
  - No empty required fields in output
  - All variable references are balanced (`{{` matches `}}`)

**Phase to address:** Phase 10 (Testing & Release) — add after core pipeline works.

---

### 9.5 Real-World Spec Tests

**Description:** Test against real, publicly available API specs. These are the specs users will actually use.

**Recommended test specs:**
| Spec | Size | Why |
|------|------|-----|
| Stripe API | ~1000 endpoints | Largest commonly-used spec; tests performance |
| GitHub REST API | ~500 endpoints | Complex auth, pagination, nested schemas |
| Petstore (OpenAPI 3.0) | ~20 endpoints | Standard reference; simple baseline |
| Petstore (Swagger 2.0) | ~20 endpoints | Tests Swagger 2.0 parser |
| GitHub GraphQL Schema | ~500 fields | Tests GraphQL parser |
| A spec with circular refs | Small | Tests circular reference handling |
| A minimal spec (1 endpoint) | Tiny | Tests minimum viable output |

**Phase to address:** Phase 10 (Testing & Release).

---

## 10. Pitfall Summary Matrix

| # | Pitfall | Severity | Phase | Prevention |
|---|---------|----------|-------|------------|
| 1.1 | `$ref` resolution | **Critical** | P2 | Use swagger-parser dereference; test circular refs |
| 1.2 | `allOf/oneOf/anyOf` | **High** | P2, P5 | Merge for allOf; first-variant for oneOf/anyOf; warn |
| 1.3 | OpenAPI 3.1 JSON Schema | **Medium** | P2 | Best-effort mapping; warn on unsupported features |
| 1.4 | Missing required fields | **Medium** | P2, P3 | Include optional fields with fake values; warn |
| 2.1 | basePath/host/schemes | **High** | P6 | Normalize to servers array during parsing |
| 2.2 | produces/consumes | **High** | P6 | Map to content types and headers |
| 2.3 | definitions → components | **Medium** | P6 | Direct path rewrite |
| 2.4 | formData/file params | **Medium** | P6 | Group into multipart body |
| 3.1 | Union types / interfaces | **Medium** | P7 | Include __typename; test shared fields |
| 3.2 | Custom scalars | **Medium** | P7 | Known-scalar mapping; config for custom ones |
| 3.3 | Directives | **Low** | P7 | Handle @deprecated; store others in extensions |
| 3.4 | Subscriptions | **Low** | P7 | Generate as WebSocket; config to skip |
| 4.1 | Undocumented DSL | **Critical** | P1, P3 | Test every output with `bru run`; edge-case tests |
| 4.2 | Bruno version drift | **Medium** | P9+ | Pin Bruno version; monitor changelog |
| 4.3 | Variable conflicts | **Medium** | P3 | Namespace variables; avoid built-in names |
| 5.1 | Path sanitization | **High** | P1 | Sanitize filenames; handle duplicates |
| 6.1 | ESM-only deps in CJS | **Critical** | P9 | Confine to CLI layer; test both entry points |
| 6.2 | `__dirname` in ESM | **High** | P1, P9 | Use `import.meta.url` pattern |
| 6.3 | Conditional exports | **High** | P9 | Use tsup/tshy; test import + require |
| 7.1 | 1000+ endpoints | **Medium** | P4, P10 | Batch writes; filter flag; benchmark |
| 8.1 | Silent data loss | **Critical** | P4+ | Warning tracker; summary table; --strict mode |
| 8.2 | Override conflicts | **Medium** | P4 | Documented order; post-override validation |
| 9.1 | Golden file gaps | **High** | P2, P10 | Edge-case fixtures; update workflow |
| 9.3 | Integration tests | **High** | P4, P10 | `bru run` in CI; mock server |

---

## 11. What to Monitor

| Area | What to Watch | How |
|------|--------------|-----|
| Bruno DSL format | Changes in Bruno releases | Watch [usebruno/bruno](https://github.com/usebruno/bruno) releases and issues |
| OpenAPI 3.2 spec | New spec version features | Follow [OAI/OpenAPI-Specification](https://github.com/OAI/OpenAPI-Specification) |
| OpenCollection YAML | Adoption as default format | Monitor Bruno docs and RFCs |
| `@apidevtools/swagger-parser` | Breaking changes, OAS 3.2 support | Watch npm releases and GitHub |
| `graphql` package | v17 breaking changes | Watch npm releases (v16 is stable) |
| Node.js 24 | LTS timeline, ESM changes | Follow [nodejs/node](https://github.com/nodejs/node) releases |
| Commander.js | v15+ Node requirements | Already requires Node 22.12+ |
