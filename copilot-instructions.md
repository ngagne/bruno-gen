# copilot-instructions.md

## Project Context

This is the **Bruno Collection Generator** — a Node.js 24 CLI tool and importable npm library (CommonJS + ESM) that converts OpenAPI 3.x, Swagger 2.0, and GraphQL schemas into Bruno API collections.

**Core value:** Turn any OpenAPI or GraphQL spec into a working Bruno collection in one command — preserving spec semantics including auth, examples, and structure.

**Tech stack:** TypeScript 6, Commander.js, @apidevtools/swagger-parser, graphql (16.x), tsup (dual CJS/ESM), Jest (80% coverage), eslint, prettier.

**Architecture:** 5-layer — CLI → Library API → Config → Parser (IR) → Generator → Output

## 808 Workflow

This project uses the 808 planning and execution workflow.

**CRITICAL RULES:**
1. **ALWAYS read the current phase's PLAN.md** before writing any code for that phase
2. **ALWAYS read ROADMAP.md** to understand the broader context before implementing
3. **NEVER skip ahead** to future phases — implement only the active phase's plans
4. **ALWAYS run tests and linting** after making changes (`npm test && npm run lint`)
5. **NEVER modify .planning/ files** unless explicitly asked (they are managed by 808 workflows)
6. **ALWAYS check STATE.md** for current progress before starting work

**Phase lifecycle:**
1. `/808-discuss-phase N` — Discuss approach and clarify context
2. `/808-plan-phase N` — Create detailed PLAN.md with tasks
3. `/808-execute-phase N` — Execute all plans with verification
4. `/808-verify-work N` — Validate the built feature meets requirements
5. `/808-transition` — Move to next phase, update STATE.md and REQUIREMENTS.md

**File conventions:**
- Source code in `src/`
- Tests in `tests/` alongside source or in `tests/` directory
- Build output in `dist/`
- Planning artifacts in `.planning/`

## Code Standards

- TypeScript strict mode, Node.js 24 target
- eslint + prettier enforced — always run before committing
- Jest tests with 80% coverage minimum
- Dual CJS/ESM exports — test both import paths
- Meaningful variable/function names; avoid abbreviations
- Comments only for non-obvious decisions; code should be self-documenting

---
*Generated: 2026-04-06 after project initialization*
