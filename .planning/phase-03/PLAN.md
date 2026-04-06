# PLAN: Phase 3 — Bruno Generator Layer

**Goal**: Convert the unified IR into Bruno `.bru` files — collection structure, requests, folders, environment variables, and authentication.

**Depends on**: Phase 2 (parsers produce CollectionIR) ✅

**Requirements**: REQ-01 through REQ-10, AUTH-01 through AUTH-05, ENV-01 through ENV-04

---

## Architecture Overview

```
src/generators/
├── index.ts                    # Public API: generate(ir, outputDir, options)
├── orchestrator.ts             # Coordinates all sub-generators, directory creation
├── bru-serializer.ts           # Core: IR blocks → .bru DSL text serialization
├── collection-generator.ts     # collection.bru generation
├── request-generator.ts        # Individual request.bru generation
├── folder-generator.ts         # folder.bru generation
├── environment-generator.ts    # environments/*.bru generation
├── auth-generator.ts           # Auth block generation for all scheme types
├── example-generator.ts        # Schema → concrete example values
├── path-sanitizer.ts           # operationId/path → safe filename
└── file-writer.ts              # Atomic file writes, directory structure
```

**Data flow**: `CollectionIR` → `orchestrator.ts` → calls sub-generators → each returns `.bru` text → `file-writer.ts` writes to disk

---

## Plan 03-01: Output Layer — File System Operations

**File**: `src/generators/file-writer.ts`

**Responsibilities**:
- Create output directory structure (root, `environments/`, tag subdirectories)
- Write `.bru` files atomically (write to temp, then rename) to avoid partial output
- Clean existing output directory if `--force` flag (Phase 4 concern, wire now)
- Handle errors gracefully with descriptive messages

**Implementation**:
```typescript
import { mkdir, writeFile, rename, access } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

interface WriteResult {
  path: string;
  success: boolean;
  error?: string;
}

/** Ensure directory exists, creating parents as needed. */
async function ensureDir(dirPath: string): Promise<void>;

/** Write a .bru file atomically (write to temp, then rename). */
async function writeBruFile(
  content: string,
  outputPath: string
): Promise<WriteResult>;

/** Create the full directory structure for a Bruno collection. */
async function prepareOutputDir(outputDir: string): Promise<void>;
```

**Tests**:
- `ensureDir` creates nested directories
- `writeBruFile` writes content and creates parent dirs
- Atomic write: file not visible until rename completes
- Error handling: permission denied, invalid path

---

## Plan 03-02: Collection Generator — collection.bru

**File**: `src/generators/collection-generator.ts`

**Responsibilities**:
- Generate `collection.bru` from `CollectionIR`
- Include `meta { name, version }` block
- Include `auth { mode }` block based on default security schemes
- Include `docs { }` block with collection description from `CollectionIR.info`
- Determine default auth mode from `CollectionIR.defaultSecurity`

**Input**: `CollectionIR`
**Output**: string (`.bru` content)

**Implementation**:
```typescript
import { CollectionIR } from '../ir/index.js';

interface CollectionBruOptions {
  /** Override default auth mode. */
  authMode?: string;
}

/** Generate collection.bru content from IR. */
function generateCollectionBru(
  ir: CollectionIR,
  options?: CollectionBruOptions
): string;

/** Determine the default auth mode from security schemes and requirements. */
function determineDefaultAuthMode(ir: CollectionIR): string;
```

**Bru output structure**:
```bru
meta {
  name: <CollectionIR.info.title>
  version: <CollectionIR.info.version>
}

auth {
  mode: <determined from defaultSecurity>
}

docs {
  # <CollectionIR.info.title>
  <CollectionIR.info.description>
}
```

**Tests**:
- Generates correct meta block with title and version
- Generates docs block with description (markdown preserved)
- Determines `bearer` auth when Bearer scheme is in defaultSecurity
- Determines `none` when no security schemes defined
- Handles multiple default security schemes (picks first)
- Includes contact and license info in docs block when present

---

## Plan 03-03: Request Generator — Individual .bru Files

**File**: `src/generators/request-generator.ts`

**Responsibilities**:
- Generate a complete `.bru` file from a single `EndpointIR`
- `meta { name, type: http, seq, tags }` block
- HTTP method block (`get`, `post`, etc.) with `url`, `body`, `auth` fields
- `params:path` and `params:query` blocks
- `headers` block with content-type and custom headers
- `body:json` or `body:graphql` block with example data
- `docs` block with endpoint summary and description
- `vars:post-response` block extracting common response fields
- Handle deprecated endpoints (add `deprecated: true` to meta)

