# Research: Bruno .bru File Format

## Overview
Bruno uses a custom DSL (Domain Specific Language) stored in `.bru` files. These are plain-text files with a block-based syntax similar to HCL/TOML. The format is designed to be Git-friendly and human-readable.

**Source**: https://www.mintlify.com/usebruno/bruno/api/collection-format
**Bru Lang**: https://docs.usebruno.com/bru-lang/overview

## 1. collection.bru

Root-level file that defines collection identity, global settings, and defaults.

```bru
meta {
  name: My API Collection
  version: 1.0.0
}

auth {
  mode: none  # none | basic | bearer | digest | awsv4 | oauth2 | wsse | apikey
}

# Optional: default auth config
auth:bearer {
  token: {{bearerToken}}
}

# Optional: global headers applied to ALL requests
headers {
  x-api-version: 1.0
}

# Optional: global pre-request variables
vars:pre-request {
  timestamp: {{$timestamp}}
}

# Optional: global pre-request script
script:pre-request {
  // JavaScript executed before each request
}

# Optional: global tests
tests {
  test("Global check", function() {
    expect(true).to.equal(true);
  });
}

# Optional: collection documentation
docs {
  # Collection Title
  Description of this API collection.
}
```

**Key fields for our generator:**
- `meta.name` ← `CollectionIR.info.title`
- `meta.version` ← `CollectionIR.info.version`
- `auth.mode` ← determined by `CollectionIR.securitySchemes`
- Auth-specific blocks ← mapped from `SecurityScheme` types

## 2. folder.bru

Placed in each tag-based subdirectory.

```bru
meta {
  name: Users API
  seq: 1
}
```

**Key fields:**
- `meta.name` ← Tag name (from `EndpointIR.tags[0]` or grouped path segment)
- `meta.seq` ← incremental ordering number

## 3. Request .bru Files

One `.bru` file per `EndpointIR`. Filename = sanitized operation name.

```bru
meta {
  name: Get User
  type: http
  seq: 1
  tags: [users, v1]
}

get {
  url: {{baseUrl}}/api/v1/users/{{userId}}
  body: none
  auth: bearer
}

params:path {
  userId: {{userId}}
}

params:query {
  fields: id,name,email
  includeDeleted: false
}

headers {
  Accept: application/json
  x-request-id: {{$uuid}}
}

auth:bearer {
  token: {{authToken}}
}

vars:pre-request {
  requestId: {{$uuid}}
}

vars:post-response {
  userId: $res.body.id
  userName: $res.body.name
}

docs {
  # Get User
  Retrieves a single user by ID.
}

settings {
  timeout: 30000
  followRedirects: true
  encodeUrl: true
}

tests {
  test("Status is 200", function() {
    expect(res.getStatus()).to.equal(200);
  });
}

assert {
  $res.status: 200
  $res.body.id: isDefined
}

script:pre-request {
  // pre-request JS
}

script:post-response {
  // post-response JS
}
```

### Method Block Structure
The method block name matches the HTTP verb:
- `get`, `post`, `put`, `patch`, `delete`, `head`, `options`
- `patch` for PATCH requests
- `trace` for TRACE requests (rare)

Method block fields:
```bru
post {
  url: {{baseUrl}}/api/v1/users
  body: json          # none | json | text | xml | form-urlencoded | multipart-form | graphql | sparql
  auth: bearer        # none | basic | bearer | digest | awsv4 | oauth2 | wsse | apikey
}
```

### Body Formats

#### JSON Body
```bru
body:json {
  {
    "name": "John Doe",
    "email": "john@example.com",
    "age": 30
  }
}
```

#### Form URL Encoded
```bru
body:form-urlencoded {
  username: johndoe
  password: secret123
}
```

#### Multipart Form (with files)
```bru
body:multipart-form {
  username: johndoe
  avatar: @file(/path/to/image.png) @contentType(image/png)
  description: '''Multi-line text value''' @contentType(text/plain)
}
```

#### GraphQL
```bru
body:graphql {
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
    }
  }
}

body:graphql:vars {
  {
    "id": "{{userId}}"
  }
}
```

#### File Body
```bru
body:file {
  file: @file(/path/to/document.pdf) @contentType(application/pdf)
}
```

### Parameter Blocks

#### Query Parameters
```bru
params:query {
  page: 1
  limit: 20
  sort: name
  ~debug: false        # disabled with ~ prefix
}
```

