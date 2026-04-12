# gen-bruno

Convert OpenAPI 3.x, Swagger 2.0, and GraphQL schemas into fully functional Bruno API collections with one command. Available as a CLI tool and a programmatic JavaScript/TypeScript library.

```bash
gen-bruno ./openapi.yaml ./output
```

## Features

- **OpenAPI 3.x** — Full support for paths, parameters, request bodies, responses, and examples
- **Swagger 2.0** — Legacy Swagger specs automatically normalized and converted
- **GraphQL** — SDL schemas converted to Bruno collections with query/mutation folders
- **Authentication** — Bearer, Basic, API Key, OAuth2, and OpenID Connect security schemes
- **Examples** — Preserves spec examples and auto-generates placeholder values from schemas
- **Folder grouping** — Organize by tags, URL paths, or flat structure
- **Plugins** — Transform the IR or modify .bru output before writing
- **Config files** — `brunogen.config.yml` for reproducible, team-shared settings
- **Dual ESM/CJS** — Works in both `import` and `require` projects

## Quick Start

```bash
# Install globally
npm install -g gen-bruno

# Generate from a spec file
gen-bruno ./openapi.yaml ./output

# Or use npx without installing
npx gen-bruno ./openapi.yaml ./output

# Open the output folder in Bruno — done
```

## Installation

```bash
# Global CLI
npm install -g gen-bruno

# Or as a project dependency
npm install gen-bruno
```

**Requires Node.js 24+**.

## CLI Usage

```bash
gen-bruno [spec] [output] [options]
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `<spec>` | Path to OpenAPI, Swagger, or GraphQL spec file | _(required)_ |
| `[output]` | Output directory for the Bruno collection | `./bruno-output` |
| `--format <tag\|path\|flat>` | Folder grouping strategy | `tag` |
| `--tests` | Generate post-response test assertions | off |
| `--dry-run` | Print tree to stdout without writing files | off |
| `--config <path>` | Path to config file | auto-discover |
| `--verbose` | Include stack traces in error output | off |

### Examples

```bash
# OpenAPI spec → Bruno collection (grouped by tag)
gen-bruno ./openapi.yaml ./output

# GraphQL schema with test assertions
gen-bruno ./schema.graphql ./output --tests

# Dry run to preview parsed spec
gen-bruno ./openapi.yaml ./output --dry-run

# Group requests by URL path instead of tags
gen-bruno ./openapi.yaml ./output --format path

# Use a config file with overrides
gen-bruno --config ./brunogen.config.yaml --tests --verbose
```

### Folder Grouping Strategies

- **`tag`** (default) — Groups requests by their OpenAPI tags into Bruno folders
- **`path`** — Groups by URL path structure (`/users`, `/users/{id}`, etc.)
- **`flat`** — All requests in a single folder, no grouping

## Config File

Place `brunogen.config.yml` (or `.json`) in your project root. The CLI auto-discovers it.

```yaml
# brunogen.config.yml
spec: ./openapi.yaml        # Default spec path (CLI <spec> overrides)
output: ./bruno-output      # Default output directory
format: tag                 # Folder grouping: tag | path | flat
tests: false                # Generate test assertions
force: false                # Overwrite existing output directory
# plugins:                  # Plugin file paths (optional)
#   - ./plugins/add-headers.js
```

**Merge priority** (lowest → highest): Built-in defaults < config file < CLI flags.

## Library API

Use programmatically in your own scripts. Supports both ESM and CommonJS.

### Basic Usage

```ts
import { generate, parse } from "gen-bruno";

const ir = await parse("./openapi.yaml");

const result = await generate(ir, {
  outputDir: "./output",
  grouping: "tag",       // "tag" | "path" | "flat"
  generateTests: false,  // Include post-response test assertions
  force: false,          // Overwrite existing output
});

console.log(`Generated ${result.filesWritten.length} files`);
```

### `parse(input)`

Unified spec parser. Accepts file paths to OpenAPI 3.x YAML/JSON, Swagger 2.0, or GraphQL SDL files.

```ts
import { parse } from "gen-bruno";

// OpenAPI 3.x
const ir = await parse("./openapi.yaml");

// Swagger 2.0
const ir = await parse("./swagger.json");

// GraphQL SDL
const ir = await parse("./schema.graphql");
```

Returns a `CollectionIR` object with normalized endpoints, parameters, security schemes, and response schemas.

### `CollectionBuilder`

Fluent builder API for chaining configuration and generation.

```ts
import { CollectionBuilder } from "gen-bruno";

// From a spec file
const result = await CollectionBuilder.fromSpec("./openapi.yaml")
  .withOptions({ grouping: "path", generateTests: true })
  .withPlugins([myHeaderPlugin])
  .generate("./output");

