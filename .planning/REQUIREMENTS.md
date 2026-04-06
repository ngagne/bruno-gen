# Requirements: Bruno Collection Generator

**Defined:** 2026-04-06
**Core Value:** Turn any OpenAPI or GraphQL spec into a working Bruno collection in one command — preserving spec semantics including auth, examples, and structure.

## v1 Requirements

### Parser

- [ ] **PARSE-01**: Tool accepts OpenAPI 3.0 and 3.1 specs in YAML format
- [ ] **PARSE-02**: Tool accepts OpenAPI 3.0 and 3.1 specs in JSON format
- [ ] **PARSE-03**: Tool accepts Swagger 2.0 specs in YAML format
- [ ] **PARSE-04**: Tool accepts Swagger 2.0 specs in JSON format
- [ ] **PARSE-05**: Tool accepts a single GraphQL schema file (`.graphql`)
- [ ] **PARSE-06**: Tool accepts a directory of GraphQL schema files (`/**/*.graphql`)
- [ ] **PARSE-07**: Tool resolves `$ref` references (internal, relative file, remote)
- [ ] **PARSE-08**: Tool handles circular references without infinite recursion
- [ ] **PARSE-09**: Tool validates specs and reports validation errors with file/line context
- [ ] **PARSE-10**: Tool normalizes Swagger 2.0 to internal OpenAPI 3.x equivalent

### Request Generation

- [ ] **REQ-01**: Each OpenAPI path+operation becomes a Bruno request with correct HTTP method
- [ ] **REQ-02**: GraphQL queries generated as POST requests with `query` body
- [ ] **REQ-03**: GraphQL mutations generated as POST requests with `mutation` body
- [ ] **REQ-04**: Path parameters included in request URLs as Bruno variables
- [ ] **REQ-05**: Query parameters from spec included in requests
- [ ] **REQ-06**: Headers defined in spec (Content-Type, Accept, custom) included in requests
- [ ] **REQ-07**: Example request bodies from spec schemas included in requests with realistic values
- [ ] **REQ-08**: Example responses from spec included as Bruno response examples
- [ ] **REQ-09**: Requests grouped by tag (OpenAPI) or type (GraphQL query vs mutation) in folder structure
- [ ] **REQ-10**: OperationIds sanitized to valid filenames (special characters, spaces, reserved words handled)

### Authentication

- [ ] **AUTH-01**: apiKey auth scheme generates environment variable and applies to request headers/query
- [ ] **AUTH-02**: HTTP bearer auth scheme generates `{{bearerToken}}` environment variable
- [ ] **AUTH-03**: HTTP basic auth scheme generates `{{basicUser}}` and `{{basicPass}}` environment variables
- [ ] **AUTH-04**: OAuth2 and OpenID Connect schemes generate appropriate env variables and pre-request script stubs
- [ ] **AUTH-05**: Auth schemes from spec applied at correct scope (global, path, operation level)

### Environment & Variables

- [ ] **ENV-01**: `{{baseUrl}}` variable generated from OpenAPI server URLs (first server used, others as alternatives in env file)
- [ ] **ENV-02**: Bruno environment file created with all generated variables
- [ ] **ENV-03**: Environment file placed in `environments/` directory within generated output
- [ ] **ENV-04**: Environment file follows Bruno's `.bru` environment format

### Test Assertions (via --tests flag)

- [ ] **TEST-01**: Post-response script asserts response status code matches spec's declared response codes
- [ ] **TEST-02**: Post-response script asserts response body matches declared response schema (required fields present, correct types)
- [ ] **TEST-03**: Example-based assertions included when spec provides response examples
- [ ] **TEST-04**: Test scripts only generated when `--tests` flag is provided

### CLI

- [ ] **CLI-01**: Command accepts spec file path or directory as input argument
- [ ] **CLI-02**: Command accepts output directory as argument
- [ ] **CLI-03**: `--format` flag controls folder grouping: `tag` (default), `path`, `flat`
- [ ] **CLI-04**: `--tests` flag enables test assertion generation
- [ ] **CLI-05**: `--dry-run` flag prints generated output to stdout without writing files
- [ ] **CLI-06**: `--config` flag specifies custom config file path
- [ ] **CLI-07**: Exit code 0 on success (including warnings)
- [ ] **CLI-08**: Exit code 1 on unrecoverable error (invalid spec, missing output dir)
- [ ] **CLI-09**: Warnings logged for unsupported features or spec issues without halting generation
- [ ] **CLI-10**: Non-interactive output suitable for CI/CD pipelines (no prompts, progress spinners disabled in non-TTY)

### Library API

- [ ] **LIB-01**: `generate(spec, outputDir, options)` function exported as default entry point
- [ ] **LIB-02**: CollectionBuilder fluent class: `CollectionBuilder.fromSpec(spec).withOptions(opts).generate(dir)`
- [ ] **LIB-03**: Module importable via CommonJS (`require()`)
- [ ] **LIB-04**: Module importable via ESM (`import`)
- [ ] **LIB-05**: TypeScript type definitions (`.d.ts`) included in published package
- [ ] **LIB-06**: Options object supports all CLI flags programmatically

### Config & Plugins

