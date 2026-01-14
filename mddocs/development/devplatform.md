---
title: Developer Platform Documentation
type: reference
---

# Developer Platform Documentation

This document is the **single source of truth** for understanding the project's development infrastructure. It covers quality gates, build systems, testing, CI/CD, and publishing.

## Table of Contents

- [Mental Model](#mental-model)
- [The ops CLI](#the-ops-cli)
  - [Command Structure](#command-structure)
  - [Global Options](#global-options)
  - [Quick Reference](#quick-reference)
- [Quality Stack](#quality-stack)
  - [Pre-commit Hooks](#pre-commit-hooks)
  - [Python Quality](#python-quality)
  - [TypeScript/Angular Quality](#typescriptangular-quality)
  - [Protobuf Quality](#protobuf-quality)
- [Build Systems](#build-systems)
  - [Proto Generation](#proto-generation)
  - [Package Building](#package-building)
- [Development Environment](#development-environment)
  - [Devcontainer](#devcontainer)
  - [Docker Compose](#docker-compose)
- [Testing](#testing)
  - [Python Tests](#python-tests)
  - [Frontend Tests](#frontend-tests)
- [CI/CD](#cicd)
  - [GitHub Actions Workflows](#github-actions-workflows)
  - [CI Pipeline](#ci-pipeline)
- [Publishing](#publishing)
  - [Release Process](#release-process)
  - [OIDC Trusted Publishers](#oidc-trusted-publishers)
  - [Testing Publish Locally](#testing-publish-locally)
- [Common Commands](#common-commands)
  - [Daily Development](#daily-development)
  - [Before Committing](#before-committing)
  - [Before Pushing](#before-pushing)
  - [Releasing](#releasing)
- [Infrastructure Files Reference](#infrastructure-files-reference)

## Mental Model

```
+----------------------------------------------------------------------+
|                        DEVELOPER WORKFLOW                            |
+----------------------------------------------------------------------+
|                                                                      |
|  Local Development                    Quality Gates                  |
|  -----------------                    -------------                  |
|  ops dev server        ------------->      git commit                |
|  ops dev frontend                           |                        |
|  ops docker up                              v                        |
|                                  .pre-commit-config.yaml             |
|                                  (ruff, pyright, eslint, prettier)   |
|                                          |                           |
|                                          v                           |
|                                      git push                        |
|                                          |                           |
|                                          v                           |
|                                  pre-push hooks                      |
|                                  (tests, angular build, check-gen)   |
|                                                                      |
+----------------------------------------------------------------------+
|                                                                      |
|  CI Pipeline (.github/workflows/ci.yaml)                             |
|  ---------------------------------------                             |
|  Pull Request -> lightweight setup -> ops ci check -> pre-commit     |
|                  (uv, node, buf)                                     |
|                                                                      |
|  Local Testing: ops ci test ci (uses act)                            |
|                                                                      |
+----------------------------------------------------------------------+
|                                                                      |
|  Devcontainer Verification (runs only when .devcontainer/ changes)   |
|  -----------------------------------------------------------------   |
|  Uses dorny/paths-filter to detect changes, builds image to verify   |
|                                                                      |
+----------------------------------------------------------------------+
|                                                                      |
|  Release Pipeline                                                    |
|  ----------------                                                    |
|  ops release patch|minor|major                                       |
|        |                                                             |
|        +--> Create release PR (version bumps)                        |
|        +--> Wait for CI                                              |
|        +--> Merge PR                                                 |
|        +--> Create version tag ---> .github/workflows/publish.yaml   |
|                                        |                             |
|                                        +--> PyPI (OIDC)              |
|                                        +--> npm (OIDC)               |
|                                                                      |
|  Local Testing: ops ci test publish (dry-run mode)                   |
|                                                                      |
+----------------------------------------------------------------------+
```

---

## The ops CLI

The **ops CLI** is the unified developer interface for all build, test, quality, and release operations. It consolidates what was previously spread across Makefiles, shell scripts, and standalone Python scripts into a single, type-safe Python CLI.

**Package**: `ops/` (workspace member, installed via `uv sync`)

**Entry point**: `ops` (available after `uv sync`)

For detailed implementation information, see the [ops CLI TDD](ops-cli/tdd.md).

### Command Structure

```
ops
+-- build                    # Build artifacts
|   +-- protos               # Generate proto code (Python + TypeScript)
|   +-- frontend             # Build Angular production bundle
|   +-- packages             # Build Python wheel/sdist
|   +-- all                  # Full build (default)
+-- dev                      # Development servers
|   +-- server               # Start backend gRPC server
|   +-- frontend             # Start frontend dev server
+-- docker                   # Docker operations
|   +-- up                   # Start containers
|   +-- down                 # Stop containers
|   +-- logs                 # View container logs
|   +-- ps                   # List running containers
+-- quality                  # Quality checks
|   +-- check                # Run all checks (default)
|   +-- fix                  # Run with auto-fix
|   +-- test                 # Run test suite
|       +-- unit             # Unit tests only
|       +-- integration      # Integration tests
|       +-- e2e              # E2E tests (requires Docker)
+-- ci                       # CI pipeline commands
|   +-- check                # Run full CI validation (default)
|   +-- build                # Build release artifacts
|   +-- verify               # Verify artifacts work
|   +-- matrix               # Output CI matrix as JSON
|   +-- test                 # Run workflows locally with act
+-- release                  # Release management
|   +-- patch                # Bump patch version (x.y.Z)
|   +-- minor                # Bump minor version (x.Y.0)
|   +-- major                # Bump major version (X.0.0)
|   +-- status               # Show current version info
```

### Global Options

| Flag | Short | Description |
|------|-------|-------------|
| `--help` | `-h` | Show help for command |
| `--verbose` | `-v` | Show detailed output |
| `--version` | | Show ops version |

### Quick Reference

```bash
# Development
ops dev server               # Start backend gRPC server
ops dev frontend             # Start frontend dev server
ops docker up                # Start via Docker Compose

# Quality & Testing
ops quality                  # Run quality checks (lint, format, type check)
ops quality fix              # Auto-fix issues
ops quality test             # Run all tests
ops quality test unit        # Run unit tests only
ops quality test e2e         # Run E2E tests

# CI (same checks as GitHub Actions)
ops ci check                 # Run full CI validation
ops ci check --skip-e2e      # Skip slow E2E tests
ops ci test ci               # Run ci.yaml locally with act
ops ci test publish          # Run publish.yaml in dry-run mode

# Building
ops build                    # Build everything
ops build protos             # Generate proto code only
ops build frontend           # Build Angular bundle
ops build --clean            # Clean then build

# Releasing
ops release status           # Show current version
ops release patch            # Create patch release
ops release minor            # Create minor release
ops release patch --dry-run  # Preview release steps
```

---

## Quality Stack

### Pre-commit Hooks

**File**: `.pre-commit-config.yaml`

Pre-commit is the **single source of truth** for all quality checks. It runs the same checks locally and in CI.

**Stages**:

| Stage | When | What Runs |
|-------|------|-----------|
| `commit` | Every `git commit` | Fast checks: lint, format, type-check |
| `pre-push` | Every `git push` | Full suite: tests, Angular build, generated code check |
| `manual` | Explicit invocation | Same as pre-push |

**E2E Test Optimization**:

E2E tests are skipped during `pre-push` when **only** documentation/config files are changed.

Skip patterns (files that cannot affect runtime):
- `mddocs/` - Documentation
- `.github/agents/` - Copilot agent definitions
- `.claude/` - Claude configuration
- `README.md`, `CLAUDE.md` - Root documentation
- `.vscode/` - Editor configuration
- `git-town.toml` - Git workflow config

**Running Checks**:

```bash
# Quick check (commit-stage hooks)
ops quality check
# or directly:
uv run pre-commit run --all-files

# Full check (all stages including tests)
ops ci check
# or directly:
uv run pre-commit run --all-files --hook-stage manual
```

### Python Quality

| Tool | Config | Purpose |
|------|--------|---------|
| **ruff** | `pyproject.toml [tool.ruff]` | Linting + formatting (replaces flake8, isort, black) |
| **pyright** | `pyproject.toml [tool.pyright]` | Type checking (strict mode) |
| **pytest** | `pyproject.toml [tool.pytest]` | Test runner |

**Ruff Rules** (from `pyproject.toml`):
- `E`, `F`: pycodestyle + pyflakes (standard Python style)
- `I`: isort (import sorting)
- `UP`, `FURB`: pyupgrade + refurb (modernization)
- `SIM`, `B`, `C4`: simplify, bugbear, comprehensions
- `TID`: flake8-tidy-imports (bans `typing.Optional`, etc.)
- `TC`: flake8-type-checking (TYPE_CHECKING blocks)
- `PT`: pytest-style

**Pyright Settings**:
- `typeCheckingMode = "strict"`
- `pythonVersion = "3.14"`
- Excludes generated proto code

### TypeScript/Angular Quality

| Tool | Config | Purpose |
|------|--------|---------|
| **eslint** | `frontend/eslint.config.js` | Linting |
| **prettier** | workspace root | Formatting |
| **Angular CLI** | `frontend/angular.json` | AOT build verification |

### Protobuf Quality

| Tool | Config | Purpose |
|------|--------|---------|
| **buf-lint** | `buf.yaml` | Linting (STANDARD + COMMENTS + versioning rules) |
| **buf-format** | `buf.yaml` | Formatting |
| **buf-generate** | `buf.gen.yaml` | Code generation |

**Lint Rules** (from `buf.yaml`):
- `STANDARD`: Core protobuf best practices
- `COMMENTS`: All definitions must have comments
- `PACKAGE_VERSION_SUFFIX`: Enforce `v1`, `v1beta1` suffixes
- `RPC_REQUEST_STANDARD_NAME`: Request messages match RPC name
- `RPC_RESPONSE_STANDARD_NAME`: Response messages match RPC name
- `RPC_REQUEST_RESPONSE_UNIQUE`: Unique request/response per RPC

---

## Build Systems

### Proto Generation

**Files**: `buf.yaml`, `buf.gen.yaml`

Proto generation uses **buf** to generate both Python (betterproto) and TypeScript (protobuf-es) code.

**Output Directories**:
- Python: `packages/adk-sim-protos/src/adk_sim_protos/`
- TypeScript: `packages/adk-sim-protos-ts/src/`

**Special Handling**:
- `index.ts` in TS output is hand-written and preserved during generation
- Generated Python code is auto-formatted with ruff
- Generated TS code is auto-formatted with prettier

**Commands**:

```bash
ops build protos         # Generate with caching
ops build protos --clean # Force regeneration
```

### Package Building

The ops CLI provides unified build commands with dependency management:

```bash
ops build protos     # Proto generation only
ops build frontend   # Frontend bundle (auto-generates protos)
ops build packages   # Python packages (auto-generates protos + frontend)
ops build            # Full build (all of the above)
```

**Published Packages**:

| Package | Registry | Language |
|---------|----------|----------|
| `adk-sim-protos` | PyPI | Python |
| `adk-sim-testing` | PyPI | Python |
| `adk-sim-server` | PyPI | Python |
| `adk-agent-sim` | PyPI | Python |
| `@adk-sim/protos` | npm | TypeScript |

---

## Development Environment

### Devcontainer

**Files**: `.devcontainer/devcontainer.json`, `.devcontainer/Dockerfile`

The devcontainer provides a consistent development environment with all tools pre-installed.

**Features**:
- Docker-in-Docker (for running compose stacks)
- uv (Python package manager)
- Node.js 22 + npm
- GitHub CLI
- Prettier, jq, vim, cloc

**VS Code Extensions** (auto-installed):
- Python, Pylance, Ruff
- Angular Language Service
- Jupyter
- GitHub Copilot

**Ports Forwarded**:
- `4200`: Frontend dev server
- `8080`: Backend HTTP server
- `50051`: Backend gRPC server

**Lifecycle Scripts**:
- `init.sh`: Post-create setup (uv sync, npm install, pre-commit install)
- `post-start.sh`: Post-start setup (GitHub auth)

### Docker Compose

**Files**:

| File | Purpose |
|------|---------|
| `docker-compose.yaml` | Full dev stack (backend + frontend with hot reload) |
| `docker-compose.test.yaml` | Backend-only for E2E tests |

**Full Stack** (`docker-compose.yaml`):
- Backend: Python server with volume mounts for hot reload
- Frontend: Angular dev server with proxy to backend
- Persisted database in named volume

**Test Stack** (`docker-compose.test.yaml`):
- Backend only with ephemeral SQLite database
- Used by pytest-docker for E2E tests

**Commands**:

```bash
ops docker up        # Start containers (foreground)
ops docker up -d     # Start containers (background)
ops docker down      # Stop containers
ops docker logs      # View container logs
ops docker ps        # List running containers
```

---

## Testing

### Python Tests

**Config**: `pyproject.toml [tool.pytest]`

**Test Directories**:
- `server/tests/unit/`: Unit tests
- `server/tests/e2e/`: E2E tests (require Docker)
- `plugins/python/tests/`: Plugin tests

**Commands**:

```bash
ops quality test           # All tests
ops quality test unit      # Unit + integration (no Docker)
ops quality test e2e       # E2E tests (requires Docker)

# Direct pytest
uv run pytest server/tests/unit -v
uv run pytest server/tests/e2e --run-e2e -v
```

**Markers**:
- `@pytest.mark.e2e`: Requires `--run-e2e` flag and Docker

### Frontend Tests

**Test Frameworks**:

| Framework | Config | Purpose |
|-----------|--------|---------|
| **Vitest** | `frontend/vitest.config.ts` | Unit tests |
| **Playwright (CT)** | `frontend/playwright-ct.config.ts` | Component tests |
| **Playwright (E2E)** | `frontend/playwright.config.ts` | E2E tests |

**Commands**:

```bash
cd frontend

# Unit tests (Vitest)
npm test
npm run ng -- test --watch=false

# Component tests (Playwright)
npx playwright test -c playwright-ct.config.ts

# E2E tests (Playwright)
npx playwright test -c playwright.config.ts
```

---

## CI/CD

### GitHub Actions Workflows

**Files**: `.github/workflows/`

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yaml` | All PRs, pushes to main | Run quality checks and tests |
| `build-image.yaml` | Dependency file changes | Build/cache devcontainer image |
| `publish.yaml` | Version tags (`v*`) | Publish to PyPI and npm |
| `codeql.yml` | Schedule + PRs | Security scanning |

### CI Pipeline

**File**: `.github/workflows/ci.yaml`

The CI pipeline uses a **lightweight setup** for fast startup (~30s vs ~5min with devcontainer):

1. Setup uv with `astral-sh/setup-uv@v7`
2. Setup Node.js with `actions/setup-node@v4`
3. Install buf CLI globally
4. Install dependencies (`npm ci`, `uv sync`)
5. Run `ops ci check`

**Devcontainer Verification Job**:

A separate job verifies the devcontainer still builds when relevant files change:
- `.devcontainer/**`
- `pyproject.toml`, `uv.lock`
- `package.json`, `package-lock.json`

This ensures devcontainer changes don't break builds while keeping the main CI fast.

**CI Check Command** (`ops ci check`):

1. Install dependencies (`npm install`, `uv sync`)
2. Build TS packages (required for frontend)
3. Run all pre-commit hooks with `--hook-stage manual`
4. Run all test suites

This ensures CI runs **exactly the same checks** as local pre-push hooks.

**Local CI Reproduction**:

```bash
# Run the exact same checks that CI runs
ops ci check

# Skip slow E2E tests
ops ci check --skip-e2e

# Stop on first failure
ops ci check --fail-fast

# Run workflow locally with act (requires Docker)
ops ci test ci

# Test publish workflow in dry-run mode
ops ci test publish
```

---

## Publishing

### Release Process

**Command**: `ops release {patch|minor|major}`

Automated release process:

```bash
ops release patch   # Bug fixes (0.1.0 -> 0.1.1)
ops release minor   # New features (0.1.0 -> 0.2.0)
ops release major   # Breaking changes (0.1.0 -> 1.0.0)
```

**Steps**:
1. Create release PR with version bumps
2. Monitor CI checks until pass
3. Prompt to merge PR
4. Pull merged changes
5. Create and push version tag
6. Tag push triggers publish workflow

**Options**:

| Flag | Description |
|------|-------------|
| `--yes`, `-y` | Auto-confirm prompts (fully automated) |
| `--skip-ci` | Don't wait for CI checks |
| `--dry-run`, `-n` | Show what would happen without executing |
| `--verbose`, `-v` | Show detailed output |

**Version Synchronization**:
- `scripts/sync_versions.py`: Update all package versions

All packages are **version-locked** - they all bump to the same version.

### OIDC Trusted Publishers

**No stored secrets** - publishing uses OIDC for authentication.

**PyPI**:
- Configured in PyPI trusted publisher settings
- Workflow: `publish.yaml`
- Environment: `pypi`

**npm**:
- Uses OIDC provenance
- Published with `--provenance` flag

### Testing Publish Locally

The publish workflow supports a **dry-run mode** for local testing:

```bash
# Run publish workflow locally (skips actual publishing)
ops ci test publish
```

This sets `DRY_RUN=true` which:
- Runs the full build and verification steps
- Skips the `publish-pypi` and `publish-npm` jobs
- Validates the workflow without risking accidental releases

The workflow also supports manual dispatch via GitHub UI with an optional dry-run checkbox.

---

## Common Commands

### Daily Development

```bash
# Start development servers
ops dev server       # Terminal 1: Backend
ops dev frontend     # Terminal 2: Frontend

# Or use Docker
ops docker up
```

### Before Committing

```bash
# Quick quality check
ops quality check

# Auto-fix issues
ops quality fix
```

### Before Pushing

```bash
# Full check including tests (same as CI)
ops ci check

# Or run pre-commit directly
uv run pre-commit run --all-files --hook-stage manual
```

### Releasing

```bash
# Show current version and status
ops release status

# Create a release
ops release patch    # or minor/major

# Preview without executing
ops release patch --dry-run
```

---

## Infrastructure Files Reference

| File | Purpose |
|------|---------|
| `ops/` | Unified developer CLI (Python package) |
| `.pre-commit-config.yaml` | Quality gates (single source of truth) |
| `pyproject.toml` | Python workspace, ruff, pyright, pytest config |
| `package.json` | npm workspace config |
| `buf.yaml` | Protobuf linting rules |
| `buf.gen.yaml` | Protobuf code generation |
| `.devcontainer/devcontainer.json` | Dev container config |
| `.devcontainer/Dockerfile` | Dev container image |
| `docker-compose.yaml` | Full dev stack |
| `docker-compose.test.yaml` | Test stack |
| `.github/workflows/ci.yaml` | CI pipeline |
| `.github/workflows/publish.yaml` | Publishing pipeline |
| `scripts/sync_versions.py` | Version synchronization |
| `mddocs/development/ops-cli/tdd.md` | ops CLI design document |
