# Architecture: Bruno Collection Generator

> Research date: April 2026
> Target: Node.js 24, TypeScript 6
> Purpose: Component architecture, data flow, and build order for the CLI + library

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI Layer                                │
│   commander  •  options parsing  •  output formatting            │
│   (chalk, ora, cli-table3)                                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Library API                                 │
│   generate(input, options)  •  CollectionBuilder fluent API      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Config System                               │
│   Config file discovery (brunogen.config.yml)                    │
│   Merge strategy: defaults < config file < CLI flags            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Parser Layer                                 │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ OpenAPI 3.x  │  │ Swagger 2.0  │  │  GraphQL SDL │          │
│  │   Parser     │  │   Parser     │  │   Parser     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌─────────────────────────────────────────────────┐           │
│  │          Intermediate Representation (IR)         │           │
│  │     Version-agnostic, fully-resolved model        │           │
│  └──────────────────────┬──────────────────────────┘           │
│                         │                                      │
│                         ▼                                      │
│              ┌─────────────────────┐                           │
│              │  IR Transformers     │                           │
│              │  (config overrides,  │                           │
│              │   plugin hooks)      │                           │
│              └─────────────────────┘                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Generator Layer                               │
│                                                                  │
│  ┌──────────────────┐     ┌──────────────────┐                  │
│  │  Collection      │     │  Request         │                  │
│  │  Generator       │     │  Generator       │                  │
│  │  (collection.bru)│     │  (request.bru)   │                  │
│  └────────┬─────────┘     └────────┬─────────┘                  │
│           │                        │                             │
│           ▼                        ▼                             │
│  ┌──────────────────┐     ┌──────────────────┐                  │
│  │  Environment     │     │  Folder          │                  │
│  │  Generator       │     │  Generator       │                  │
│  │  (envs/*.bru)    │     │  (folder.bru)    │                  │
│  └──────────────────┘     └──────────────────┘                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Output Layer                                 │
│   File system ops  •  Directory structure creation               │
│   Path sanitization  •  Atomic writes                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Details

### 2.1 Parser Layer

**Goal:** Accept multiple input formats and produce a single, unified Intermediate Representation (IR).

#### Parsers

| Parser | Input | Library | Output |
|--------|-------|---------|--------|
| `OpenApiParser` | OpenAPI 3.0.x, 3.1.x (JSON/YAML) | `@apidevtools/swagger-parser` | IR |
| `SwaggerParser` | Swagger/OpenAPI 2.0 (JSON/YAML) | `@apidevtools/swagger-parser` (with 2.0→3.0 normalization) | IR |
| `GraphQLParser` | GraphQL SDL string or introspection JSON | `graphql` (parse, buildSchema, introspectionFromSchema) | IR |

**Parser interface:**
```ts
interface SpecParser {
  /** Detect if this parser can handle the given input */
  canParse(input: SpecInput): boolean;

  /** Parse the spec and return the IR */
  parse(input: SpecInput, options?: ParseOptions): Promise<CollectionIR>;

  /** Validate the spec before parsing */
  validate(input: SpecInput): Promise<ValidationResult>;
}
```

**Parser responsibilities:**
1. Load the spec file (detect JSON vs YAML via extension)
2. Resolve all `$ref` references (dereference)
3. Validate the spec structure
4. Map the spec's concepts to IR types
5. Report unparseable sections (for error reporting)

**Key design decision:** Use `@apidevtools/swagger-parser` for both OpenAPI and Swagger parsing. For Swagger 2.0, apply a normalization layer that maps 2.0 concepts to their 3.0 equivalents before IR construction (see Pitfalls section for specifics).

#### Auto-detection

The library should auto-detect the input format:
1. Check file extension (`.yaml`, `.yml`, `.json`, `.gql`, `.graphql`)
2. For unknown extensions, attempt JSON parse; if that fails, attempt YAML parse
3. Check `openapi` field (OpenAPI 3.x) vs `swagger` field (Swagger 2.0) vs GraphQL SDL syntax
4. Fall back to user-specified `--format` CLI flag

---

### 2.2 Intermediate Representation (IR)

**Goal:** A version-agnostic TypeScript type system that captures all relevant spec concepts needed for Bruno collection generation.

**Design principles:**
- **No version-specific fields** — the IR should not have `openapi3Field` or `swagger2Field`
- **Fully resolved** — no unresolved `$ref` pointers
- **Nullable-aware** — distinguish between "not present" and "explicitly null"
- **Extensible** — plugin system can attach metadata to IR nodes

#### Core IR Types

```ts
// ─── Root ───────────────────────────────────────────────────────

