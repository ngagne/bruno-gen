# Phase 1 Research: Project Scaffold & IR Types

**Research date:** 2026-04-06
**Phase:** 01-project-scaffold-ir-types
**Target runtime:** Node.js 24, TypeScript 6

---

## 1. Dependency Versions

| Package | Latest Version | Notes |
|---------|---------------|-------|
| `typescript` | **6.0.2** (Mar 23, 2026) | Strict mode now defaults to `true`. See TS 6.0 breaking changes below. |
| `tsup` | **8.5.1** | Zero-config bundler powered by esbuild. Supports dual CJS/ESM + DTS. |
| `vitest` | **4.1.2** | Requires Vite >= 6.0, Node.js >= 20. Native ESM. |
| `@vitest/coverage-v8` | **4.1.2** | Must match vitest major version. Separate install required. |
| `eslint` | **9.x** (latest 9.x) | Flat config is the default. v10 also supported by typescript-eslint. |
| `@eslint/js` | Bundled with eslint | Provides `eslint.configs.recommended`. |
| `typescript-eslint` | **8.58.0** (Mar 30, 2026) | Supports TypeScript 6, ESLint ^8.57 \|\| ^9 \|\| ^10. Single meta-package replaces old `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin`. |
| `prettier` | **3.8.1** (Jan 2026) | Stable 3.x line. No v4 yet. |
| `eslint-config-prettier` | Latest 9.x/10.x | Disables ESLint rules that conflict with Prettier. Flat-config compatible. |
| `@tsconfig/node24` | Available | Base tsconfig extending Node 24 defaults. Optional but recommended. |
| `actions/setup-node` | **v5.0.0+** (v6.3.0 latest) | v5+ runs on Node.js 24 natively. Use `node-version: '24'` in workflow. |

### TypeScript 6.0 Breaking Changes (Critical)

TypeScript 6.0 changes several defaults that directly affect this project:

| Option | Old Default | TS 6.0 Default | Action Needed |
|--------|------------|----------------|---------------|
| `strict` | `false` | `true` | Good — we want strict mode. No override needed. |
| `target` | `ES3` | `es2025` | We want `ES2022` — must set explicitly. |
| `module` | `CommonJS` | `es2022` | We want `NodeNext` — must set explicitly. |
| `moduleResolution` | `node10` | `bundler` | Resolved from `module` when set to `NodeNext`. |
| `rootDir` | Inferred | `.` (tsconfig dir) | **Must set `"rootDir": "./src"`** or output nests under `dist/src/`. |
| `types` | `["*"]` (all) | `[]` (none) | **Must set `"types": ["node", "vitest/globals"`]** or ambient types are missing. |
| `esModuleInterop` | `false` | `true` | Good — we want this. |
| `noUncheckedSideEffectImports` | `false` | `true` | May cause errors on bare `import "./polyfill"` — be aware. |

**Deprecated options that will error in TS 7.0:** `moduleResolution: node/node10/classic`, `module: amd/umd/system/none`, `baseUrl`, `outFile`, explicit `false` for `esModuleInterop`/`allowSyntheticDefaultImports`/`alwaysStrict`. None of these affect our config since we use modern values.

---

## 2. tsup Configuration