// Reuse the same builder for different outputs
const builder = CollectionBuilder.fromSpec("./openapi.yaml");

await builder.withOptions({ grouping: "tag" }).generate("./out-tag");
await builder.withOptions({ grouping: "flat" }).generate("./out-flat");
```

### `loadConfig(cwd?, configPath?)`

Load and merge a config file from the filesystem.

```ts
import { loadConfig } from "gen-bruno";

// Auto-discover config in CWD
const config = await loadConfig();

// Load specific config file
const config = await loadConfig(process.cwd(), "./config/brunogen.yaml");
```

### `mergeConfig(defaults, configFile, cliFlags)`

Three-layer config merge utility.

```ts
import { mergeConfig } from "gen-bruno";

const merged = mergeConfig(
  { format: "tag", tests: false },   // Built-in defaults
  { spec: "./api.yaml", tests: true }, // Config file
  { format: "path" },                // CLI flags
);

// Result: { spec: "./api.yaml", format: "path", tests: true }
```

## Plugins

Plugins let you transform the IR before generation or modify .bru content before writing.

### Plugin Interface

```ts
interface Plugin {
  name: string;
  hooks: {
    // Transform the CollectionIR after parsing, before generation
    transformIR?: (ir: CollectionIR, ctx: PluginContext) => Promise<CollectionIR>;
    // Transform file content right before writing
    preOutput?: (content: string, ctx: PreOutputContext) => Promise<string>;
  };
}
```

### Example: Add a Custom Header

```ts
const addHeaderPlugin: Plugin = {
  name: "add-custom-header",
  hooks: {
    preOutput: async (content) => {
      return content.includes("method:")
        ? content + "\nheader: X-Custom-Header: my-value\n"
        : content;
    },
  },
};
```

### Example: Auth Header Injection

```ts
import type { Plugin } from "gen-bruno";

const authPlugin: Plugin = {
  name: "auth-header-injector",
  hooks: {
    transformIR: async (ir) => ({
      ...ir,
      endpoints: ir.endpoints.map((ep) => ({
        ...ep,
        headers: [
          ...(ep.headers || []),
          { name: "Authorization", value: "{{apiKey}}", required: true },
        ],
      })),
    }),
  },
};

// Use via CollectionBuilder
await CollectionBuilder.fromSpec("./openapi.yaml")
  .withPlugins([authPlugin])
  .generate("./output");
```

### Using Plugins

**Via config file:**
```yaml
plugins:
  - ./plugins/add-headers.js
  - ./plugins/auth-injector.js
```

**Via builder API:**
```ts
await CollectionBuilder.fromSpec("./api.yaml")
  .withPlugins([plugin1, plugin2])
  .generate("./output");
```

**Via `generate()` function:**
```ts
await generate(ir, {
  outputDir: "./output",
  plugins: [myPlugin],
});
```

## Output Structure

The generator produces a complete Bruno collection directory:

```
output/
├── bruno.json                    # Bruno collection metadata
├── collection.bru                # Collection-level config (meta, auth, vars, docs)
├── environments/
│   └── default.bru               # Environment variables (auth tokens, etc.)
├── Weather/                      # Folder per tag (or path segment)
│   └── getweatherdata.bru        # One .bru file per endpoint
└── Users/
    ├── createuser.bru
    ├── getuser.bru
    └── updateuser.bru
```

Each `.bru` file contains the full request definition — method, URL, parameters, headers, body, auth, tests, and docs — ready to use in Bruno.

## Troubleshooting

### No output generated
- Verify the spec file path is correct and accessible
- Check that the spec is valid OpenAPI 3.x, Swagger 2.0, or GraphQL SDL
- Run with `--verbose` to see detailed error output including stack traces

### Invalid Bruno output
- Validate your spec first: `gen-bruno ./openapi.yaml ./output --dry-run`
- Check for unsupported features in the warnings output
- Ensure `$ref` references in your spec resolve correctly

### Module not found
- Ensure you're running **Node.js 24 or higher** (`node --version`)
- For ESM projects: use `import { generate } from "gen-bruno"`
- For CommonJS projects: use `const { generate } = require("gen-bruno")`

### Plugin not loaded
- Verify the plugin file path is correct (relative to CWD or absolute)
- Ensure the plugin exports an object with `name` and `hooks` properties
- Check that each hook is an async function returning the transformed value

### Config file not discovered
- Place `brunogen.config.yml` or `brunogen.config.json` in your project root
- Or specify explicitly: `gen-bruno --config ./path/to/config.yaml`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests: `npm test`
5. Ensure build passes: `npm run build`
6. Check linting: `npm run lint && npm run format:check`
7. Open a Pull Request

All contributions welcome — bug fixes, new features, docs improvements, and real-world spec validation.