interface CollectionIR {
  info: CollectionInfo;
  servers: Server[];
  securitySchemes: Record<string, SecurityScheme>;
  defaultSecurity: SecurityRequirement[];
  tags: Tag[];
  endpoints: EndpointIR[];
  webhooks?: EndpointIR[];        // OpenAPI 3.1 webhooks
  components: {
    schemas: Record<string, SchemaIR>;
    parameters: Record<string, ParameterIR>;
    responses: Record<string, ResponseIR>;
    requestBodies: Record<string, RequestBodyIR>;
  };
  extensions: Record<string, unknown>; // x-* extensions
}

interface CollectionInfo {
  title: string;
  description?: string;
  version: string;
  contact?: { name?: string; email?: string; url?: string };
  license?: { name: string; url?: string };
}

// ─── Servers ────────────────────────────────────────────────────

interface Server {
  url: string;
  description?: string;
  variables: Record<string, ServerVariable>;
}

interface ServerVariable {
  default: string;
  enum?: string[];
  description?: string;
}

// ─── Security ───────────────────────────────────────────────────

type SecurityScheme =
  | HttpSecurityScheme
  | ApiKeySecurityScheme
  | OAuth2SecurityScheme
  | OpenIdConnectSecurityScheme;

interface HttpSecurityScheme {
  type: "http";
  scheme: "basic" | "bearer" | "digest";
  bearerFormat?: string;
  description?: string;
}

interface ApiKeySecurityScheme {
  type: "apiKey";
  name: string;
  in: "header" | "query" | "cookie";
  description?: string;
}

interface OAuth2SecurityScheme {
  type: "oauth2";
  flows: OAuth2Flows;
  description?: string;
}

interface OAuth2Flows {
  authorizationCode?: OAuth2Flow;
  implicit?: OAuth2ImplicitFlow;
  password?: OAuth2Flow;
  clientCredentials?: OAuth2Flow;
}

interface OAuth2Flow {
  authorizationUrl?: string;
  tokenUrl: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

interface OpenIdConnectSecurityScheme {
  type: "openIdConnect";
  openIdConnectUrl: string;
  description?: string;
}

interface SecurityRequirement {
  [schemeName: string]: string[]; // scheme name -> scopes
}

// ─── Endpoints ──────────────────────────────────────────────────

interface EndpointIR {
  id: string;                    // operationId or generated "method-path"
  method: HttpMethod;
  path: string;                  // e.g., "/users/{id}"
  summary?: string;
  description?: string;
  tags: string[];
  deprecated: boolean;

  // Parameters
  parameters: ParameterIR[];     // path, query, header, cookie params

  // Request body
  requestBody?: RequestBodyIR;

  // Security (endpoint-level overrides collection-level)
  security?: SecurityRequirement[];

  // Responses
  responses: ResponseIR[];

  // For request chaining
  producesContentType?: string;
  consumesContentTypes: string[];
}

type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "head" | "options" | "trace";

// ─── Parameters ─────────────────────────────────────────────────

interface ParameterIR {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required: boolean;
  description?: string;
  deprecated: boolean;
  schema: SchemaIR;
  example?: unknown;
  examples?: Record<string, ExampleObject>;
}

// ─── Request Body ───────────────────────────────────────────────

interface RequestBodyIR {
  description?: string;
  required: boolean;
  content: Record<string, MediaTypeIR>; // mime type -> media type
}

interface MediaTypeIR {
  schema: SchemaIR;
  example?: unknown;
  examples?: Record<string, ExampleObject>;
  encoding?: Record<string, EncodingObject>;
}

// ─── Responses ──────────────────────────────────────────────────

interface ResponseIR {
  statusCode: string;            // "200", "4XX", "default", etc.
  description: string;
  headers: Record<string, HeaderIR>;
  content: Record<string, MediaTypeIR>;
  links?: Record<string, LinkObject>; // For request chaining
}

interface HeaderIR {
  description?: string;
  required: boolean;
  schema: SchemaIR;
}

// ─── Schema (Unified) ───────────────────────────────────────────

interface SchemaIR {
  type?: SchemaType | SchemaType[];  // OpenAPI 3.1 allows array
  format?: string;
  title?: string;
  description?: string;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;

