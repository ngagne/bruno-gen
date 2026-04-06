# Plan: Phase 2 — Parser Layer

**Phase:** 02-parser-layer
**Started:** 2026-04-06
**Depends on:** Phase 1 (Project Scaffold & IR Types) — COMPLETE
**Feeds into:** Phase 3 (Bruno Generator Layer)

---

## 1. Phase Objective

Build three parsers (OpenAPI 3.x, Swagger 2.0, GraphQL SDL) that each accept their respective input formats and produce a fully-resolved, version-agnostic `CollectionIR` object. This phase adds the parser layer under `src/parsers/` with golden file tests against real-world specs.

**Output of this phase:** Given a spec file path, return a complete `CollectionIR` object. No Bruno generation yet — that's Phase 3.

**Scope boundary:**
- In scope: Parsing, `$ref` resolution, spec validation, Swagger 2.0 normalization, GraphQL SDL extraction, circular reference handling
- Out of scope: Bruno `.bru` file generation (Phase 3), CLI interface (Phase 4), remote `$ref` resolution over HTTP (deferred to v2)

---

## 2. Requirements Coverage

| Requirement | Description | Covered by Plan |
|-------------|-------------|-----------------|
| PARSE-01 | Accept OpenAPI 3.0/3.1 YAML | 02-01 |
| PARSE-02 | Accept OpenAPI 3.0/3.1 JSON | 02-01 |
| PARSE-03 | Accept Swagger 2.0 YAML | 02-02 |
| PARSE-04 | Accept Swagger 2.0 JSON | 02-02 |
| PARSE-05 | Accept single GraphQL `.graphql` file | 02-03 |
| PARSE-06 | Accept directory of GraphQL `.graphql` files | 02-04 |
| PARSE-07 | Resolve `$ref` references | 02-05 |
| PARSE-08 | Handle circular references | 02-05 |
| PARSE-09 | Validate specs, report errors with context | 02-06 |
| PARSE-10 | Normalize Swagger 2.0 to OpenAPI 3.x equivalent | 02-02 |

---

## 3. Dependencies Between Sub-Plans

```
02-05 ($ref utils) ──► 02-01 (OpenAPI parser) ──┐
02-06 (validation) ──► 02-01 (OpenAPI parser)    │
                      02-02 (Swagger parser) ─────┼──► 02-00 (auto-detector + facade)
                      02-06 (validation) ──► 02-02 (Swagger parser)
                      02-05 ($ref utils) ──► 02-02 (Swagger parser)
                                                 │
                      02-03 (GraphQL SDL parser)─┤
                      02-04 (GraphQL dir parser)─┘
```

**Execution order** (serial within each group, parallel across independent groups):

1. **Foundation first**: 02-05, 02-06 (shared utilities used by all parsers)
2. **Core parsers**: 02-01, 02-02 (can be done in parallel after foundation), then 02-03
3. **GraphQL directory**: 02-04 (depends on 02-03)
4. **Integration facade**: Auto-detector + unified entry point (wired last)

---

## 4. Sub-Plans

### 02-01: OpenAPI 3.x Parser

**Requirements:** PARSE-01, PARSE-02, PARSE-07, PARSE-08

**Files to create:**

| File | Purpose |
|------|---------|
| `src/parsers/openapi/OpenApiParser.ts` | Main parser class implementing `SpecParser` interface |
| `src/parsers/openapi/schema-mapper.ts` | Map raw OpenAPI schema objects to `SchemaIR` |
| `src/parsers/openapi/endpoint-mapper.ts` | Map paths/operations to `EndpointIR[]` |
| `src/parsers/openapi/security-mapper.ts` | Map `components.securitySchemes` to `SecurityScheme` variants |
| `src/parsers/openapi/parameter-mapper.ts` | Map OpenAPI parameters to `ParameterIR[]` |
| `src/parsers/openapi/response-mapper.ts` | Map OpenAPI responses to `ResponseIR[]` |
| `src/parsers/openapi/request-body-mapper.ts` | Map `requestBody` to `RequestBodyIR` |
| `src/parsers/openapi/OpenApiParser.test.ts` | Unit + golden file tests |