#### Path Parameters
```bru
params:path {
  userId: 123
  accountId: abc-456
  "key with spaces": value   # quoted keys for special chars
}
```

#### Header Parameters
```bru
headers {
  Content-Type: application/json
  Accept: application/json
  Authorization: Bearer {{token}}
  x-custom-header: custom-value
}
```

### Auth Blocks Detail

#### Basic Auth
```bru
auth:basic {
  username: admin
  password: {{password}}
}
```

#### Bearer Token
```bru
auth:bearer {
  token: {{bearerToken}}
}
```

#### API Key
```bru
auth:apikey {
  key: X-API-Key
  value: {{apiKey}}
  placement: header    # header | query | cookie
}
```

#### OAuth2
```bru
auth:oauth2 {
  grant_type: authorization_code
  authorization_url: https://auth.example.com/authorize
  access_token_url: https://auth.example.com/token
  client_id: {{clientId}}
  client_secret: {{clientSecret}}
  scope: read write
  pkce: true
}
```

#### Digest Auth
```bru
auth:digest {
  username: user
  password: {{password}}
}
```

### Variables

#### Pre-request Variables
```bru
vars:pre-request {
  timestamp: {{$timestamp}}
  requestId: {{$uuid}}
  @localVar: not-persisted    # @ prefix = local, not saved
}
```

Built-in Bruno variables:
- `{{$uuid}}` — generates a UUID
- `{{$timestamp}}` — current Unix timestamp in milliseconds

#### Post-response Variables (Response Extraction)
```bru
vars:post-response {
  token: $res.body.token
  userId: $res.body.user.id
  contentType: $res.headers.content-type
  @sessionId: $res.body.sessionId
}
```

Path syntax:
- `$res.status` — HTTP status code
- `$res.body` — response body (parsed JSON)
- `$res.body.field` — nested field access
- `$res.headers.headerName` — response header

### Tests (Chai Assertions)
```bru
tests {
  test("Status is 200", function() {
    expect(res.getStatus()).to.equal(200);
    expect(res.getBody()).to.have.property('data');
    expect(res.getResponseTime()).to.be.below(1000);
    expect(res.getBody().items).to.be.an('array');
  });
}
```

Available test APIs:
- `res.getStatus()` — HTTP status code
- `res.getBody()` — parsed response body
- `res.getHeader(name)` — specific response header
- `getResponseTime()` — response time in ms

### Declarative Assertions
```bru
assert {
  $res.status: 200
  $res.body.success: true
  $res.body.id: isDefined
  $res.headers.content-type: matches /json/
  ~$res.body.debug: disabled   # disabled with ~
}
```

Operators:
- Direct value match: `$res.status: 200`
- `isDefined` — field exists
- `matches /regex/` — regex match
- `~` prefix — disabled

### Settings
```bru
settings {
  timeout: 30000         # milliseconds
  followRedirects: true
  maxRedirects: 5
  encodeUrl: true
}
```

## 4. Environment Files

Located in `environments/` directory.

```bru
vars {
  baseUrl: https://api.example.com/v1
  authToken: your-token-here
  clientId: your-client-id
  clientSecret: your-client-secret
  ~deprecatedVar: disabled-value
  @localSecret: ephemeral-value
}
```

**Key rules:**
- `{{varName}}` resolves from: request vars > environment vars > collection vars > built-in vars
- `~varName: value` — disabled var
- `@varName: value` — local/unpersisted var (not committed to .bru file by Bruno)

## 5. Value Serialization Rules

### Scalar Values
- Strings: unquoted if simple, quoted with `'''` for multi-line, quoted with `" "` if contains special chars
- Numbers: unquoted `42`, `3.14`
- Booleans: unquoted `true`, `false`
- Null: unquoted `null`

### Objects in body:json
- Raw JSON: `{ "key": "value" }`
- Must be valid JSON

### Arrays in params
- For repeated query params: `tags: [users, api, v1]`

### Variable Interpolation
- `{{varName}}` — standard variable reference
- `{{$uuid}}`, `{{$timestamp}}` — built-in Bruno variables
- Variables are resolved at request execution time

## 6. Special Characters and Escaping

- Keys with spaces: `"key with spaces": value`
- Multi-line strings: `'''line1\nline2'''`
- Hash comments: `# this is a comment` (though `#` is also used for block delimiters in some versions)
- Block content: enclosed in `{ }`