  // Scalar constraints
  enum?: unknown[];
  default?: unknown;
  example?: unknown;

  // String
  minLength?: number;
  maxLength?: number;
  pattern?: string;

  // Number
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  multipleOf?: number;

  // Array
  items?: SchemaIR;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;

  // Object
  properties?: Record<string, SchemaIR>;
  required?: string[];
  additionalProperties?: boolean | SchemaIR;
  minProperties?: number;
  maxProperties?: number;

  // Composition
  allOf?: SchemaIR[];
  oneOf?: SchemaIR[];
  anyOf?: SchemaIR[];
  discriminator?: DiscriminatorObject;

  // Reference (already resolved, but track origin)
  $ref?: string;                 // Original $ref path, if any
  resolvedName?: string;         // e.g., "User" from "#/components/schemas/User"
}

type SchemaType = "string" | "number" | "integer" | "boolean" | "array" | "object" | "null";

// ─── GraphQL-specific IR extensions ─────────────────────────────

interface GraphQLEndpointExtension {
  operationType: "query" | "mutation" | "subscription";
  operationName: string;
  arguments: GraphQlArgumentIR[];
  returnType: SchemaIR;
  description?: string;
  directives: string[];
}

interface GraphQlArgumentIR {
  name: string;
  type: SchemaIR;
  defaultValue?: unknown;
  description?: string;
  directives: string[];
}

// ─── Helpers ────────────────────────────────────────────────────

interface ExampleObject {
  summary?: string;
  description?: string;
  value: unknown;
  externalValue?: string;
}

interface DiscriminatorObject {
  propertyName: string;
  mapping?: Record<string, string>;
}

interface Tag {
  name: string;
  description?: string;
  externalDocs?: { url: string; description?: string };
}

interface EncodingObject {
  contentType?: string;
  headers?: Record<string, HeaderIR>;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
}

interface LinkObject {
  operationRef?: string;
  operationId?: string;
  parameters?: Record<string, string>;
  requestBody?: string;
  description?: string;
  server?: Server;
}
```

#### GraphQL → IR Mapping

GraphQL requires special mapping because it is not HTTP-native:

| GraphQL Concept | IR Representation |
|-----------------|-------------------|
| Query/Mutation type | HTTP method `post` (all GraphQL ops are POST) |
| Query field name | Path: `/graphql` |
| Operation name | `id` and request name |
| Arguments | Combined as JSON body in `requestBody` |
| Return type | Response schema |
| Custom scalars | Schema type `string` with `format: "custom-scalar-<name>"` |
| Union/Interface types | `oneOf` in SchemaIR |
| Directives | Stored in extensions for plugin use |

Each GraphQL operation becomes an `EndpointIR` with:
- `method: "post"`
- `path: "/graphql"` (or configured endpoint)
- `requestBody` containing the GraphQL query/mutation as JSON
- Tags derived from the GraphQL type they belong to

---

### 2.3 Generator Layer

**Goal:** Transform IR into Bruno `.bru` files using typed builder functions.

#### Generator Interface

```ts
interface Generator {
  /** Generate all files for a collection */
  generate(ir: CollectionIR, options: GeneratorOptions): Promise<GenerateResult>;
}

interface GeneratorOptions {
  outputDir: string;
  groupingStrategy: "tag" | "path" | "flat";
  envStrategy: "auto" | "manual" | "none";
  testGeneration: "none" | "basic" | "full";
  dryRun: boolean;
  config?: UserConfig;
}

interface GenerateResult {
  filesWritten: string[];
  filesSkipped: string[];
  warnings: Warning[];
  errors: Error[];
}
```

#### File Structure Output

```
output/
├── collection.bru              # Collection-level settings, auth, vars, scripts
├── environments/
│   ├── dev.bru                 # Development environment variables
│   ├── staging.bru             # Staging environment variables
│   └── prod.bru                # Production environment variables
├── Users/                      # Tag-based grouping
│   ├── folder.bru
│   ├── Get Users.bru
│   ├── Create User.bru
│   └── Get User by ID.bru
├── Orders/
│   ├── folder.bru
│   ├── List Orders.bru
│   └── Create Order.bru
└── Auth/
    ├── folder.bru
    └── Login.bru
```

#### Builder Pattern for .bru Output

Each block type gets a dedicated builder function:

```
src/generators/
├── index.ts                    # Main Generator class
├── collection.ts               # collection.bru builder
├── request.ts                  # request.bru builder
├── folder.ts                   # folder.bru builder
├── environment.ts              # environment .bru builder
├── blocks/
│   ├── meta.ts                 # meta { } block
│   ├── http-method.ts          # get/post/put/etc. blocks
│   ├── headers.ts              # headers { } block
│   ├── params.ts               # params:query { } etc.
│   ├── body.ts                 # body:json, body:xml, etc.
│   ├── auth.ts                 # auth:bearer, auth:basic, etc.
│   ├── script.ts               # script:pre-request, script:post-response
│   ├── tests.ts                # tests { } block
│   ├── settings.ts             # settings { } block
│   ├── docs.ts                 # docs { } block
│   └── vars.ts                 # vars:pre-request, vars:post-response
├── scripts/
│   ├── auth-scripts.ts         # Generated auth pre-scripts (e.g., token refresh)
│   └── test-assertions.ts      # Generated test assertions from response schemas
└── utils/
    ├── bru-escape.ts           # Escaping/quoting for .bru values
    └── path-sanitizer.ts       # Sanitize operation names for filenames
```

**Collection builder** produces:
- `collection.bru` with headers, auth, vars, scripts, docs
- One environment file per server URL found in spec

**Request builder** produces:
- One `.bru` file per endpoint
- Proper `meta`, HTTP method, params, headers, body, auth, scripts, tests

**Key design decision: String builders over template engines.** Each block builder is a pure TypeScript function that returns a string. This gives full type safety and zero dependencies. See STACK.md section 6 for justification.

---

### 2.4 Output Layer

**Goal:** Write generated `.bru` files to the filesystem with proper directory structure.

```ts
interface OutputWriter {
  /** Write all generated files to disk */
  write(files: GeneratedFile[]): Promise<WriteResult>;

