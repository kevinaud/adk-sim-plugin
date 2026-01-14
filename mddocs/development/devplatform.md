---
title: Developer Platform Documentation
type: reference
---

# Developer Platform Documentation

This document is the **single source of truth** for understanding the project's development infrastructure. It covers quality gates, build systems, testing, CI/CD, and publishing.

## Table of Contents

- [Mental Model](#mental-model)
- [Quality Stack](#quality-stack)
  - [Pre-commit Hooks](#pre-commit-hooks)
  - [Python Quality](#python-quality)
  - [TypeScript/Angular Quality](#typescriptangular-quality)
  - [Protobuf Quality](#protobuf-quality)
- [Build Systems](#build-systems)
  - [Makefile](#makefile)
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
- [Common Commands](#common-commands)

---

## Mental Model

```
┌──────────────────────────────────────────────────────────────────────┐
│                        DEVELOPER WORKFLOW                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Local Development                    Quality Gates                  │
│  ─────────────────                    ─────────────                  │
│  make server         ──────────►      git commit                     │
│  make frontend                           │                           │
│  docker compose up                       ▼                           │
│                                  .pre-commit-config.yaml             │
│                                  (ruff, pyright, eslint, prettier)   │
│                                          │                           │
│                                          ▼                           │
│                                      git push                        │
│                                          │                           │
│                                          ▼                           │
│                                  pre-push hooks                      │
│                                  (tests, angular build, check-gen)   │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  CI Pipeline (.github/workflows/ci.yaml)                             │
│  ───────────────────────────────────────                             │
│  Pull Request → devcontainer/ci → presubmit.sh → pre-commit --all    │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Release Pipeline                                                    │
│  ────────────────                                                    │
│  ./scripts/ship.sh {patch|minor|major}                               │
│        │                                                             │
│        ├──► Create release PR (version bumps)                        │
│        ├──► Wait for CI                                              │
│        ├──► Merge PR                                                 │
│        └──► Create version tag ──► .github/workflows/publish.yaml    │
│                                        │                             │
│                                        ├──► PyPI (OIDC)              │
│                                        └──► npm (OIDC)               │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
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

**Running Checks**:

```bash
# Quick check (commit-stage hooks)
uv run pre-commit run --all-files

# Full check (all stages including tests)
uv run pre-commit run --all-files --hook-stage manual

# Via Makefile
make quality  # Quick check
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

### Makefile

**File**: `Makefile`

The Makefile provides developer-friendly commands that wrap underlying tools.

**Key Targets**:

| Target | Command | Description |
|--------|---------|-------------|
| `help` | `make help` | Show all available commands |
| `generate` | `make generate` | Generate proto code |
| `server` | `make server` | Start backend gRPC server |
| `frontend` | `make frontend` | Start frontend dev server |
| `quality` | `make quality` | Run pre-commit checks |
| `test` | `make test` | Run unit + integration tests |
| `test-e2e` | `make test-e2e` | Run E2E tests (requires Docker) |
| `build` | `make build` | Full release build |
| `bundle` | `make bundle` | Bundle frontend into server |
| `clean` | `make clean` | Remove generated files |

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
make generate        # Generate with caching
make clean generate  # Force regeneration
```

### Package Building

**File**: `scripts/build.sh`

Unified build script with granular control:

```bash
./scripts/build.sh protos    # Proto generation only
./scripts/build.sh ts        # TypeScript packages only
./scripts/build.sh frontend  # Frontend bundle only
./scripts/build.sh packages  # Python packages only
./scripts/build.sh all       # Full build
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
make test       # Unit + integration (no Docker)
make test-e2e   # E2E tests (requires Docker)

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

The CI pipeline runs in a cached devcontainer image:

1. Checkout code
2. Login to GHCR (for cached image)
3. Run `./scripts/presubmit.sh` inside devcontainer

**Presubmit Script** (`scripts/presubmit.sh`):

1. Install dependencies (`npm install`, `uv sync`)
2. Build TS packages (required for frontend)
3. Run all pre-commit hooks with `--hook-stage manual`

This ensures CI runs **exactly the same checks** as local pre-push hooks.

---

## Publishing

### Release Process

**File**: `scripts/ship.sh`

Automated release process:

```bash
./scripts/ship.sh patch   # Bug fixes (0.1.0 → 0.1.1)
./scripts/ship.sh minor   # New features (0.1.0 → 0.2.0)
./scripts/ship.sh major   # Breaking changes (0.1.0 → 1.0.0)
```

**Steps**:
1. Create release PR with version bumps
2. Monitor CI checks until pass
3. Prompt to merge PR
4. Pull merged changes
5. Create and push version tag
6. Tag push triggers publish workflow

**Version Synchronization**:
- `scripts/get_next_version.py`: Calculate next version
- `scripts/sync_versions.py`: Update all package versions

All packages are **version-locked** — they all bump to the same version.

### OIDC Trusted Publishers

**No stored secrets** — publishing uses OIDC for authentication.

**PyPI**:
- Configured in PyPI trusted publisher settings
- Workflow: `publish.yaml`
- Environment: `pypi`

**npm**:
- Uses OIDC provenance
- Published with `--provenance` flag

---

## Common Commands

### Daily Development

```bash
# Start development servers
make server      # Terminal 1: Backend
make frontend    # Terminal 2: Frontend

# Or use Docker
docker compose up
```

### Before Committing

```bash
# Quick quality check
make quality

# Or directly
uv run pre-commit run --all-files
```

### Before Pushing

```bash
# Full check including tests
uv run pre-commit run --all-files --hook-stage manual

# Or run presubmit (same thing)
./scripts/presubmit.sh
```

### Releasing

```bash
./scripts/ship.sh patch  # or minor/major
```

---

## Infrastructure Files Reference

| File | Purpose |
|------|---------|
| `.pre-commit-config.yaml` | Quality gates (single source of truth) |
| `Makefile` | Developer commands |
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
| `scripts/presubmit.sh` | Local CI equivalent |
| `scripts/build.sh` | Unified build |
| `scripts/ship.sh` | Release automation |