### Recommended `tsup.config.ts`

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,              // Generates .d.ts declaration files
  sourcemap: true,        // Source maps for debugging
  clean: true,            // Clean dist/ before each build
  splitting: true,        // Code splitting for ESM
  target: "es2022",       // Match our TypeScript target
  treeshake: true,        // Dead code elimination
  platform: "node",       // Node.js platform
  cjsInterop: true,       // Fixes default export naming in CJS
  bundle: false,          // false for library (keeps module structure); true for CLI
  external: [],           // Add peerDependencies here if any
});
```

### Key Decisions

- **`bundle: false`** for the library entry (`src/index.ts`) — keeps the module structure intact for tree-shaking by consumers. If you later add a CLI entry point (`src/cli.ts`), set `bundle: true` for that entry only via tsup's `defineConfig` function form.
- **`dts: true`** generates a single `.d.ts` file per entry. For complex type imports, use `dts: { resolve: true }` to ensure all referenced types are bundled into the declaration.
- **Dual output files:** ESM produces `.js`, CJS produces `.cjs` (when using tsup's default naming). The `package.json` `exports` field must map both.

### package.json `exports` for Dual Output

```json
{
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "bin": {
    "gen-bruno": "./dist/cli.js"
  }
}
```

### Gotchas

1. **`__dirname` is not available in ESM.** Use `node:url`'s `fileURLToPath(import.meta.url)` pattern. Confine this to utility modules.
2. **tsup with `bundle: false`** does not emit `.cjs`/`.d.cts` extensions by default — it creates separate `dist/cjs/` and `dist/esm/` directories. If you want flat file naming (`.cjs`/`.d.cts`), use `bundle: true` or configure `outExtension`.
3. **Alternative approach with directories:** Set `outDir` in tsup and use separate `format` outputs. tsup handles the `exports` mapping when you use `dts: true` with dual format.
4. **ESM-only dependencies** (`chalk` 5+, `ora` 8+) must only be imported from the CLI entry point, never from the library core. The CJS build will fail if it transitively requires an ESM-only package.

---

## 3. Vitest Configuration

### Recommended `vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
```

### Key Details

- **`@vitest/coverage-v8`** is a separate package — must be installed as dev dependency. Version must match vitest major (4.x for vitest 4.x).
- **`globals: true`** makes `describe`, `it`, `expect` available without imports. Convenient but adds globals to the TypeScript namespace — requires `"types": ["vitest/globals"]` in tsconfig (see TypeScript 6 `types` change above).
- **v8 vs Istanbul:** v8 is the default and recommended for Node.js. No pre-instrumentation needed. Faster execution and lower memory than Istanbul.
- **`thresholds`** causes the test run to fail if any metric falls below the percentage. Set to 80 per project requirements.
- **Golden file tests:** Use Vitest's `expect(actual).toMatchFileSnapshot(path)` for comparing generated `.bru` output against fixture files.

### Recommended npm Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Gotchas

1. **Vitest 4 requires Vite >= 6.0.** If you don't use Vite otherwise, `vitest` pulls it in as a dependency automatically.
2. **TypeScript 6 `types: []` default** means vitest globals won't be available unless you explicitly add `"types": ["vitest/globals"]` to tsconfig (when using `globals: true`).
3. **Coverage excludes test files by default.** If you want to count test files in coverage (you don't), you'd need to adjust `coverage.include`.
4. **v8 does not support Bun or Cloudflare Workers.** Not relevant for this Node.js 24 project, but worth noting if the project ever expands to other runtimes.

---

## 4. ESLint Flat Config with TypeScript

### Required Packages

```
eslint@^9
@eslint/js            (bundled with eslint)
typescript-eslint@^8  (meta-package, replaces old parser + plugin)
eslint-config-prettier (disables conflicting rules)
```

Note: `typescript-eslint` v8.58.0 is a single meta-package that bundles the parser, plugin, and configs. You no longer need to install `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` separately — they are re-exported through the meta-package.

### Recommended `eslint.config.js`

```js
// eslint.config.js — ESM flat config (project has "type": "module")
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  // Global ignores
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**"],
  },

  // Base ESLint recommended
  eslint.configs.recommended,

  // TypeScript recommended (parser + plugin rules)
  ...tseslint.configs.recommended,

  // TypeScript strict (additional bug-catching rules)
  ...tseslint.configs.strict,

  // TypeScript stylistic (code style rules)
  ...tseslint.configs.stylistic,

  // Prettier (disables ESLint rules that conflict with Prettier)
  prettierConfig,
);
```

### Key Details

- **`tseslint.config()`** is the equivalent of `defineConfig()` — it merges configs and handles the TypeScript plugin setup.
- **`...tseslint.configs.recommended`** — the spread is required because these are arrays of config objects.
- **Three tiers available:** `recommended` (essential rules), `strict` (extra type-safety rules), `stylistic` (code style). Using all three gives comprehensive coverage.
- **No separate parser config needed** — `typescript-eslint` auto-configures the parser for `.ts`, `.tsx`, `.mts`, `.cts` files.
- **`eslint-config-prettier`** is imported as a plain config object and added last to override any conflicting rules.

### Alternative: Using `defineConfig` from `eslint/config`

```js
import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default defineConfig(
  { ignores: ["dist/**", "coverage/**", "node_modules/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.strict,
  prettierConfig,
);
```

`defineConfig()` provides better TypeScript inference for the config array. Either approach works.

### Recommended npm Scripts

```json
{
  "scripts": {
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write src/",
    "format:check": "prettier --check src/"
  }
}
```

### Gotchas

1. **Flat config is the default in ESLint 9.** No `--flag` needed. If using ESLint 8, you'd need `ESLINT_USE_FLAT_CONFIG=true`.
2. **File extension:** With `"type": "module"` in package.json, `eslint.config.js` uses ESM `import` syntax. Without it, use `eslint.config.mjs`.
3. **typescript-eslint v8.58.0 added TypeScript 6 support** (released Mar 30, 2026). Make sure you're on at least this version.
4. **No `@typescript-eslint/eslint-plugin` needed separately** — the `typescript-eslint` meta-package handles everything. Old tutorials referencing separate parser/plugin installs are outdated.

---

## 5. Prettier Configuration

### Recommended `prettier.config.js`

```js
// prettier.config.js — ESM (project has "type": "module")
/** @type {import("prettier").Config} */
export default {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  arrowParens: "always",
  bracketSpacing: true,
  endOfLine: "lf",
  overrides: [
    {
      files: "*.json",
      options: { printWidth: 80 },
    },
  ],
};
```

### `.editorconfig`

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_size = 2
indent_style = space
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

### Gotchas

1. **Prettier 3.x is ESM-first but supports CJS.** No compatibility issues for this project.
2. **`eslint-config-prettier` handles the integration** — no `eslint-plugin-prettier` needed. The prettier plugin runs as a separate step (`npm run format`), and eslint-config-prettier disables conflicting ESLint rules.
3. **`.prettierignore`** should include `dist/`, `coverage/`, `node_modules/`.

---

## 6. TypeScript Configuration

### Recommended `tsconfig.json`

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
    "resolveJsonModule": true,
    "types": ["node"],
    "noUncheckedSideEffectImports": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### Separate tsconfig for tests

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*.ts", "src/**/*.test.ts"]
}
```

This is needed because the main tsconfig excludes test files and doesn't include vitest globals in `types`.

### Gotchas

1. **`rootDir: "./src"` is mandatory in TS 6.0.** Without it, `rootDir` defaults to `.` (tsconfig directory), causing output to nest as `dist/src/...`.
2. **`types: ["node"]` is mandatory in TS 6.0.** The old default `["*"]` auto-discovered all `@types` packages. Now you must explicitly list which ambient types to include.
3. **`module: "NodeNext"`** implies `moduleResolution: "NodeNext"` and requires `.js` extensions in relative imports (even for `.ts` source files). This is the correct behavior for ESM.
4. **TS 6.0 defaults `strict: true`**, so explicitly setting it is redundant but makes intent clear.
5. **`target: "ES2022"`** gives access to top-level await, class fields, ergonomic brand checks, and error cause — all available in Node.js 24.
6. **`noUncheckedSideEffectImports: true`** (new TS 6.0 default) will error on `import "./some-file"` if the file doesn't exist. This is good behavior but may surprise during initial setup.

---

## 7. Directory Structure

### Recommended Layout

```
gen-bruno/
├── .github/
│   └── workflows/
│       └── ci.yml
├── .editorconfig
├── .gitignore
├── .prettierignore
├── eslint.config.js
├── prettier.config.js
├── package.json
├── tsconfig.json
├── tsconfig.test.json
├── tsup.config.ts
├── vitest.config.ts
├── src/
│   ├── index.ts              # Library entry point (dual CJS/ESM exports)
│   ├── ir/                   # Intermediate Representation types
│   │   ├── collection.ts     # CollectionIR, CollectionInfo, Server, Tag
│   │   ├── endpoint.ts       # EndpointIR, HttpMethod
│   │   ├── parameter.ts      # ParameterIR
│   │   ├── schema.ts         # SchemaIR, SchemaType, discriminator, composition
│   │   ├── response.ts       # ResponseIR, HeaderIR, MediaTypeIR
│   │   ├── security.ts       # SecurityScheme variants, OAuth2Flows
│   │   ├── request-body.ts   # RequestBodyIR
│   │   ├── graphql.ts        # GraphQLEndpointExtension, GraphQlArgumentIR
│   │   ├── validation.ts     # ValidationError, ValidationResult, Warning
│   │   └── index.ts          # Re-exports all IR types
│   └── cli/                  # CLI entry point (ESM-only, Phase 4)
│       └── (deferred)
├── test/
│   └── ir/
│       └── ir-types.test.ts  # Type-level tests (compile-time validation)
└── dist/                     # Build output (gitignored)
```

### Design Rationale

- **`src/ir/`** as a dedicated directory — IR types are the core contract shared by all phases. Keeping them in one place makes them easy to import (`from "../ir"` or from the library entry point once exported).
- **Split IR types by domain** (collection, endpoint, schema, security, etc.) rather than a single massive file. Each file is focused and testable.
- **`src/index.ts`** re-exports all public IR types so consumers can import from the package root: `import { CollectionIR } from "gen-bruno"`.
- **`src/cli/`** is deferred to Phase 4. The CLI is ESM-only and should be physically separated from the library core to prevent ESM-only dependencies from leaking into the CJS build.
- **`test/` at root** (not `src/__tests__/`) — keeps test fixtures and golden files separate from source. Vitest's `include` pattern handles discovery.
- **Separate `tsconfig.test.json`** — extends the base config but adds vitest globals to `types` and includes test files.

### Alternative: Single `ir/types.ts`

For Phase 1, a single `src/ir/types.ts` file with all interfaces is also valid. The split-by-domain approach scales better as the project grows, but a single file is simpler for initial implementation. The planning phase should decide based on file size — if `types.ts` exceeds ~400 lines, split it.

---

## 8. GitHub Actions CI

### Recommended `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: "24"
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check

  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: "24"
      - run: npm ci
      - run: npm run test:coverage

  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: "24"
      - run: npm ci
      - run: npm run build
```

### Key Details

- **`actions/setup-node@v5`** runs on Node.js 24 natively (v5.0.0+ requirement).
- **`actions/checkout@v5`** is the latest major version.
- **Three separate jobs** (lint, test, build) run in parallel — faster than a single combined job.
- **`npm ci`** instead of `npm install` — deterministic installs from lockfile, faster in CI.
- Coverage report is produced by vitest's `text` and `lcov` reporters. LCOV can be uploaded to codecov or similar services later.

### Gotchas

1. **GitHub Actions runner migration:** As of March 2026, GitHub is migrating runners to Node 24. Using `actions/setup-node@v5` with `node-version: "24"` ensures compatibility regardless of the runner's default Node version.
2. **`npm ci` requires a `package-lock.json`.** Run `npm install` locally first to generate it before the first CI run.
3. **Coverage thresholds are enforced by vitest**, so the test job will fail if coverage drops below 80%.

---

## 9. ValidationError Type

From decision D-17, the `ValidationError` type should include source location for compiler-like error output:

```ts
interface ValidationError {
  /** Source file path or identifier */
  file: string;
  /** Line number in the source file (1-based), if available */
  line?: number;
  /** Column number in the source file (1-based), if available */
  column?: number;
  /** Human-readable error message */
  message: string;
  /** Optional error code for programmatic handling */
  code?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: Warning[];
}

interface Warning {
  message: string;
  severity: "info" | "warn" | "error";
  file?: string;
  line?: number;
  column?: number;
}
```

**Note:** `js-yaml` preserves line/column information during parsing, which can be threaded through to `ValidationError` when spec parsing fails. `@apidevtools/swagger-parser` provides validation errors that may include JSON Pointer paths — these can be converted to line/column with additional processing.

---

## 10. Installation Order

When scaffolding the project, install dependencies in this order:

```bash
# 1. Core build tools
npm install -D typescript tsup @tsconfig/node24

# 2. Testing
npm install -D vitest @vitest/coverage-v8

# 3. Linting & formatting
npm install -D eslint @eslint/js typescript-eslint eslint-config-prettier prettier

# 4. Node types (for TypeScript)
npm install -D @types/node
```

All of these are dev dependencies for Phase 1. Runtime dependencies (`@apidevtools/swagger-parser`, `graphql`, `js-yaml`, `commander`, etc.) come in later phases.

---

## 11. Summary of Gotchas for Planning

| Gotcha | Impact | Mitigation |
|--------|--------|------------|
| TS 6 `rootDir` defaults to `.` | Output nests as `dist/src/` | Explicitly set `"rootDir": "./src"` |
| TS 6 `types` defaults to `[]` | `process`, `Buffer`, vitest globals unavailable | Set `"types": ["node", "vitest/globals"]` |
| `module: "NodeNext"` requires `.js` extensions in imports | Import paths need `.js` even for `.ts` files | Enforce via ESLint rule; use auto-imports in editor |
| tsup `dts` generates `.d.ts` + `.d.cts` for dual format | Must map both in `package.json` `exports` | Use tsup defaults; verify with `npm pack --dry-run` |
| ESM-only deps in CJS build | `ERR_REQUIRE_ESM` at runtime | Confine chalk/ora to `src/cli/` only |
| vitest 4 requires Vite >= 6 | Pulls in vite as dependency | Expected; not a problem |
| typescript-eslint 8.58+ required for TS 6 | Older versions won't parse TS 6 output | Pin `typescript-eslint@^8.58.0` |
| `noUncheckedSideEffectImports: true` | Errors on bare `import "./file"` imports | Only use side-effect imports intentionally; ensure files exist |

---

*Research complete. Ready for planning phase.*