  /** Dry run: return what would be written without writing */
  dryRun(files: GeneratedFile[]): Promise<DryRunResult>;
}

interface GeneratedFile {
  path: string;                 // Relative to output dir
  content: string;
}
```

**Responsibilities:**
1. Create output directory and all subdirectories
2. Write files atomically (write to temp, then rename)
3. Handle file conflicts (existing collection — append vs. overwrite mode)
4. Path sanitization for filenames
5. Dry-run mode (return diff without writing)

---

### 2.5 CLI Layer

```
bruno-gen <input> [options]

Arguments:
  input                    Path or URL to API spec file

Options:
  -o, --output <dir>       Output directory (default: ./bruno-collection)
  -f, --format <format>    Input format: openapi, swagger, graphql (auto-detected)
  -g, --grouping <strategy> Folder grouping: tag, path, flat (default: tag)
  -e, --env <strategy>     Environment generation: auto, manual, none (default: auto)
  -t, --tests <level>      Test generation: none, basic, full (default: basic)
  -c, --config <path>      Path to config file
  --dry-run                Show what would be generated without writing files
  --no-color               Disable colored output
  --validate-only          Only validate the input spec, don't generate
  -v, --verbose            Verbose output
  --version                Show version
  -h, --help               Show help
```

**CLI command flow:**
1. Parse arguments with Commander
2. Load and merge config (see Config System)
3. Start spinner (`ora`)
4. Validate input spec
5. Parse spec → IR
6. Apply config overrides to IR
7. Generate .bru files
8. Write files to disk (or dry-run)
9. Print summary table (`cli-table3`)
10. Exit with appropriate code (0 = success, 1 = errors, 2 = partial)

---

### 2.6 Library API

The library exports two interfaces:

#### Functional API
```ts
import { generate } from "bruno-gen";

const result = await generate("./openapi.yaml", {
  outputDir: "./bruno-collection",
  groupingStrategy: "tag",
  envStrategy: "auto",
  testGeneration: "basic",
});
```

#### Fluent Builder API
```ts
import { CollectionBuilder } from "bruno-gen";

const builder = new CollectionBuilder()
  .fromOpenAPI("./openapi.yaml")
  .groupBy("tag")
  .withEnvironments("auto")
  .withTests("full")
  .withConfig("./brunogen.config.yml")
  .dryRun(false);

const result = await builder.generate();
```

Both APIs produce identical output — they are just different DX preferences.

---

### 2.7 Config System

#### Config Discovery

Search order (first match wins):
1. `--config` CLI flag (explicit path)
2. `brunogen.config.yml` in current working directory
3. `brunogen.config.json` in current working directory
4. `.brunogenrc.yml` / `.brunogenrc.json` in current working directory
5. `brunogen` field in nearest `package.json`
6. Defaults (hardcoded)

#### Config Schema

```ts
interface UserConfig {
  // Input
  input?: {
    format?: "openapi" | "swagger" | "graphql";
    validation?: "strict" | "warn" | "skip";
  };

