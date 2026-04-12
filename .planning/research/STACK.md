# Stack Research: Bruno Collection Generator

> Research date: April 2026
> Target runtime: Node.js 24, TypeScript 6
> Purpose: What libraries, tools, and patterns should power this CLI + library?

---

## 1. OpenAPI / Swagger Parsing

### 1.1 `@apidevtools/swagger-parser` — **RECOMMENDED**

| Attribute | Value |
|-----------|-------|
| Latest version | 12.1.0 (Oct 2025) |
| Node requirement | 18+ |
| Spec support | Swagger 2.0, OpenAPI 3.0, OpenAPI 3.1 |
| License | MIT |
| Weekly downloads | ~400K |

**What it does:** Full parse, validate, dereference, and bundle of OpenAPI specs. It wraps `@apidevtools/json-schema-ref-parser` for `$ref` resolution and provides a unified API across spec versions.

**Key API:**
```ts
import SwaggerParser from "@apidevtools/swagger-parser";

const api = await SwaggerParser.parse("./openapi.yaml");
const dereferenced = await SwaggerParser.dereference("./openapi.yaml");
const bundled = await SwaggerParser.bundle("./openapi.yaml");
await SwaggerParser.validate("./openapi.yaml"); // throws on invalid
```

**Pros:**
- Single library handles Swagger 2.0, OAS 3.0, and OAS 3.1
- Built-in `$ref` resolution and circular reference detection
- Validates against JSON Schema validators
- Well-maintained (active releases through 2025)
- Dereference mode gives you a fully-resolved object tree — exactly what the IR layer needs
- Browser-compatible (useful if a web version is ever built)

**Cons:**
- Validation uses AJV under the hood; complex specs with deep nesting can be slow
- Does not auto-convert Swagger 2.0 to OpenAPI 3.x (you get the 2.0 structure back)
- Some users report issues with OpenAPI 3.1 JSON Schema 2020-12 dialect features (e.g., `prefixItems`, `unevaluatedProperties`)
- No streaming API — entire spec loaded into memory

**Confidence: High**

---

### 1.2 `swagger-parser` (Java/Maven) — NOT FOR THIS PROJECT

This is the Java Swagger Parser (io.swagger.parser.v3), currently at 2.1.26. It is a Maven package, not an npm package. Irrelevant for a Node.js project.

**Confidence: High (that we should NOT use it)**

---

### 1.3 `swagger-client` (swagger-js)

| Attribute | Value |
|-----------|-------|
| Latest version | 3.37.1 (Mar 2026) |
| Node requirement | Varies |
| Spec support | OpenAPI 2.0, 3.0, 3.1 |
| License | Apache-2.0 |

**What it does:** Full Swagger/OpenAPI client generation and spec resolution. More focused on generating HTTP clients than pure parsing.

**Pros:**
- Handles OpenAPI 3.1 well
- Includes spec converter (2.0 → 3.0)
- Active development

**Cons:**
- Heavier dependency tree than swagger-parser
- Oriented toward client generation, not parsing
- More complex API surface than needed

**Confidence: Medium** — could work as a secondary option for Swagger 2.0 → 3.0 conversion, but `@apidevtools/swagger-parser` is simpler for our use case.

---

### 1.4 `js-yaml`

| Attribute | Value |
|-----------|-------|
| Latest version | 4.1.0 (stable, long-maintained) |
| License | MIT |
| Weekly downloads | ~50M |

**What it does:** YAML parse and dump. Used to load `.yaml`/`.yml` OpenAPI specs before passing to the parser.

**Pros:**
- Industry standard for YAML in Node.js
- Safe loading (no `eval`)
- Preserves line/column info (useful for error reporting)

**Cons:**
- Only handles YAML, not JSON (use `JSON.parse()` for `.json` specs)

**Recommendation:** Use `js-yaml` for loading YAML specs. Detect file extension and use `JSON.parse()` for `.json` files. No alternative needed.

**Confidence: High**

---

### 1.5 `openapi-types`

| Attribute | Value |
|-----------|-------|
| Latest version | 12.1.3 (May 2023) |
| License | MIT |

