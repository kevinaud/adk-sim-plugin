#!/usr/bin/env python3
"""Calculate the next version based on semantic versioning bump type.

Reads the current version from the TypeScript package.json (source of truth)
and outputs the next version based on the bump type (patch, minor, major).

Usage:
    python scripts/get_next_version.py patch   # 0.1.0 -> 0.1.1
    python scripts/get_next_version.py minor   # 0.1.0 -> 0.2.0
    python scripts/get_next_version.py major   # 0.1.0 -> 1.0.0
"""

import json
import sys
from pathlib import Path

# Source of truth for version
VERSION_SOURCE = Path("packages/adk-sim-protos-ts/package.json")


def parse_version(version: str) -> tuple[int, int, int]:
    """Parse a semver string into (major, minor, patch)."""
    parts = version.split(".")
    if len(parts) != 3:
        raise ValueError(f"Invalid version format: {version}")
    return int(parts[0]), int(parts[1]), int(parts[2])


def bump_version(version: str, bump_type: str) -> str:
    """Bump the version according to the bump type."""
    major, minor, patch = parse_version(version)

    if bump_type == "major":
        return f"{major + 1}.0.0"
    elif bump_type == "minor":
        return f"{major}.{minor + 1}.0"
    elif bump_type == "patch":
        return f"{major}.{minor}.{patch + 1}"
    else:
        raise ValueError(f"Invalid bump type: {bump_type}. Use: patch, minor, or major")


def get_current_version() -> str:
    """Read the current version from the TypeScript package.json."""
    with VERSION_SOURCE.open() as f:
        data = json.load(f)
    return data["version"]


def main() -> None:
    """Main entry point."""
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <patch|minor|major>", file=sys.stderr)
        sys.exit(1)

    bump_type = sys.argv[1].lower()
    current_version = get_current_version()
    next_version = bump_version(current_version, bump_type)

    # Output only the version (for shell capture)
    print(next_version)


if __name__ == "__main__":
    main()
