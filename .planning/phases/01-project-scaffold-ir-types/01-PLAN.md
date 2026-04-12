---
phase: 1
phase_name: "Project Scaffold & IR Types"
plans: 4
requirements: [QUAL-01, QUAL-02, QUAL-03, QUAL-04, QUAL-05]
wave_strategy: parallel
---

# Phase 1 Plan: Project Scaffold & IR Types

## Overview

Set up the complete project scaffolding: package.json, TypeScript config, tooling (lint, format, test), build pipeline via tsup, GitHub Actions CI, and the full IR type system. All 4 plans can execute in parallel since they touch disjoint file sets.

## Plans

---

### Plan 01-01: Initialize project — package.json, tsconfig.json, tsup config

**Wave:** 1
**Depends on:** None
**Files modified:** `package.json`, `tsconfig.json`, `tsup.config.ts`, `.gitignore`, `.prettierignore`
**Autonomous:** true

<read_first>
- `/Users/nickgagne/Development/gen-bruno/.planning/phases/01-project-scaffold-ir-types/1-CONTEXT.md` — User decisions (ESM-first, tsup, Vitest, flat config, full IR)
- `/Users/nickgagne/Development/gen-bruno/.planning/phases/01-project-scaffold-ir-types/01-RESEARCH.md` — Technical research with specific versions and configs
- `/Users/nickgagne/Development/gen-bruno/.planning/PROJECT.md` — Project context and constraints
</read_first>

<acceptance_criteria>
- `package.json` exists with `"type": "module"`, `"name": "gen-bruno"`, `"engines": { "node": ">=24" }`
- `package.json` has `exports` field mapping `.` to ESM (`./dist/index.js`) and CJS (`./dist/index.cjs`) with types
- `package.json` has `bin` field pointing to `./dist/cli.js` (ESM)
- `package.json` scripts: `build` (tsup), `test` (vitest run), `test:coverage` (vitest run --coverage), `lint` (eslint src/), `lint:fix` (eslint src/ --fix), `format` (prettier --write src/), `format:check` (prettier --check src/)
- `package.json` devDependencies include: typescript, tsup, vitest, @vitest/coverage-v8, eslint, @eslint/js, typescript-eslint, eslint-config-prettier, prettier, @types/node
- `tsconfig.json` has: `target: "ES2022"`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `rootDir: "./src"`, `strict: true`, `types: ["node"]`, `declaration: true`, `declarationMap: true`, `sourceMap: true`, `skipLibCheck: true`, `forceConsistentCasingInFileNames: true`, `resolveJsonModule: true`
- `tsconfig.json` `include: ["src/**/*.ts"]`, `exclude: ["node_modules", "dist", "**/*.test.ts"]`
- `tsconfig.test.json` extends `./tsconfig.json`, overrides `types: ["node", "vitest/globals"]`, `include: ["src/**/*.ts", "src/**/*.test.ts"]`
- `tsup.config.ts` exports `defineConfig` with: `entry: ["src/index.ts"]`, `format: ["esm", "cjs"]`, `dts: true`, `sourcemap: true`, `clean: true`, `splitting: true`, `target: "es2022"`, `platform: "node"`, `cjsInterop: true`, `bundle: false`
- `npm run build` produces `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`, `dist/index.d.cts` with zero errors
- `.gitignore` includes: `node_modules/`, `dist/`, `coverage/`, `*.tsbuildinfo`
- `.prettierignore` includes: `dist/`, `coverage/`, `node_modules/`
- `src/index.ts` exists as empty library entry point (exports nothing yet, or re-exports IR types once created)
</acceptance_criteria>