**Key implementation steps:**

1. Create `OpenApiParser` class implementing `SpecParser` interface:
   - `canParse()`: check for `openapi` field in parsed JSON/YAML, version must match `^3\.[01]\.`
   - `parse()`: call `SwaggerParser.dereference()` to get fully-resolved spec, then map to `CollectionIR`
   - `validate()`: call `SwaggerParser.validate()`, catch errors and wrap with source location
2. Implement `schema-mapper.ts` — recursive function that maps OpenAPI Schema Object to `SchemaIR`:
   - Map all JSON Schema fields (`type`, `format`, `enum`, `default`, `properties`, `items`, etc.)
   - Handle `allOf`, `oneOf`, `anyOf` composition — store as-is in `SchemaIR` fields
   - Track `$ref` origin and `resolvedName` from dereferenced pointers
   - Handle OpenAPI 3.1 `type` as array (e.g., `["string", "null"]`) — set `nullable: true` and use first type
3. Implement `endpoint-mapper.ts`:
   - Iterate `paths` object, for each path iterate HTTP methods (get, post, put, patch, delete, head, options, trace)
   - Generate `id` from `operationId` if present, otherwise `"method-path"` (e.g., `"get-users"`)
   - Merge operation-level parameters with path-level parameters (operation wins on conflict)
   - Inherit `produces`/`consumes` from root-level if not overridden at operation level
4. Implement `security-mapper.ts`:
   - Map `components.securitySchemes` — each variant (http, apiKey, oauth2, openIdConnect) to corresponding IR type
   - Map root-level `security` array to `CollectionIR.defaultSecurity`
   - Map endpoint-level `security` overrides
5. Implement `parameter-mapper.ts`:
   - Map `in: "path" | "query" | "header" | "cookie"` parameters to `ParameterIR`
   - Map parameter schema via `schema-mapper`
   - Preserve `required`, `deprecated`, `description`, `example`
6. Implement `response-mapper.ts`:
   - Map each response code (including wildcards like `"4XX"`, `"default"`) to `ResponseIR`
   - Map `content` media types via `request-body-mapper`
   - Map headers, links
7. Implement `request-body-mapper.ts`:
   - Map `requestBody.content` media types to `RequestBodyIR`
   - Map schemas via `schema-mapper`, preserve examples

**Test approach:**
- Unit tests for each mapper function with minimal inline OpenAPI objects
- Golden file test: parse `test/fixtures/openapi/petstore-openapi3.yaml` and snapshot IR JSON
- Golden file test: parse `test/fixtures/openapi/stripe-subset.json` (complex nested schemas) and snapshot
- Test `$ref` resolution with inline spec containing internal and file references
- Test circular reference handling with self-referencing schema (e.g., `Category` with `parent: Category`)

**Acceptance criteria:**
- Parses valid OpenAPI 3.0 and 3.1 specs (YAML and JSON) without errors
- Produces `CollectionIR` with all endpoints, parameters, request bodies, responses, and security schemes
- `$ref` references resolved correctly (internal `#/components/schemas/X` and relative file refs)
- Circular references handled without stack overflow
- Golden file snapshots match for Petstore and Stripe subset fixtures

---

### 02-02: Swagger 2.0 Parser

**Requirements:** PARSE-03, PARSE-04, PARSE-10

**Files to create:**

| File | Purpose |
|------|---------|
| `src/parsers/swagger/SwaggerParser.ts` | Main parser class implementing `SpecParser` interface |
| `src/parsers/swagger/normalizer.ts` | Normalize Swagger 2.0 structure to OpenAPI 3.x equivalent |
| `src/parsers/swagger/SwaggerParser.test.ts` | Unit + golden file tests |