**What it does:** TypeScript type definitions for OpenAPI document structures across all spec versions (2.0, 3.0, 3.1). Types-only package — no runtime code.

**Pros:**
- Covers all OpenAPI versions
- Zero runtime cost (types only)
- Used by many OpenAPI tooling libraries

**Cons:**
- Not updated since 2023 — does not include OpenAPI 3.2 types (if/when released)
- Types are broad; you will need to narrow them for your IR

**Recommendation:** Use for typing the raw parsed output from swagger-parser. Do NOT use as your IR types — the IR should be a curated, version-agnostic type system (see ARCHITECTURE.md).

**Confidence: High**

---

### 1.6 `openapi-format`

| Attribute | Value |
|-----------|-------|
| Latest version | Active (Mar 2026) |
| License | MIT |

**What it does:** Format, filter, and convert OpenAPI documents. Notably can upgrade OAS 3.0 → 3.1.

**Pros:**
- Useful for spec normalization before parsing
- Can filter out tags/operations during conversion

**Cons:**
- Not a parser — complementary tool only
- Adds another dependency

**Recommendation:** Consider as an optional pre-processing step for spec normalization. Not required for MVP.

**Confidence: Medium**

---

### What NOT to use for OpenAPI parsing:

| Package | Why not |
|---------|---------|
| `openapi-typescript` (v7.x) | This converts OpenAPI schemas to TypeScript types, not a parser for runtime use |
| `@scalar/openapi-types` (v0.6.x) | Types-only, very new, not battle-tested |
| Raw `JSON.parse()` + `yaml.parse()` | You'd have to implement `$ref` resolution, circular detection, and validation yourself — use swagger-parser instead |
| `swagger-parser` (Java) | Wrong ecosystem |

---

## 2. GraphQL Parsing

### 2.1 `graphql` (reference implementation) — **RECOMMENDED**

| Attribute | Value |
|-----------|-------|
| Latest version | 16.12.0 (Nov 2025, v16.x stable line) |
| License | MIT |
| Weekly downloads | ~30M |

**What it does:** The official JavaScript/TypeScript reference implementation of GraphQL. Provides parsing, validation, schema building, and printing utilities.

**Key functions for this project:**
```ts
import { parse, buildSchema, print, printSchema, get_introspection_query } from "graphql";

// Parse a GraphQL SDL string into an AST
const ast = parse(schemaString);

// Build a GraphQLSchema object from SDL
const schema = buildSchema(schemaString);

// Print a schema back to SDL
const sdl = printSchema(schema);

// Print an AST back to SDL
const sdl2 = print(ast);

// Introspection query generation
const introspectionQuery = get_introspection_query();
```

**For introspection from a live endpoint:**
```ts
import { introspectionFromSchema, buildClientSchema } from "graphql/utilities";

// If you have a live endpoint, fetch introspection data
const introspectionResult = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: get_introspection_query() }),
});
const schema = buildClientSchema(await introspectionResult.json());
```

**Pros:**
- Official reference implementation — most complete and correct
- Handles all GraphQL features: unions, interfaces, custom scalars, directives, enums
- AST is well-structured and traversable
- TypeScript types included
- Stable 16.x line (no major changes expected)

**Cons:**
- Large package (~1MB minified) — but this is a CLI, not a browser bundle
- No built-in HTTP client for introspection (you write the fetch yourself)
- `buildSchema` does NOT execute resolvers — it only parses SDL

**Confidence: High**

---

### What NOT to use for GraphQL parsing:

| Package | Why not |
|---------|---------|
| `@graphql-tools/schema` | Useful for building schemas programmatically, but we're parsing existing SDL — the `graphql` package is sufficient |
| `graphql-tag` | Only for parsing client queries into ASTs, not for schema parsing |
| `@apollo/server` | Full server runtime — way too heavy, completely wrong tool |

---

## 3. Bruno .bru File Format

### 3.1 The DSL