<tasks>
<task id="01-01-1">
<name>Initialize package.json and tsconfig files</name>
<description>Create package.json with ESM-first config, dual exports, and all required scripts. Create tsconfig.json with TS 6 strict settings and tsconfig.test.json for vitest.</description>
<files_to_create>
- `package.json` — ESM-first, dual CJS/ESM exports, bin field, all scripts, devDependencies
- `tsconfig.json` — TS 6 strict, NodeNext, rootDir ./src, types ["node"]
- `tsconfig.test.json` — extends tsconfig.json, adds vitest/globals to types
</files_to_create>
<acceptance_criteria>
- `package.json` contains `"type": "module"`
- `package.json` contains `"exports"` with import/require maps
- `package.json` contains `"bin": { "gen-bruno": "./dist/cli.js" }`
- `tsconfig.json` contains `"rootDir": "./src"`
- `tsconfig.json` contains `"types": ["node"]`
- `tsconfig.test.json` contains `"extends": "./tsconfig.json"`
</acceptance_criteria>
</task>

<task id="01-01-2">
<name>Install all dev dependencies</name>
<description>Install all required dev dependencies in the correct order.</description>
<commands>
- `npm install -D typescript tsup @tsconfig/node24`
- `npm install -D vitest @vitest/coverage-v8`
- `npm install -D eslint @eslint/js typescript-eslint eslint-config-prettier prettier`
- `npm install -D @types/node`
</commands>
<acceptance_criteria>
- `node_modules` directory exists
- `package-lock.json` generated
- `npm ls typescript vitest eslint prettier tsup` shows no errors
</acceptance_criteria>
</task>

<task id="01-01-3">
<name>Create tsup config and ignore files</name>
<description>Create tsup.config.ts for dual CJS/ESM build. Create .gitignore and .prettierignore.</description>
<files_to_create>
- `tsup.config.ts` — dual format, dts, sourcemap, clean, splitting, target es2022
- `.gitignore` — node_modules, dist, coverage, *.tsbuildinfo
- `.prettierignore` — dist, coverage, node_modules
</files_to_create>
<acceptance_criteria>
- `tsup.config.ts` exports defineConfig with format ["esm", "cjs"] and dts: true
- `.gitignore` contains `dist/`, `node_modules/`, `coverage/`
- `.prettierignore` contains `dist/`, `coverage/`, `node_modules/`
</acceptance_criteria>
</task>

<task id="01-01-4">
<name>Create library entry point</name>
<description>Create src/index.ts as the library entry point. Initially empty or re-exporting IR types once they exist.</description>
<files_to_create>
- `src/index.ts` — empty export or placeholder
</files_to_create>
<acceptance_criteria>
- `src/index.ts` exists and is valid TypeScript
- `npm run build` completes with zero errors
- `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`, `dist/index.d.cts` all exist after build
</acceptance_criteria>
</task>
</tasks>

<must_haves>
- npm run build succeeds with zero TypeScript errors
- dist/ contains all 4 output files (esm, cjs, d.ts, d.cts)
- package.json exports field correctly maps both formats
</must_haves>

---

### Plan 01-02: Configure tooling — eslint flat config, prettier, .editorconfig, vitest

**Wave:** 1
**Depends on:** None (can run parallel with 01-01)
**Files modified:** `eslint.config.js`, `prettier.config.js`, `.editorconfig`, `vitest.config.ts`
**Autonomous:** true

<read_first>
- `/Users/nickgagne/Development/gen-bruno/.planning/phases/01-project-scaffold-ir-types/1-CONTEXT.md` — User decisions (flat config, Vitest)
- `/Users/nickgagne/Development/gen-bruno/.planning/phases/01-project-scaffold-ir-types/01-RESEARCH.md` §3, §4, §5 — Vitest, ESLint, Prettier configs
- `/Users/nickgagne/Development/gen-bruno/.planning/PROJECT.md` — Code quality constraints
</read_first>

<acceptance_criteria>
- `eslint.config.js` exists as ESM module using flat config with typescript-eslint recommended + strict + stylistic configs, eslint-config-prettier at end
- `eslint.config.js` ignores `dist/**`, `coverage/**`, `node_modules/**`
- `prettier.config.js` exists with: semi true, trailingComma "all", printWidth 100, tabWidth 2, endOfLine "lf"
- `.editorconfig` exists with root=true, 2-space indent, lf line endings, final newline, trailing whitespace trim
- `vitest.config.ts` exports defineConfig with globals true, coverage provider v8, thresholds 80% for lines/branches/functions/statements
- `npm run lint` passes with zero errors (on empty src/)
- `npm run format:check` passes (on empty src/)
- `npm test` runs vitest successfully (even with zero tests, or with a placeholder test)
</acceptance_criteria>