**Key implementation steps:**

1. Create `SwaggerParser` class implementing `SpecParser` interface:
   - `canParse()`: check for `swagger` field with value `"2.0"`
   - `parse()`: call `SwaggerParser.dereference()`, then `normalizer.ts`, then map to `CollectionIR` (reuse OpenAPI mappers)
   - `validate()`: call `SwaggerParser.validate()`
2. Implement `normalizer.ts` — transform Swagger 2.0 to OpenAPI 3.x structure BEFORE IR construction:
   - **Servers**: `host` + `basePath` + `schemes` → `servers` array
     - For each scheme in `schemes` (default `["https"]` if absent): `${scheme}://${host}${basePath || ""}`
     - Default `basePath` to `""` if absent
   - **Schemas**: `definitions` → `components.schemas`, rewrite all `$ref` paths from `#/definitions/X` to `#/components/schemas/X`
   - **Parameters**: root-level `parameters` → `components.parameters`
   - **Responses**: root-level `responses` → `components.responses`
   - **Security**: `securityDefinitions` → `components.securitySchemes` with format normalization:
     - `type: "basic"` → `{ type: "http", scheme: "basic" }`
     - `type: "apiKey"` → unchanged (same structure)
     - `type: "oauth2"` → map to `oauth2` with `flows` structure
   - **Content types**: root-level `produces`/`consumes` → apply as defaults to all operations; operation-level `produces`/`consumes` override
     - Map `consumes` to `requestBody.content` keys (e.g., `"application/json"`)
     - Map `produces` to `responses.<code>.content` keys
   - **FormData params**: `in: formData` parameters → group into `requestBody.content` with appropriate media type
     - If any param has `type: file` → use `multipart/form-data`
     - Otherwise → use `application/x-www-form-urlencoded`
   - **Path params**: `in: path` with `type: "file"` — should not exist in Swagger 2.0, but if encountered, emit warning
3. After normalization, reuse OpenAPI mappers (`endpoint-mapper.ts`, `schema-mapper.ts`, etc.) — this ensures the IR is identical whether the input was Swagger 2.0 or equivalent OpenAPI 3.x

**Test approach:**
- Unit tests for `normalizer.ts` with minimal Swagger 2.0 objects, verify normalized structure
- Golden file test: parse `test/fixtures/swagger/petstore-swagger2.yaml` and snapshot IR JSON
- **Invariant test**: parse equivalent OpenAPI 3.x spec and Swagger 2.0 spec, assert IR output is identical
- Test `basePath`/`host`/`schemes` → `servers` conversion explicitly
- Test `formData` → request body conversion

**Acceptance criteria:**
- Parses valid Swagger 2.0 specs (YAML and JSON) without errors
- Normalized structure produces IR identical to equivalent OpenAPI 3.x spec
- `basePath` + `host` + `schemes` correctly converted to `servers` array
- `definitions` correctly remapped to `components.schemas`
- `securityDefinitions` correctly converted to `components.securitySchemes`
- `produces`/`consumes` mapped to content-type fields
- Golden file snapshot matches for Petstore Swagger 2.0 fixture

---

### 02-03: GraphQL SDL Parser

**Requirements:** PARSE-05

**Files to create:**

| File | Purpose |
|------|---------|
| `src/parsers/graphql/GraphQLParser.ts` | Main parser class implementing `SpecParser` interface |
| `src/parsers/graphql/schema-mapper.ts` | Map GraphQL types to `SchemaIR` |
| `src/parsers/graphql/endpoint-mapper.ts` | Map queries/mutations to `EndpointIR[]` with POST `/graphql` |
| `src/parsers/graphql/GraphQLParser.test.ts` | Unit + golden file tests |

**Key implementation steps:**

