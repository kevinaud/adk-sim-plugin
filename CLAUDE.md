# ADK Agent Simulator

This is a monorepo for a gRPC-based agent simulator with Python backend, Angular frontend, and protocol buffers.

## Quality Gates

- Run `./scripts/presubmit.sh` before any `git push` - pushing failing code is prohibited
- Run `./scripts/check_quality.sh` before considering code complete

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

## Key Commands

```bash
# Quality checks
./scripts/presubmit.sh      # MUST pass before push
./scripts/check_quality.sh  # Run before code complete

# Development
make protos                  # Generate proto code
make server                  # Run Python server
make frontend                # Run Angular dev server
```

## Project Structure

- `server/` - Python gRPC backend (async, SQLAlchemy)
- `frontend/` - Angular 21 web UI
- `protos/` - Protocol buffer definitions
- `packages/` - Shared packages (protos, testing utilities)
- `plugins/python/` - ADK agent plugin
- `mddocs/` - Linked markdown documentation
