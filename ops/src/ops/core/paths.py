"""Project path constants."""

from pathlib import Path


def _find_repo_root() -> Path:
  """Find the repository root by looking for pyproject.toml."""
  current = Path(__file__).resolve()
  for parent in current.parents:
    if (parent / "pyproject.toml").exists() and (parent / "server").exists():
      return parent
  # Fallback: assume we're in ops/src/ops/core/
  return current.parent.parent.parent.parent.parent


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
