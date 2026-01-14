# ADK Agent Simulator

This is a monorepo for a gRPC-based agent simulator with Python backend, Angular frontend, and protocol buffers.

## Quality Gates

Quality rules are defined in `.pre-commit-config.yaml` (single source of truth).

- Run `ops ci check` before any `git push` - pushing failing code is prohibited
- Run `ops quality` for quick quality checks (lint/format only)
- Pre-commit hooks run automatically:
  - `git commit`: Fast checks (lint, format, type check) on staged files
  - `git push`: Full test suite (unit, integration, e2e) + Angular build

## Git Workflow

YOU MUST use git-town for all branch management:
- `git town hack <branch>` - create new feature branches (NOT `git checkout -b`)
- `git town append <branch>` - create dependent/stacked branches
- `git town sync` - synchronize branch chains with upstream
- `git town ship` - merge completed branches

## Pull Request Standards

IMPORTANT: All PRs MUST be small and focused:
- Maximum 100-200 lines of changed code (hard limit)
- Each PR addresses a single, cohesive concern
- Implementation and tests MUST be in the same PR
- PRs with unrelated changes MUST be split

When planning features, frame them as sequences of ~50 small PRs.

## Testing Philosophy (Classicist/Detroit School)

Dependency hierarchy for tests:
1. Real implementations (preferred)
2. High-fidelity fakes in `tests/fixtures/` (for slow/IO-bound deps)
3. Mocks - ABSOLUTELY LAST RESORT, requires explicit user permission

Use state-based verification, not interaction-based verification.

## Environment

- Dev container manages all system dependencies
- Python: managed by `uv` (NOT pip)
- Frontend: managed by `npm`
- Protos: managed by `buf`
- Quality checks: managed by `pre-commit`
- Developer CLI: `ops` (installed via `uv sync`)

## Key Commands

```bash
# Quality checks (ops CLI is the primary interface)
ops ci check                             # MUST pass before push (runs all tests + checks)
ops quality                              # Quick quality check (lint, format, type check)
ops quality fix                          # Auto-fix lint/format issues

# Development
ops dev server                           # Run Python server with hot reload
ops dev frontend                         # Run Angular dev server
ops docker up                            # Run via Docker Compose

# Build
ops build                                # Full build (protos, ts, frontend, packages)
ops build protos                         # Generate proto code only
ops build frontend                       # Build Angular frontend only

# Testing
ops quality test                         # Run all tests
ops quality test unit                    # Unit tests only
ops quality test e2e                     # E2E tests (requires Docker)

# Releasing
ops release patch                        # Create patch release
ops release minor                        # Create minor release
ops release status                       # Show current version
```

## Project Structure

- `server/` - Python gRPC backend (async, SQLAlchemy)
- `frontend/` - Angular 21 web UI
- `protos/` - Protocol buffer definitions
- `packages/` - Shared packages (protos, testing utilities)
- `plugins/python/` - ADK agent plugin
- `ops/` - Unified developer CLI
- `mddocs/` - Linked markdown documentation
