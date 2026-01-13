#!/bin/bash
# ============================================================
# Presubmit Checks - Runs everything that pre-push would run
# ============================================================
# This is equivalent to what happens on `git push`, but can be
# run manually before pushing to catch issues early.
# ============================================================

set -e
cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "🚀 Running Presubmit Checks..."

# Ensure dependencies are installed
npm install --silent
uv sync --frozen

# Generate protos (with clean to ensure consistency)
make clean
make generate

# Build TS packages (required for frontend)
npm run build --workspace=packages/adk-sim-protos-ts
npm run build --workspace=packages/adk-converters-ts

# Run ALL pre-commit hooks (commit + push stages)
echo ""
echo "📋 Running all quality checks and tests..."
uv run pre-commit run --all-files --hook-stage manual

echo ""
echo "✅ All presubmit checks passed!"
