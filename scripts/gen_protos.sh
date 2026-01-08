#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$REPO_ROOT"

echo "🔧 Generating code from proto files..."

# Clean output directories
echo "🧹 Cleaning output directories..."
rm -rf "$REPO_ROOT/packages/adk-sim-protos/src/adk_sim_protos/adksim"
rm -rf "$REPO_ROOT/packages/adk-sim-protos/src/adk_sim_protos/google"
rm -rf "$REPO_ROOT/packages/adk-sim-protos-ts/src/adksim"
rm -rf "$REPO_ROOT/packages/adk-sim-protos-ts/src/google"

# Generate code using buf (configured in buf.yaml)
echo "📦 Running buf generate..."
PATH="$REPO_ROOT/.venv/bin:$PATH" buf generate

# Format Python generated code with ruff
echo "🎨 Formatting Python generated code..."
uv run ruff check --fix "$REPO_ROOT/packages/adk-sim-protos/src/adk_sim_protos" 2>/dev/null || true
uv run ruff format "$REPO_ROOT/packages/adk-sim-protos/src/adk_sim_protos"

# Format TypeScript generated code with prettier
echo "🎨 Formatting TypeScript generated code..."
cd "$REPO_ROOT/frontend"
npx prettier --write "../packages/adk-sim-protos-ts/src/**/*.ts" 2>/dev/null || true

echo "✅ Proto generation complete!"
echo "📦 Python package: adk_sim_protos.adksim.v1"
echo "📦 TypeScript: packages/adk-sim-protos-ts/src/adksim/v1/"
