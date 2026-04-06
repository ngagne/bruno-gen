# Phase 3 Context — Bruno Generator Layer

## Phase Goal
Convert the unified IR into Bruno `.bru` files — collection structure, requests, folders, environment variables, and authentication.

## Requirements
[REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06, REQ-07, REQ-08, REQ-09, REQ-10, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, ENV-01, ENV-02, ENV-03, ENV-04]

## Success Criteria
1. Generated collection opens in Bruno and displays all requests with correct methods, URLs, and headers
2. Request bodies populated with example values from spec schemas (not empty or placeholder-only)
3. Example responses from spec visible as Bruno response examples in the UI
4. Environment file contains `{{baseUrl}}` and all auth variables; requests reference them correctly
5. Requests grouped by tag (OpenAPI) or query/mutation type (GraphQL) in Bruno folder structure
6. All auth scheme types (apiKey, HTTP bearer, HTTP basic, OAuth2/OIDC) generate correct env vars and request headers
7. OperationIds with special characters, spaces, and reserved words sanitized to valid filesystem paths

## Plans to Create
- 03-01: Output layer — file system ops, directory structure creation, path sanitization, atomic writes
- 03-02: Collection generator — collection.bru with name, version, default auth
- 03-03: Request generator — method, URL with {{baseUrl}}, path params, query params, headers, body
- 03-04: Response examples generator — convert spec response examples to Bruno response format
- 03-05: Folder generator — tag-based and path-based grouping, folder.bru metadata
- 03-06: Environment generator — {{baseUrl}}, auth variables, environments/ directory structure
- 03-07: Auth handler — apiKey, HTTP bearer/basic, OAuth2/OIDC env var generation and request header injection

## Input: What We Have
- **Complete IR type system** in `src/ir/` — CollectionIR, EndpointIR, ParameterIR, SchemaIR, SecurityScheme variants, ResponseIR, RequestBodyIR, MediaTypeIR
- **Working parsers** in `src/parsers/` — OpenAPI 3.x, Swagger 2.0, GraphQL, Directory parsers all produce CollectionIR
- **Parser entry point**: `parse(spec, options)` returns `CollectionIR`
- **Project scaffold**: TypeScript 6, tsup dual CJS/ESM, vitest, eslint, prettier all configured

## Output: What We Need to Build
A `src/generators/` module that takes `CollectionIR` and writes a Bruno collection directory:

```
output/
├── collection.bru           # Collection metadata, global settings, default auth
├── environments/
│   └── default.bru          # {{baseUrl}}, auth variables
├── <tag-folder>/
│   ├── folder.bru           # Tag name, display order
│   ├── GetUser.bru          # Individual request files
│   ├── CreateUser.bru
│   └── ...
└── ...
```

## Bruno .bru Format Research Summary

### collection.bru
- `meta { name, version }` — collection identity
- `auth { mode: <mode> }` — default auth mode
- `auth:<mode> { }` — default auth config
- `headers { }` — global headers
- `vars:pre-request { }` — global pre-request vars
- `script:pre-request { }` — global pre-request script
- `tests { }` — global tests
- `docs { }` — collection docs (markdown)

### folder.bru
- `meta { name, seq }` — folder display name and order

### request.bru
- `meta { name, type: http, seq, tags }` — request identity
- `get/post/put/delete/patch { url, body, auth }` — method block
- `params:query { }` — query parameters
- `params:path { }` — path parameters
- `headers { }` — request headers
- `auth:<mode> { }` — request-level auth override
- `body:json { ... }` — JSON body (also `body:graphql`, `body:form-urlencoded`, `body:multipart-form`, `body:file`)
- `body:graphql:vars { }` — GraphQL query variables
- `vars:pre-request { }` — request-level pre-request vars
- `vars:post-response { $res.body.field }` — response var extraction
- `docs { }` — request docs (markdown)
- `settings { timeout, followRedirects, maxRedirects, encodeUrl }` — request settings
- `tests { test("...", function() { chai assertions }) }` — test scripts
- `assert { $res.status: 200 }` — declarative assertions
- `script:pre-request { }` — pre-request JS
- `script:post-response { }` — post-response JS

### Environment .bru
- `vars { key: value }` — environment variables
- `~key: value` — disabled var
- `@key: value` — local/unpersisted var

### Auth Modes
- `none`, `basic`, `bearer`, `digest`, `awsv4`, `oauth2`, `wsse`, `apikey`
- `auth:basic { username, password }`
- `auth:bearer { token }`
- `auth:apikey { key, value, placement: header|query|cookie }`
- `auth:oauth2 { grant_type, authorization_url, access_token_url, client_id, client_secret, scope, pkce }`

### Key Constraints
- Bruno uses `{{varName}}` for variable interpolation
- `$res.body.field` for response extraction in `vars:post-response`
- Tests use Chai assertion syntax
- Path params use `params:path { }`, query params use `params:query { }`
- Body type must be declared in method block (`body: json`) AND content in `body:json { }`
- File references use `@file(path) @contentType(type)` syntax
- `~` prefix disables a block/field, `@` prefix marks as local

## Architectural Decisions Needed

1. **Generator orchestration**: Single `generate(CollectionIR, outputDir, options)` function that coordinates all sub-generators
2. **File writing strategy**: Atomic writes — write to temp dir then move to avoid partial output
3. **Path sanitization**: Convert operationIds/paths to safe filesystem names (remove `/`, `?`, `#`, spaces → `-`, lowercase, handle reserved words)
4. **Grouping strategy**: Default tag-based, with `--format` flag controlling path-based or flat (Phase 4 concern, but structure now)
5. **Example value generation**: Schema → concrete example for body when no explicit example exists
6. **Response example format**: Bruno stores response examples inline in the request.bru as `body:json` content (not separate files)
7. **Variable naming**: Map security scheme names to Bruno env var names (e.g., `bearerAuth` → `{{bearerAuthToken}}`)

## Dependencies
- Node.js `fs/promises` for file I/O
- No external Bruno SDK exists — we generate plain text .bru files
- `path` module for path manipulation
- May need a small schema-to-example generator for when specs lack explicit examples