  // Output
  output?: {
    dir?: string;
    grouping?: "tag" | "path" | "flat";
    environments?: "auto" | "manual" | "none";
    tests?: "none" | "basic" | "full";
  };

  // Overrides — target specific operations
  overrides?: OperationOverride[];

  // Script injection
  scripts?: {
    collectionPreRequest?: string;    // JS source code
    collectionPostResponse?: string;
    requestPreRequest?: string;
    requestPostResponse?: string;
  };

  // Variable mapping
  variables?: Record<string, VariableMapping>;

  // Plugins
  plugins?: string[];                 // Module paths
}

interface OperationOverride {
  // Targeting — at least one required
  operationId?: string;
  tag?: string;
  method?: string;
  pathPattern?: string;              // e.g., "/users/**"

  // Overrides
  name?: string;
  skip?: boolean;
  folder?: string;
  auth?: AuthOverride;
  headers?: Record<string, string>;
  preRequestScript?: string;
  postResponseScript?: string;
  tests?: TestOverride[];
}
```

#### Merge Strategy

```
defaults < config file < CLI flags

Arrays (overrides, plugins): deep merge (concatenate, deduplicate)
Objects (variables, headers): shallow merge (CLI wins over config wins over defaults)
Scalars: last one wins
```

**Confidence: High** — this is the standard config pattern used by ESLint, Prettier, and similar tools.

---

### 2.8 Plugin System

**Goal:** Allow third-party code to hook into the generation pipeline at defined extension points.

```ts
interface Plugin {
  name: string;

  /** Called after IR is constructed but before generation */
  transformIR?(ir: CollectionIR, context: PluginContext): CollectionIR | Promise<CollectionIR>;

  /** Called after .bru files are generated but before writing */
  preOutput?(files: GeneratedFile[], context: PluginContext): GeneratedFile[] | Promise<GeneratedFile[]>;

