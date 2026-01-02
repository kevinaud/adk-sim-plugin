#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$REPO_ROOT"

echo "🔧 Generating code from proto files..."

# Clean output directories
echo "🧹 Cleaning output directories..."
rm -rf "$REPO_ROOT/adk_agent_sim/generated"
rm -rf "$REPO_ROOT/frontend/src/app/generated"

# Generate code using buf (configured in buf.yaml)
echo "📦 Running buf generate..."
PATH="$REPO_ROOT/.venv/bin:$PATH" buf generate

# Create Python root __init__.py
touch "$REPO_ROOT/adk_agent_sim/generated/__init__.py"

# Format Python generated code with ruff
echo "🎨 Formatting Python generated code..."
uv run ruff check --fix "$REPO_ROOT/adk_agent_sim/generated" 2>/dev/null || true
uv run ruff format "$REPO_ROOT/adk_agent_sim/generated"

# Format TypeScript generated code with prettier
echo "🎨 Formatting TypeScript generated code..."
cd "$REPO_ROOT/frontend"
npx prettier --write "src/app/generated/**/*.ts" 2>/dev/null || true

echo "✅ Proto generation complete!"
echo "📦 Python package: adk_agent_sim.generated.adksim.v1"
echo "📦 TypeScript: frontend/src/app/generated/adksim/v1/"