**Input**: `EndpointIR`, `CollectionIR` (for servers, auth context)
**Output**: string (`.bru` content)

**Implementation**:
```typescript
import { EndpointIR, CollectionIR } from '../ir/index.js';

interface RequestBruOptions {
  /** Request ordering sequence number. */
  seq?: number;
  /** Base URL template to use (default: '{{baseUrl}}'). */
  baseUrl?: string;
}

/** Generate a complete request.bru file from EndpointIR. */
function generateRequestBru(
  endpoint: EndpointIR,
  collection: CollectionIR,
  options?: RequestBruOptions
): string;

/** Generate the HTTP method block (get, post, etc.). */
function generateMethodBlock(endpoint: EndpointIR, baseUrl: string): string;

/** Generate params:block (query and path). */
function generateParams(endpoint: EndpointIR): string;

/** Generate headers block. */
function generateHeaders(endpoint: EndpointIR): string;

/** Generate body:block based on content type. */
function generateBody(endpoint: EndpointIR): string;
```

**URL construction**:
- Replace path params `{paramName}` with `{{paramName}}` Bruno variable references
- Prepend `{{baseUrl}}` to the path
- Example: `/users/{id}/posts` → `{{baseUrl}}/users/{{id}}/posts`

**Params serialization**:
- `params:path { }` — only if endpoint has path parameters
- `params:query { }` — only if endpoint has query parameters
- Use example values from `ParameterIR.example` or generate from schema

**Headers**:
- `Content-Type` derived from `requestBody.content` keys (e.g., `application/json`)
- `Accept` derived from `responses` content types
- Additional headers from `producesContentType` / `consumesContentTypes`

**Tests**:
- GET request: generates `get { url, body: none, auth }` with `params:path` and `params:query`
- POST request with JSON body: generates `post { url, body: json, auth }` with `body:json { }`
- Path params use `{{paramName}}` syntax in URL and `params:path { }` block
- Query params serialized to `params:query { }` with example values
- Headers block includes Content-Type from request body media type
- Deprecated endpoint includes `deprecated: true` in meta
- Tags array in meta matches `EndpointIR.tags`
- GraphQL operation generates `type: graphql` meta and `body:graphql { }`
- Multi-line description preserved in docs block

---

## Plan 03-04: Response Examples Generator

**File**: `src/generators/response-examples.ts` (used by request-generator.ts)

**Responsibilities**:
- Extract response examples from `EndpointIR.responses`
- Include them in the `docs` block as markdown code examples
- Generate `vars:post-response` blocks for common response fields

**Implementation**:
```typescript
import { ResponseIR, MediaTypeIR } from '../ir/index.js';

/** Generate markdown documentation with response examples. */
function generateResponseDocs(responses: ResponseIR[]): string;

/** Generate vars:post-response block extracting common response fields. */
function generatePostResponseVars(responses: ResponseIR[]): string;
```

**Response docs format** (inside the `docs { }` block):
```bru
docs {
  # Get User

  Retrieves a single user by ID.

  ## Responses

  ### 200 OK
  \`\`\`json
  { "id": 1, "name": "John", "email": "john@example.com" }
  \`\`\`

  ### 404 Not Found
  \`\`\`json
  { "error": "User not found" }
  \`\`\`
}
```

**vars:post-response** — extract top-level fields from successful (2xx) response schemas:
```bru
vars:post-response {
  id: $res.body.id
  name: $res.body.name
}
```

Only generate for object response bodies with clear top-level properties.

**Tests**:
- Response examples formatted as markdown code blocks in docs
- vars:post-response generated for 2xx object responses
- No vars:post-response for error responses (4xx, 5xx)
- Handles responses without examples (generates from schema)
- Skips vars:post-response for array response bodies

---

## Plan 03-05: Folder Generator — Tag-Based Grouping

**File**: `src/generators/folder-generator.ts`

**Responsibilities**:
- Generate `folder.bru` for each tag group
- Map endpoints to folders by their primary tag
- Handle endpoints with no tags → `ungrouped/` folder
- Handle endpoints with multiple tags → placed in first tag's folder
- Generate `meta { name, seq }` block

**Input**: `CollectionIR.tags[]`, `EndpointIR[]` grouped by tag
**Output**: `{ folderName: string, folderBru: string, requests: EndpointIR[] }[]`