1. Create `GraphQLParser` class implementing `SpecParser` interface:
   - `canParse()`: check file extension (`.graphql`, `.gql`) OR inspect content for GraphQL SDL syntax (presence of `type Query`, `type Mutation`, or `{` after type definitions)
   - `parse(input)`: call `graphql`'s `parse()` to get AST, then `buildSchema()` to get `GraphQLSchema` object, then map to `CollectionIR`
   - `validate()`: call `graphql`'s `validateSchema()`, re-wrap errors with file context
2. Implement `endpoint-mapper.ts` — extract operations from GraphQL schema:
   - Use `schema.getQueryType()` to get Query type fields
   - Use `schema.getMutationType()` to get Mutation type fields
   - Each Query field → `EndpointIR` with `method: "post"`, `path: "/graphql"`, `id` from field name
   - Each Mutation field → same structure, tagged as `"mutation"`
   - Map GraphQL arguments to `requestBody.content['application/json'].schema` — NOT to `parameters` (GraphQL args are body-only, per D-22)
   - Map GraphQL return types to `ResponseIR` with status `"200"`
   - Tags: `"query"` for queries, `"mutation"` for mutations
   - Summary/description from GraphQL field descriptions
   - Store `GraphQLEndpointExtension` in `EndpointIR.extensions` with operation type, name, arguments, return type, directives
3. Implement `schema-mapper.ts` — map GraphQL types to `SchemaIR`:
   - Scalar types: `String` → `{ type: "string" }`, `Int` → `{ type: "integer" }`, `Float` → `{ type: "number" }`, `Boolean` → `{ type: "boolean" }`, `ID` → `{ type: "string", format: "id" }`
   - Custom scalars: `{ type: "string", format: "custom-scalar-<name>" }` (per D-23)
   - Object types: `{ type: "object", properties: { ... }, required: [non-nullable fields] }`
   - List types: `{ type: "array", items: <inner type> }`
   - Non-null: mark as `required` on parent object, not on the schema itself
   - Union types: `{ oneOf: [<concrete types>] }`
   - Interface types: treat as object type with shared fields; implementing types inherit
   - Enum types: `{ type: "string", enum: [values] }`
   - Input types: same as object types (used for argument schemas)
   - Directives: store in extension field (per D-24)
4. Build `CollectionIR` root:
   - `info.title`: derived from schema definition or default `"GraphQL API"`
   - `info.version`: `"1.0.0"` (GraphQL SDL has no version)
   - `servers`: `[{ url: "/graphql" }]`
   - `securitySchemes`: empty (GraphQL auth is typically header-based, handled at generation time)
   - `components.schemas`: all named GraphQL types mapped to `SchemaIR`

**Test approach:**
- Unit tests for `schema-mapper.ts` with individual GraphQL type definitions
- Unit tests for `endpoint-mapper.ts` with small Query/Mutation schemas
- Golden file test: parse `test/fixtures/graphql/schema.graphql` and snapshot IR JSON
- Test custom scalar handling (`DateTime`, `Upload`, unknown custom scalar)
- Test union type → `oneOf` mapping
- Test `@deprecated` directive detection and storage

**Acceptance criteria:**
- Parses valid GraphQL SDL files without errors
- All Query and Mutation fields mapped to `EndpointIR` with `method: "post"`, `path: "/graphql"`
- GraphQL arguments mapped to `requestBody.content` (not `parameters`)
- GraphQL types mapped to `SchemaIR` in `components.schemas`
- Custom scalars represented with `format: "custom-scalar-<name>"`
- Directives stored in extension fields
- Golden file snapshot matches for test GraphQL fixture

---

### 02-04: GraphQL Directory Parser

**Requirements:** PARSE-06

**Files to create:**

| File | Purpose |
|------|---------|
| `src/parsers/graphql/DirectoryParser.ts` | Discover and merge multiple `.graphql` files |
| `src/parsers/graphql/DirectoryParser.test.ts` | Unit + golden file tests |

