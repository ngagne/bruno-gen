# Phase 2: Parser Layer - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Three parsers (OpenAPI 3.x, Swagger 2.0, GraphQL SDL) that each produce the unified IR established in Phase 1. This phase adds the parser layer under `src/parsers/` with golden file tests against real-world specs. No Bruno generation yet — that's Phase 3. The output of this phase is: given a spec file, return a complete `CollectionIR` object.

Phase 2 depends on Phase 1 IR types being stable and complete (they are). Phase 3 will depend on Phase 2 producing correct IR.

</domain>

<decisions>
## Implementation Decisions

### Parser Library Selection
- **D-01:** Use `@apidevtools/swagger-parser` v12.x for both OpenAPI 3.x and Swagger 2.0 parsing — single library handles both spec versions
- **D-02:** Use `graphql` v16.x (reference implementation) for GraphQL SDL parsing — `parse()`, `buildSchema()`, AST traversal
- **D-03:** Use `js-yaml` v4.x for YAML spec loading — safe loading, preserves line/column info for error reporting
- **D-04:** Use `openapi-types` v12.x for TypeScript typing of raw parsed output (not IR types)

### Parser Architecture
- **D-05:** Unified `SpecParser` interface with `canParse()`, `parse()`, and `validate()` methods — all parsers implement this
- **D-06:** Auto-detection logic: file extension → content inspection (`openapi` field vs `swagger` field vs GraphQL SDL syntax) → parser selection
- **D-07:** Swagger 2.0 normalization layer: convert 2.0 concepts to OpenAPI 3.x equivalents BEFORE IR construction (basePath+schemes → servers, definitions → components)
- **D-08:** $ref resolution delegated to swagger-parser's `dereference()` method — proven, handles circular references
- **D-09:** GraphQL operations map to `EndpointIR` with `method: "post"`, path `/graphql`, request body containing query/mutation

### Error Handling Strategy
- **D-10:** Validation errors include source location: `{ file, line?, column?, message, code? }` (from Phase 1 D-17)
- **D-11:** Unparseable sections produce warnings, not hard failures — continue generation with partial IR
- **D-12:** Circular $ref detection uses swagger-parser's built-in handling — no custom depth limiting needed
- **D-13:** GraphQL schema errors from `graphql` library are caught and re-wrapped with file context

### Testing Strategy
- **D-14:** Golden file tests using Vitest `toMatchFileSnapshot()` — compare parsed IR JSON against fixture snapshots
- **D-15:** Real-world spec fixtures: OpenAPI Petstore (minimal), Stripe API (complex), Swagger 2.0 Petstore (legacy), GraphQL SDL schema (custom test fixture)
- **D-16:** Unit tests for each parser in isolation; integration tests for full pipeline: spec file → IR object

### Module Organization
- **D-17:** `src/parsers/` directory with subdirectories: `openapi/`, `swagger/`, `graphql/`
- **D-18:** Shared utilities in `src/parsers/utils/`: spec loader (YAML/JSON detection), auto-detector, validation helpers
- **D-19:** Parser interface exported from `src/parsers/index.ts` for library consumers

### GraphQL-Specific Decisions
- **D-20:** Single `.graphql` file and directory of `.graphql` files both supported — directory mode concatenates files before parsing
- **D-21:** GraphQL queries/mutations become separate `EndpointIR` entries, each with unique `id` from operation name
- **D-22:** GraphQL arguments mapped to `requestBody.content['application/json'].schema` — not to `parameters` (GraphQL args are body-only)
- **D-23:** GraphQL custom scalars represented as `SchemaIR` with `type: "string"`, `format: "custom-scalar-<name>"`
- **D-24:** GraphQL directives stored in `GraphQLEndpointExtension.directives` array for potential plugin use

### Swagger 2.0 → OpenAPI 3.x Normalization
- **D-25:** `basePath` + `schemes` + `host` → `servers` array with URL construction
- **D-26:** `definitions` → `components.schemas` namespace remapping
- **D-27:** `parameters`/`responses` at root level → `components.parameters`/`components.responses`
- **D-28:** `securityDefinitions` → `components.securitySchemes` with format normalization
- **D-29:** Response `produces`/`consumes` → endpoint-level `producesContentType`/`consumesContentTypes`

### the agent's Discretion
- Exact function naming within parser modules
- Internal helper function organization
- Specific test fixture file names and locations
- Logging verbosity levels during parsing
- Progress reporting details (spinner messages, etc.)

</decisions>

<specifics>
## Specific Ideas