- [ ] **CFG-01**: Config file (`brunogen.config.yml` or `.json`) discovered from CWD
- [ ] **CFG-02**: Config values merged: defaults < config file < CLI flags (CLI wins)
- [ ] **CFG-03**: Config supports: format, tests enabled, auth overrides, custom headers
- [ ] **CFG-04**: Plugin system supports `transformIR` hook to modify intermediate representation
- [ ] **CFG-05**: Plugin system supports `preOutput` hook to modify generated .bru content before writing
- [ ] **CFG-06**: Plugins configured via config file or programmatic API

### Code Quality

- [x] **QUAL-01**: eslint configured and enforced on all source files
- [x] **QUAL-02**: Prettier configured with .prettierrc and .editorconfig
- [x] **QUAL-03**: Vitest test suite with 80% code coverage threshold enforced
- [x] **QUAL-04**: TypeScript 6 strict mode
- [x] **QUAL-05**: Target runtime Node.js 24

### Publishing

- [ ] **PUB-01**: Package published to npm registry as public package
- [ ] **PUB-02**: package.json has correct `bin` field for CLI
- [ ] **PUB-03**: package.json has correct `main`, `module`, `types`, `exports` for dual CJS/ESM library
- [ ] **PUB-04**: README.md with installation, usage, examples, and API documentation

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Features

- **ADV-01**: Incremental generation — only update changed requests, preserve manual edits
- **ADV-02**: Multi-spec merging — combine multiple OpenAPI/GraphQL specs into one collection
- **ADV-03**: Watch mode — regenerate collection when spec files change
- **ADV-04**: Bruno 3.0 OpenCollection YAML format support
- **ADV-05**: OAuth2 token exchange pre-request script generation (full flow, not just stubs)

### Reverse Engineering

- **REV-01**: Generate OpenAPI spec from existing Bruno collection (reverse direction)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| GUI wrapper | CLI + library only; GUI is Bruno's domain |
| Live sync/watch mode (v1) | Bruno has OpenAPI Sync; defer to v2 |
| API mocking server | Out of scope; other tools handle this |
| Collection versioning | Git handles versioning of generated files |
| GraphQL subscriptions | Bruno doesn't support WebSocket subscriptions |
| Swagger/OpenAPI 1.x | Too legacy, not worth maintenance burden |
| Auto-generated docs beyond spec | Only use descriptions from source spec |
| Mobile app | CLI and library only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PARSE-01 | Phase 1 | Pending |
| PARSE-02 | Phase 1 | Pending |
| PARSE-03 | Phase 1 | Pending |
| PARSE-04 | Phase 1 | Pending |
| PARSE-05 | Phase 1 | Pending |
| PARSE-06 | Phase 1 | Pending |
| PARSE-07 | Phase 1 | Pending |
| PARSE-08 | Phase 1 | Pending |
| PARSE-09 | Phase 1 | Pending |
| PARSE-10 | Phase 1 | Pending |
| REQ-01 | Phase 2 | Pending |
| REQ-02 | Phase 2 | Pending |
| REQ-03 | Phase 2 | Pending |
| REQ-04 | Phase 2 | Pending |
| REQ-05 | Phase 2 | Pending |
| REQ-06 | Phase 2 | Pending |
| REQ-07 | Phase 2 | Pending |
| REQ-08 | Phase 2 | Pending |
| REQ-09 | Phase 2 | Pending |
| REQ-10 | Phase 2 | Pending |
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| AUTH-05 | Phase 2 | Pending |
| ENV-01 | Phase 2 | Pending |
| ENV-02 | Phase 2 | Pending |
| ENV-03 | Phase 2 | Pending |
| ENV-04 | Phase 2 | Pending |
| TEST-01 | Phase 3 | Pending |
| TEST-02 | Phase 3 | Pending |
| TEST-03 | Phase 3 | Pending |
| TEST-04 | Phase 3 | Pending |
| CLI-01 | Phase 4 | Pending |
| CLI-02 | Phase 4 | Pending |
| CLI-03 | Phase 4 | Pending |
| CLI-04 | Phase 4 | Pending |
| CLI-05 | Phase 4 | Pending |
| CLI-06 | Phase 4 | Pending |
| CLI-07 | Phase 4 | Pending |
| CLI-08 | Phase 4 | Pending |
| CLI-09 | Phase 4 | Pending |
| CLI-10 | Phase 4 | Pending |
| LIB-01 | Phase 5 | Pending |
| LIB-02 | Phase 5 | Pending |
| LIB-03 | Phase 5 | Pending |
| LIB-04 | Phase 5 | Pending |
| LIB-05 | Phase 5 | Pending |
| LIB-06 | Phase 5 | Pending |
| CFG-01 | Phase 5 | Pending |
| CFG-02 | Phase 5 | Pending |
| CFG-03 | Phase 5 | Pending |
| CFG-04 | Phase 5 | Pending |
| CFG-05 | Phase 5 | Pending |
| CFG-06 | Phase 5 | Pending |
| QUAL-01 | Phase 1 | Validated |
| QUAL-02 | Phase 1 | Validated |
| QUAL-03 | Phase 1 | Validated |
| QUAL-04 | Phase 1 | Validated |
| QUAL-05 | Phase 1 | Validated |
| PUB-01 | Phase 6 | Pending |
| PUB-02 | Phase 6 | Pending |
| PUB-03 | Phase 6 | Pending |
| PUB-04 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 64 total
- Mapped to phases: 64
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after initial definition*
