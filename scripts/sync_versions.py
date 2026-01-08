#!/usr/bin/env python3
"""Sync Python package versions with the TypeScript source of truth.

This script bridges Changesets (JS) and Python pyproject.toml files.
It reads the version from packages/adk-sim-protos-ts/package.json (the source
of truth after Changesets runs) and updates all Python packages to match.

For each Python package:
1. Updates project.version to match the TypeScript version
2. Updates internal dependency constraints to use exact equality (e.g., adk-sim-protos==0.2.0)

IMPORTANT: This script does NOT touch [tool.uv.sources] sections - those must
remain as { workspace = true } for local development.
"""

import json
from pathlib import Path

import tomlkit

# Source of truth for version
VERSION_SOURCE = Path("packages/adk-sim-protos-ts/package.json")

# Python packages to update (relative to repo root)
PYTHON_PACKAGES = [
  Path("packages/adk-sim-protos/pyproject.toml"),
  Path("packages/adk-sim-testing/pyproject.toml"),
  Path("server/pyproject.toml"),
  Path("plugins/python/pyproject.toml"),
]

# Internal package names that should use exact version pinning
INTERNAL_PACKAGES = frozenset(
  {
    "adk-sim-protos",
    "adk-sim-testing",
    "adk-sim-server",
    "adk-agent-sim",
  }
)


def get_source_version() -> str:
  """Read the version from the TypeScript package.json (source of truth)."""
  with VERSION_SOURCE.open() as f:
    data = json.load(f)
  return data["version"]


def update_dependency_version(dep: str, version: str) -> str | None:
  """Update an internal dependency string to use exact version pinning.

  Args:
      dep: The dependency string (e.g., "adk-sim-protos" or "adk-sim-protos>=1.0.0")
      version: The new version to pin to

  Returns:
      Updated dependency string with exact version, or None if not an internal package
  """
  # Extract package name (before any version specifier)
  package_name = dep.split(">=")[0].split("==")[0].split("<")[0].split(">")[0].strip()

  if package_name in INTERNAL_PACKAGES:
    return f"{package_name}=={version}"

  return None


def update_pyproject(path: Path, version: str) -> bool:
  """Update a pyproject.toml file with the new version.

  Args:
      path: Path to the pyproject.toml file
      version: The new version to set

  Returns:
      True if changes were made, False otherwise
  """
  with path.open() as f:
    doc = tomlkit.load(f)

  changed = False

  # Update project.version
  if doc.get("project", {}).get("version") != version:
    doc["project"]["version"] = version
    changed = True

  # Update internal dependencies in project.dependencies
  if "dependencies" in doc.get("project", {}):
    deps = doc["project"]["dependencies"]
    for i, dep in enumerate(deps):
      updated = update_dependency_version(dep, version)
      if updated and deps[i] != updated:
        deps[i] = updated
        changed = True

  # Update internal dependencies in dependency-groups.dev (if present)
  if "dependency-groups" in doc and "dev" in doc["dependency-groups"]:
    dev_deps = doc["dependency-groups"]["dev"]
    for i, dep in enumerate(dev_deps):
      updated = update_dependency_version(dep, version)
      if updated and dev_deps[i] != updated:
        dev_deps[i] = updated
        changed = True

  if changed:
    with path.open("w") as f:
      tomlkit.dump(doc, f)

  return changed


def update_ts_package_version(version: str) -> bool:
  """Update the TypeScript package.json with the new version.

  Args:
      version: The new version to set

  Returns:
      True if changes were made, False otherwise
  """
  with VERSION_SOURCE.open() as f:
    data = json.load(f)

  if data.get("version") == version:
    return False

  data["version"] = version
  with VERSION_SOURCE.open("w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")  # Trailing newline for POSIX compliance

  return True


def main() -> None:
  """Main entry point.

  Usage:
      python sync_versions.py           # Sync from TS package.json (source of truth)
      python sync_versions.py 1.2.3     # Set all packages to specific version
  """
  import sys

  if len(sys.argv) > 1:
    # Version provided as argument - set all packages to this version
    version = sys.argv[1]
    print(f"📦 Setting version to: {version}")

    # Update the TypeScript package.json first (source of truth)
    if update_ts_package_version(version):
      print(f"✅ Updated {VERSION_SOURCE}")
    else:
      print(f"⏭️  No changes needed for {VERSION_SOURCE}")
  else:
    # No argument - read version from source of truth
    version = get_source_version()
    print(f"📦 Source version: {version}")

  for path in PYTHON_PACKAGES:
    if not path.exists():
      print(f"⚠️  Skipping {path} (not found)")
      continue

    if update_pyproject(path, version):
      print(f"✅ Updated {path}")
    else:
      print(f"⏭️  No changes needed for {path}")

  print(f"\n🎉 All packages synced to version {version}")


if __name__ == "__main__":
  main()
