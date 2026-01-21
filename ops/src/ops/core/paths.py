"""Project path constants."""

import os
from pathlib import Path


def _find_repo_root() -> Path:
  """Find the repository root.

  First checks the ADK_SIM_REPO_ROOT environment variable,
  then checks the current working directory for repo markers.
  """
  # Check environment variable first
  env_root = os.environ.get("ADK_SIM_REPO_ROOT")
  if env_root:
    return Path(env_root)

  # Check current working directory and its parents
  cwd = Path.cwd().resolve()
  for path in [cwd, *cwd.parents]:
    if (path / "pyproject.toml").exists() and (path / "server").exists():
      return path

  # Fallback to cwd (may fail later if not in repo)
  return cwd


REPO_ROOT = _find_repo_root()

# Key directories
PROTOS_DIR = REPO_ROOT / "protos"
PACKAGES_DIR = REPO_ROOT / "packages"
FRONTEND_DIR = REPO_ROOT / "frontend"
SERVER_DIR = REPO_ROOT / "server"
SCRIPTS_DIR = REPO_ROOT / "scripts"

# Proto output directories
PYTHON_PROTOS_DIR = PACKAGES_DIR / "adk-sim-protos" / "src" / "adk_sim_protos"
TS_PROTOS_DIR = PACKAGES_DIR / "adk-sim-protos-ts" / "src"

# Staleness marker for proto generation
PROTO_MARKER = REPO_ROOT / ".proto-generated"
