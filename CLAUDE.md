# ADK Agent Simulator

This is a monorepo for a gRPC-based agent simulator with Python backend, Angular frontend, and protocol buffers.

## Quality Gates

Quality rules are defined in `.jj/repo/config.toml` (jj-native quality gates).

- Run `jj secure-push` instead of `jj git push` - runs full verification pipeline then pushes
- Run `jj fix` to auto-format modified files (ruff, prettier, buf format)
- Run `jj quality` for quick quality checks (format + lint + type-check, no tests)
- Run `ops ci check` for CI-style verification (equivalent to `jj secure-push` without push)

## Version Control (Jujutsu)

This project uses **Jujutsu (jj) exclusively**. Git commands are prohibited.

Load the `jujutsu` skill before any VCS operation. See `.claude/skills/jujutsu/` for workflows.

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
- Quality checks: managed by `jj` (see `.jj/repo/config.toml`)
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
