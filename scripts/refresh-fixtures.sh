#!/usr/bin/env bash
# refresh-fixtures.sh — Pull fresh real-world OpenAPI specs to update test fixtures.
# This script is NOT run in CI. Run manually when you want to update fixtures.
#
# Usage: ./scripts/refresh-fixtures.sh

set -euo pipefail

FIXTURES_DIR="$(cd "$(dirname "$0")/../test/fixtures" && pwd)"

echo "Refreshing test fixtures from public API specs..."

# Stripe-like spec (using a public OpenAPI spec or a representative example)
echo "  → stripe-like fixture..."
# Note: Stripe's actual OpenAPI spec requires authentication.
# This fixture is hand-crafted to exercise the edge cases we care about.
echo "    (stripe-like fixture is hand-crafted — not refreshed from URL)"

# GitHub-like spec
echo "  → github-like fixture..."
# Note: GitHub's OpenAPI spec is available via their REST API description
# But it's massive. Our fixture is hand-crafted for the edge cases we care about.
echo "    (github-like fixture is hand-crafted — not refreshed from URL)"

# Petstore spec — the canonical example
echo "  → petstore fixture..."
if command -v curl &> /dev/null; then
  curl -sfL "https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/examples/v3.0/petstore.yaml" \
    -o "${FIXTURES_DIR}/petstore/openapi.yaml" 2>/dev/null \
    || echo "    (could not fetch petstore.yaml — keeping existing fixture)"
else
  echo "    (curl not available — keeping existing fixture)"
fi

echo ""
echo "Fixture refresh complete."
echo "Run 'npm test' to verify all fixture tests pass."
