---
title: Pre-commit Quality Gates Proposal
type: proposal
parent: infrastructure-analysis.md
---

# Pre-commit Quality Gates Proposal

## Table of Contents

- [Problem Statement](#problem-statement)
- [Proposed Solution](#proposed-solution)
- [Configuration](#configuration)
  - [Pre-commit Config](#pre-commit-config)
  - [Hook Explanations](#hook-explanations)
- [Developer Experience](#developer-experience)
  - [Local Workflow](#local-workflow)
  - [CI Workflow](#ci-workflow)
- [Migration Plan](#migration-plan)
  - [Phase 1: Install Pre-commit](#phase-1-install-pre-commit)
  - [Phase 2: Simplify Scripts](#phase-2-simplify-scripts)
  - [Phase 3: Update CI](#phase-3-update-ci)
  - [Phase 4: Cleanup](#phase-4-cleanup)
- [Files Affected](#files-affected)
- [Benefits](#benefits)
- [Risks and Mitigations](#risks-and-mitigations)

## Problem Statement

Our current quality enforcement is **imperative and scattered**:

| Problem | Current State |
|---------|---------------|
| Multiple entry points | `make quality`, `make lint`, `check_quality.sh`, `presubmit.sh` |
| Duplicated logic | Same checks defined in multiple scripts |
| No local enforcement | Developers can push without running checks |
| CI-only discovery | Quality issues found only after pushing |
| No incremental checks | Always runs on all files, even if unchanged |

**Root cause**: We're defining quality rules procedurally in shell scripts instead of declaratively.

## Proposed Solution

Adopt **`pre-commit`** as the single source of truth for quality gates.

```
┌─────────────────────────────────────────────────────────────────┐
│                   .pre-commit-config.yaml                       │
│                   (Declarative quality rules)                   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│  git commit   │      │   git push    │      │  CI workflow  │
│ (staged only) │      │ (all files)   │      │ (all files)   │
│    ~fast~     │      │   ~thorough~  │      │   ~required~  │
└───────────────┘      └───────────────┘      └───────────────┘
```

**Key principle**: Same rules, same tool, multiple enforcement points.

## Configuration

### Pre-commit Config

```yaml
# .pre-commit-config.yaml
# Quality gates for ADK Simulator
# Run locally: pre-commit run --all-files
# Enforced in: CI workflow

default_language_version:
  python: python3.14
  node: "22"

repos:
  # ============================================================
  # Protocol Buffers
  # ============================================================
  - repo: https://github.com/bufbuild/buf
    rev: v1.47.2
    hooks:
      - id: buf-lint
        args: [--config, buf.yaml]
      - id: buf-format
        args: [--config, buf.yaml, --diff, --exit-code]

  # ============================================================
  # Python - Linting & Formatting
  # ============================================================
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.6
    hooks:
      - id: ruff
        name: ruff (lint)
        args: [--fix, --exit-non-zero-on-fix]
        files: ^(server/|plugins/python/|packages/)/.*\.py$
        exclude: ^packages/adk-sim-protos/src/adk_sim_protos/(adksim|google)/
      - id: ruff-format
        name: ruff (format)
        files: ^(server/|plugins/python/|packages/)/.*\.py$
        exclude: ^packages/adk-sim-protos/src/adk_sim_protos/(adksim|google)/

  # ============================================================
  # Python - Type Checking
  # ============================================================
  - repo: local
    hooks:
      - id: pyright
        name: pyright (type check)
        entry: uv run pyright
        language: system
        types: [python]
        pass_filenames: false
        # Only run if Python files changed
        files: ^(server/|plugins/python/|packages/)/.*\.py$
        exclude: ^packages/adk-sim-protos/src/adk_sim_protos/(adksim|google)/

  # ============================================================
  # TypeScript/Angular - Linting
  # ============================================================
  - repo: local
    hooks:
      - id: eslint
        name: eslint (frontend)
        entry: npm run lint --workspace=frontend --
        language: system
        files: ^frontend/.*\.(ts|html)$
        pass_filenames: false

  # ============================================================
  # TypeScript - Formatting
  # ============================================================
  - repo: local
    hooks:
      - id: prettier
        name: prettier (typescript)
        entry: npx prettier --check
        language: system
        files: \.(ts|tsx|js|jsx|json|html|css|scss)$
        exclude: ^(node_modules/|dist/|\.angular/)

  # ============================================================
  # Angular - Build Verification (AOT template checking)
  # ============================================================
  - repo: local
    hooks:
      - id: angular-build
        name: angular build (template verification)
        entry: bash -c 'cd frontend && CI=true npm run build -- --configuration production --no-progress'
        language: system
        files: ^frontend/.*\.(ts|html|scss)$
        pass_filenames: false
        stages: [pre-push, manual]  # Only on push, not every commit

  # ============================================================
  # General - File hygiene
  # ============================================================
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: trailing-whitespace
        exclude: ^.*\.(snap|lock)$
      - id: end-of-file-fixer
        exclude: ^.*\.(snap|lock)$
      - id: check-yaml
        args: [--unsafe]  # Allow custom tags
      - id: check-json
      - id: check-merge-conflict
      - id: check-added-large-files
        args: [--maxkb=500]
```

### Hook Explanations

| Hook | Tool | Stage | Purpose |
|------|------|-------|---------|
| `buf-lint` | buf | commit | Validate proto files against buf.yaml rules |
| `buf-format` | buf | commit | Ensure proto files are formatted |
| `ruff` | ruff | commit | Python linting with auto-fix |
| `ruff-format` | ruff | commit | Python formatting |
| `pyright` | pyright | commit | Python type checking |
| `eslint` | eslint | commit | TypeScript/Angular linting |
| `prettier` | prettier | commit | TypeScript/JSON/HTML formatting |
| `angular-build` | ng build | push | AOT template verification (slow) |
| `trailing-whitespace` | built-in | commit | Remove trailing whitespace |
| `end-of-file-fixer` | built-in | commit | Ensure files end with newline |
| `check-yaml` | built-in | commit | Validate YAML syntax |
| `check-json` | built-in | commit | Validate JSON syntax |
| `check-merge-conflict` | built-in | commit | Catch unresolved merge markers |
| `check-added-large-files` | built-in | commit | Prevent accidental large file commits |

## Developer Experience

### Local Workflow

**First-time setup** (once per machine):
```bash
# Install pre-commit (already in dev dependencies)
uv sync

# Install git hooks
uv run pre-commit install
uv run pre-commit install --hook-type pre-push
```

**Daily workflow**:
```bash
# Automatic on git commit (staged files only)
git add .
git commit -m "feat: add feature"
# → pre-commit runs automatically
# → Blocks commit if checks fail
# → Auto-fixes what it can (ruff --fix, prettier --write)

# Manual full check (before opening PR)
uv run pre-commit run --all-files

# Skip hooks in emergency (use sparingly)
git commit --no-verify -m "wip: broken but need to save"
```

**What developers see**:
```
$ git commit -m "feat: add new endpoint"
buf-lint.................................................................Passed
buf-format...............................................................Passed
ruff (lint)..............................................................Passed
ruff (format)............................................................Passed
pyright (type check).....................................................Passed
eslint (frontend)........................................................Passed
prettier (typescript)....................................................Passed
trailing-whitespace......................................................Passed
end-of-file-fixer........................................................Passed
check-yaml...............................................................Passed
check-json...............................................................Passed
check-merge-conflict.....................................................Passed
check-added-large-files..................................................Passed
[main abc1234] feat: add new endpoint
```

### CI Workflow

**Simplified CI** (`.github/workflows/ci.yaml`):
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  quality:
    name: Quality Gates
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.14'

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: |
          pip install pre-commit
          uv sync --frozen
          npm ci

      - name: Run pre-commit
        run: pre-commit run --all-files --show-diff-on-failure

  test:
    name: Tests
    needs: quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ... test setup and execution
```

## Migration Plan

### Phase 1: Install Pre-commit

**Duration**: Single PR

1. Add pre-commit to dev dependencies:
   ```toml
   # pyproject.toml
   [dependency-groups]
   dev = [
       # ... existing
       "pre-commit>=4.0.0",
   ]
   ```

2. Create `.pre-commit-config.yaml` (as shown above)

3. Add to devcontainer init:
   ```bash
   # .devcontainer/init.sh
   uv run pre-commit install
   uv run pre-commit install --hook-type pre-push
   ```

4. Run initial baseline:
   ```bash
   uv run pre-commit run --all-files
   # Fix any issues found
   ```

### Phase 2: Simplify Scripts

**Duration**: Single PR (after Phase 1 lands)

1. **Simplify `check_quality.sh`**:
   ```bash
   #!/bin/bash
   # Unified quality checks - delegates to pre-commit
   set -e

   echo "Running quality checks..."
   uv run pre-commit run --all-files

   echo "✅ All quality checks passed!"
   ```

2. **Simplify `presubmit.sh`**:
   ```bash
   #!/bin/bash
   set -e

   echo "🚀 Starting Presubmit Checks..."

   # Proto generation (still needed - not a quality check)
   make clean && make generate

   # Quality checks (now delegated)
   uv run pre-commit run --all-files

   # Tests
   echo "🧪 Running Backend Tests..."
   uv run pytest server/tests/unit plugins/python/tests -v

   echo "🧪 Running Frontend Tests..."
   cd frontend && CI=true npm test

   echo "✅ All presubmit checks passed!"
   ```

3. **Simplify Makefile**:
   ```makefile
   quality: generate
   	@echo "🔍 Running quality checks..."
   	uv run pre-commit run --all-files

   lint: generate
   	@echo "🔍 Running linters (no auto-fix)..."
   	uv run pre-commit run --all-files

   format:
   	@echo "🎨 Formatting all code..."
   	uv run pre-commit run --all-files || true
   	@echo "✅ Formatting complete!"
   ```

### Phase 3: Update CI

**Duration**: Single PR (after Phase 2 lands)

1. Update `ci.yaml` to use pre-commit (as shown in CI Workflow section)
2. Remove redundant quality steps from other workflows
3. Keep test-specific jobs separate

### Phase 4: Cleanup

**Duration**: Single PR (after Phase 3 validated)

1. Remove now-unused code from `check_quality.sh` (keep as thin wrapper)
2. Update documentation (CLAUDE.md, README)
3. Remove any orphaned quality-check code

## Files Affected

| File | Change |
|------|--------|
| `.pre-commit-config.yaml` | **New** - Quality gate definitions |
| `pyproject.toml` | Add pre-commit dependency |
| `.devcontainer/init.sh` | Add hook installation |
| `scripts/check_quality.sh` | Simplify to delegate to pre-commit |
| `scripts/presubmit.sh` | Simplify quality section |
| `Makefile` | Simplify quality/lint/format targets |
| `.github/workflows/ci.yaml` | Use pre-commit instead of manual tool calls |
| `CLAUDE.md` | Update developer instructions |

## Benefits

| Benefit | Before | After |
|---------|--------|-------|
| **Single source of truth** | Rules in 3+ scripts | Rules in `.pre-commit-config.yaml` |
| **Local enforcement** | Optional `make quality` | Automatic on commit |
| **Incremental checks** | Always all files | Only staged files on commit |
| **Consistent CI/local** | Different code paths | Same pre-commit command |
| **Auto-fixing** | Manual `make format` | Automatic on commit |
| **Caching** | None | Pre-commit caches tool installations |
| **Ecosystem** | Custom scripts | 1000+ community hooks available |

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| **Slow commits** | Configure slow checks (Angular build) for push-only stage |
| **Developer friction** | Provide `--no-verify` escape hatch, document clearly |
| **Hook installation forgotten** | Automated in devcontainer init.sh |
| **CI/local divergence** | Both run identical `pre-commit run --all-files` |
| **Tool version drift** | Versions pinned in `.pre-commit-config.yaml` |

---

**Next Steps**:
1. Review and approve this proposal
2. Create PR implementing Phase 1
3. Validate with team for 1-2 weeks
4. Proceed with Phases 2-4
