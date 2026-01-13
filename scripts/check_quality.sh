#!/bin/bash
# ============================================================
# Unified Quality Check Script
# ============================================================
# Runs code quality checks using pre-commit.
# This script delegates to pre-commit which is the single source
# of truth for all quality rules.
#
# Usage:
#   ./scripts/check_quality.sh        # Run all quality checks
#
# NOTE: This script assumes protos have already been generated.
#       Use `make quality` to ensure generation runs first.
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "========================================"
echo "  Code Quality Checks"
echo "========================================"

# Run pre-commit on all files
echo ""
echo "Running pre-commit quality checks..."
uv run pre-commit run --all-files

echo ""
echo "========================================"
echo "  ✅ All quality checks passed!"
echo "========================================"
