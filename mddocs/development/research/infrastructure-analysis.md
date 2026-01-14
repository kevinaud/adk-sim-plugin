---
title: Build Infrastructure Analysis
type: analysis
---

# Build Infrastructure Analysis

## Table of Contents

- [Executive Summary](#executive-summary)
- [Current State Inventory](#current-state-inventory)
  - [Shell Scripts](#shell-scripts)
  - [Makefile](#makefile)
  - [Docker Files](#docker-files)
  - [GitHub Actions](#github-actions)
  - [Package Managers](#package-managers)
- [Identified Issues](#identified-issues)
  - [Script Redundancy](#script-redundancy)
  - [Docker Compose Duplication](#docker-compose-duplication)
  - [GitHub Actions Fragmentation](#github-actions-fragmentation)
  - [Entry Point Confusion](#entry-point-confusion)
- [Simplification Recommendations](#simplification-recommendations)
  - [Phase 1: Eliminate Redundant Scripts](#phase-1-eliminate-redundant-scripts)
  - [Phase 2: Consolidate Docker Compose](#phase-2-consolidate-docker-compose)
  - [Phase 3: Streamline GitHub Actions](#phase-3-streamline-github-actions)
  - [Phase 4: Establish Clear Mental Model](#phase-4-establish-clear-mental-model)
- [Proposed Architecture](#proposed-architecture)
  - [Guiding Principles](#guiding-principles)
  - [Consolidated File Structure](#consolidated-file-structure)
  - [Workflow Diagram](#workflow-diagram)

## Executive Summary

The current build infrastructure accomplishes its goals but has accumulated complexity through organic growth. The primary issues are:

1. **Redundant proto generation** - Same logic in Makefile AND standalone script
2. **Nearly identical Docker Compose files** - 3 files with minor differences
3. **Fragmented CI** - 5 GitHub Actions workflows with overlapping responsibilities
4. **No clear mental model** - Developers must understand multiple entry points

**Recommendation**: Consolidate to a single source of truth per concern while preserving all functionality.

## Current State Inventory

### Shell Scripts

| Script | Lines | Purpose | Calls |
|--------|-------|---------|-------|
| `scripts/presubmit.sh` | 108 | Full CI suite | `make clean`, `make generate`, `check_quality.sh` |
| `scripts/check_quality.sh` | 95 | Lint + format + build verification | buf, ruff, pyright, Angular build, eslint |
| `scripts/gen_protos.sh` | 101 | Proto code generation | buf, ruff, prettier |
| `scripts/ship.sh` | 331 | Release automation | `make release-pr-*`, gh CLI |
| `scripts/update_vendored_protos.sh` | ~50 | Update vendored Google protos | curl, git |
| `scripts/configure_github.sh` | ~80 | One-time GitHub security setup | gh API |
| `scripts/allpaste_*.sh` | ~30 each | Code context extraction | allpaste CLI |

### Makefile

**249 lines** with these target categories:

| Category | Targets |
|----------|---------|
| Proto generation | `generate`, `regenerate`, `clean` |
| Development | `server`, `frontend`, `dev` |
| Docker | `docker-up`, `docker-up-d`, `docker-down`, `docker-rebuild` |
| Testing | `test`, `test-unit`, `test-int`, `test-e2e` |
| Quality | `quality`, `lint`, `format` |
| Release | `release-pr-{patch,minor,major}`, `release-tag` |

### Docker Files

| File | Purpose | Base Image |
|------|---------|------------|
| `.devcontainer/Dockerfile` | Dev environment | `mcr.microsoft.com/devcontainers/python:3.14` |
| `docker/backend.Dockerfile` | Production backend | `python:3.14-slim` |
| `docker/frontend.Dockerfile` | Production frontend | `node:22-slim` |
| `docker-compose.yaml` | Full dev stack | backend + frontend |
| `docker-compose.test.yaml` | Backend testing | backend only |
| `docker-compose.e2e.yaml` | E2E testing | backend only |

### GitHub Actions

| Workflow | Trigger | What It Does |
|----------|---------|--------------|
| `ci.yaml` | All PRs, pushes to main | Runs `presubmit.sh` in cached devcontainer |
| `e2e.yaml` | All PRs | Runs pytest E2E tests with Docker |
| `frontend-tests.yaml` | Frontend changes | Runs Playwright component + E2E tests |
| `build-image.yaml` | Dependency file changes | Builds/caches devcontainer image |
| `publish.yaml` | Version tags | Builds, verifies, publishes to PyPI/npm |

### Package Managers

| Manager | Config | Workspaces |
|---------|--------|------------|
| uv | `pyproject.toml` | server, plugins/python, packages/adk-sim-protos, packages/adk-sim-testing |
| npm | `package.json` | frontend, packages/adk-sim-protos-ts, packages/adk-converters-ts |

## Identified Issues

### Script Redundancy

**Problem**: `scripts/gen_protos.sh` duplicates the Makefile `generate` target.

Both do:
1. Clean output directories
2. Run `buf generate`
3. Format Python with ruff
4. Format TypeScript with prettier
5. Create `index.ts` barrel file

The only difference: `gen_protos.sh` has a more elaborate `index.ts` with explicit type exports, while Makefile has a simpler version.

**Impact**: Two places to maintain, potential for drift.

### Docker Compose Duplication

**Problem**: `docker-compose.test.yaml` and `docker-compose.e2e.yaml` are nearly identical.

| Property | test.yaml | e2e.yaml |
|----------|-----------|----------|
| Ports | 50051 | 50051, 8080 |
| DB path | `/tmp/test.db` | `/tmp/e2e-test.db` |
| Command | `python -m adk_sim_server.main` | `adk-sim` |
| Healthcheck retries | 10 | 15 |
| Healthcheck start_period | 5s | 10s |

**Impact**: Nearly identical files with minor variations that could be environment variables.

### GitHub Actions Fragmentation

**Problem**: 5 workflows with overlapping responsibilities.

1. `ci.yaml` runs `presubmit.sh` which includes backend tests
2. `e2e.yaml` also runs backend E2E tests (separately)
3. `frontend-tests.yaml` runs frontend tests that `presubmit.sh` also runs

This means:
- Backend E2E tests run in BOTH `ci.yaml` (via presubmit) AND `e2e.yaml`
- Frontend unit tests run in BOTH `ci.yaml` (via presubmit) AND `frontend-tests.yaml`

**Impact**: Longer CI times, resource waste, potential for inconsistent results.

### Entry Point Confusion

**Problem**: Multiple ways to do the same thing.

| Task | Option 1 | Option 2 |
|------|----------|----------|
| Generate protos | `make generate` | `./scripts/gen_protos.sh` |
| Run quality checks | `make quality` | `./scripts/check_quality.sh` |
| Run all checks | `./scripts/presubmit.sh` | (manual sequence) |
| Start backend | `make server` | `uv run adk-sim` |

**Impact**: Cognitive overhead, documentation burden, onboarding friction.

## Simplification Recommendations

### Phase 1: Eliminate Redundant Scripts

**Action**: Delete `scripts/gen_protos.sh` and keep proto generation in Makefile only.

**Rationale**:
- Makefile has proper dependency tracking (`.proto-generated` marker)
- Makefile is already the documented entry point
- One place to maintain is better than two

**Migration**:
1. Copy the elaborate `index.ts` generation from `gen_protos.sh` into Makefile
2. Delete `scripts/gen_protos.sh`
3. Update any documentation references

### Phase 2: Consolidate Docker Compose

**Action**: Merge test and e2e compose files using profiles or environment variables.

**Option A - Profiles** (recommended):
```yaml
# docker-compose.test.yaml (combined)
services:
  backend:
    build:
      context: .
      dockerfile: docker/backend.Dockerfile
    ports:
      - "50051:50051"
      - "${EXPOSE_HTTP_PORT:-}"
    environment:
      ADK_AGENT_SIM_DATABASE_URL: "${DB_URL:-sqlite+aiosqlite:///tmp/test.db}"
    command: ${BACKEND_CMD:-uv run adk-sim}
    healthcheck:
      retries: ${HC_RETRIES:-10}
      start_period: ${HC_START:-5s}
```

**Usage**:
```bash
# Default (for pytest-docker)
docker compose -f docker-compose.test.yaml up

# For frontend E2E (expose HTTP port, longer startup)
EXPOSE_HTTP_PORT=8080:8080 HC_RETRIES=15 HC_START=10s docker compose -f docker-compose.test.yaml up
```

**Option B - Single file with profiles**:
```yaml
services:
  backend:
    # ... base config
    profiles: ["test", "e2e"]

  backend-e2e:
    extends: backend
    profiles: ["e2e"]
    ports:
      - "8080:8080"
    healthcheck:
      retries: 15
```

### Phase 3: Streamline GitHub Actions

**Problem Analysis**:
- `ci.yaml` already runs `presubmit.sh` which runs ALL tests
- `e2e.yaml` duplicates backend E2E tests
- `frontend-tests.yaml` adds Playwright tests not in presubmit

**Recommended Consolidation**:

1. **Keep `ci.yaml`** as the single comprehensive CI workflow
2. **Enhance `presubmit.sh`** to include Playwright tests (currently missing)
3. **Convert `e2e.yaml` to conditional** - only run when `ci.yaml` doesn't (e.g., workflow_dispatch for debugging)
4. **Keep `frontend-tests.yaml`** but make it complementary (visual regression only, not duplicate unit tests)

**Target State**:
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yaml` | All PRs | Complete validation (presubmit + E2E + component tests) |
| `build-image.yaml` | Dependency changes | Cache devcontainer |
| `publish.yaml` | Tags | Build & publish |
| `frontend-tests.yaml` | Frontend changes | Visual regression snapshots only |

### Phase 4: Establish Clear Mental Model

**Goal**: Every developer should know: "There's ONE way to do X".

**Proposed Entry Points**:

| Task | Command | Notes |
|------|---------|-------|
| Generate protos | `make generate` | Automatic dependency tracking |
| Run quality checks | `make quality` | Calls check_quality.sh |
| Run all tests | `make test` | Unit + integration |
| Run E2E tests | `make test-e2e` | Requires Docker |
| Full presubmit | `./scripts/presubmit.sh` | Before git push |
| Start dev servers | `make server` / `make frontend` | Separate terminals |
| Start via Docker | `make docker-up` | Full stack |
| Release | `./scripts/ship.sh {patch\|minor\|major}` | Full automation |

**Documentation Update**: CLAUDE.md already specifies presubmit.sh - keep this as THE command.

## Proposed Architecture

### Guiding Principles

1. **Single Source of Truth**: Each concern has exactly one authoritative location
2. **Composition over Duplication**: Build complex workflows from simple building blocks
3. **Make as Entry Point**: All common tasks accessible via `make <target>`
4. **Scripts for Orchestration**: Complex multi-step workflows live in scripts/
5. **CI Mirrors Local**: `presubmit.sh` runs both locally and in CI

### Consolidated File Structure

```
/
├── Makefile                    # Developer entry point (all targets)
├── docker-compose.yaml         # Full dev stack
├── docker-compose.test.yaml    # Testing (pytest-docker + playwright e2e)
├── scripts/
│   ├── presubmit.sh           # Complete CI check (THE quality gate)
│   ├── check_quality.sh       # Lint/format/type check
│   ├── ship.sh                # Release automation
│   └── update_vendored_protos.sh  # Maintenance
├── .github/workflows/
│   ├── ci.yaml                # Main CI (runs presubmit.sh)
│   ├── build-image.yaml       # Devcontainer caching
│   └── publish.yaml           # Package publishing
└── docker/
    ├── backend.Dockerfile
    └── frontend.Dockerfile
```

**Removed/Consolidated**:
- `scripts/gen_protos.sh` → merged into Makefile
- `docker-compose.e2e.yaml` → merged into docker-compose.test.yaml
- `e2e.yaml` workflow → functionality absorbed into ci.yaml
- `frontend-tests.yaml` → reduced to visual regression only (or absorbed)

### Workflow Diagram

```
Developer Workflow:

  [Write Code] ──▶ [make quality] ──▶ [presubmit.sh] ──▶ [git push]
                         │                  │
                         ▼                  ▼
                   check_quality.sh    make test + E2E
                   (lint, format,      (pytest, playwright)
                    type check, build)

GitHub CI:

  [Push/PR] ──▶ [ci.yaml] ──▶ [presubmit.sh in devcontainer]
                    │
                    ▼ (on failure)
              Debug with:
              - `act` locally
              - Re-run specific tests

Release:

  [ship.sh patch] ──▶ [Create PR] ──▶ [Wait for CI] ──▶ [Merge] ──▶ [Tag] ──▶ [publish.yaml]
```

---

**Next Steps**:
1. Review this analysis with the team
2. Prioritize phases based on pain points
3. Implement incrementally (each phase is independent)
4. Update CLAUDE.md and developer onboarding after each phase
