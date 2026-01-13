# ADK Agent Simulator

This is a monorepo for a gRPC-based agent simulator with Python backend, Angular frontend, and protocol buffers.

## Quality Gates

Quality rules are defined in `.pre-commit-config.yaml` (single source of truth).

- Run `./scripts/presubmit.sh` before any `git push` - pushing failing code is prohibited
- Run `uv run pre-commit run --all-files` for quick quality checks (lint/format only)
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

## Key Commands

```bash
# Quality checks
./scripts/presubmit.sh               # MUST pass before push
uv run pre-commit run --all-files    # Quick quality check
make quality                         # Same as pre-commit

# Development
make generate                        # Generate proto code
make server                          # Run Python server
make frontend                        # Run Angular dev server
make format                          # Auto-format all code
```

## Project Structure

- `server/` - Python gRPC backend (async, SQLAlchemy)
- `frontend/` - Angular 21 web UI
- `protos/` - Protocol buffer definitions
- `packages/` - Shared packages (protos, testing utilities)
- `plugins/python/` - ADK agent plugin
- `mddocs/` - Linked markdown documentation