**Key implementation steps:**

1. Create `DirectoryParser` class:
   - `canParse()`: check if input is a directory path containing at least one `.graphql` or `.gql` file
   - `parse(input)`: discover all `.graphql` files recursively, concatenate contents (sorted by path for determinism), delegate to `GraphQLParser.parse()`
   - `validate(input)`: validate each file individually, aggregate errors with file-specific context
2. File discovery:
   - Use `fs.readdirSync()` with recursive option or `fast-glob` pattern `**/*.graphql`
   - Sort files by path for deterministic merge order
   - Skip files in `node_modules/`, `__tests__/`, `test/`, `tests/` directories
3. Content merging:
   - Read each file, concatenate with newline separator
   - Pass merged SDL string to `GraphQLParser.parse()` — no custom merge logic needed since `graphql`'s parser handles multi-document SDL
4. Deduplication:
   - GraphQL's `buildSchema()` will error on duplicate type definitions — this is correct behavior (fail fast)
   - Catch the error and report which type is duplicated and in which files

**Test approach:**
- Unit test: file discovery with mock directory structure
- Integration test: parse `test/fixtures/graphql/multi/` directory with 3 files (types, queries, mutations in separate files) and snapshot IR
- Test deduplication: directory with duplicate type definition, assert clear error message with file names
- Test empty directory: no `.graphql` files found, assert clear error

**Acceptance criteria:**
- Discovers all `.graphql` files recursively in given directory
- Merges files in deterministic order (sorted by path)
- Produces identical `CollectionIR` as equivalent single-file input
- Reports clear errors for duplicate type definitions with file names
- Skips common test directories (`node_modules`, `__tests__`, etc.)
- Golden file snapshot matches for multi-file GraphQL fixture

---

### 02-05: $ref Resolution and Circular Reference Handling

**Requirements:** PARSE-07, PARSE-08

**Files to create:**

| File | Purpose |
|------|---------|
| `src/parsers/utils/ref-utils.ts` | $ref resolution utilities (path resolution, depth tracking) |
| `src/parsers/utils/ref-utils.test.ts` | Unit tests for $ref utilities |

**Key implementation steps:**

1. Implement `ref-utils.ts`:
   - `resolveRefPath(ref: string, specFilePath: string)`: resolve relative file references relative to spec file's directory
     - Handle `./models/User.yaml` → absolute path
     - Handle `../common/Error.yaml` → absolute path
     - Return `null` for internal refs (`#/...`) and remote refs (`https://...`)
   - `isInternalRef(ref: string)`: check if ref starts with `#/`
   - `isFileRef(ref: string)`: check if ref is a relative or absolute file path
   - `isRemoteRef(ref: string)`: check if ref is a URL (starts with `http://` or `https://`)
2. Delegate primary `$ref` resolution to `@apidevtools/swagger-parser`'s `dereference()` method (per D-08):
   - This handles internal refs (`#/components/schemas/User`), relative file refs, and circular references
   - Circular references are preserved as special marker objects rather than infinite expansion
   - No custom depth limiting needed (per D-12) — swagger-parser handles this
