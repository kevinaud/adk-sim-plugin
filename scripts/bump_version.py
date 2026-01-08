#!/usr/bin/env python3
"""Bump version across all packages in the monorepo.

Usage:
    python scripts/bump_version.py <new_version>

Updates:
- Python packages: project.version and internal dependency constraints
- JS packages: version and internal dependency constraints
"""

import json
import sys
from pathlib import Path

import tomlkit

# Python packages to update
PYTHON_PACKAGES = [
  Path("packages/adk-sim-protos/pyproject.toml"),
  Path("packages/adk-sim-testing/pyproject.toml"),
  Path("server/pyproject.toml"),
  Path("plugins/python/pyproject.toml"),
]

# JS packages to update
JS_PACKAGES = [
  Path("packages/adk-sim-protos-ts/package.json"),
  Path("frontend/package.json"),
]

# Internal Python package names that need dependency updates
PYTHON_INTERNAL_DEPS = {"adk-sim-protos", "adk-sim-testing"}

# Internal JS package names that need dependency updates
JS_INTERNAL_DEPS = {"@adk-sim/protos"}


def update_python_package(path: Path, new_version: str) -> None:
  """Update a Python pyproject.toml file."""
  if not path.exists():
    print(f"Warning: {path} not found, skipping", file=sys.stderr)
    return

  content = path.read_text()
  doc = tomlkit.parse(content)

  # Update project version
  if "project" in doc:
    doc["project"]["version"] = new_version

  # Update internal dependencies in [project.dependencies]
  if "project" in doc and "dependencies" in doc["project"]:
    deps = doc["project"]["dependencies"]
    for i, dep in enumerate(deps):
      dep_str = str(dep)
      for internal_dep in PYTHON_INTERNAL_DEPS:
        if dep_str.startswith(internal_dep):
          # Replace with new version constraint
          deps[i] = f"{internal_dep}>={new_version}"
          break

  # Update internal dependencies in [dependency-groups.dev]
  if "dependency-groups" in doc and "dev" in doc["dependency-groups"]:
    dev_deps = doc["dependency-groups"]["dev"]
    for i, dep in enumerate(dev_deps):
      dep_str = str(dep)
      for internal_dep in PYTHON_INTERNAL_DEPS:
        if dep_str.startswith(internal_dep):
          dev_deps[i] = f"{internal_dep}>={new_version}"
          break

  # NOTE: We intentionally do NOT touch [tool.uv.sources] - those must stay as workspace = true

  path.write_text(tomlkit.dumps(doc))
  print(f"Updated: {path}")


def update_js_package(path: Path, new_version: str) -> None:
  """Update a JavaScript package.json file."""
  if not path.exists():
    print(f"Warning: {path} not found, skipping", file=sys.stderr)
    return

  content = path.read_text()
  data = json.loads(content)

  # Update package version
  if "version" in data:
    data["version"] = new_version

  # Update internal dependencies
  for dep_section in ["dependencies", "devDependencies", "peerDependencies"]:
    if dep_section in data:
      for dep_name in JS_INTERNAL_DEPS:
        if dep_name in data[dep_section]:
          data[dep_section][dep_name] = f"^{new_version}"

  # Write with 2-space indent and trailing newline
  path.write_text(json.dumps(data, indent=2) + "\n")
  print(f"Updated: {path}")


def main() -> None:
  if len(sys.argv) != 2:
    print("Usage: bump_version.py <new_version>", file=sys.stderr)
    sys.exit(1)

  new_version = sys.argv[1]

  # Validate version format
  parts = new_version.split(".")
  if len(parts) != 3:
    print(f"Error: Invalid version format: {new_version}", file=sys.stderr)
    sys.exit(1)

  try:
    [int(p) for p in parts]
  except ValueError:
    print(f"Error: Version parts must be integers: {new_version}", file=sys.stderr)
    sys.exit(1)

  print(f"Bumping all packages to version {new_version}")
  print()

  # Update Python packages
  for path in PYTHON_PACKAGES:
    update_python_package(path, new_version)

  # Update JS packages
  for path in JS_PACKAGES:
    update_js_package(path, new_version)

  print()
  print("Version bump complete!")


if __name__ == "__main__":
  main()
