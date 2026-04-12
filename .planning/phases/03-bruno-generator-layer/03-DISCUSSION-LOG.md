# Phase 3: Bruno Generator Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 03-gen-brunoerator-layer
**Areas discussed:** Output structure & grouping, Request body & example generation, Auth handler implementation, Environment variable strategy

---

## Output Structure & Grouping

| Option | Description | Selected |
|--------|-------------|----------|
| Tag-based (Recommended) | Group by OpenAPI tags — matches how API docs organize endpoints. ARCHITECTURE.md shows this as default. | ✓ |
| Path-based | Group by URL path prefix — /users/* → Users folder. | |
| Flat | All requests in root — no folders. | |

**User's choice:** Tag-based grouping (D-01)

**Follow-up decisions:**
- Folder names when tags missing: First path segment (D-02)
- Folder display names: Use tag.description when available (D-03)
- GraphQL folders: Separate Queries/ and Mutations/ folders (D-04)

---

## Request Body & Example Generation

| Option | Description | Selected |
|--------|-------------|----------|
| Schema-driven defaults (Recommended) | Generate plausible defaults from types: string → "string", integer → 0, boolean → false, enum → first value, format: "email" → "user@example.com" | ✓ |
| Empty/null placeholders | Generate null or {} for complex objects. Less noisy but less useful. | |
| Rich sample data | Use faker-style data: "john@example.com", 42, true. More useful but could be misleading. | |

**User's choice:** Schema-driven defaults (D-06)

**Follow-up decisions:**
- Complex nested schemas: One level deep (D-07)
- Enum handling: First enum value (D-08)
- Required fields with complex nested schemas: Recurse fully (D-09)

---

## Auth Handler Implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Honor spec placement (Recommended) | Generate apiKey in whichever location the spec declares (header, query, cookie). For cookie, generate pre-request script stub. | ✓ |
| Header only | Force all apiKey auth to headers. Simpler but breaks spec semantics. | |
| You decide | Agent determines best approach. | |

**User's choice:** Honor spec placement (D-11)

**Follow-up decisions:**
- OAuth2/OIDC: Token exchange stubs with TODO comments for user credentials (D-12)
- HTTP auth: Use Bruno's native auth: blocks in .bru files (D-13)
- Multiple auth schemes: All auth blocks in each .bru file — user fills in whichever they need (D-14)

---

## Environment Variable Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Single default environment | One environments/default.bru with baseUrl, auth vars. Simple. | |
| Per-server environments | One env file per server URL in spec (dev, staging, prod). | |
| Other | User's custom approach. | ✓ |

**User's choice:** Use collection variables in collection.bru instead of environment files for baseUrl and auth vars (D-16). Promotes variable reuse across collection without needing to load a separate environment. Environment files can still exist for user-created per-deployment overrides (D-17).

---

## the agent's Discretion

- Exact block builder function naming and organization within blocks/ subdirectory
- Internal helper utilities for .bru string escaping and path sanitization
- Specific .bru formatting details (indentation, blank lines between blocks)
- Logging verbosity during generation
- Progress reporting details

## Deferred Ideas

None — all discussion stayed within phase scope.
