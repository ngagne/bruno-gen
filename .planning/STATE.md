# STATE.md

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-06 after v1.0 milestone completion)

**Core value:** Turn any OpenAPI or GraphQL spec into a working Bruno collection in one command — preserving spec semantics including auth, examples, and structure.
**Current focus:** v1.0 shipped — ready for v1.1 planning

## Current State

**Milestone:** v1.0 ✓ SHIPPED
**Next milestone:** TBD (use `/808-new-milestone` to start)
**Tests:** 195 passing across 24 test files
**Coverage:** 80%+ enforced (lines, branches, functions, statements)
**Build:** tsup dual CJS/ESM + DTS, bundle: true
**Lint:** eslint + prettier — clean
**Publish ready:** npm pack verified, tarball contains dist/, README.md, package.json only

### Accomplished (v1.0)

- 6 phases complete, all 76 requirements satisfied
- 3 real-world test fixtures (stripe-like, github-like, petstore)
- README.md: 329 lines of production documentation
- Dual CJS/ESM exports verified
- CLI with 7 flags, proper exit codes, TTY-aware output
- Plugin system with transformIR + preOutput hooks
- Config file auto-discovery with 3-layer merge
- 195 tests, 80%+ coverage enforced

### Bug Fixes Applied

1. **folder-generator.ts** — Empty `ir.tags` array no longer prevents folder creation (falls back to discovered endpoint tags)
2. **tsup.config.ts** — `bundle: false` → `bundle: true` for proper ESM dist output

### Archives

- Roadmap: `.planning/milestones/v1.0-ROADMAP.md`
- Requirements: `.planning/milestones/v1.0-REQUIREMENTS.md`
- Full project history: `.planning/PROJECT.md`

---
*Last updated: 2026-04-06 after v1.0 milestone completion*
