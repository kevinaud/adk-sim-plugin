#!/usr/bin/env python3
"""Get the next semantic version based on bump type.

Usage:
    python scripts/get_next_version.py [major|minor|patch]

Reads current version from packages/adk-sim-protos/pyproject.toml (source of truth)
and prints the next version to stdout.
"""

import sys
from pathlib import Path

import tomlkit


def get_current_version() -> str:
  """Read current version from the source of truth package."""
  source_path = Path("packages/adk-sim-protos/pyproject.toml")
  if not source_path.exists():
    msg = f"Source of truth not found: {source_path}"
    raise FileNotFoundError(msg)

  content = source_path.read_text()
  doc = tomlkit.parse(content)
  return str(doc["project"]["version"])


def bump_version(current: str, bump_type: str) -> str:
  """Calculate the next version based on bump type."""
  parts = current.split(".")
  if len(parts) != 3:
    msg = f"Invalid version format: {current}"
    raise ValueError(msg)

  major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])

  match bump_type:
    case "major":
      return f"{major + 1}.0.0"
    case "minor":
      return f"{major}.{minor + 1}.0"
    case "patch":
      return f"{major}.{minor}.{patch + 1}"
    case _:
      msg = f"Invalid bump type: {bump_type}. Must be major, minor, or patch."
      raise ValueError(msg)


def main() -> None:
  if len(sys.argv) != 2:
    print("Usage: get_next_version.py [major|minor|patch]", file=sys.stderr)
    sys.exit(1)

  bump_type = sys.argv[1]
  current = get_current_version()
  next_version = bump_version(current, bump_type)
  print(next_version)


if __name__ == "__main__":
  main()