<tasks>
<task id="01-02-1">
<name>Create ESLint flat config</name>
<description>Create eslint.config.js using ESM imports with typescript-eslint meta-package, recommended+strict+stylistic configs, and eslint-config-prettier.</description>
<files_to_create>
- `eslint.config.js` — flat config with tseslint.config(), ignores dist/coverage/node_modules, recommended+strict+stylistic+prettier
</files_to_create>
<acceptance_criteria>
- `eslint.config.js` uses `import` syntax (ESM)
- `eslint.config.js` includes `tseslint.configs.recommended`, `tseslint.configs.strict`, `tseslint.configs.stylistic`
- `eslint.config.js` includes `eslint-config-prettier` as last config
- `npm run lint` passes on src/
</acceptance_criteria>
</task>

<task id="01-02-2">
<name>Create Prettier config and .editorconfig</name>
<description>Create prettier.config.js with recommended settings and .editorconfig for editor consistency.</description>
<files_to_create>
- `prettier.config.js` — semi true, trailingComma all, printWidth 100, tabWidth 2, lf
- `.editorconfig` — root=true, 2-space indent, lf, final newline, trim trailing whitespace
</files_to_create>
<acceptance_criteria>
- `prettier.config.js` exports config object with printWidth 100
- `.editorconfig` contains `indent_size = 2` and `end_of_line = lf`
- `npm run format:check` passes
</acceptance_criteria>
</task>

<task id="01-02-3">
<name>Create Vitest config</name>
<description>Create vitest.config.ts with v8 coverage at 80% thresholds.</description>
<files_to_create>
- `vitest.config.ts` — globals true, v8 coverage, 80% thresholds all metrics
</files_to_create>
<acceptance_criteria>
- `vitest.config.ts` includes `coverage: { provider: "v8", thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 } }`
- `npm test` runs without error
</acceptance_criteria>
</task>
</tasks>

<must_haves>
- All 4 tooling commands work: npm run lint, npm run lint:fix, npm run format, npm run format:check, npm test, npm run test:coverage
- ESLint uses flat config (no .eslintrc)
- Coverage thresholds enforced at 80%
</must_haves>

---

### Plan 01-03: Define IR type system — all TypeScript interfaces

**Wave:** 1
**Depends on:** None (can run parallel with 01-01, 01-02)
**Files modified:** `src/ir/*.ts`, `src/index.ts`
**Autonomous:** true

<read_first>
- `/Users/nickgagne/Development/gen-bruno/.planning/phases/01-project-scaffold-ir-types/1-CONTEXT.md` — User decisions (full IR upfront, version-agnostic, ValidationError with locations)
- `/Users/nickgagne/Development/gen-bruno/.planning/phases/01-project-scaffold-ir-types/01-RESEARCH.md` §7, §9 — Directory structure, ValidationError type
- `/Users/nickgagne/Development/gen-bruno/.planning/research/ARCHITECTURE.md` §2.2 — Complete IR type definitions
</read_first>