**Implementation**:
```typescript
import { CollectionIR, EndpointIR } from '../ir/index.js';

interface FolderGroup {
  /** Folder directory name (sanitized tag name). */
  folderName: string;
  /** folder.bru content. */
  folderBru: string;
  /** Endpoints belonging to this folder. */
  endpoints: EndpointIR[];
}

/** Group endpoints by their primary tag and generate folder.bru for each. */
function generateFolderGroups(
  ir: CollectionIR
): FolderGroup[];

/** Generate folder.bru content for a single tag. */
function generateFolderBru(tagName: string, sequence: number): string;
```

**Grouping logic**:
1. For each `EndpointIR`, use `tags[0]` as primary tag
2. Endpoints with `tags.length === 0` → `ungrouped` folder
3. Generate `folder.bru` for each unique tag
4. `meta.seq` = sequential ordering (1, 2, 3, ...)

**Folder structure**:
```
output/
├── collection.bru
├── environments/
├── users/
│   ├── folder.bru        # meta { name: "Users", seq: 1 }
│   ├── GetUser.bru
│   └── CreateUser.bru
├── products/
│   ├── folder.bru        # meta { name: "Products", seq: 2 }
│   └── ListProducts.bru
└── ungrouped/
    ├── folder.bru        # meta { name: "Ungrouped", seq: 3 }
    └── HealthCheck.bru
```

**Tests**:
- Endpoints grouped by first tag
- Untagged endpoints placed in `ungrouped/` folder
- folder.bru contains correct tag name and sequence
- Multiple endpoints in same folder ordered by seq
- Tag names with special characters sanitized for directory names

---

## Plan 03-06: Environment Generator

**File**: `src/generators/environment-generator.ts`

**Responsibilities**:
- Generate `environments/default.bru` with:
  - `{{baseUrl}}` from `CollectionIR.servers[0].url`
  - Auth variables from all `CollectionIR.securitySchemes`
  - Server variable defaults
- Generate environment file content as `vars { }` block

**Input**: `CollectionIR`
**Output**: string (`.bru` content for environment file)

**Implementation**:
```typescript
import { CollectionIR, SecurityScheme } from '../ir/index.js';

/** Generate environment file content (default.bru). */
function generateEnvironmentBru(ir: CollectionIR): string;

/** Generate {{baseUrl}} from CollectionIR.servers. */
function extractBaseUrl(ir: CollectionIR): string;

/** Generate auth variable names and values from security schemes. */
function generateAuthVars(schemes: Record<string, SecurityScheme>): Record<string, string>;
```

**Auth variable naming convention**:
- Security scheme name → env var name (camelCase → readable)
- `bearerAuth` → `{{bearerAuthToken}}`
- `basicAuth` → `{{basicAuthUsername}}`, `{{basicAuthPassword}}`
- `apiKeyAuth` → `{{apiKeyAuthKey}}`, `{{apiKeyAuthValue}}`
- `oauth2` → `{{oauth2ClientId}}`, `{{oauth2ClientSecret}}`, etc.

**Environment file structure**:
```bru
vars {
  baseUrl: https://api.example.com/v1
  bearerAuthToken: your-bearer-token-here
  basicAuthUsername: your-username
  basicAuthPassword: your-password
  apiKeyAuthValue: your-api-key
  oauth2ClientId: your-client-id
  oauth2ClientSecret: your-client-secret
  oauth2Scope: read write
}
```

**Server variable handling**:
- If `CollectionIR.servers[0].url` = `https://{tenant}.api.example.com/{version}`
- Generate: `baseUrl: https://my-tenant.api.example.com/v1` (with defaults substituted)
- Add server vars to environment: `tenant: my-tenant`, `version: v1`

**Tests**:
- Generates `baseUrl` from first server URL
- Generates `{{baseUrl}}` with server variable defaults substituted
- Generates auth vars for bearer, basic, apiKey, oauth2 schemes
- Auth var names match scheme name + field suffix
- No auth vars generated when no security schemes
- Multiple servers: uses first server's URL

---

## Plan 03-07: Auth Handler — All Security Scheme Types

**File**: `src/generators/auth-generator.ts`

**Responsibilities**:
- Generate auth blocks for each security scheme type:
  - `auth:bearer { token: {{varName}} }`
  - `auth:basic { username: {{varName}}, password: {{varName}} }`
  - `auth:apikey { key: <name>, value: {{varName}}, placement: header|query|cookie }`
  - `auth:oauth2 { grant_type, authorization_url, access_token_url, client_id, client_secret, scope, pkce }`
  - `openIdConnect` → mapped to `auth:oauth2` with URL fetched from OIDC discovery (generate placeholder)