Bruno uses a custom DSL called **Bru** — a simple markup language with JSON-like semantics. As of Bruno v3.0.0 (Jan 2026), Bruno also supports **OpenCollection YAML** format (`.yml` files), but the `.bru` DSL remains fully supported and is the primary output target for this project (it is more git-diff-friendly and aligns with Bruno's git-native philosophy).

**Core block types:**

| Block type | Syntax | Description |
|------------|--------|-------------|
| Dictionary | `name { key: value }` | Key-value pairs. Keys are unquoted identifiers. |
| Text | `name { ...raw text... }` | Multi-line text content (JSON bodies, scripts, docs) |
| Array | `name [ item1, item2 ]` | List of strings |

**Universal rules:**
- `~` prefix on any key/item disables it without deleting: `~oldHeader: value`
- Blocks are top-level, not nested (except for special cases like `auth:oauth2:additional_params:...`)
- Values are unquoted strings; spaces in values work without quotes
- No nesting of blocks within blocks (flat structure)

### 3.2 `collection.bru` Structure

The collection root file defines collection-level settings, auth, variables, scripts, and documentation:

```bru
headers {
  accept: application/json
  x-api-version: 2.0
}

auth {
  mode: bearer
}

auth:bearer {
  token: {{authToken}}
}

vars:pre-request {
  baseUrl: https://api.example.com
  apiVersion: v2
}

vars:post-response {
  lastResponseTime: $res.responseTime
  lastStatus: $res.status
}

script:pre-request {
  const timestamp = Date.now();
  bru.setVar('timestamp', timestamp);
}

script:post-response {
  const status = res.getStatus();
  if (status === 401) {
    console.warn('Authentication token expired');
  }
}

tests {
  test("Response should be successful", function() {
    expect(status).to.be.at.least(200);
    expect(status).to.be.below(400);
  });
}

docs {
  # My API Collection
  Generated from OpenAPI 3.0 spec.
}
```

**Auth modes supported in `auth { mode: ... }`:**
`none`, `basic`, `bearer`, `digest`, `awsv4`, `oauth2`, `wsse`, `apikey`

**OAuth2 extended config** uses sub-blocks:
```bru
auth:oauth2 {
  grant_type: authorization_code
  authorization_url: https://oauth.example.com/authorize
  access_token_url: https://oauth.example.com/token
  client_id: {{client_id}}
  client_secret: {{client_secret}}
  scope: read write
  state: random-state
  pkce: true
}
```

### 3.3 `request.bru` Structure

Each `.bru` file in a collection directory represents a single API request:

```bru
meta {
  name: Get User by ID
  type: http
  seq: 1
}

get {
  url: {{baseUrl}}/users/:userId
  body: json
  auth: inherit
}

params:query {
  include: profile
  ~deprecated_field: old_value
}

params:path {
  userId: 123
}

headers {
  Content-Type: application/json
  Accept: application/json
}

body:json {
  {
    "name": "John",
    "email": "john@example.com"
  }
}

settings {
  encodeUrl: true
  followRedirects: true
  timeout: 30000
}

auth:bearer {
  token: {{authToken}}
}

script:pre-request {
  bru.setVar("requestId", crypto.randomUUID());
  req.setHeader("X-Request-ID", bru.getVar("requestId"));
}

script:post-response {
  const data = res.getBody();
  bru.setEnvVar("userId", data.id, { persist: true });
}

tests {
  test("Status code is 200", function() {
    expect(res.getStatus()).to.equal(200);
  });

  test("Response has user object", function() {
    const body = res.getBody();
    expect(body).to.have.property('user');
  });
}

docs {
  Retrieves a single user by their ID.
}
```

**Request types (`meta { type: ... }`):** `http`, `graphql-request`, `grpc-request`, `ws-request`, `js`

**Body types** (declared in the HTTP method block as `body: <type>`):
- `json` → `body:json { { ... } }`
- `xml` → `body:xml { <?xml ... ?> }`
- `text` → `body:text { plain text }`
- `form-urlencoded` → `body:form-urlencoded { key: value }`
- `multipart-form` → `body:multipart-form { key: value; file: @file(/path) }`
- `graphql` → `body:graphql { query { ... } }` + `body:graphql:vars { { ... } }`

**HTTP method blocks:** `get`, `post`, `put`, `patch`, `delete`, `head`, `options`

### 3.4 `folder.bru` Structure

Each subdirectory in the collection can have a `folder.bru` for folder-level metadata:

```bru
meta {
  name: User Management
  seq: 5
}
```

### 3.5 Environment File Structure

Environment files live in `environments/` directory and use the `.bru` extension:

```bru
vars {
  baseUrl: http://localhost:3000
  apiKey: dev-api-key
  debugMode: true
  ~unusedFeature: false
}
```

**Variable resolution order (highest to lowest):**
1. Request-level `vars` (e.g., `vars:pre-request`)
2. Active environment `.bru` file
3. `collection.bru` variables
4. Built-in system variables (`{{$uuid}}`, `{{$timestamp}}`)
5. Process environment variables (referenced as `{{PROCESS_VAR}}`)

**Variable syntax:**
- `{{variableName}}` — environment/collection variable reference
- `~variableName: value` — disabled variable (prefixed with `~`)
- `@localVar: value` — local/temp variable (not persisted)
- `{{PROCESS_ENV_VAR}}` — process environment variable reference

### 3.6 Bruno Version Format Changes

| Version | Change |
|---------|--------|
| Bruno 3.0.0 (Jan 2026) | Introduced OpenCollection YAML format as alternative to `.bru` DSL |
| Bruno 2.x | `.bru` DSL only; format stable throughout 2.x |
| Future | OpenCollection may become default, but `.bru` DSL will remain supported |

**Implication for this project:** Target the `.bru` DSL format (it is stable and well-documented). Monitor OpenCollection YAML spec for future support, but it is not needed for MVP.

**Important caveat:** The `.bru` DSL is not formally specified in a schema. It is documented through examples and the Bruno source code. The parser lives in the Bruno monorepo. Any format changes in future Bruno versions will require updates to this tool's output generator.

**Confidence: High** (on the format structure as documented), **Medium** (on long-term stability — DSL is not formally versioned)

---

## 4. CLI Framework and Output

### 4.1 `commander` — **RECOMMENDED**

| Attribute | Value |
|-----------|-------|
| Latest version | 14.0.3 (Jan 2026) |
| Node requirement | v22.12.0+ (Commander 15+); v14.x supports Node 20+ |
| License | MIT |
| Weekly downloads | ~20M |

**Pros:**
- De facto standard for Node.js CLIs
- Excellent TypeScript support (use `@commander-js/extra-typings` for inferred types)
- Subcommands, options, help generation, argument parsing
- Mature ecosystem with extensive documentation
- Commander 14.x works on Node 20+; for Node 24, Commander 15+ is appropriate

**Cons:**
- Commander 15+ requires Node.js v22.12.0+ (uses `require(esm)`)
- No built-in progress bars or spinners (use `ora` for those)

**Confidence: High**

### 4.2 Output formatting libraries

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| `chalk` | 5.x (ESM-only) | Terminal string styling (colors, bold, etc.) | High |
| `ora` | 8.x | Terminal spinners for long-running operations (spec parsing, file generation) | High |
| `cli-table3` | 0.6.x | ASCII tables for summary output (e.g., conversion report) | High |
| `figures` | 6.x | Unicode symbols (checkmarks, crosses, warnings) | Medium |
| `log-symbols` | 6.x | Colored `info`, `success`, `warning`, `error` symbols | Medium |

**Recommendation:** Use `chalk` for coloring, `ora` for spinners during generation, and `cli-table3` for the conversion summary table. `log-symbols` is a nice-to-have for consistent output icons.

**Important note:** `chalk` 5.x, `ora` 8.x, and `figures` 6.x are all ESM-only. Since this project targets dual CJS/ESM output, you need to either:
- Use ESM-only for the CLI binary (which runs as ESM) and CJS for the library API
- Use the CommonJS-compatible older versions (chalk 4.x) — but this is a downgrade

**Recommended approach:** Make the CLI entry point ESM (`.mjs` or `"type": "module"` in `package.json`) and keep the library API available in both CJS and ESM. The ESM-only dependencies are only used by the CLI layer, not the library core.

### 4.3 What NOT to use for CLI:

| Library | Why not |
|---------|---------|
| `yargs` | More complex API, less intuitive subcommand support, larger bundle |
| `cac` | Lighter but less mature ecosystem |
| `clipanion` | Type-safe but requires more boilerplate |
| `ink` (React CLI) | Overkill for a non-interactive generator |

---

## 5. TypeScript Build: Dual CJS/ESM

### 5.1 Recommended Configuration

**`package.json`:**
```json
{
  "name": "bruno-gen",
  "type": "module",
  "main": "./dist/cjs/index.js",
  "module": "./dist/esm/index.js",
  "types": "./dist/types/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/types/index.d.ts",
        "default": "./dist/esm/index.js"
      },
      "require": {
        "types": "./dist/types/index.d.ts",
        "default": "./dist/cjs/index.js"
      }
    }
  },
  "bin": {
    "bruno-gen": "./dist/esm/cli.js"
  },
  "files": ["dist"]
}
```

**`tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Build script approach:**
1. Build ESM output: `tsc --outDir dist/esm`
2. Build CJS output: `tsc --outDir dist/cjs --module CommonJS --moduleResolution node`
3. Or use `tshy` or `tsup` for automated dual builds

**Recommended tool: `tsup`** — single config, handles dual output, DCE, and minification:
```ts
// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
});
```

### 5.2 Dual Package Pitfalls

| Issue | Description | Prevention |
|-------|-------------|------------|
| False ESM / False CJS | `.d.ts` files reference paths that differ between CJS/ESM builds | Use `tshy` or `tsup` which handle this correctly |
| `__dirname` not available in ESM | CJS uses `__dirname`; ESM uses `import.meta.url` | Use `node:url`'s `fileURLToPath(import.meta.url)` in ESM |
| Conditional exports mismatch | `require()` and `import()` resolve to different code with different behavior | Test both entry points |
| ESM-only dependencies | `chalk` 5+, `ora` 8+ are ESM-only | Confine them to the CLI (ESM) layer; library core uses no ESM-only deps |

**Confidence: High**

---

## 6. Code Generation: Templates vs. String Builders

### 6.1 String Builders — **RECOMMENDED**

**Approach:** Write TypeScript functions that construct `.bru` DSL output through string concatenation or template literals.

```ts
function buildRequestBru(request: IRRequest): string {
  const parts: string[] = [];

  // meta block
  parts.push("meta {");
  parts.push(`  name: ${escapeBruValue(request.name)}`);
  parts.push(`  type: http`);
  parts.push(`  seq: ${request.seq}`);
  parts.push("}");
  parts.push("");

  // HTTP method block
  parts.push(`${request.method} {`);
  parts.push(`  url: ${request.url}`);
  if (request.bodyType) parts.push(`  body: ${request.bodyType}`);
  parts.push(`  auth: ${request.auth || "inherit"}`);
  parts.push("}");
  // ... etc

  return parts.join("\n");
}
```

**Pros:**
- Full TypeScript type safety — compiler catches invalid structures
- No template engine learning curve
- Easy to test (pure functions)
- No escaping/quoting issues from template engine interpolation
- Direct control over output formatting
- Zero dependencies

**Cons:**
- More verbose than template engines for complex structures
- Manual formatting control (indentation, newlines)

**Confidence: High**

### 6.2 Template Engines

| Engine | Version | Assessment |
|--------|---------|------------|
| `ejs` | 3.x | Familiar to web devs, but adds a dependency and runtime compilation. The `.bru` DSL is too simple to justify a template engine. |
| `handlebars` | 4.x | Good for HTML, but Bruno DSL is not HTML-like. Helpers system is overkill. |
| Mustache | Various | Logic-less, but you need logic (conditional blocks, array iteration). |

**Recommendation: Do not use a template engine.** The `.bru` DSL is simple enough that typed builder functions are cleaner, more testable, and have zero dependencies. Template engines add runtime compilation overhead and lose TypeScript type safety.

**Confidence: High (that string builders are the right choice)**

---

## 7. Testing

### 7.1 `vitest` — **RECOMMENDED**

| Attribute | Value |
|-----------|-------|
| Latest version | 3.x+ (active in 2025-2026) |
| Node requirement | 18+ |
| License | MIT |

**Why Vitest over Jest for this project:**
- Native TypeScript support via `esbuild` — no `ts-jest` or `babel-jest` configuration needed
- ESM-native (matches this project's `"type": "module"`)
- Faster than Jest (uses Vite's bundling pipeline)
- Jest's ecosystem is mature, but Vitest has reached feature parity for CLI library testing
- Built-in coverage via `v8`
- `--watch` mode is significantly faster

**Configuration:**
```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
    },
  },
});
```

**Confidence: High**

### 7.2 `jest` with `ts-jest` — Viable alternative

| Attribute | Value |
|-----------|-------|
| Latest version | 29.x (stable) |
| TypeScript support | via `ts-jest` or `babel-jest` |

**Pros:**
- Largest ecosystem (mock libraries, reporters, etc.)
- Well-understood by most TS developers
- Snapshot testing is mature

**Cons:**
- Requires `ts-jest` or `babel-jest` for TypeScript — adds configuration complexity
- Slower than Vitest
- ESM support is experimental/complex
- Jest 30 is in progress but not stable

**Confidence: Medium** — works, but Vitest is a better fit for an ESM-native Node 24 project.

### 7.3 Testing strategies specific to this project

| Strategy | Tool | Purpose |
|----------|------|---------|
| Golden file tests | Vitest `expect(actual).toMatchFileSnapshot(path)` | Compare generated `.bru` output against known-good fixtures |
| Unit tests for parsers | Vitest `describe/it` | Test each parser (OpenAPI, Swagger, GraphQL) in isolation |
| Unit tests for generators | Vitest `describe/it` | Test IR → `.bru` conversion functions |
| Integration tests | Vitest + temp directories | Full pipeline: spec file → `.bru` files on disk → validate with Bruno CLI |
| Property-based tests | `fast-check` | Generate random OpenAPI specs and verify output consistency |
| Spec validation tests | Custom | Test against real-world OpenAPI specs (Stripe, GitHub, etc.) |

**Confidence: High**

---

## 8. Full Stack Summary

| Layer | Choice | Version | Confidence |
|-------|--------|---------|------------|
| OpenAPI/Swagger parsing | `@apidevtools/swagger-parser` | 12.x | High |
| YAML loading | `js-yaml` | 4.x | High |
| OpenAPI types | `openapi-types` | 12.x | High |
| GraphQL parsing | `graphql` | 16.x | High |
| CLI framework | `commander` | 14.x or 15.x | High |
| Output coloring | `chalk` | 5.x | High |
| Spinners | `ora` | 8.x | High |
| Tables | `cli-table3` | 0.6.x | High |
| Code generation | String builders (no engine) | N/A | High |
| TypeScript build | `tsup` | 0.x (latest) | High |
| Testing | `vitest` | 3.x | High |
| Property-based testing | `fast-check` | 3.x | Medium |
| Linting | `eslint` + `typescript-eslint` | latest | High |
| Formatting | `prettier` | 3.x | High |

---

## 9. What NOT to Use (Summary)

| Category | Avoid | Reason |
|----------|-------|--------|
| OpenAPI parsing | `openapi-typescript` | It generates TS types from specs, not a runtime parser |
| OpenAPI parsing | `swagger-parser` (Java) | Wrong ecosystem |
| GraphQL parsing | `@apollo/server` | Full server runtime — wrong tool |
| CLI framework | `yargs` | More complex, less intuitive for this use case |
| CLI framework | `ink` | React-based, overkill for a generator CLI |
| Template engine | `ejs`, `handlebars`, `mustache` | Loses type safety; string builders are simpler and safer |
| Testing | `jest` + `ts-jest` | Viable but slower and harder ESM setup vs. Vitest |
| Packaging | Manual dual build scripts | Use `tsup` or `tshy` — they handle edge cases you'll miss |
| Output format | OpenCollection YAML (for now) | Bruno 3.0 just introduced it; `.bru` DSL is the stable, documented format |
