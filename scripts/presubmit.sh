#!/bin/bash
# ============================================================
# Presubmit Checks - Same as pre-push hook
# ============================================================
# This runs EXACTLY what the pre-push hook runs.
# Use this to catch issues before pushing.
# ============================================================

set -e
cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "🚀 Running Presubmit Checks..."

# Ensure dependencies are installed
npm install --silent
uv sync --frozen

# Build TS packages (required for frontend build/tests)
npm run build --workspace=packages/adk-sim-protos-ts
npm run build --workspace=packages/adk-converters-ts

# Run ALL pre-commit hooks (same as pre-push)
echo ""
echo "📋 Running all quality checks and tests..."
uv run pre-commit run --all-files --hook-stage manual

echo ""
echo "✅ All presubmit checks passed!"