- Include auth block in collection.bru (default auth)
- Include auth block in individual request.bru files (request-level override)
- Map `EndpointIR.security` to per-request auth mode

**Implementation**:
```typescript
import { SecurityScheme, SecurityRequirement } from '../ir/index.js';

/** Generate auth block for a specific security scheme. */
function generateAuthBlock(scheme: SecurityScheme, varPrefix: string): string;

/** Generate auth mode string for collection-level default. */
function generateAuthMode(schemes: Record<string, SecurityScheme>): string;

/** Determine auth mode for a specific endpoint. */
function getEndpointAuthMode(
  endpointSecurity?: SecurityRequirement[],
  collectionSecurity: SecurityRequirement[]
): string;
```

**Auth block generation per type**:

```typescript
// HTTP Bearer
auth:bearer {
  token: {{bearerAuthToken}}
}

// HTTP Basic
auth:basic {
  username: {{basicAuthUsername}}
  password: {{basicAuthPassword}}
}

// API Key (header)
auth:apikey {
  key: X-API-Key
  value: {{apiKeyAuthValue}}
  placement: header
}

// API Key (query)
auth:apikey {
  key: api_key
  value: {{apiKeyAuthValue}}
  placement: query
}

// OAuth2 Authorization Code
auth:oauth2 {
  grant_type: authorization_code
  authorization_url: https://auth.example.com/authorize
  access_token_url: https://auth.example.com/token
  client_id: {{oauth2ClientId}}
  client_secret: {{oauth2ClientSecret}}
  scope: read write
  pkce: false
}

// OpenID Connect → map to OAuth2
auth:oauth2 {
  grant_type: authorization_code
  authorization_url: {{oidcAuthorizationUrl}}
  access_token_url: {{oidcTokenUrl}}
  client_id: {{oidcClientId}}
  client_secret: {{oidcClientSecret}}
  scope: openid profile email
  pkce: true
}
```

**Endpoint-level security override**:
- If `EndpointIR.security` is `[]` (empty array) → `auth: none` in method block
- If `EndpointIR.security` is `undefined` → inherit collection default
- If `EndpointIR.security` references specific scheme → use that scheme's auth block

**Tests**:
- Bearer scheme generates `auth:bearer { token: {{varName}} }`
- Basic scheme generates `auth:basic { username, password }`
- API key in header generates `auth:apikey { key, value, placement: header }`
- API key in query generates `auth:apikey { key, value, placement: query }`
- OAuth2 generates full `auth:oauth2` block with all fields
- OpenID Connect generates `auth:oauth2` with placeholder URLs
- Empty security array on endpoint → `auth: none`
- Undefined security → inherits collection default
- Auth mode determination logic handles all scheme types

---

## Supporting Module: BRU Serializer

**File**: `src/generators/bru-serializer.ts`

**Responsibilities**:
- Core serialization primitives for Bruno DSL
- Convert values to Bruno-compatible format
- Handle block formatting (`key { ... }`)
- Handle key-value pairs (`key: value`)
- Handle multi-line strings (`'''text'''`)
- Handle comments and disabled fields (`~key: value`)

**Implementation**:
```typescript
/** Serialize a value to Bruno DSL format. */
function serializeValue(value: unknown): string;

/** Generate a Bruno block: blockName { key: value; ... } */
function formatBlock(name: string, entries: Record<string, unknown>): string;

/** Generate a Bruno block with raw content (for JSON bodies). */
function formatBlockWithContent(name: string, content: string): string;

/** Format a multi-line string for docs blocks. */
function formatMultiline(text: string): string;

/** Escape a key for use in Bruno DSL (handle spaces, special chars). */
function escapeKey(key: string): string;
```

**Tests**:
- `serializeValue` handles strings, numbers, booleans, null, arrays, objects
- `formatBlock` generates correct indentation and syntax
- `formatBlockWithContent` preserves raw JSON in body blocks
- Multi-line strings use `'''` syntax
- Keys with spaces are quoted
- Empty blocks produce empty braces `{ }`

---

## Supporting Module: Example Generator

**File**: `src/generators/example-generator.ts`