- Golden file tests should use MINIMAL spec fixtures first (prove correctness), then COMPLEX fixtures (prove completeness)
- Swagger 2.0 normalization should produce IR IDENTICAL to equivalent OpenAPI 3.x spec — test this invariant
- GraphQL directory parser should merge operations from multiple files into single CollectionIR — test deduplication
- $ref resolution test should include circular reference case (User → Post → User) — swagger-parser handles this
- Error reporting should feel like a compiler: `Error at stripe-openapi.yaml:142:7 - Unknown security scheme 'oauth2'`
- Auto-detector should be unit-tested separately from parsers — pure function, easy to test
- Parser interface should be exported so plugin authors can implement custom parsers in the future

</specifics>

<canonical_refs>
## Canonical References

### IR Types (from Phase 1)
- `src/ir/` — All IR type definitions (CollectionIR, EndpointIR, ParameterIR, SchemaIR, SecurityScheme variants, ResponseIR, GraphQL extensions)
- `.planning/phases/01-project-scaffold-ir-types/1-CONTEXT.md` — Phase 1 decisions including IR type scope (D-08 through D-11)

### Architecture
- `.planning/research/ARCHITECTURE.md` §2.1 — Parser Layer design, SpecParser interface, auto-detection
- `.planning/research/ARCHITECTURE.md` §2.2 — Complete IR type definitions (what parsers must produce)
- `.planning/research/ARCHITECTURE.md` §2.2 "GraphQL → IR Mapping" — How GraphQL maps to EndpointIR
- `.planning/research/ARCHITECTURE.md` §3 — Data flow from spec file through parser to IR

### Stack Research
- `.planning/research/STACK.md` §1 — OpenAPI/Swagger parsing libraries (@apidevtools/swagger-parser recommended)
- `.planning/research/STACK.md` §2 — GraphQL parsing (graphql v16.x recommended)
- `.planning/research/STACK.md` §1.4 — js-yaml for YAML loading
- `.planning/research/STACK.md` §1.5 — openapi-types for TypeScript types

### Requirements
- `.planning/REQUIREMENTS.md` — PARSE-01 through PARSE-10 (parser requirements)
- `.planning/ROADMAP.md` — Phase 2 goals and success criteria

### Bruno Format (context for what IR will eventually generate)
- `.planning/research/STACK.md` §3 — Bruno .bru DSL format reference

</canonical_refs>

<code_context>
## Existing Code Insights

### IR Types (Phase 1 output — already implemented)
- `src/ir/collection.ts` — CollectionIR root type with servers, securitySchemes, components
- `src/ir/endpoint.ts` — EndpointIR with method, path, parameters, requestBody, responses
- `src/ir/parameter.ts` — ParameterIR with location (path/query/header/cookie)
- `src/ir/schema.ts` — SchemaIR with all JSON Schema fields (type, format, constraints, composition)
- `src/ir/security.ts` — All 4 SecurityScheme variants (HTTP, apiKey, OAuth2, OpenID Connect)
- `src/ir/response.ts` — ResponseIR with statusCode, content, headers, links
- `src/ir/request-body.ts` — RequestBodyIR with content media types
- `src/ir/graphql.ts` — GraphQLEndpointExtension, GraphQlArgumentIR
- `src/ir/validation.ts` — ValidationError, ValidationResult, Warning types
- `src/ir/index.ts` — Barrel export of all IR types
- `src/index.ts` — Public re-exports for library consumers

### Testing Infrastructure (Phase 1 output)
- `vitest.config.ts` — Vitest configured with v8 coverage provider
- IR types already have `ir-types.test.ts` with basic compilation checks

### Build Pipeline (Phase 1 output)
- `tsup.config.ts` — Dual CJS/ESM build configured
- `npm run build` produces dist/ with ESM and CJS output

### Reusable Assets
- IR type system is complete and version-agnostic — parsers import these types directly
- Vitest test infrastructure ready — add parser tests alongside existing IR tests
- Build pipeline working — parsers will be included in dual output automatically

### Integration Points
- Phase 3 generators will import CollectionIR from this phase's output
- CLI (Phase 4) will call parser layer through library API
- Config system (Phase 5) may add parser options via config overrides

</code_context>

<deferred>
## Deferred Ideas

- OpenAPI 3.1 JSON Schema 2020-12 dialect features (prefixItems, unevaluatedProperties) — handle if encountered but don't require full support yet
- Remote $ref resolution (HTTP URLs) — defer to v2; only resolve local file refs for v1
- Introspection from live GraphQL endpoints — file-based SDL only for v1
- Incremental parsing / caching — full regenerate each time
- Property-based testing with fast-check — nice to have, not required for Phase 2
- OpenCollection YAML format output — Phase 3+ feature, Bruno 3.0 just introduced it

</deferred>

---

*Phase: 02-parser-layer*
*Context gathered: 2026-04-06*