3. Add safety valve for edge cases:
   - Wrap `dereference()` in try/catch with specific error messages
   - If dereference fails with "Maximum call stack size exceeded" (shouldn't happen with swagger-parser, but defensive), catch and emit error
   - Remote refs (`https://...`) — for v1, emit a warning and skip resolution (per deferred items). Log: `Remote $ref not resolved: https://example.com/schemas/User.yaml — remote refs not supported in v1`
4. Track `$ref` origin in `SchemaIR`:
   - After dereferencing, set `schema.$ref` to original reference path
   - Set `schema.resolvedName` to the schema name extracted from the ref (e.g., `"User"` from `#/components/schemas/User`)

**Test approach:**
- Unit tests for `resolveRefPath` with various relative path scenarios
- Integration test: parse spec with internal `$ref` references, verify they are resolved
- Integration test: parse spec with relative file `$ref` references, verify they are resolved
- Integration test: parse spec with circular references (e.g., `User → Post → User`), verify no stack overflow and IR is produced
- Integration test: parse spec with remote `$ref`, verify warning is emitted (not error)

**Acceptance criteria:**
- Internal `$ref` references resolved correctly by swagger-parser
- Relative file `$ref` references resolved relative to spec file directory
- Circular references handled without stack overflow or infinite recursion
- Remote `$ref` references produce a warning (not a hard error) and parsing continues
- `$ref` origin and `resolvedName` tracked on `SchemaIR` nodes
- All tests pass including circular reference fixture

---

### 02-06: Spec Validation Layer

**Requirements:** PARSE-09

**Files to create:**

| File | Purpose |
|------|---------|
| `src/parsers/utils/spec-validator.ts` | Shared validation utilities |
| `src/parsers/utils/spec-loader.ts` | YAML/JSON detection and loading |
| `src/parsers/utils/auto-detector.ts` | Format auto-detection logic |
| `src/parsers/utils/spec-validator.test.ts` | Unit tests for validation |
| `src/parsers/utils/spec-loader.test.ts` | Unit tests for loader |
| `src/parsers/utils/auto-detector.test.ts` | Unit tests for auto-detection |

**Key implementation steps:**

1. Implement `spec-loader.ts`:
   - `loadSpec(filePath: string)`: read file, detect JSON vs YAML by extension, parse accordingly
     - `.json` → `JSON.parse()`
     - `.yaml`, `.yml` → `js-yaml`'s `load()` with `{ schema: jsYaml.CORE_SCHEMA }` for safety
   - Return `{ data: object, source: string }` where source is the file path
   - On parse error, throw with file path and line/column info from js-yaml or JSON.parse
2. Implement `auto-detector.ts`:
   - `detectFormat(data: object, filePath?: string): "openapi" | "swagger" | "graphql" | "unknown"`
   - Step 1: Check file extension — `.graphql`, `.gql` → `"graphql"`
   - Step 2: Check content fields — `data.openapi` → `"openapi"`, `data.swagger` → `"swagger"`
   - Step 3: For unknown extensions, attempt JSON parse; if fails, attempt YAML parse; then check fields
   - Step 4: If no recognized fields, inspect content for GraphQL SDL syntax (regex for `type Query`, `type Mutation`, or `{` after type definitions)
   - Return `"unknown"` if none match
3. Implement `spec-validator.ts`:
   - `validateOpenAPI(data: object, source: string)`: delegate to `SwaggerParser.validate()`, catch errors, map to `ValidationError[]` with source location
   - `validateSwagger(data: object, source: string)`: same as above (swagger-parser validates both)
   - `validateGraphQL(sdl: string, source: string)`: use `graphql`'s `validateSchema(buildSchema(sdl))`, re-wrap errors with file context
   - All validation functions return `ValidationResult` with `valid`, `errors`, `warnings`
4. Error reporting format (per D-10, D-11):
   - Errors: `{ file, line?, column?, message, code? }`
   - Warnings: `{ message, severity: "info" | "warn" | "error", file?, line?, column? }`
   - Unparseable sections produce warnings, not hard failures — continue with partial IR
   - Format errors like a compiler: `Error at stripe-openapi.yaml:142:7 - Unknown security scheme 'oauth2'`

**Test approach:**
- Unit tests for `spec-loader.ts` with YAML and JSON fixtures
- Unit tests for `auto-detector.ts` with various file extensions and content patterns
- Unit tests for `spec-validator.ts` with valid and invalid specs for each format
- Test invalid OpenAPI spec: assert error with line/column info
- Test invalid GraphQL SDL: assert error with schema validation message
- Test auto-detection priority: extension → content inspection → fallback

**Acceptance criteria:**
- YAML and JSON specs loaded and parsed correctly with format detection
- Auto-detector correctly identifies OpenAPI, Swagger, and GraphQL formats
- Validation errors include source file, line, and column when available
- Invalid specs produce clear error messages (compiler-style)
- Warnings emitted for unparseable sections without halting parsing
- All validation tests pass for all three formats

---

## 5. Shared Module Structure

```
src/parsers/
├── index.ts                    # Barrel export: SpecParser interface, auto-detect, parse function
├── types.ts                    # SpecParser interface, ParseOptions, SpecInput types
├── openapi/
│   ├── OpenApiParser.ts        # OpenAPI 3.x parser (02-01)
│   ├── schema-mapper.ts
│   ├── endpoint-mapper.ts
│   ├── security-mapper.ts
│   ├── parameter-mapper.ts
│   ├── response-mapper.ts
│   ├── request-body-mapper.ts
│   └── OpenApiParser.test.ts
├── swagger/
│   ├── SwaggerParser.ts        # Swagger 2.0 parser (02-02)
│   ├── normalizer.ts           # Swagger → OpenAPI 3.x normalization
│   └── SwaggerParser.test.ts
├── graphql/
│   ├── GraphQLParser.ts        # Single file GraphQL SDL parser (02-03)
│   ├── DirectoryParser.ts      # Multi-file GraphQL parser (02-04)
│   ├── schema-mapper.ts
│   ├── endpoint-mapper.ts
│   └── GraphQLParser.test.ts
│   └── DirectoryParser.test.ts
└── utils/
    ├── ref-utils.ts            # $ref resolution utilities (02-05)
    ├── spec-validator.ts       # Validation utilities (02-06)
    ├── spec-loader.ts          # YAML/JSON loading (02-06)
    ├── auto-detector.ts        # Format auto-detection (02-06)
    ├── ref-utils.test.ts
    ├── spec-validator.test.ts
    ├── spec-loader.test.ts
    └── auto-detector.test.ts
```

**`src/parsers/index.ts` exports:**
```ts
// SpecParser interface
export type { SpecParser, ParseOptions, SpecInput } from "./types.js";

// Unified parse function (auto-detects format, loads, validates, parses)
export { parse } from "./parse.js";

// Individual parsers (for direct use)
export { OpenApiParser } from "./openapi/OpenApiParser.js";
export { SwaggerParser } from "./swagger/SwaggerParser.js";
export { GraphQLParser } from "./graphql/GraphQLParser.js";
export { DirectoryParser } from "./graphql/DirectoryParser.js";

// Utilities
export { detectFormat } from "./utils/auto-detector.js";
export { loadSpec } from "./utils/spec-loader.js";
export { validateSpec } from "./utils/spec-validator.js";
```

---

## 6. Test Fixtures

Create minimal test fixtures in `test/fixtures/`:

| Fixture | Format | Purpose |
|---------|--------|---------|
| `test/fixtures/openapi/petstore-openapi3.yaml` | OpenAPI 3.0 YAML | Minimal Petstore spec — prove correctness |
| `test/fixtures/openapi/stripe-subset.json` | OpenAPI 3.0 JSON | Complex nested schemas — prove completeness |
| `test/fixtures/openapi/circular-refs.yaml` | OpenAPI 3.0 YAML | Self-referencing schemas — prove circular handling |
| `test/fixtures/openapi/file-refs.yaml` + `test/fixtures/openapi/models/` | OpenAPI 3.0 with file refs | Relative file references — prove file resolution |
| `test/fixtures/swagger/petstore-swagger2.yaml` | Swagger 2.0 YAML | Legacy Petstore — prove Swagger parsing |
| `test/fixtures/swagger/petstore-swagger2.json` | Swagger 2.0 JSON | Same spec in JSON — prove JSON handling |
| `test/fixtures/swagger/equivalent-openapi3.yaml` | OpenAPI 3.0 YAML | OpenAPI equivalent of Swagger Petstore — prove normalization invariant |
| `test/fixtures/graphql/schema.graphql` | GraphQL SDL | Custom test schema with Query, Mutation, custom scalars, unions |
| `test/fixtures/graphql/multi/types.graphql` | GraphQL SDL | Type definitions in separate file |
| `test/fixtures/graphql/multi/queries.graphql` | GraphQL SDL | Query definitions in separate file |
| `test/fixtures/graphql/multi/mutations.graphql` | GraphQL SDL | Mutation definitions in separate file |

---

## 7. Dependencies to Install

```bash
npm install @apidevtools/swagger-parser@^12 graphql@^16 js-yaml@^4
npm install -D openapi-types@^12
```

---

## 8. Verification Criteria (Mapped to ROADMAP.md Success Criteria)

| Success Criterion | Verification Method |
|-------------------|-------------------|
| **1.** Tool parses a valid OpenAPI 3.1 YAML spec and produces correct IR with all endpoints, params, bodies, and auth schemes | Golden file test with Petstore 3.1 YAML fixture; assert `CollectionIR.endpoints.length > 0`, all have `parameters`, `requestBody`, `responses`, `securitySchemes` populated |
| **2.** Tool parses a Swagger 2.0 JSON spec and produces equivalent IR (normalized to OpenAPI 3.x structure) | Golden file test with Swagger 2.0 Petstore JSON; invariant test against equivalent OpenAPI 3.1 YAML — `expect(ir1).toEqual(ir2)` |
| **3.** Tool parses a single `.graphql` SDL file and produces IR with queries and mutations as POST endpoints | Golden file test with `schema.graphql`; assert all endpoints have `method: "post"`, `path: "/graphql"`, endpoints tagged `"query"` and `"mutation"` |
| **4.** Tool parses a directory of `.graphql` files and merges them into a single IR | Integration test with `test/fixtures/graphql/multi/`; assert IR matches equivalent single-file parse |
| **5.** Tool resolves `$ref` references including circular references without stack overflow | Test with `circular-refs.yaml` fixture; assert parsing completes, IR contains dereferenced schemas with `resolvedName` tracking |
| **6.** Tool reports validation errors with file/line context for invalid specs | Test with deliberately broken spec files; assert `ValidationResult.errors` contains entries with `file`, `line`, `message` |
| **7.** All 10 parser requirements pass with golden file tests against known specs (Petstore, Stripe subset) | Run full test suite; all golden file snapshots match; coverage threshold met |

---

## 9. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| swagger-parser slow on large specs (Stripe) | Benchmark early; if >5s, consider `SwaggerParser.parse()` instead of `dereference()` and handle refs manually |
| OpenAPI 3.1 JSON Schema 2020-12 dialect incompatibility | Handle gracefully with warnings for `prefixItems`, `unevaluatedProperties` — do not block on full support (per deferred items) |
| GraphQL SDL parsing fails on complex schemas with directives | Use `buildSchema()` with `assumeValid: true` option to skip strict validation; store directives in extensions |
| Circular references cause infinite loops in schema mapper | swagger-parser's `dereference()` handles this; add depth-limit safety valve as defensive measure |
| Test fixture availability | Start with minimal hand-crafted fixtures; download real-world specs (Petstore, Stripe subset) after initial parser works |

---

## 10. Phase Completion Checklist

- [ ] All 6 sub-plans executed and tests passing
- [ ] `npm test` passes with 80%+ coverage on `src/parsers/`
- [ ] `npm run build` succeeds with all new source files included
- [ ] `npm run lint` passes with no errors
- [ ] All 10 PARSE requirements satisfied
- [ ] 7 success criteria from ROADMAP.md verified
- [ ] Golden file snapshots reviewed and committed
- [ ] Test fixtures committed to `test/fixtures/`
- [ ] `src/parsers/index.ts` exports clean public API