**Responsibilities**:
- Generate concrete example values from `SchemaIR` when no explicit example is provided
- Used for request body generation, parameter examples, response examples
- Type-aware: generates appropriate values for string, number, boolean, array, object
- Format-aware: handles `email`, `date-time`, `uuid`, `uri`, etc.

**Implementation**:
```typescript
import { SchemaIR } from '../ir/index.js';

/** Generate a concrete example value from a schema. */
function generateExample(schema: SchemaIR, depth?: number): unknown;

/** Generate a flat map of field paths to example values (for vars:post-response). */
function generateExampleFields(schema: SchemaIR, prefix?: string): Record<string, string>;
```

**Generation rules**:
- `string` → use `example` if present, else `"string"` or field-name-derived value
- `integer`/`number` → use `example`, else `0` or `minimum` or `default`
- `boolean` → use `example`, else `true`
- `array` → use `example`, else `[]` or `[generateExample(schema.items)]`
- `object` → use `example`, else `{}` or map of properties with generated values
- `enum` → first value in enum
- `format: "email"` → `"user@example.com"`
- `format: "date-time"` → `"2026-01-01T00:00:00Z"`
- `format: "uuid"` → `"00000000-0000-0000-0000-000000000000"`
- `format: "uri"` → `"https://example.com"`
- `depth > 3` → return `{}` or `[]` to prevent infinite recursion on circular refs

**Tests**:
- Generates string examples from schema `example` field
- Generates placeholder `"string"` when no example present
- Generates number from `minimum` or `default`
- Generates array with example items
- Generates object with example properties
- Handles enum → first value
- Handles format hints (email, date-time, uuid)
- Depth limit prevents infinite recursion

---

## Supporting Module: Path Sanitizer

**File**: `src/generators/path-sanitizer.ts`

**Responsibilities**:
- Convert operationId or method+path to safe filesystem filename
- Handle special characters, spaces, reserved words
- Ensure uniqueness (append `_2`, `_3` for duplicates)

**Implementation**:
```typescript
/** Convert an endpoint identifier to a safe .bru filename. */
function sanitizeRequestFilename(endpoint: EndpointIR, usedNames: Set<string>): string;

/** Convert a tag name to a safe directory name. */
function sanitizeFolderName(tag: string): string;

/** Core sanitization: remove/replace unsafe chars, collapse separators. */
function sanitizeName(raw: string): string;
```

**Rules**:
- Replace `/`, `?`, `#`, `&`, `=`, `:` → `-`
- Replace `{`, `}` → `` (remove)
- Replace spaces → `-`
- Replace multiple consecutive dashes → single `-`
- Trim leading/trailing dashes
- Lowercase (recommended for consistency)
- Handle Windows reserved words: CON, PRN, AUX, NUL, COM1-9, LPT1-9 → prefix with `_`
- Append `_2`, `_3` etc. for duplicate filenames

**Tests**:
- `GET /users/{id}` → `get-users-id.bru`
- `POST /oauth/token?grant_type=client_credentials` → `post-oauth-token.bru`
- `GET /users` with operationId `Get All Users` → `get-all-users.bru`
- `GET /CON` → `_con.bru` (Windows reserved)
- Duplicate names get `_2`, `_3` suffixes
- Folder names sanitized similarly

---

## Supporting Module: Orchestrator

**File**: `src/generators/orchestrator.ts`

**Responsibilities**:
- `generate(ir, outputDir, options)` — main entry point
- Create directory structure
- Generate collection.bru, environment file, folder groups, request files
- Write all files using file-writer
- Report generation results (files written, warnings)

**Implementation**:
```typescript
import { CollectionIR } from '../ir/index.js';

interface GenerateOptions {
  /** Output directory path. */
  outputDir: string;
  /** Force regeneration (clean existing). */
  force?: boolean;
  /** Grouping strategy: 'tag' | 'path' | 'flat'. Default: 'tag'. */
  grouping?: 'tag' | 'path' | 'flat';
}

interface GenerateResult {
  success: boolean;
  filesWritten: string[];
  warnings: string[];
}

/** Main entry point — generate a complete Bruno collection from IR. */
async function generate(
  ir: CollectionIR,
  options: GenerateOptions
): Promise<GenerateResult>;
```

**Execution flow**:
1. `prepareOutputDir(outputDir)` — create directory structure
2. `generateCollectionBru(ir)` → write `collection.bru`
3. `generateEnvironmentBru(ir)` → write `environments/default.bru`
4. `generateFolderGroups(ir)` → for each group:
   - Create subdirectory `group.folderName/`
   - Write `folder.bru`
   - For each endpoint in group:
     - `generateRequestBru(endpoint, ir)` → write `<sanitized-name>.bru`
