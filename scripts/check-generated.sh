#!/bin/bash
# ============================================================
# Check Generated Code Consistency
# ============================================================
# Verifies that `make clean && make generate` produces no changes.
# This ensures generated code is always committed in its final state.
# ============================================================

set -e
cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "🔍 Checking generated code consistency..."

# Regenerate from clean state
make clean
make generate

# Check for any changes
if ! git diff --quiet -- packages/adk-sim-protos packages/adk-sim-protos-ts; then
    echo ""
    echo "❌ Error: Generated code is out of date!"
    echo ""
    echo "The following files differ from what make generate produces:"
    git diff --name-only -- packages/adk-sim-protos packages/adk-sim-protos-ts
    echo ""
    echo "Please run 'make generate' and commit the changes."
    exit 1
fi

echo "✅ Generated code is up-to-date!"
