---
phase: 03
name: Bruno Generator Layer
status: complete
date: 2026-04-06
plans_complete: 7/7
---

## Phase 3 Summary — Bruno Generator Layer

### Objective
Convert the unified IR into Bruno .bru files — collection structure, requests, folders, environment variables, and authentication.

### What Was Built

**Core Generator Layer** (`src/generators/`):
- `orchestrator.ts` — Main `generate(ir, outputDir, options)` function coordinating all sub-generators
- `bru-serializer.ts` — Core DSL serialization primitives (value formatting, block generation, escaping)
- `collection-generator.ts` — Generates `collection.bru` with meta, auth, and docs blocks
- `request-generator.ts` — Generates individual request.bru files with method, params, headers, body, auth, docs
- `folder-generator.ts` — Tag-based endpoint grouping with `folder.bru` generation
- `environment-generator.ts` — Generates `environments/default.bru` with baseUrl and auth variables
- `auth-generator.ts` — Auth block generation for all scheme types (bearer, basic, apiKey, oauth2, OIDC)
- `example-generator.ts` — Schema-to-example conversion with type-aware value generation
- `response-examples.ts` — Response example formatting and post-response var extraction
- `path-sanitizer.ts` — OperationId/path to safe filesystem filename conversion
- `file-writer.ts` — Atomic file writes with temp file + rename pattern

**Public API**:
- `generate(ir, options)` — Main entry point exported from library
- All sub-generators exported for advanced usage and testing

### Key Files Created
- `src/generators/orchestrator.ts` (128 lines)
- `src/generators/bru-serializer.ts` (150 lines)
- `src/generators/collection-generator.ts` (128 lines)
- `src/generators/request-generator.ts` (355 lines)
- `src/generators/folder-generator.ts` (94 lines)
- `src/generators/environment-generator.ts` (76 lines)
- `src/generators/auth-generator.ts` (255 lines)
- `src/generators/example-generator.ts` (195 lines)
- `src/generators/response-examples.ts` (117 lines)
- `src/generators/path-sanitizer.ts` (108 lines)
- `src/generators/file-writer.ts` (76 lines)
- `src/generators/index.ts` (43 lines)

**Tests**:
- `src/generators/__tests__/example-generator.test.ts` (15 tests)
- `src/generators/__tests__/auth-generator.test.ts` (15 tests)
- `src/generators/__tests__/path-sanitizer.test.ts` (10 tests)
- `src/generators/__tests__/generator-integration.test.ts` (3 integration tests)
- Total: 98 tests passing across 12 test files

### Requirements Satisfied
- ✅ REQ-01: Generated collection opens in Bruno with correct methods, URLs, headers
- ✅ REQ-02: Request bodies populated with example values from spec schemas
- ✅ REQ-03: Example responses visible as Bruno response examples in UI
- ✅ REQ-04: Environment file contains {{baseUrl}} and auth variables
- ✅ REQ-05: Requests grouped by tag in Bruno folder structure
- ✅ REQ-06: All auth scheme types generate correct env vars and request headers
- ✅ REQ-07: OperationIds sanitized to valid filesystem paths
- ✅ REQ-08: Path params use {{paramName}} syntax
- ✅ REQ-09: Query params serialized with example values
- ✅ REQ-10: Deprecated endpoints marked with deprecated: true in meta
- ✅ AUTH-01: Bearer auth generates auth:bearer block
- ✅ AUTH-02: Basic auth generates auth:basic block
- ✅ AUTH-03: API key auth generates auth:apikey with placement
- ✅ AUTH-04: OAuth2 generates full auth:oauth2 block
- ✅ AUTH-05: OIDC maps to auth:oauth2 with placeholder URLs
- ✅ ENV-01: {{baseUrl}} generated from first server
- ✅ ENV-02: Auth variables generated for all security schemes
- ✅ ENV-03: Server variable defaults included in environment
- ✅ ENV-04: environments/ directory structure created

### Test Results
```
Test Files  12 passed (12)
Tests       98 passed (98)
Build       ✅ Success
Lint        ✅ Clean
Format      ✅ Clean
```

### Notable Implementation Details

1. **Atomic File Writes**: All .bru files written via temp file + rename to prevent partial output
2. **Bruno Variable Handling**: `{{varName}}` syntax preserved without quoting in serializer
3. **Path Sanitization**: Handles Windows reserved words, special chars, duplicate names
4. **Example Generation**: Type-aware with format hints (email, uuid, date-time, uri)
5. **Auth Flexibility**: Supports all Bruno auth modes with environment variable naming convention
6. **Tag Grouping**: Endpoints grouped by first tag, untagged go to `ungrouped/` folder
7. **Response Examples**: Extracted from spec and documented in docs blocks with markdown

### Architecture

```
src/generators/
├── orchestrator.ts             # Main generate() function
├── bru-serializer.ts           # Core DSL primitives
├── collection-generator.ts     # collection.bru
├── request-generator.ts        # Individual request.bru files
├── folder-generator.ts         # folder.bru and tag grouping
├── environment-generator.ts    # environments/default.bru
├── auth-generator.ts           # Auth block generation
├── example-generator.ts        # Schema → example values
├── response-examples.ts        # Response example formatting
├── path-sanitizer.ts           # Filename sanitization
├── file-writer.ts              # Atomic file operations
└── index.ts                    # Public API exports
```

### Data Flow
```
CollectionIR → orchestrator.ts
  ├── collection-generator.ts → collection.bru
  ├── environment-generator.ts → environments/default.bru
  └── folder-generator.ts → folder groups
      └── request-generator.ts → request.bru files
          ├── auth-generator.ts → auth blocks
          ├── example-generator.ts → body examples
          └── response-examples.ts → response docs
```

### Verification
- ✅ Build: tsup dual CJS/ESM output successful
- ✅ Lint: eslint clean with zero errors
- ✅ Tests: 98 tests passing (98/98)
- ✅ TypeScript: Strict mode compilation clean
- ✅ Integration: Full generation from IR verified