<acceptance_criteria>
- `src/ir/` directory exists with type definitions split by domain
- `src/ir/collection.ts` — CollectionIR, CollectionInfo, Server, ServerVariable, Tag
- `src/ir/endpoint.ts` — EndpointIR, HttpMethod (get|post|put|patch|delete|head|options|trace)
- `src/ir/parameter.ts` — ParameterIR with in: "path"|"query"|"header"|"cookie"
- `src/ir/schema.ts` — SchemaIR with all fields (type, format, constraints, composition: allOf/oneOf/anyOf, discriminator, nullable)
- `src/ir/response.ts` — ResponseIR, MediaTypeIR, HeaderIR, ExampleObject, LinkObject, EncodingObject
- `src/ir/security.ts` — SecurityScheme union (HttpSecurityScheme, ApiKeySecurityScheme, OAuth2SecurityScheme, OpenIdConnectSecurityScheme), OAuth2Flows, OAuth2Flow, SecurityRequirement
- `src/ir/request-body.ts` — RequestBodyIR, MediaTypeIR
- `src/ir/graphql.ts` — GraphQLEndpointExtension (operationType: query|mutation|subscription), GraphQlArgumentIR
- `src/ir/validation.ts` — ValidationError { file, line?, column?, message, code? }, ValidationResult, Warning
- `src/ir/index.ts` re-exports all IR types from sub-modules
- `src/index.ts` re-exports all IR types from `./ir/index.js` (note: .js extension required by NodeNext)
- All types compile with zero errors under `npm run build`
- Types are version-agnostic — no `openapi3Field` or `swagger2Field` in any interface
</acceptance_criteria>

<tasks>
<task id="01-03-1">
<name>Create core IR types: collection, endpoint, parameter</name>
<description>Implement CollectionIR, EndpointIR, ParameterIR and supporting types.</description>
<files_to_create>
- `src/ir/collection.ts` — CollectionIR, CollectionInfo, Server, ServerVariable, Tag
- `src/ir/endpoint.ts` — EndpointIR, HttpMethod type
- `src/ir/parameter.ts` — ParameterIR
</files_to_create>
<acceptance_criteria>
- CollectionIR has: info, servers, securitySchemes, defaultSecurity, tags, endpoints, components, extensions
- EndpointIR has: id, method, path, summary, description, tags, deprecated, parameters, requestBody, security, responses, producesContentType, consumesContentTypes
- ParameterIR has: name, in, required, description, deprecated, schema, example, examples
- All files compile under strict TypeScript
</acceptance_criteria>
</task>

<task id="01-03-2">
<name>Create schema and response IR types</name>
<description>Implement SchemaIR with all constraint fields, ResponseIR and supporting types.</description>
<files_to_create>
- `src/ir/schema.ts` — SchemaIR, SchemaType, DiscriminatorObject
- `src/ir/response.ts` — ResponseIR, MediaTypeIR, HeaderIR, ExampleObject, LinkObject, EncodingObject
</files_to_create>
<acceptance_criteria>
- SchemaIR includes all fields from ARCHITECTURE.md: type, format, constraints (min/max, pattern, enum, default, example), composition (allOf/oneOf/anyOf), nullable, readOnly, writeOnly, discriminator, $ref, resolvedName
- ResponseIR has: statusCode, description, headers, content, links
- MediaTypeIR has: schema, example, examples, encoding
- All files compile under strict TypeScript
</acceptance_criteria>
</task>

<task id="01-03-3">
<name>Create security scheme IR types</name>
<description>Implement all 4 SecurityScheme variants and OAuth2 flow types.</description>
<files_to_create>
- `src/ir/security.ts` — SecurityScheme (union), HttpSecurityScheme, ApiKeySecurityScheme, OAuth2SecurityScheme, OpenIdConnectSecurityScheme, OAuth2Flows, OAuth2Flow, SecurityRequirement
</files_to_create>
<acceptance_criteria>
- SecurityScheme is a discriminated union of 4 variants
- HttpSecurityScheme has: type "http", scheme "basic"|"bearer"|"digest", bearerFormat?, description?
- ApiKeySecurityScheme has: type "apiKey", name, in "header"|"query"|"cookie", description?
- OAuth2SecurityScheme has: type "oauth2", flows: OAuth2Flows, description?
- OAuth2Flows has: authorizationCode?, implicit?, password?, clientCredentials?
- All files compile under strict TypeScript
</acceptance_criteria>
</task>