5. Collect all file paths and warnings
6. Return `GenerateResult`

**Tests**:
- Integration test: full generation from a sample CollectionIR
- Verifies directory structure created correctly
- Verifies all expected files written
- Verifies collection.bru content matches expected
- Verifies environment file has correct vars
- Verifies request files have correct method, URL, body
- Warnings collected for deprecated endpoints
- Force mode: cleans existing directory before generation

---

## Module Graph

```
orchestrator.ts
├── collection-generator.ts → bru-serializer.ts
├── environment-generator.ts → auth-generator.ts
├── folder-generator.ts → path-sanitizer.ts
├── request-generator.ts
│   ├── bru-serializer.ts
│   ├── auth-generator.ts
│   ├── example-generator.ts
│   └── response-examples.ts
└── file-writer.ts
```

---

## File Structure Summary

```
src/
├── generators/
│   ├── index.ts              # Re-exports: generate, GenerateOptions, GenerateResult
│   ├── orchestrator.ts       # Main generate() function
│   ├── bru-serializer.ts     # Core DSL serialization
│   ├── collection-generator.ts
│   ├── request-generator.ts
│   ├── folder-generator.ts
│   ├── environment-generator.ts
│   ├── auth-generator.ts
│   ├── example-generator.ts
│   ├── response-examples.ts
│   ├── path-sanitizer.ts
│   └── file-writer.ts
└── ir/                       # (existing)
└── parsers/                  # (existing)
```

---

## Verification Plan

### Unit Tests
- Each generator module tested independently with mock IR input
- bru-serializer tested with all value types and block formats
- example-generator tested with all schema types and formats
- path-sanitizer tested with edge cases (reserved words, duplicates, special chars)
- auth-generator tested with all security scheme variants

### Integration Tests
- Full generation from a parsed OpenAPI Petstore spec → verify directory structure and file content
- Full generation from a parsed GraphQL schema → verify queries/Mutations folders
- Generate from a spec with all auth types → verify environment vars and auth blocks
- Generate from a spec with no tags → verify `ungrouped/` folder
- Generate from a spec with deprecated endpoints → verify `deprecated: true` in meta

### Golden File Tests
- Compare generated output against known-good `.bru` file snapshots
- Petstore OpenAPI spec → golden Bruno collection
- Simple GraphQL schema → golden Bruno collection

---

## Risk Areas

1. **Bruno DSL edge cases**: The .bru format may have quirks not documented (escaping, edge syntax). Mitigation: test generated files in actual Bruno app if possible.
2. **Circular schema references**: `example-generator.ts` must handle recursive schemas (e.g., tree structures) with depth limits.
3. **Response example storage**: Bruno doesn't have a native "response example" block. We'll document them in `docs` blocks. If this proves insufficient, may need to pivot to OpenCollection YAML format.
4. **Large collections**: Performance for APIs with 100+ endpoints. Mitigation: stream writes, don't hold all content in memory.

---

## Implementation Order

1. **03-01**: `file-writer.ts` — foundation, no dependencies
2. **03-08**: `bru-serializer.ts` — core serialization, needed by all generators
3. **03-09**: `example-generator.ts` — needed by request generator
4. **03-10**: `path-sanitizer.ts` — needed by orchestrator and request generator
5. **03-02**: `collection-generator.ts` — simple, standalone
6. **03-06**: `environment-generator.ts` + `auth-generator.ts` — environment depends on auth
7. **03-07**: `auth-generator.ts` — standalone auth block generation
8. **03-05**: `folder-generator.ts` — grouping logic
9. **03-04**: `response-examples.ts` — response docs for request generator
10. **03-03**: `request-generator.ts` — complex, depends on serializer, example, auth, response
11. **03-11**: `orchestrator.ts` — ties everything together
12. **Integration + Golden tests**

---

## Public API

```typescript
// src/generators/index.ts
export { generate } from './orchestrator.js';
export type { GenerateOptions, GenerateResult } from './orchestrator.js';
```

Usage:
```typescript
import { parse } from 'bruno-collection-generator';
import { generate } from 'bruno-collection-generator/generators';

const ir = await parse('./openapi.yaml');
const result = await generate(ir, { outputDir: './output' });
console.log(`Generated ${result.filesWritten.length} files`);
```