  /** Called after all files are written */
  postWrite?(result: GenerateResult, context: PluginContext): void | Promise<void>;
}

interface PluginContext {
  config: UserConfig;
  logger: PluginLogger;
  inputSpec: SpecInput;
}
```

**Plugin registration:** Via config file:
```yaml
plugins:
  - ./my-plugin.ts
  - bruno-gen-plugin-auth
```

**Use cases:**
- Custom IR transformations (e.g., add custom headers to all requests)
- Custom test generation (e.g., fuzzing tests)
- Custom output post-processing (e.g., add collection-level docs)
- Custom environment variable injection

**Confidence: Medium** — this is a post-MVP feature. The hooks are designed now, but implementation can wait until after the core pipeline works.

---

## 3. Data Flow

```
Input file (openapi.yaml / schema.graphql / introspection.json)
  │
  ├─ Detect format (extension + content inspection)
  │
  ├─ Load spec (js-yaml or JSON.parse)
  │
  ├─ Validate spec (swagger-parser.validate or graphql validate)
  │
  ▼
Parser (OpenApiParser / SwaggerParser / GraphQLParser)
  │
  ├─ Resolve $refs (dereference)
  ├─ Normalize to 3.0+ concepts (for Swagger 2.0)
  ├─ Extract endpoints, schemas, auth, tags
  │
  ▼
CollectionIR (fully resolved, version-agnostic)
  │
  ├─ Apply config overrides (skip operations, rename, etc.)
  ├─ Apply plugin transformIR hooks
  ├─ Generate test assertions from response schemas
  ├─ Generate environment variables from servers
  │
  ▼
Enriched CollectionIR
  │
  ├─ Group endpoints by strategy (tag/path/flat)
  ├─ For each endpoint → build request.bru
  ├─ Build collection.bru
  ├─ Build environment .bru files
  ├─ Build folder.bru files
  │
  ▼
GeneratedFile[] (path + content pairs)
  │
  ├─ Apply plugin preOutput hooks
  ├─ Apply plugin postWrite hooks
  ├─ Sanitize paths
  ├─ Write atomically (temp file + rename)
  │
  ▼
Output directory with complete Bruno collection
```

---

## 4. Suggested Build Order (Phases)

### Phase 1: Foundation
- [ ] Project scaffold (tsconfig, package.json, tsup config)
- [ ] IR type system (all types from section 2.2)
- [ ] Bru DSL string builder utilities (escaping, block formatting)
- [ ] Output writer (file system ops, path sanitization)
- [ ] Basic CLI scaffolding with Commander (accepts input, prints help)

### Phase 2: OpenAPI Parser
- [ ] OpenAPI 3.x parser (endpoints, params, request bodies, responses)
- [ ] Schema-to-IR mapping (all SchemaIR fields)
- [ ] Security scheme mapping (http, apiKey)
- [ ] Server URL extraction
- [ ] Tag extraction

### Phase 3: Bruno Output Generator
- [ ] Request builder (meta, HTTP method, params, headers, body)
- [ ] Collection builder (headers, auth, vars, scripts)
- [ ] Environment file generator
- [ ] Folder structure generation
- [ ] Test assertion generator (basic: status code, content type)

### Phase 4: End-to-End Pipeline
- [ ] Wire parser → IR → generator → output
- [ ] CLI full pipeline with spinner and summary
- [ ] Config file discovery and merge
- [ ] Dry-run mode

### Phase 5: Test Generation
- [ ] JSON schema validation tests
- [ ] Required field presence tests
- [ ] Response structure tests
- [ ] Content-type assertion tests
- [ ] Response time threshold tests

### Phase 6: Swagger 2.0 Support
- [ ] Swagger 2.0 parser (with 2.0→3.0 normalization)
- [ ] Handle `produces`/`consumes` → `content` mapping
- [ ] Handle `basePath` + `host` + `schemes` → `servers` mapping
- [ ] Handle `definitions` → `components/schemas` mapping

### Phase 7: GraphQL Support
- [ ] GraphQL SDL parser
- [ ] Introspection endpoint support
- [ ] Query/mutation → EndpointIR mapping
- [ ] GraphQL-specific body generation (`body:graphql`)
- [ ] Handle union types, interfaces, custom scalars

### Phase 8: Advanced Features
- [ ] Auth handling (OAuth2 flows, collection-level auth inheritance)
- [ ] Pre/post script injection from config
- [ ] Config overrides (skip, rename, custom headers)
- [ ] OAuth2 flow mapping to Bruno auth
- [ ] Request chaining / workflow detection

### Phase 9: Library API & Polish
- [ ] Fluent CollectionBuilder class
- [ ] Functional generate() API
- [ ] Dual CJS/ESM build
- [ ] TypeScript declaration files
- [ ] Error reporting and validation
- [ ] Plugin system skeleton

### Phase 10: Testing & Release
- [ ] Golden file tests against real-world specs
- [ ] Property-based tests
- [ ] Integration tests (generate → run with `bru run`)
- [ ] Performance testing (1000+ endpoint specs)
- [ ] Documentation
- [ ] v1.0.0 release

---

## 5. Directory Structure

```
bruno-gen/
├── src/
│   ├── index.ts                  # Library entry point (exports generate, CollectionBuilder)
│   ├── cli.ts                    # CLI entry point (commander)
│   │
│   ├── ir/
│   │   ├── types.ts              # All IR type definitions
│   │   └── builders.ts           # IR construction helpers
│   │
│   ├── parsers/
│   │   ├── index.ts              # Parser registry + auto-detection
│   │   ├── openapi-parser.ts     # OpenAPI 3.x → IR
│   │   ├── swagger-parser.ts     # Swagger 2.0 → IR
│   │   ├── graphql-parser.ts     # GraphQL SDL/introspection → IR
│   │   └── utils.ts              # Shared parsing utilities
│   │
│   ├── generators/
│   │   ├── index.ts              # Main Generator class
│   │   ├── collection.ts         # collection.bru
│   │   ├── request.ts            # request.bru
│   │   ├── folder.ts             # folder.bru
│   │   ├── environment.ts        # environments/*.bru
│   │   ├── blocks/               # Individual .bru block builders
│   │   │   ├── meta.ts
│   │   │   ├── http-method.ts
│   │   │   ├── headers.ts
│   │   │   ├── params.ts
│   │   │   ├── body.ts
│   │   │   ├── auth.ts
│   │   │   ├── script.ts
│   │   │   ├── tests.ts
│   │   │   ├── settings.ts
│   │   │   ├── docs.ts
│   │   │   └── vars.ts
│   │   ├── scripts/
│   │   │   ├── auth-scripts.ts
│   │   │   └── test-assertions.ts
│   │   └── utils/
│   │       ├── bru-escape.ts
│   │       └── path-sanitizer.ts
│   │
│   ├── output/
│   │   ├── writer.ts             # File system operations
│   │   └── sanitizer.ts          # Path sanitization
│   │
│   ├── config/
│   │   ├── discovery.ts          # Config file discovery
│   │   ├── merge.ts              # Config merge strategy
│   │   ├── schema.ts             # Config type definitions + validation
│   │   └── overrides.ts          # Apply overrides to IR
│   │
│   ├── plugins/
│   │   ├── types.ts              # Plugin interface
│   │   └── runner.ts             # Plugin lifecycle runner
│   │
│   ├── tests/
│   │   ├── generator.ts          # Test assertion generation from schemas
│   │   └── assertions.ts         # Assertion DSL → Bruno tests
│   │
│   └── utils/
│       ├── errors.ts             # Custom error types
│       ├── logger.ts             # Structured logger
│       └── validation.ts         # Spec validation utilities
│
├── test/
│   ├── fixtures/                 # Input spec fixtures
│   │   ├── openapi3/
│   │   ├── swagger2/
│   │   └── graphql/
│   ├── golden/                   # Expected .bru output (golden files)
│   │   ├── openapi3/
│   │   ├── swagger2/
│   │   └── graphql/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── package.json
└── README.md
```

---

## 6. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Parser library | `@apidevtools/swagger-parser` | Single lib for all OpenAPI versions; dereference mode gives clean input for IR |
| Output format | `.bru` DSL (not OpenCollection YAML) | Stable, documented, git-friendly, Bruno's current primary format |
| Code generation | String builders (no template engine) | Type-safe, zero deps, easy to test, DSL is simple enough |
| IR design | Version-agnostic, fully-resolved | One generator pipeline works for all input formats |
| CLI framework | Commander | Industry standard, excellent TS support |
| Testing | Vitest | Native TS, ESM-native, fast, modern |
| Build tool | tsup | Handles dual CJS/ESM + declarations in one config |
| Config format | YAML primary, JSON secondary | YAML is more readable for config; JSON for programmatic use |
| Grouping strategy | Tag-based (default), path-based, flat | Matches what Bruno's own importer offers; tag-based is most common |
