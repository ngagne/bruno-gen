# Bruno Collection Generator

## What This Is

A CLI tool and importable npm library that converts API specifications (OpenAPI 3.x, Swagger 2.0, GraphQL schemas) into Bruno API collections. Users point it at a spec file or directory and get a ready-to-use Bruno collection with requests, environment variables, example request bodies, example responses, and optional test assertions — no manual translation needed.

## Core Value

Turn any OpenAPI or GraphQL spec into a working Bruno collection in one command — preserving spec semantics including auth, examples, and structure.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] CLI that accepts OpenAPI (3.x, 2.0) specs in YAML or JSON and generates a Bruno collection
- [ ] CLI that accepts GraphQL schema files (`.graphql`) or directories and generates a Bruno collection
- [ ] Generated collection includes all endpoints as requests in a single collection with folder grouping
- [ ] Auth schemes from specs are extracted into Bruno environment variables
- [ ] Example request bodies from specs are included in generated requests
- [ ] Example responses from specs are included as Bruno response examples
- [ ] Bruno environment file generated with `{{baseUrl}}` and auth variables
- [ ] Optional test assertion scripts (pre/post request) via CLI flag
- [ ] GraphQL queries and mutations generated as separate Bruno requests
- [ ] Programmatic module API importable as both CommonJS and ESM
- [ ] Simple function API (`generate(spec, outputDir, options)`) and fluent builder API
- [ ] CI-friendly: clean output, non-interactive, proper exit codes, dry-run mode
- [ ] Full regeneration mode (always regenerate entire collection from scratch)
- [ ] Warnings for unsupported features or spec issues, continues generation (exit 0)
- [ ] Published as a public npm package
- [ ] Config file support for overriding defaults (naming, grouping, etc.)
- [ ] Plugin/hook system for custom output transformations
- [ ] Spec docs only — no generated documentation beyond what's in the source spec
- [ ] TypeScript 6, Node.js 24, Commander.js, eslint, prettier, .editorconfig, Jest with 80% coverage

### Out of Scope

- [GraphQL subscriptions] — Bruno doesn't support WebSocket subscriptions well; queries and mutations only
- [Incremental generation] — Full regenerate each time keeps the tool simple and predictable
- [OAuth token exchange scripts] — Auth is handled via environment variables; users configure flows manually
- [Mobile app or GUI] — CLI and library only
- [Swagger/OpenAPI 1.x support] — Too legacy, not worth the maintenance burden
- [Auto-generated documentation beyond spec] — Only use descriptions already present in the source spec
- [Mobile app] — CLI and library only

## Context

- **Bruno**: An open-source API client and alternative to Postman/Insomnia that uses plain text files (`.bru`) stored in your repository
- **Bruno collections**: Directory-based structure with `.bru` files for requests, `collection.bru` for collection metadata, and `env` directories for environment variables
- The Bruno `.bru` format is a markdown-like DSL for defining HTTP requests with scripting support
- OpenAPI 3.x and Swagger 2.0 together cover the vast majority of existing API specs in the wild
- Target users include both API developers (testing their own APIs) and API consumers (working with third-party APIs)

## Constraints

- **Runtime**: Node.js 24 — modern JS features available, no legacy compatibility needed
- **Language**: TypeScript 6 — full type safety for both CLI and library surface
- **Distribution**: Must support both CommonJS and ESM imports for the library API
- **Quality**: Jest with 80% code coverage threshold enforced in CI
- **Code quality**: eslint + prettier + .editorconfig for consistent formatting

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single collection per spec (not split by tag) | Simpler output, matches how most teams use Bruno | ✓ Good — matches user workflow |
| Auth via environment variables | Bruno's native pattern; lets users fill in secrets securely | ✓ Good — follows Bruno conventions |
| Include example responses from spec | Makes collections immediately useful for exploration | — Pending |
| Warn and continue on spec issues | Better to produce partial output than fail entirely | — Pending |
| Full regeneration only | Incremental adds complexity; specs should be the source of truth | — Pending |
| Both simple function + builder API | Simple covers 80% of cases; builder for advanced composition | — Pending |
| CI-friendly with dry-run mode | Enables CI/CD pipeline integration for automated testing | — Pending |
| Plugin system + config file | Config for simple overrides, plugins for custom transformations | — Pending |
| Public npm package | Tool has broad appeal beyond internal use | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/808-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/808-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-06 after initialization*
