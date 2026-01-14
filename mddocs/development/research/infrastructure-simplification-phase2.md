---
title: Infrastructure Simplification Phase 2
type: proposal
parent: pre-commit-proposal.md
---

# Infrastructure Simplification Phase 2

## Table of Contents

- [Overview](#overview)
- [Part 1: Remove Redundant Scripts and Make Commands](#part-1-remove-redundant-scripts-and-make-commands)
  - [Scripts to Delete](#scripts-to-delete)
  - [Makefile Simplification](#makefile-simplification)
  - [Presubmit Simplification](#presubmit-simplification)
- [Part 2: Simplify CI Workflows](#part-2-simplify-ci-workflows)
  - [Current State](#current-state)
  - [Proposed State](#proposed-state)
  - [Unified CI Workflow](#unified-ci-workflow)
- [Part 3: Standardize Build Steps](#part-3-standardize-build-steps)
  - [Problem: Scattered Build Logic](#problem-scattered-build-logic)
  - [Solution: Centralized Build Script](#solution-centralized-build-script)
  - [Simplified Publish Workflow](#simplified-publish-workflow)
- [Part 4: Consolidate Docker Compose Files](#part-4-consolidate-docker-compose-files)
  - [Current Docker Files](#current-docker-files)
  - [Proposed Consolidation](#proposed-consolidation)
- [Implementation Summary](#implementation-summary)
  - [Files to Delete](#files-to-delete)
  - [Files to Create](#files-to-create)
  - [Files to Modify](#files-to-modify)
  - [Final File Count](#final-file-count)
- [Migration Steps](#migration-steps)
  - [Step 1: Create build.sh](#step-1-create-buildsh)
  - [Step 2: Simplify presubmit.sh](#step-2-simplify-presubmitsh)
  - [Step 3: Consolidate Docker Compose](#step-3-consolidate-docker-compose)
  - [Step 4: Simplify CI Workflows](#step-4-simplify-ci-workflows)

## Overview

With pre-commit now handling quality gates, we can significantly simplify the remaining infrastructure:

| Area | Current | After |
|------|---------|-------|
| Shell scripts | 8 | 4 |
| GitHub workflows | 5 | 3 |
| Docker compose files | 3 | 2 |
| Makefile targets | 20+ | 12 |

## Part 1: Remove Redundant Scripts and Make Commands

### Scripts to Delete

| Script | Reason | Replacement |
|--------|--------|-------------|
| `scripts/check_quality.sh` | Thin wrapper around pre-commit | `uv run pre-commit run --all-files` |
| `scripts/gen_protos.sh` | Duplicates Makefile `generate` target | `make generate` |

**Scripts to Keep**:
| Script | Purpose |
|--------|---------|
| `scripts/presubmit.sh` | Orchestrates full CI (simplified) |
| `scripts/ship.sh` | Release automation |
| `scripts/update_vendored_protos.sh` | Maintenance (rare use) |
| `scripts/configure_github.sh` | One-time setup |
| `scripts/allpaste_*.sh` | Developer tooling |

### Makefile Simplification

**Remove these targets** (now handled by pre-commit or redundant):

```makefile
# REMOVE: lint is now identical to quality
lint: generate
	uv run pre-commit run --all-files

# REMOVE: format can be done via pre-commit with --hook-stage manual
format:
	# ... manual formatting commands
```

**Simplified Makefile**:

```makefile
# ============================================================
# ADK Agent Simulator - Developer Makefile
# ============================================================

.PHONY: help generate clean server frontend dev docker-up docker-down test test-e2e quality bundle build

.DEFAULT_GOAL := help

# Directories
PYTHON_GEN_DIR := packages/adk-sim-protos/src/adk_sim_protos
TS_GEN_DIR := packages/adk-sim-protos-ts/src
PROTO_MARKER := .proto-generated
PROTO_FILES := $(shell find protos -name '*.proto' 2>/dev/null)

# ============================================================
# Help
# ============================================================
help:
	@echo "ADK Agent Simulator - Developer Commands"
	@echo ""
	@echo "Development:"
	@echo "  make server       - Start backend gRPC server"
	@echo "  make frontend     - Start frontend dev server"
	@echo "  make docker-up    - Start via Docker Compose"
	@echo ""
	@echo "Quality & Testing:"
	@echo "  make quality      - Run all quality checks (pre-commit)"
	@echo "  make test         - Run unit + integration tests"
	@echo "  make test-e2e     - Run E2E tests (requires Docker)"
	@echo ""
	@echo "Build:"
	@echo "  make generate     - Generate proto code"
	@echo "  make bundle       - Bundle frontend into server"
	@echo "  make build        - Full release build (protos + frontend + packages)"
	@echo "  make clean        - Remove generated files"

# ============================================================
# Proto Generation (with index.ts preservation)
# ============================================================
$(PROTO_MARKER): $(PROTO_FILES) buf.yaml buf.gen.yaml
	@echo "🔧 Generating proto code..."
	@# Save custom index.ts if it exists
	@if [ -f "$(TS_GEN_DIR)/index.ts" ]; then cp "$(TS_GEN_DIR)/index.ts" /tmp/index.ts.bak; fi
	@rm -rf "$(PYTHON_GEN_DIR)/adksim" "$(PYTHON_GEN_DIR)/google"
	@rm -rf "$(TS_GEN_DIR)/adksim" "$(TS_GEN_DIR)/google"
	@PATH="$(PWD)/.venv/bin:$$PATH" buf generate
	@# Restore custom index.ts
	@if [ -f /tmp/index.ts.bak ]; then mv /tmp/index.ts.bak "$(TS_GEN_DIR)/index.ts"; fi
	@uv run ruff check --fix "$(PYTHON_GEN_DIR)" 2>/dev/null || true
	@uv run ruff format "$(PYTHON_GEN_DIR)"
	@cd frontend && npx prettier --write "../$(TS_GEN_DIR)/**/*.ts" 2>/dev/null || true
	@touch $(PROTO_MARKER)
	@echo "✅ Proto generation complete!"

generate: $(PROTO_MARKER)

clean:
	@rm -rf "$(PYTHON_GEN_DIR)/adksim" "$(PYTHON_GEN_DIR)/google"
	@rm -rf "$(TS_GEN_DIR)/adksim" "$(TS_GEN_DIR)/google"
	@rm -f $(PROTO_MARKER)
	@echo "✅ Clean complete!"

# ============================================================
# Development
# ============================================================
server: generate
	uv run adk-sim

frontend: generate
	cd frontend && npm start

dev:
	@echo "Run 'make server' and 'make frontend' in separate terminals"

docker-up:
	docker compose up

docker-down:
	docker compose down

# ============================================================
# Quality & Testing
# ============================================================
quality: generate
	uv run pre-commit run --all-files

test: generate
	uv run pytest server/tests/unit plugins/python/tests -v

test-e2e:
	uv run pytest server/tests/e2e --run-e2e -v

# ============================================================
# Build (for releases)
# ============================================================
bundle: generate
	@echo "📦 Bundling frontend into server..."
	cd frontend && CI=TRUE npm run build
	rm -rf server/src/adk_sim_server/static/*
	cp -r frontend/dist/frontend/* server/src/adk_sim_server/static/
	@echo "✅ Frontend bundled!"

build: generate bundle
	@echo "📦 Building all packages..."
	npm run build --workspace=packages/adk-sim-protos-ts
	npm run build --workspace=packages/adk-converters-ts
	uv build --package adk-sim-protos --out-dir dist/
	uv build --package adk-sim-testing --out-dir dist/
	uv build --package adk-sim-server --out-dir dist/
	uv build --package adk-agent-sim --out-dir dist/
	@echo "✅ All packages built in dist/"
```

### Presubmit Simplification

The current `presubmit.sh` duplicates logic that pre-push hooks now handle. Simplify to:

```bash
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
```

**Key insight**: `--hook-stage manual` runs ALL hooks regardless of their configured stage, including the pre-push tests.

## Part 2: Simplify CI Workflows

### Current State

| Workflow | Trigger | What It Does | Overlap |
|----------|---------|--------------|---------|
| `ci.yaml` | All PRs | `presubmit.sh` in devcontainer | Contains all tests |
| `e2e.yaml` | All PRs | Python E2E tests | **Duplicates ci.yaml** |
| `frontend-tests.yaml` | Frontend changes | Playwright tests | **Duplicates ci.yaml** |
| `build-image.yaml` | Dependency changes | Build devcontainer | Unique |
| `publish.yaml` | Tags | Build & publish | Unique |

**Problem**: `e2e.yaml` and `frontend-tests.yaml` run tests that `ci.yaml` already runs.

### Proposed State

| Workflow | Trigger | What It Does |
|----------|---------|--------------|
| `ci.yaml` | All PRs | Run `presubmit.sh` (all checks + all tests) |
| `build-image.yaml` | Dependency changes | Build devcontainer |
| `publish.yaml` | Tags | Build & publish |

**Delete**:
- `e2e.yaml` - redundant (ci.yaml runs E2E via pre-push hooks)
- `frontend-tests.yaml` - redundant (ci.yaml runs Playwright via pre-push hooks)

### Unified CI Workflow

The simplified `ci.yaml` already does everything:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    name: Check
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Run CI in Dev Container
        uses: devcontainers/ci@v0.3
        with:
          imageName: ghcr.io/${{ github.repository }}/devcontainer
          cacheFrom: ghcr.io/${{ github.repository }}/devcontainer
          push: filter
          runCmd: ./scripts/presubmit.sh
```

This runs `presubmit.sh` which runs `pre-commit run --all-files --hook-stage manual`, which runs:
- All linting (buf, ruff, eslint, prettier)
- All type checking (pyright)
- All tests (pytest, vitest, playwright component, playwright e2e, pytest e2e)

**One workflow to rule them all.**

## Part 3: Standardize Build Steps

### Problem: Scattered Build Logic

Build steps are duplicated across:
1. `Makefile` (`bundle-frontend`, `generate`)
2. `presubmit.sh` (proto gen, TS package builds)
3. `publish.yaml` (full build for release)

The `index.ts` in `packages/adk-sim-protos-ts/src/` is hand-written with careful exports, but `make generate` clobbers it with a simpler version.

### Solution: Centralized Build Script

Create `scripts/build.sh` as the single source of truth for building:

```bash
#!/bin/bash
# ============================================================
# build.sh - Unified build for all artifacts
# ============================================================
# Usage:
#   ./scripts/build.sh           # Full build
#   ./scripts/build.sh protos    # Proto generation only
#   ./scripts/build.sh frontend  # Frontend bundle only
#   ./scripts/build.sh packages  # Package builds only
# ============================================================

set -e
cd "$(dirname "${BASH_SOURCE[0]}")/.."

PYTHON_GEN_DIR="packages/adk-sim-protos/src/adk_sim_protos"
TS_GEN_DIR="packages/adk-sim-protos-ts/src"

build_protos() {
    echo "🔧 Generating proto code..."

    # Preserve hand-written index.ts
    if [ -f "$TS_GEN_DIR/index.ts" ]; then
        cp "$TS_GEN_DIR/index.ts" /tmp/index.ts.bak
    fi

    # Clean generated directories (but not index.ts)
    rm -rf "$PYTHON_GEN_DIR/adksim" "$PYTHON_GEN_DIR/google"
    rm -rf "$TS_GEN_DIR/adksim" "$TS_GEN_DIR/google"

    # Generate
    PATH="$PWD/.venv/bin:$PATH" buf generate

    # Restore index.ts
    if [ -f /tmp/index.ts.bak ]; then
        mv /tmp/index.ts.bak "$TS_GEN_DIR/index.ts"
    fi

    # Format generated code
    uv run ruff check --fix "$PYTHON_GEN_DIR" 2>/dev/null || true
    uv run ruff format "$PYTHON_GEN_DIR"
    npx prettier --write "$TS_GEN_DIR/**/*.ts" 2>/dev/null || true

    echo "✅ Protos generated!"
}

build_ts_packages() {
    echo "📦 Building TypeScript packages..."
    npm run build --workspace=packages/adk-sim-protos-ts
    npm run build --workspace=packages/adk-converters-ts
    echo "✅ TypeScript packages built!"
}

build_frontend() {
    echo "📦 Building and bundling frontend..."
    cd frontend && CI=TRUE npm run build && cd ..
    rm -rf server/src/adk_sim_server/static/*
    cp -r frontend/dist/frontend/* server/src/adk_sim_server/static/
    echo "✅ Frontend bundled into server!"
}

build_python_packages() {
    echo "📦 Building Python packages..."
    rm -rf dist/
    uv build --package adk-sim-protos --out-dir dist/
    uv build --package adk-sim-testing --out-dir dist/
    uv build --package adk-sim-server --out-dir dist/
    uv build --package adk-agent-sim --out-dir dist/
    echo "✅ Python packages built in dist/!"
}

# Main
case "${1:-all}" in
    protos)
        build_protos
        ;;
    ts|typescript)
        build_ts_packages
        ;;
    frontend)
        build_ts_packages  # Required dependency
        build_frontend
        ;;
    packages|python)
        build_python_packages
        ;;
    all)
        build_protos
        build_ts_packages
        build_frontend
        build_python_packages
        echo ""
        echo "🎉 Full build complete!"
        ;;
    *)
        echo "Usage: $0 {protos|ts|frontend|packages|all}"
        exit 1
        ;;
esac
```

### Simplified Publish Workflow

With `scripts/build.sh`, the publish workflow becomes cleaner:

```yaml
name: Publish Packages

on:
  push:
    tags: ['v*']

permissions:
  contents: read
  id-token: write

jobs:
  build-and-verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup uv
        uses: astral-sh/setup-uv@v7

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: |
          uv sync
          npm ci

      - name: Build all artifacts
        run: ./scripts/build.sh all

      - name: Verify installation
        run: |
          uv venv .verify-venv
          uv pip install --python .verify-venv adk-sim-server --find-links dist/ --prerelease=allow
          .verify-venv/bin/python -c "import adk_sim_server; import adk_sim_protos; print('✅ Imports OK')"

          # Verify frontend bundled
          .verify-venv/bin/adk-sim &
          sleep 3
          curl -s http://localhost:8080/ | grep -q "<app-root>" || exit 1
          kill %1
          echo "✅ Frontend served correctly"

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  publish-pypi:
    needs: build-and-verify
    runs-on: ubuntu-latest
    environment: pypi
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/
      - uses: pypa/gh-action-pypi-publish@release/v1
        with:
          packages-dir: dist/
          skip-existing: true

  publish-npm:
    needs: build-and-verify
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          registry-url: 'https://registry.npmjs.org'
      - run: |
          npm ci
          npm run build --workspace=packages/adk-sim-protos-ts
          npm run build --workspace=packages/adk-converters-ts
      - name: Publish packages
        run: |
          cd packages/adk-sim-protos-ts && unset NODE_AUTH_TOKEN && npm publish --provenance --access public
          cd ../adk-converters-ts && unset NODE_AUTH_TOKEN && npm publish --provenance --access public
```

## Part 4: Consolidate Docker Compose Files

### Current Docker Files

| File | Purpose | Differences from base |
|------|---------|----------------------|
| `docker-compose.yaml` | Full dev stack | backend + frontend, volume mounts |
| `docker-compose.test.yaml` | pytest-docker | backend only, temp DB, healthcheck |
| `docker-compose.e2e.yaml` | Playwright E2E | backend only, temp DB, healthcheck (slightly different) |

**`test.yaml` vs `e2e.yaml` differences**:
- Port exposure: 50051 vs 50051+8080
- DB path: `/tmp/test.db` vs `/tmp/e2e-test.db`
- Healthcheck retries: 10 vs 15
- Healthcheck start_period: 5s vs 10s
- Command: `python -m adk_sim_server.main` vs `adk-sim`

### Proposed Consolidation

**Keep**: `docker-compose.yaml` (dev) and `docker-compose.test.yaml` (testing)
**Delete**: `docker-compose.e2e.yaml`

**Merged `docker-compose.test.yaml`**:

```yaml
# Testing Docker Compose Stack
# Used by pytest-docker and Playwright E2E tests

services:
  backend:
    build:
      context: .
      dockerfile: docker/backend.Dockerfile
    ports:
      - "50051:50051"
      - "${HTTP_PORT:-8080}:8080"  # Expose HTTP for E2E, optional otherwise
    environment:
      PYTHONPATH: /app
      LOG_LEVEL: INFO
      ADK_AGENT_SIM_DATABASE_URL: "sqlite+aiosqlite:///tmp/test.db"
    command: uv run adk-sim
    healthcheck:
      test: ["CMD", "python", "-c", "import socket; s=socket.socket(); s.connect(('localhost', 50051)); s.close()"]
      interval: 2s
      timeout: 5s
      retries: ${HC_RETRIES:-15}
      start_period: ${HC_START:-10s}
```

**Usage**:
```bash
# For pytest-docker (default settings work)
docker compose -f docker-compose.test.yaml up

# For Playwright E2E (same file, HTTP port exposed by default now)
docker compose -f docker-compose.test.yaml up
```

The minor differences (retries, start_period) don't justify a separate file - use the more conservative E2E values as defaults.

**Update references**:
- `frontend-tests.yaml` → delete (workflow deleted)
- Pre-push hooks → use `docker-compose.test.yaml`
- pytest-docker config → use `docker-compose.test.yaml`

## Implementation Summary

### Files to Delete

| File | Reason |
|------|--------|
| `scripts/check_quality.sh` | Replaced by `uv run pre-commit run --all-files` |
| `scripts/gen_protos.sh` | Replaced by `make generate` / `scripts/build.sh protos` |
| `.github/workflows/e2e.yaml` | Redundant with ci.yaml |
| `.github/workflows/frontend-tests.yaml` | Redundant with ci.yaml |
| `docker-compose.e2e.yaml` | Merged into docker-compose.test.yaml |

### Files to Create

| File | Purpose |
|------|--------|
| `scripts/build.sh` | Unified build script |

### Files to Modify

| File | Changes |
|------|---------|
| `Makefile` | Remove lint/format, add build target, fix index.ts preservation |
| `scripts/presubmit.sh` | Simplify to use pre-commit --hook-stage manual |
| `docker-compose.test.yaml` | Merge e2e config, add env var flexibility |
| `.github/workflows/publish.yaml` | Use scripts/build.sh |

### Final File Count

| Category | Before | After |
|----------|--------|-------|
| Shell scripts | 8 | 5 |
| GitHub workflows | 5 | 3 |
| Docker compose files | 3 | 2 |
| Makefile lines | ~243 | ~80 |

## Migration Steps

### Step 1: Create build.sh
Single PR that:
1. Creates `scripts/build.sh`
2. Updates Makefile to use it
3. Fixes index.ts preservation in proto generation

### Step 2: Simplify presubmit.sh
Single PR that:
1. Rewrites `scripts/presubmit.sh` to use `--hook-stage manual`
2. Deletes `scripts/check_quality.sh`
3. Deletes `scripts/gen_protos.sh`

### Step 3: Consolidate Docker Compose
Single PR that:
1. Merges `docker-compose.e2e.yaml` into `docker-compose.test.yaml`
2. Updates any references

### Step 4: Simplify CI Workflows
Single PR that:
1. Deletes `.github/workflows/e2e.yaml`
2. Deletes `.github/workflows/frontend-tests.yaml`
3. Updates `.github/workflows/publish.yaml` to use `scripts/build.sh`

---

**Result**: A cleaner, more maintainable infrastructure where:
- Pre-commit is the single source of truth for quality
- Build.sh is the single source of truth for builds
- CI simply runs presubmit.sh
- Docker has one dev compose and one test compose
