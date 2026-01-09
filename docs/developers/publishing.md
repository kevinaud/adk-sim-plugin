# Publishing Guide

This document describes how to release new versions of the ADK Simulator packages.

## Overview

The repository publishes 5 packages to public registries:

| Package | Registry | Language |
|---------|----------|----------|
| `adk-sim-protos` | PyPI | Python |
| `adk-sim-testing` | PyPI | Python |
| `adk-sim-server` | PyPI | Python |
| `adk-agent-sim` | PyPI | Python |
| `@adk-sim/protos` | npm | TypeScript |

All packages are **version-locked** — when one bumps, they all bump to the same version.

## Quick Start

To release a new version:

```bash
./scripts/ship.sh patch   # For bug fixes (0.1.0 → 0.1.1)
./scripts/ship.sh minor   # For new features (0.1.0 → 0.2.0)
./scripts/ship.sh major   # For breaking changes (0.1.0 → 1.0.0)
```

The script will:
1. Create a release PR with version bumps
2. Monitor CI checks until they pass
3. Prompt you to merge the PR
4. Pull the merged changes
5. Create and push a version tag (e.g., `v0.2.0`)

The tag push triggers the publish workflow automatically.

## Architecture

### Authentication: OIDC Trusted Publishers

We use **OIDC (OpenID Connect) Trusted Publishers** instead of stored API tokens. This means:

- **No secrets to manage** — No `PYPI_TOKEN` or `NPM_TOKEN` in repository secrets
- **Cryptographic verification** — The registry verifies the workflow identity
- **Scoped permissions** — Only the `publish.yaml` workflow can publish

#### PyPI Configuration

PyPI trusted publisher is configured with:
- **Repository**: `kevinaud/adk-sim-plugin`
- **Workflow**: `publish.yaml`
- **Environment**: `pypi`

#### npm Configuration

npm trusted publisher is configured with:
- **Repository**: `kevinaud/adk-sim-plugin`
- **Workflow**: `publish.yaml`
- **Environment**: (none)

### Workflow: `.github/workflows/publish.yaml`

Triggered by: `push` to tags matching `v*`

**Jobs:**

1. **`verify-build`** — Builds all packages and verifies they're installable
   - Builds Python wheels with `uv build`
   - Builds TypeScript with `npm run build`
   - Installs the leaf package (`adk-sim-server`) from local wheels
   - Runs smoke tests to verify imports work
   - Uploads artifacts for the publish jobs

2. **`publish-pypi`** — Publishes Python packages to PyPI
   - Uses OIDC with `environment: pypi`
   - Publishes all 4 Python packages
   - Uses `skip-existing: true` to handle retries safely

3. **`publish-npm`** — Publishes TypeScript package to npm
   - Uses OIDC (no environment)
   - Must `unset NODE_AUTH_TOKEN` to force OIDC auth (Node 24 quirk)
   - Publishes with `--provenance` for supply chain security

### Version Synchronization

Two scripts handle version management:

#### `scripts/get_next_version.py`

Calculates the next version based on semver bump type:

```bash
uv run python scripts/get_next_version.py patch  # 0.1.0 → 0.1.1
uv run python scripts/get_next_version.py minor  # 0.1.0 → 0.2.0
uv run python scripts/get_next_version.py major  # 0.1.0 → 1.0.0
```

#### `scripts/sync_versions.py`

Synchronizes the version across all packages:

```bash
uv run python scripts/sync_versions.py 0.2.0
```

Updates:
- `packages/adk-sim-protos-ts/package.json` (TypeScript)
- `packages/adk-sim-protos/pyproject.toml`
- `packages/adk-sim-testing/pyproject.toml`
- `server/pyproject.toml`
- `plugins/python/pyproject.toml`

Also updates internal dependency pins (e.g., `adk-sim-protos==0.2.0`).

### Makefile Targets

For manual control, these targets are available:

```bash
make release-pr-patch  # Create a patch release PR
make release-pr-minor  # Create a minor release PR
make release-pr-major  # Create a major release PR
make release-tag       # Create and push tag for current version
```

## Installation Notes for Users

Users installing from PyPI need to allow pre-releases because we depend on `betterproto>=2.0.0b7`:

```bash
# Using uv
uv add adk-sim-server --prerelease=allow

# Using pip
pip install adk-sim-server --pre
```

## Troubleshooting

### PyPI Publishing Fails

1. Check that the `pypi` environment exists in GitHub repository settings
2. Verify the trusted publisher config on PyPI matches exactly:
   - Owner: `kevinaud`
   - Repository: `adk-sim-plugin`
   - Workflow: `publish.yaml`
   - Environment: `pypi`

### npm Publishing Fails

1. Verify the trusted publisher config on npm matches:
   - Repository owner: `kevinaud`
   - Repository name: `adk-sim-plugin`
   - Workflow: `publish.yaml`
   - Environment: (blank/none)

2. The workflow must use Node 24+ and `unset NODE_AUTH_TOKEN` before `npm publish`

### "Access token expired or revoked" Error

This misleading error from npm usually means OIDC claim mismatch, not an actual expired token. Check:
- The workflow file name matches exactly
- No environment is configured (for npm)
- The repository URL in `package.json` matches

### Version Mismatch Errors

If CI fails with version mismatch errors:
1. Run `uv run python scripts/sync_versions.py <version>` to re-sync
2. Run `uv lock` to update the lockfile
3. Run `npm install` to update package-lock.json

## Key Implementation Decisions

1. **Single consolidated workflow** — All packages publish from `publish.yaml` to satisfy OIDC trust policies

2. **Local verification over TestPyPI** — We verify installability using `--find-links dist/` instead of TestPyPI to avoid dependency confusion attacks

3. **Version-locked releases** — All packages share the same version to simplify dependency management

4. **Manual tagging via `ship.sh`** — Gives developers explicit control over when releases happen

5. **`betterproto` pre-release dependency** — Required for async gRPC support; users must use `--prerelease=allow`