<task id="01-03-4">
<name>Create request body, GraphQL, and validation IR types</name>
<description>Implement RequestBodyIR, GraphQL extension types, and ValidationError types.</description>
<files_to_create>
- `src/ir/request-body.ts` — RequestBodyIR
- `src/ir/graphql.ts` — GraphQLEndpointExtension, GraphQlArgumentIR
- `src/ir/validation.ts` — ValidationError, ValidationResult, Warning
</files_to_create>
<acceptance_criteria>
- RequestBodyIR has: description?, required, content: Record<string, MediaTypeIR>
- GraphQLEndpointExtension has: operationType "query"|"mutation"|"subscription", operationName, arguments, returnType, description?, directives
- GraphQlArgumentIR has: name, type, defaultValue?, description?, directives
- ValidationError has: file, line?, column?, message, code?
- ValidationResult has: valid, errors: ValidationError[], warnings: Warning[]
- Warning has: message, severity "info"|"warn"|"error", file?, line?, column?
- All files compile under strict TypeScript
</acceptance_criteria>
</task>

<task id="01-03-5">
<name>Create IR barrel re-exports and wire into library entry</name>
<description>Create src/ir/index.ts barrel export and update src/index.ts to re-export IR types.</description>
<files_to_modify>
- `src/ir/index.ts` — new file, re-exports all IR types
- `src/index.ts` — update to re-export from ./ir/index.js
</files_to_modify>
<acceptance_criteria>
- `src/ir/index.ts` exports CollectionIR, EndpointIR, ParameterIR, SchemaIR, ResponseIR, RequestBodyIR, all SecurityScheme variants, GraphQLEndpointExtension, GraphQlArgumentIR, ValidationError, ValidationResult, Warning, and all supporting types
- `src/index.ts` has `export { ... } from "./ir/index.js"` (note .js extension for NodeNext)
- `npm run build` completes with all types present in dist/
</acceptance_criteria>
</task>
</tasks>

<must_haves>
- All IR types from ARCHITECTURE.md §2.2 are present and compile
- Types are version-agnostic (no OpenAPI 3.x or Swagger 2.0 specific fields)
- ValidationError includes source location fields (file, line, column)
- npm run build produces clean output
- src/index.ts re-exports all IR types
</must_haves>

---

### Plan 01-04: Set up CI pipeline — GitHub Actions workflow

**Wave:** 1
**Depends on:** None (can run parallel with 01-01, 01-02, 01-03)
**Files modified:** `.github/workflows/ci.yml`
**Autonomous:** true

<read_first>
- `/Users/nickgagne/Development/gen-bruno/.planning/phases/01-project-scaffold-ir-types/01-RESEARCH.md` §8 — GitHub Actions CI config
- `/Users/nickgagne/Development/gen-bruno/.planning/ROADMAP.md` — Phase 1 success criteria
</read_first>

<acceptance_criteria>
- `.github/workflows/ci.yml` exists
- Workflow triggers on push to main and PR to main
- Three parallel jobs: lint (runs npm run lint + npm run format:check), test (runs npm run test:coverage), build (runs npm run build)
- All jobs use actions/checkout@v5 and actions/setup-node@v5 with node-version "24"
- All jobs use `npm ci` for dependency installation
- Workflow file is valid YAML (no syntax errors)
</acceptance_criteria>

<tasks>
<task id="01-04-1">
<name>Create GitHub Actions CI workflow</name>
<description>Create .github/workflows/ci.yml with three parallel jobs: lint, test, build.</description>
<files_to_create>
- `.github/workflows/ci.yml` — CI workflow with lint, test, build jobs
</files_to_create>
<acceptance_criteria>
- File is valid YAML
- Triggers on push to main and PR to main
- lint job runs eslint and prettier check
- test job runs vitest with coverage
- build job runs tsup build
- All jobs use node 24, checkout v5, setup-node v5, npm ci
</acceptance_criteria>
</task>
</tasks>

<must_haves>
- CI workflow file is valid YAML and syntactically correct
- Three parallel jobs cover lint, test, build
- Node 24 used in all jobs
</must_haves>
