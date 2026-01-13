#!/bin/bash
# ============================================================
# Presubmit Checks
# ============================================================
# Runs the full suite of CI checks:
# 1. Proto generation (Python + TypeScript)
# 2. Quality checks (linting, formatting)
# 3. Backend tests (unit and integration)
# 4. Frontend tests
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "🚀 Starting Presubmit Checks..."

# Ensure frontend npm dependencies are installed (needed for proto generation)
echo ""
echo "📦 Ensuring frontend dependencies are installed..."
cd "$PROJECT_ROOT/frontend"
npm install --silent
cd "$PROJECT_ROOT"

# Clean and regenerate protos (ensures buf config matches generated code)
echo ""
echo "🔧 Cleaning and Regenerating Proto Code..."
make clean
make generate

# Build TypeScript protos package (required for frontend to resolve @adk-sim/protos)
echo ""
echo "📦 Building TypeScript protos package..."
cd "$PROJECT_ROOT/packages/adk-sim-protos-ts"
npm run build
cd "$PROJECT_ROOT"

# Build and test adk-converters-ts package
echo ""
echo "📦 Building and testing adk-converters-ts package..."
cd "$PROJECT_ROOT/packages/adk-converters-ts"
npm install --silent
npm run build
npm run test
cd "$PROJECT_ROOT"

# Run Quality Checks
echo ""
echo "📋 Running Quality Checks..."
./scripts/check_quality.sh

# Run Unit and Integration Tests
echo ""
echo "🧪 Running Backend Tests..."
# (sequential - async tests need single event loop)
uv run pytest server/tests/unit plugins/python/tests -v

# Run Frontend Tests
echo ""
echo "🧪 Running Frontend Tests..."
cd frontend

# Capture both stdout and stderr to detect test failures and warnings
TEST_OUTPUT_FILE=$(mktemp)
TEST_EXIT_CODE=0

# Run tests with a 5-minute timeout to prevent hanging
if ! timeout 300 bash -c 'CI=true npm run ng -- test --watch=false 2>&1' | tee "$TEST_OUTPUT_FILE"; then
  TEST_EXIT_CODE=$?
fi

# Check for vitest unhandled errors (indicates missing dependencies or runtime issues)
if grep -q "Unhandled Errors\|Cannot find package\|ERR_MODULE_NOT_FOUND" "$TEST_OUTPUT_FILE" 2>/dev/null; then
  echo ""
  echo "❌ Frontend tests failed with unhandled errors:"
  grep -A 5 "Unhandled Error\|Cannot find package\|ERR_MODULE_NOT_FOUND" "$TEST_OUTPUT_FILE"
  rm -f "$TEST_OUTPUT_FILE"
  exit 1
fi

# Check if tests actually ran and passed
if ! grep -q "Tests.*[0-9]* passed" "$TEST_OUTPUT_FILE" 2>/dev/null; then
  # If no tests passed and we had a non-zero exit, fail
  if [ $TEST_EXIT_CODE -ne 0 ]; then
    echo ""
    echo "❌ Frontend tests failed (exit code: $TEST_EXIT_CODE)"
    rm -f "$TEST_OUTPUT_FILE"
    exit 1
  fi
fi

# Check for Angular warnings in output
if grep -q "It looks like you're using" "$TEST_OUTPUT_FILE" 2>/dev/null; then
  echo ""
  echo "❌ Frontend tests produced Angular warnings - please fix them:"
  grep -A 10 "It looks like you're using" "$TEST_OUTPUT_FILE"
  rm -f "$TEST_OUTPUT_FILE"
  exit 1
fi

rm -f "$TEST_OUTPUT_FILE"

echo ""
echo "✅ All presubmit checks passed!"
