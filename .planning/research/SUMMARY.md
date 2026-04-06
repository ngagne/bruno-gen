# Research Summary: Bruno Collection Generator

> Synthesized: 2026-04-06
> Purpose: Key findings from parallel research across Stack, Features, Architecture, and Pitfalls dimensions

---

## Stack — Key Findings

**Parser stack:**
- **OpenAPI/Swagger:** `@apidevtools/swagger-parser` 12.x — handles Swagger 2.0, OpenAPI 3.0, 3.1 with dereferencing, validation, and bundling (400K+ weekly downloads)
- **GraphQL:** `graphql` 16.x — `parse()` for SDL, `buildSchema()` + `getIntrospectionQuery()` for schema analysis
- **YAML/JSON:** `js-yaml` 4.x for YAML specs, native `JSON.parse` for JSON specs

**Bruno format:**
- `.bru` files use a markdown-like DSL with frontmatter blocks (`---`) and named code blocks (`@body:json`, `@script:js`)
- `collection.bru` — collection metadata (name, version, auth)
- `folder.bru` — optional folder-level metadata
- `{name}.bru` — individual requests with method, URL, headers, body, scripts
- Environment files live in `environments/` directory with variable key-value pairs
- **Bruno 3.0** introduces `opencollection.yaml` — a YAML alternative format (track this for future compatibility)

**Build tooling:**
- **tsup** for dual CJS/ESM bundling (simpler than manual tsconfig dual-targeting)
- **Commander.js** 14.x/15.x for CLI (already chosen)
- **ora** 8.x for spinners, **chalk** 5.x for output, **cli-table3** for tables
- **Vitest** recommended over Jest for testing (native TS/ESM, faster), but project spec calls for Jest — reconcile in planning

**Code generation:** String builders over template engines — type-safe, no runtime deps, easier to test

---

## Features — Key Findings

**Table stakes (must have):**
1. Request generation (method, URL, path)
2. Request body from schema examples
3. Headers from spec
4. Auth handling via environment variables
5. Response examples from spec
6. Folder organization (by tag/path)
7. Variable substitution (`{{baseUrl}}`)

**Top differentiators:**
1. **Environment variable generation** — auto-generate `{{baseUrl}}` and auth variable files
2. **Test assertion generation** — auto-generate post-response scripts that validate status codes and schemas (via `--tests` flag)
3. **Config file overrides** — `brunogen.config.yml` for customizing output
4. **Plugin system** — hooks at IR-transform and pre-output stages

**Deliberately NOT building:**
- GUI wrapper, live sync/watch mode, API mocking server, collection versioning, reverse spec generation

**Positioning:** "Portman for Bruno" — a config-driven CLI that produces testable Bruno collections in one command

---

## Architecture — Key Findings

**Recommended 5-layer architecture:**

```
CLI Layer → Library API → Config System → Parser Layer (IR) → Generator Layer → Output
```

1. **Parser Layer** — Separate parsers for OpenAPI 3.x, Swagger 2.0, GraphQL → unified Intermediate Representation (IR)
2. **IR (Intermediate Representation)** — ~25 TypeScript interfaces capturing all spec concepts (endpoints, params, bodies, auth, examples)
3. **Generator Layer** — Builder pattern: one function per `.bru` block type, composable
4. **Config System** — Discovery: CWD `brunogen.config.yml` → merge with defaults → CLI flags override
5. **Plugin System** — Three hooks: `transformIR`, `preOutput`, `postWrite`

**Key insight:** The IR pattern (from Babel/Prettier/GraphQL Code Generator) is critical — it decouples input formats from output format and makes the plugin system natural.

---

## Pitfalls — Key Findings

**Highest risk pitfalls (by severity):**

| Pitfall | Severity | Phase | Prevention |
|---------|----------|-------|------------|
| `$ref` resolution failures (circular refs, remote refs) | Critical | Phase 2 | Use swagger-parser's `dereference()`, test with circular ref specs |
| `allOf/oneOf/anyOf` composition | High | Phase 2 | Merge schemas correctly; test with Stripe/GitHub specs |
| Bruno format drift between versions | Medium | Phase 4 | Test against current Bruno version; pin format version |
| File path sanitization | Medium | Phase 4 | URL-safe, filesystem-safe filename conversion |
| Dual CJS/ESM packaging | High | Phase 1 | Use `tsup`; test both import paths in CI |
| Silent data loss during translation | High | All phases | Warning tracker with summary table; `--strict` mode |
| Large spec performance (1000+ endpoints) | Medium | Phase 4 | Benchmark against Stripe/GitHub specs; stream output |

**Testing strategy for code generators:**
- Golden file tests (spec → expected .bru files comparison)
- Snapshot tests for IR serialization
- `bru run` integration tests (execute generated collections in Bruno CLI)
- Property-based tests with `fast-check` for schema edge cases
- Real-world spec benchmarks (Stripe, GitHub, Petstore)

---

## What This Means for Requirements

1. **v1 must include** all 7 table stakes features — without these, the tool isn't competitive
2. **Test assertion generation** is the #1 differentiator — prioritize this
3. **IR architecture** is the right call — plan for it from Phase 1
4. **Dual CJS/ESM packaging** needs attention early — set up tsup in scaffold phase
5. **Warning system** is critical — spec translation always loses information; be transparent about it
6. **Golden file testing** is the right test strategy — not just unit tests

---

*Research synthesized from 4 parallel research outputs*