## 7. Path Sanitization for Filenames

Bruno request filenames must be valid filesystem paths:
- Replace `/` → `-` or `_`
- Replace `?` → `` (remove)
- Replace `#` → `` (remove)
- Replace spaces → `-`
- Replace special chars (`&`, `=`, `:`) → `-`
- Collapse multiple dashes → single `-`
- Lowercase recommended but not required
- Must end with `.bru`
- Handle reserved words (CON, PRN, AUX, NUL, COM1-9, LPT1-9 on Windows)

Example: `GET /users/{id}/profile` → `get-users-id-profile.bru`
Example: `POST /oauth/token?grant_type=client_credentials` → `post-oauth-token.bru`

## 8. Response Examples in Bruno

Bruno stores response examples in the request file itself, not as separate files. The `docs` block or separate response files can be used.

**Important**: Bruno doesn't have a native "response example" block in the .bru DSL. Response examples from OpenAPI specs should be documented in the `docs` block of the request, or stored as separate `.bru` files if Bruno supports the OpenCollection YAML format. For our generator, we'll include example request bodies from the spec in `body:json` blocks, and document response examples in the `docs` block.

## 9. Directory Structure Template

```
collection-name/
├── collection.bru
├── environments/
│   └── default.bru
├── tag-one/
│   ├── folder.bru
│   ├── request-one.bru
│   └── request-two.bru
├── tag-two/
│   ├── folder.bru
│   └── request-three.bru
└── ungrouped/          # endpoints with no tags
    └── request-four.bru
```

For GraphQL:
```
collection-name/
├── collection.bru
├── environments/
│   └── default.bru
├── queries/
│   ├── folder.bru
│   ├── GetUser.bru
│   └── ListItems.bru
└── mutations/
    ├── folder.bru
    ├── CreateUser.bru
    └── DeleteItem.bru
```

## 10. GraphQL-Specific Considerations

- All GraphQL operations map to `POST` requests to `/graphql` endpoint
- Query goes in `body:graphql { }`
- Variables go in `body:graphql:vars { }`
- The `type: graphql` meta can be used instead of `type: http`
- Grouping: queries in `queries/` folder, mutations in `mutations/` folder
- Subscriptions: OUT OF SCOPE (Bruno doesn't support WebSocket well)

```bru
meta {
  name: GetUser
  type: graphql
  seq: 1
}

post {
  url: {{baseUrl}}/graphql
  body: graphql
  auth: none
}

body:graphql {
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
    }
  }
}

body:graphql:vars {
  {
    "id": "123"
  }
}
```

## 11. Auth Mapping from IR to Bruno

| IR SecurityScheme type | Bruno auth mode | Bruno auth block |
|----------------------|-----------------|------------------|
| `http` + `scheme: "bearer"` | `bearer` | `auth:bearer { token: {{bearerToken}} }` |
| `http` + `scheme: "basic"` | `basic` | `auth:basic { username: {{username}}, password: {{password}} }` |
| `apiKey` + `in: "header"` | `apikey` | `auth:apikey { key: X-API-Key, value: {{apiKey}}, placement: header }` |
| `apiKey` + `in: "query"` | `apikey` | `auth:apikey { key: api_key, value: {{apiKey}}, placement: query }` |
| `oauth2` | `oauth2` | `auth:oauth2 { grant_type, authorization_url, access_token_url, ... }` |
| `openIdConnect` | `oauth2` | Fetch OIDC config, map to `auth:oauth2` |

## 12. Example Value Generation Strategy

When the OpenAPI/GraphQL spec provides `example` or `examples` fields:
- Use them directly in `body:json { }` blocks
- For parameters, use `example` in the appropriate params block

When NO example is provided:
- Generate sensible defaults from schema:
  - `string` → field name or `"string"` (e.g., `"name"` for a `name` field)
  - `integer`/`number` → `0` or from `minimum`/`default` if present
  - `boolean` → `true`
  - `array` → `[]` or `[<example item>]` if `items.example` exists
  - `object` → `{}` or `{ "field": <example> }` for each property
  - `enum` → first value in enum list
  - `format: "email"` → `"user@example.com"`
  - `format: "date-time"` → `"2026-01-01T00:00:00Z"`
  - `format: "uuid"` → `"00000000-0000-0000-0000-000000000000"`

This keeps the generated collection immediately usable for API exploration.
