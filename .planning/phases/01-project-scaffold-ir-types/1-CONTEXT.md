# Phase 1: Project Scaffold & IR Types - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Foundation infrastructure: project initialization with TypeScript, tooling configuration (linting, formatting, testing), build pipeline producing dual CJS/ESM output, and the complete Intermediate Representation (IR) type system that all parsers and generators share. This phase delivers zero runtime functionality — it's the scaffolding and type contracts that Phase 2+ builds on.

</domain>

<decisions>
## Implementation Decisions

### Package & Build Strategy
- **D-01:** `package.json` uses `"type": "module"` — ESM-first project
- **D-02:** `tsup` handles dual CJS/ESM build output via `format: ["esm", "cjs"]`
- **D-03:** CLI entry point is ESM (`.mjs` or ESM source file), library exports both CJS and ESM via `package.json` `exports` field
- **D-04:** ESM-only dependencies (chalk 5, ora 8) confined to CLI layer; library core uses no ESM-only deps

### Testing Framework
- **D-05:** Vitest (not Jest) — native TypeScript via esbuild, ESM-native, faster, simpler config
- **D-06:** v8 coverage provider with 80% threshold enforced in CI
- **D-07:** Golden file tests using Vitest `toMatchFileSnapshot()` for comparing generated `.bru` output against fixtures

### IR Type Scope
- **D-08:** Full IR type system implemented upfront — all types from ARCHITECTURE.md section 2.2
- **D-09:** Includes: core types (CollectionIR, EndpointIR, ParameterIR, SchemaIR, ResponseIR), all 4 security scheme variants (HTTP, apiKey, OAuth2, OpenID Connect), GraphQL extension types (GraphQLEndpointExtension, GraphQlArgumentIR), webhooks, discriminator objects, links, encoding objects
- **D-10:** IR types are version-agnostic — no `openapi3Field` or `swagger2Field` in the IR
- **D-11:** GraphQL operations map to `EndpointIR` with `method: "post"`, path `/graphql`, request body containing query/mutation as JSON

### Tooling Configuration
- **D-12:** Flat config format — `eslint.config.js`, `prettier.config.js` as ESM modules
- **D-13:** `.editorconfig` for editor-level consistency
- **D-14:** TypeScript 6 strict mode, target ES2022, module NodeNext

### CI Pipeline
- **D-15:** GitHub Actions workflow in Phase 1 — runs lint, test, build on push and PR
- **D-16:** Coverage report included in CI output

### Error Types & Validation
- **D-17:** `ValidationError` type includes source location: `{ file, line?, column?, message, code? }`
- **D-18:** Enables precise CLI error output: `Error at openapi.yaml:42:15 - ...`

### the agent's Discretion
- Exact ESLint rules and plugin selection
- Prettier formatting specifics (print width, semi, etc.)
- GitHub Actions workflow naming and structure
- Exact directory layout within `src/`
- Utility function naming conventions

</decisions>

<specifics>
## Specific Ideas

- "Jest was in the original requirements but Vitest is the better fit for ESM-first Node 24" — requirement doc updated
- Error reporting should feel like a compiler: precise location, clear message, actionable guidance
- IR types should be the single source of truth that parsers produce and generators consume — no parallel type systems
- The `.bru` DSL string builders (recommended over template engines) are defined in later phases, but the IR types they consume must be complete now

</specifics>

<canonical_refs>
## Canonical References

### IR Type System
- `.planning/research/ARCHITECTURE.md` §2.2 — Complete IR type definitions (CollectionIR, EndpointIR, ParameterIR, SchemaIR, SecurityScheme variants, ResponseIR, GraphQL extensions)
- `.planning/research/ARCHITECTURE.md` §2.2 "GraphQL → IR Mapping" — How GraphQL operations map to EndpointIR

### Build & Tooling
- `.planning/research/STACK.md` §5 — TypeScript build dual CJS/ESM configuration with tsup
- `.planning/research/STACK.md` §7 — Vitest configuration and testing strategies
- `.planning/research/STACK.md` §6 — String builders over template engines (design decision)

### Requirements
- `.planning/REQUIREMENTS.md` — QUAL-01 through QUAL-05 (code quality requirements, updated: Jest → Vitest)
- `.planning/ROADMAP.md` — Phase 1 goals and success criteria

### Bruno Format
- `.planning/research/STACK.md` §3 — Bruno .bru file format reference (context for IR design)

</canonical_refs>

<code_context>
## Existing Code Insights

This is a greenfield project — no existing code to analyze. All patterns will be established in this phase.

### Reusable Assets
- None yet — first phase establishes all patterns

### Established Patterns
- None yet — this phase defines them

### Integration Points
- Phase 2 parsers will import IR types from this phase
- Phase 3 generators will import IR types from this phase
- CLI layer (Phase 4) will import from library core

</code_context>

<deferred>
## Deferred Ideas

- Plugin system implementation — Phase 5 (CFG-04, CFG-05, CFG-06)
- Config file system — Phase 5 (CFG-01, CFG-02, CFG-03)
- OpenCollection YAML format support — v2 (ADV-04), Bruno 3.0 just introduced it
- Property-based testing with fast-check — nice to have, not required for Phase 1

</deferred>

---

*Phase: 01-project-scaffold-ir-types*
*Context gathered: 2026-04-06*
