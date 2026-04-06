# Phase 3: Bruno Generator Layer - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Convert the unified CollectionIR (produced by Phase 2 parsers) into Bruno `.bru` files — collection structure, requests, folders, environment variables, and authentication. This is the core output layer: given a CollectionIR object, produce a directory of `.bru` files that open correctly in Bruno. Covers 19 requirements: REQ-01 through REQ-10, AUTH-01 through AUTH-05, ENV-01 through ENV-04.

No CLI integration yet (Phase 4). No plugin/config hooks (Phase 5). This phase delivers: given `CollectionIR + GeneratorOptions`, write `.bru` files to disk.

</domain>

<decisions>
## Implementation Decisions

### Output Structure & Grouping
- **D-01:** Default grouping is **tag-based** — OpenAPI tags → folder names, matches REQ-09
- **D-02:** When endpoint has no tags, fall back to **first path segment** as folder name (e.g., `/users/{id}` → "Users" folder)
- **D-03:** Folder display names use **tag.description** as `folder.bru` name when available, otherwise capitalized tag name
- **D-04:** GraphQL operations split into separate folders — **Queries/** and **Mutations/** — not a single mixed folder
- **D-05:** Bruno folder structure follows ARCHITECTURE.md §2.3 layout: tag folders with `folder.bru`, individual `.bru` request files

### Request Body & Example Generation
- **D-06:** Example values generated from schemas when spec has no examples — **schema-driven defaults**: `string` → `"string"`, `integer` → `0`, `boolean` → `false`, `enum` → first value, `format: "email"` → `"user@example.com"`
- **D-07:** Complex nested objects/arrays generated **one level deep** — `{"address": {"street": "string", "city": "string"}}`, arrays get one item: `{"items": [{"id": 0}]}`
- **D-08:** Enum fields use **first enum value** as default
- **D-09:** Required fields with complex nested schemas **recurse fully** — ensures structurally valid request bodies per schema
- **D-10:** When spec provides examples, use those directly (REQ-07) — don't synthesize

### Auth Handler Implementation
- **D-11:** apiKey auth honors spec placement — `in: header`, `in: query`, or `in: cookie`. For `cookie`, generate pre-request script stub (Bruno doesn't handle cookies natively)
- **D-12:** OAuth2/OIDC generates **pre-request script stubs** with OAuth2 flow skeleton (client credentials, authorization code, etc.) — TODO comments for user to fill in client_id, client_secret, token URL
- **D-13:** HTTP auth (bearer/basic) uses Bruno's native **`auth:` blocks** in `.bru` files — `auth: bearer { ... }` / `auth: basic { ... }`
- **D-14:** Multiple auth schemes in a spec → **all auth blocks in each `.bru` file** — user fills in whichever they need (Bruno supports multiple auth blocks)
- **D-15:** Auth env vars generated with naming: `{{bearerToken}}`, `{{apiKey}}`, `{{basicUser}}`, `{{basicPass}}`

### Environment & Collection Variables
- **D-16:** `{{baseUrl}}` and auth variables go in **collection.bru vars** (not environment files) — promotes variable reuse, no environment switching needed when opening collection
- **D-17:** Environment files can still be generated for **user-created per-deployment overrides** — collection vars as defaults, env files as optional overrides
- **D-18:** `{{baseUrl}}` derived from first OpenAPI server URL; other servers noted as alternatives in collection vars
- **D-19:** Environment files placed in `environments/` directory within generated output (ENV-03)

### Builder Pattern
- **D-20:** Pure TypeScript string builder functions for each `.bru` block type — zero template engine dependency, full type safety (ARCHITECTURE.md §2.3, STACK.md §6)
- **D-21:** Module organization follows ARCHITECTURE.md §2.3 structure: `src/generators/` with `blocks/` subdirectory for individual block builders

### the agent's Discretion
- Exact block builder function naming and organization within `blocks/` subdirectory
- Internal helper utilities for .bru string escaping and path sanitization
- Specific `.bru` formatting details (indentation, blank lines between blocks) within Bruno DSL
- Logging verbosity during generation
- Progress reporting details (spinner messages, etc.)

</decisions>

<canonical_refs>
## Canonical References

### Architecture
- `.planning/research/ARCHITECTURE.md` §2.3 — Generator Layer design, Generator interface, file structure output, builder pattern
- `.planning/research/ARCHITECTURE.md` §2.4 — Output Layer design (filesystem ops, atomic writes, dry-run)

### IR Types (what generators consume)
- `src/ir/collection.ts` — CollectionIR root type (endpoints, servers, securitySchemes, components)
- `src/ir/endpoint.ts` — EndpointIR (method, path, parameters, requestBody, responses, tags)
- `src/ir/security.ts` — All 4 SecurityScheme variants (HTTP, apiKey, OAuth2, OpenID Connect)
- `src/ir/parameter.ts` — ParameterIR (path, query, header, cookie locations)
- `src/ir/request-body.ts` — RequestBodyIR with content media types
- `src/ir/response.ts` — ResponseIR with statusCode, content, headers
- `src/ir/schema.ts` — SchemaIR for example value generation

### Stack Research
- `.planning/research/STACK.md` §3 — Bruno .bru DSL format reference (block syntax, auth format, vars format)
- `.planning/research/STACK.md` §6 — String builders over template engines (design justification)
- `.planning/research/STACK.md` §4 — Output layer and filesystem best practices

### Requirements
- `.planning/REQUIREMENTS.md` — REQ-01 through REQ-10 (request generation)
- `.planning/REQUIREMENTS.md` — AUTH-01 through AUTH-05 (authentication)
- `.planning/REQUIREMENTS.md` — ENV-01 through ENV-04 (environment & variables)
- `.planning/ROADMAP.md` — Phase 3 goals and success criteria

### Prior Decisions
- `.planning/phases/01-project-scaffold-ir-types/1-CONTEXT.md` — D-08 (full IR type scope), D-10 (version-agnostic IR)
- `.planning/phases/02-parser-layer/2-CONTEXT.md` — D-09 (GraphQL → EndpointIR mapping)

</canonical_refs>

<code_context>
## Existing Code Insights

### IR Types (Phase 1 output — generators consume these)
- `src/ir/collection.ts` — CollectionIR: endpoints array, servers, securitySchemes, components
- `src/ir/endpoint.ts` — EndpointIR: method, path, tags, parameters, requestBody, responses, security
- `src/ir/parameter.ts` — ParameterIR: name, location (path/query/header/cookie), schema
- `src/ir/schema.ts` — SchemaIR: type, format, enum, properties, items, required — used for example synthesis
- `src/ir/security.ts` — All SecurityScheme variants: HttpSecurityScheme, ApiKeySecurityScheme, OAuth2SecurityScheme, OpenIdConnectSecurityScheme
- `src/ir/request-body.ts` — RequestBodyIR: content media types with schema
- `src/ir/response.ts` — ResponseIR: statusCode, content, headers, links
- `src/ir/index.ts` — Barrel export for library consumers

### Parsers (Phase 2 output — generators receive their output)
- `src/parsers/index.ts` — Parser interface, parse/validate/detectFormat/loadSpec exports
- `src/parsers/openapi/OpenApiParser.ts` — Produces CollectionIR from OpenAPI 3.x
- `src/parsers/swagger/SwaggerParser.ts` — Produces CollectionIR from Swagger 2.0 (normalized)
- `src/parsers/graphql/GraphQLParser.ts` — Produces CollectionIR from GraphQL SDL
- `src/parsers/utils/ref-utils.ts` — $ref resolution utilities (used by parsers, not generators)
- `src/parsers/utils/spec-validator.ts` — Spec validation with error context

### Reusable Assets
- IR type system — generators import these types directly, no additional type definitions needed
- Vitest test infrastructure — add generator tests alongside existing parser tests
- Build pipeline — generators included in dual CJS/ESM output automatically

### Integration Points
- Phase 3 generators receive CollectionIR from Phase 2 parsers
- CLI (Phase 4) will call `generate(ir, options)` to produce output
- Config system (Phase 5) may add generator option overrides (grouping strategy, test generation level)
- Plugin hooks (Phase 5) will use `transformIR` (before generation) and `preOutput` (after generation)

</code_context>

<specifics>
## Specific Ideas

- Collection variables preferred over environment variables — `collection.bru` vars are available immediately when collection opens, no environment switching needed
- Auth blocks use Bruno's native `auth:` block syntax, not manual headers
- Example generation is deterministic (schema-driven) — same spec always produces same examples
- "One level deep" for nested objects balances usefulness with readability
- OAuth2 pre-request scripts are stubs with TODO comments — users fill in their own credentials
- GraphQL queries/mutations get separate folders to match read vs write operation mental model

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-bruno-generator-layer*
*Context gathered: 2026-04-06*
