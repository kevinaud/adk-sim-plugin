# **Proposal: Unified Developer CLI (ops) — Second Draft**

**Status:** Draft v2
**Date:** 2026-01-14
**Target:** Developer Infrastructure
**Authors:** [Your Name]

---

## **Table of Contents**

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Design Philosophy](#3-design-philosophy)
4. [The Solution: `ops` Workspace Package](#4-the-solution-ops-workspace-package)
5. [Command Structure & Help System](#5-command-structure--help-system)
6. [Output & Feedback Design](#6-output--feedback-design)
7. [Error Handling Strategy](#7-error-handling-strategy)
8. [Configuration Management](#8-configuration-management)
9. [Implementation Details](#9-implementation-details)
10. [Migration Plan](#10-migration-plan)
11. [Best Practices Checklist](#11-best-practices-checklist)
12. [Risks & Mitigations](#12-risks--mitigations)
13. [Success Criteria](#13-success-criteria)

---

## **1. Executive Summary**

This document proposes consolidating the project's fragmented developer tooling—currently spread across Makefiles, Bash scripts, and standalone Python scripts—into a single, type-safe Python CLI package named `ops`.

By leveraging our existing `uv` workspace architecture, we will treat our developer tooling as a first-class citizen with its own dependencies and strict quality standards. This move replaces fragile Bash string manipulation with robust Python logic, offering a superior developer experience (DX) and simplified maintenance.

**Key Design Principles (from CLI Guidelines):**
- **Human-first design**: Optimize for the developer sitting at the terminal
- **Consistency**: Follow established CLI conventions developers already know
- **Discoverability**: Make functionality easy to find without reading docs
- **Robustness**: Feel solid and reliable, never leave users confused

---

## **2. Problem Statement**

### **2.1 Current State Analysis**

Our developer infrastructure has accumulated technical debt in the form of "Script Sprawl":

| Problem | Evidence | Impact |
|---------|----------|--------|
| **Fragmented Logic** | Logic split between `Makefile` (UI), `scripts/*.sh` (execution), `scripts/*.py` (complex logic) | Developers must context-switch between 3 languages |
| **Fragile Dependencies** | `ship.sh` relies on `jq`, `gh`, manual JSON parsing | Breaks silently on missing tools or API changes |
| **Redundant Execution** | Makefile can't express "only if stale" dependencies | Wasted build time, confusing state |
| **Poor Discoverability** | `make help` is hand-maintained, scripts undocumented | Developers don't know what's available |
| **Inconsistent Output** | Each script has its own emoji scheme, color usage | Cognitive load, unprofessional feel |
| **No Validation** | Scripts assume correct input, fail cryptically | Time wasted debugging invocation errors |

### **2.2 Current Tool Inventory**

```
Makefile
├── help              # Hand-maintained, often stale
├── generate          # Proto generation
├── clean             # Remove generated files
├── server            # Start backend
├── frontend          # Start frontend
├── docker-up/down    # Docker compose
├── quality           # Run pre-commit
├── test              # Unit tests
├── test-e2e          # E2E tests
├── bundle            # Build + copy frontend
├── build             # Full release build
└── release-pr-*      # Create release PRs

scripts/
├── build.sh          # Multi-target build script
├── ship.sh           # Full release automation (200+ lines Bash)
├── presubmit.sh      # Pre-push validation
├── check-generated.sh
├── should-run-e2e.sh
├── get_next_version.py
├── sync_versions.py
└── configure_github.sh
```

**Key Insight**: The `ship.sh` script alone contains 200+ lines of Bash doing JSON parsing, GitHub API polling, and ANSI escape code manipulation—all of which would be trivial in Python with proper libraries.

---

## **3. Design Philosophy**

We adopt the following principles from the [CLI Guidelines](https://clig.dev/):

### **3.1 Human-First Design**

> "Today's command line is human-first: a text-based UI that affords access to all kinds of tools."

Our CLI will be designed for the developer sitting at the terminal, not for shell scripts. When machine consumption is needed, we'll provide explicit flags (`--json`, `--quiet`).

### **3.2 Conversation as the Norm**

> "Running a program usually involves more than one invocation... This mode of learning through repeated failure is like a conversation."

The CLI will:
- Suggest the next logical command after completing an operation
- Provide helpful error messages that guide toward resolution
- Support dry-run modes for risky operations

### **3.3 Consistency Across Commands**

> "The terminal's conventions are hardwired into our fingers."

We will use standard flag names and patterns that developers already know:
- `-h`, `--help` for help
- `-v`, `--verbose` for verbose output
- `-q`, `--quiet` for suppressed output
- `--dry-run` for simulation
- `--json` for machine-readable output

### **3.4 Robustness Over Speed**

> "You want your software to feel like it isn't going to fall apart."

The CLI will:
- Validate all inputs before acting
- Show progress for long operations
- Confirm before destructive actions
- Handle interrupts (Ctrl+C) gracefully
- Be idempotent where possible

### **3.5 Ease of Discovery**

> "Discoverable CLIs have comprehensive help texts, provide lots of examples, suggest what command to run next."

Every command will have:
- A one-line description
- Usage examples in help text
- Links to documentation where appropriate

---

## **4. The Solution: `ops` Workspace Package**

### **4.1 Package Architecture**

```
.
├── ops/                          # New Workspace Member
│   ├── pyproject.toml            # Dependencies: typer, rich
│   └── src/
│       └── ops/
│           ├── __init__.py       # Version, metadata
│           ├── cli.py            # Main entry point, top-level commands
│           ├── commands/         # One file per command group
│           │   ├── __init__.py
│           │   ├── build.py      # ops build [protos|frontend|packages]
│           │   ├── dev.py        # ops server, ops frontend
│           │   ├── release.py    # ops release [patch|minor|major]
│           │   ├── quality.py    # ops quality, ops test
│           │   └── docker.py     # ops docker [up|down|logs]
│           ├── core/             # Shared utilities
│           │   ├── __init__.py
│           │   ├── console.py    # Rich console singleton
│           │   ├── git.py        # Git operations
│           │   ├── github.py     # GitHub CLI wrapper
│           │   ├── process.py    # Subprocess helpers
│           │   └── paths.py      # Project path constants
│           └── py.typed          # PEP 561 marker
├── pyproject.toml                # Root config registers 'ops'
└── ...
```

### **4.2 Why This Structure?**

Following the Typer best practice of **"One File Per Command"**:

> "When your CLI application grows, you can split it into multiple files and modules. This pattern helps maintain a clean and organized code structure."

Each command group (`build`, `release`, etc.) lives in its own file with its own `typer.Typer()` app, then gets composed into the main app using `add_typer()`.

### **4.3 Integration with `uv`**

**Root `pyproject.toml` additions:**

```toml
[tool.uv.workspace]
members = [
  "packages/*",
  "server",
  "plugins/python",
  "ops",  # NEW
]

[dependency-groups]
dev = [
  # ... existing
  "ops",  # Install ops as editable dev dependency
]
```

**`ops/pyproject.toml`:**

```toml
[project]
name = "ops"
version = "0.1.0"
description = "Developer CLI for adk-sim-plugin"
requires-python = ">=3.14"
dependencies = [
  "typer>=0.15.0",
  "rich>=13.0.0",
]

[project.scripts]
ops = "ops.cli:app"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

**Benefits:**
- **Zero Setup:** `uv sync` installs `ops` automatically
- **Instant Feedback:** Editable mode means changes take effect immediately
- **Type Safety:** Same `ruff` and `pyright` strictness as production code

### **4.4 Naming Rationale**

From CLI Guidelines on naming:

> "Make it a simple, memorable word... Use only lowercase letters... Keep it short... Make it easy to type."

`ops` was chosen because:
- **Short**: 3 characters, easy to type repeatedly
- **Memorable**: Common DevOps terminology
- **Lowercase**: No shift key needed
- **Easy to type**: All keys on home row or adjacent

Alternative names considered and rejected:
- `dev` - Too generic, conflicts with common aliases
- `adk` - Already overloaded in the project
- `sim` - Ambiguous with "simulator" runtime
- `build` - Too narrow, doesn't cover release/quality

---

## **5. Command Structure & Help System**

### **5.1 Command Hierarchy**

Following the CLI Guidelines pattern of `noun verb` or `verb noun` ordering with consistent verbs:

```
ops
├── build                    # Build artifacts
│   ├── protos               # Generate proto code (Python + TypeScript)
│   ├── frontend             # Build Angular production bundle
│   ├── packages             # Build Python wheel/sdist
│   └── all                  # Full build (default)
├── dev                      # Development servers
│   ├── server               # Start backend gRPC server
│   ├── frontend             # Start frontend dev server
│   └── all                  # Start both (default)
├── docker                   # Docker operations
│   ├── up                   # Start containers
│   ├── down                 # Stop containers
│   └── logs                 # View container logs
├── quality                  # Quality checks
│   ├── check                # Run all checks (default)
│   ├── fix                  # Run with auto-fix
│   └── test                 # Run test suite
│       ├── unit             # Unit tests only
│       ├── integration      # Integration tests
│       └── e2e              # E2E tests (requires Docker)
├── release                  # Release management
│   ├── patch                # Bump patch version
│   ├── minor                # Bump minor version
│   ├── major                # Bump major version
│   └── status               # Show current version info
├── clean                    # Remove generated files
└── version                  # Show ops version
```

### **5.2 Help Text Design**

Following CLI Guidelines:

> "Display concise help text by default... Lead with examples... Display the most common flags and commands at the start."

**Top-level help (`ops --help`):**

```
$ ops --help

 Usage: ops [OPTIONS] COMMAND [ARGS]...

 Developer CLI for adk-sim-plugin.

 Common workflows:
   ops dev              Start development servers
   ops build            Build all artifacts
   ops quality          Run quality checks
   ops release patch    Create a patch release

╭─ Options ───────────────────────────────────────────────────────────╮
│ --verbose  -v    Show detailed output                               │
│ --quiet    -q    Suppress non-essential output                      │
│ --help     -h    Show this message and exit                         │
│ --version        Show version and exit                              │
╰─────────────────────────────────────────────────────────────────────╯
╭─ Commands ──────────────────────────────────────────────────────────╮
│ build      Build project artifacts (protos, frontend, packages)     │
│ dev        Start development servers                                │
│ docker     Manage Docker containers                                 │
│ quality    Run quality checks and tests                             │
│ release    Create and publish releases                              │
│ clean      Remove generated files                                   │
╰─────────────────────────────────────────────────────────────────────╯

 Documentation: https://github.com/kevinaud/adk-sim-plugin
```

**Subcommand help (`ops build --help`):**

```
$ ops build --help

 Usage: ops build [OPTIONS] [TARGET]

 Build project artifacts.

 Examples:
   ops build              Build everything (protos → frontend → packages)
   ops build protos       Generate proto code only
   ops build frontend     Build Angular bundle (auto-generates protos if needed)
   ops build --clean      Clean before building

╭─ Arguments ─────────────────────────────────────────────────────────╮
│ TARGET    What to build [protos|frontend|packages|all]              │
│           [default: all]                                            │
╰─────────────────────────────────────────────────────────────────────╯
╭─ Options ───────────────────────────────────────────────────────────╮
│ --clean        Clean generated files before building                │
│ --skip-cache   Force rebuild even if outputs are fresh              │
│ --verbose -v   Show build command output                            │
│ --help    -h   Show this message and exit                           │
╰─────────────────────────────────────────────────────────────────────╯
```

### **5.3 Standard Flag Conventions**

From CLI Guidelines, we adopt these standard flags across all commands:

| Flag | Short | Meaning | Notes |
|------|-------|---------|-------|
| `--help` | `-h` | Show help | Required on all commands |
| `--verbose` | `-v` | Detailed output | Shows subprocess output |
| `--quiet` | `-q` | Minimal output | Only errors |
| `--dry-run` | `-n` | Simulate, don't execute | For destructive operations |
| `--json` | | Machine-readable output | Where applicable |
| `--force` | `-f` | Skip confirmations | For automated scripts |
| `--yes` | `-y` | Auto-confirm prompts | Alias for `--force` |

### **5.4 Typo Suggestions**

From CLI Guidelines:

> "If the user did something wrong and you can guess what they meant, suggest it."

**Implementation with Typer's built-in fuzzy matching:**

```
$ ops biuld
Usage: ops [OPTIONS] COMMAND [ARGS]...
Try 'ops --help' for help.

Error: No such command 'biuld'. Did you mean 'build'?
```

---

## **6. Output & Feedback Design**

### **6.1 Output Principles**

From CLI Guidelines:

> "The terminal is a world of pure information... there's often too much or too little of it."

**Output modes:**

| Mode | When | What's shown |
|------|------|--------------|
| Default | Normal use | Progress indicators, success/failure, next steps |
| `--verbose` | Debugging | Subprocess output, file paths, timing |
| `--quiet` | Scripts/CI | Only errors |
| `--json` | Automation | Structured data, no decoration |

### **6.2 Progress Indicators**

From CLI Guidelines:

> "Show progress if something takes a long time... A good spinner or progress indicator can make a program appear to be faster than it is."

**Rules:**
1. **< 100ms**: No indicator needed
2. **100ms - 2s**: Spinner with message
3. **> 2s**: Progress bar with ETA (if deterministic) or spinner with elapsed time

**Implementation with Rich:**

```python
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn

def build_frontend():
  with Progress(
    SpinnerColumn(),
    TextColumn("[progress.description]{task.description}"),
    TimeElapsedColumn(),
  ) as progress:
    task = progress.add_task("Building frontend...", total=None)
    # ... build logic
```

### **6.3 State Change Communication**

From CLI Guidelines:

> "If you change state, tell the user."

After every mutation, we explain what happened:

```
$ ops build protos

✓ Generated Python protos → packages/adk-sim-protos/src/adk_sim_protos/
✓ Generated TypeScript protos → packages/adk-sim-protos-ts/src/
✓ Formatted 47 files

Next: ops build frontend
```

### **6.4 Color Usage**

From CLI Guidelines:

> "Use color with intention... Disable color if your program is not in a terminal."

**Color palette:**

| Color | Meaning |
|-------|---------|
| Green | Success, completion |
| Yellow | Warning, needs attention |
| Red | Error, failure |
| Blue | Information, progress |
| Dim | Secondary info, paths |

**Implementation:**

```python
from rich.console import Console

console = Console()

# Respect NO_COLOR, TERM=dumb, non-TTY
# Rich handles this automatically!
```

### **6.5 Symbol/Emoji Usage**

From CLI Guidelines:

> "Use symbols and emoji where it makes things clearer... Be careful—it can be easy to overdo it."

**Approved symbols (from yubikey-agent example):**

| Symbol | Meaning |
|--------|---------|
| ✓ | Success/complete |
| ✗ | Failure/error |
| ⚠ | Warning |
| → | Points to output |
| ⏳ | In progress (spinner replaces) |

**NOT used:** 🚀 🎉 📦 etc. (too casual for developer tooling)

---

## **7. Error Handling Strategy**

### **7.1 Error Message Design**

From CLI Guidelines:

> "If you can make errors into documentation, then this will save the user loads of time."

**Error message template:**

```
Error: <what went wrong>

<why it might have happened>

<how to fix it>
```

**Example:**

```
$ ops release patch

Error: Uncommitted changes detected.

You have 3 modified files that haven't been committed.
Release automation requires a clean working directory.

To fix:
  git stash              # Stash changes temporarily
  ops release patch      # Run release
  git stash pop          # Restore changes

Or to see what's changed:
  git status
```

### **7.2 Exit Codes**

From CLI Guidelines:

> "Return zero exit code on success, non-zero on failure."

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments/usage |
| 3 | Missing prerequisites |
| 4 | External tool failure |
| 130 | Interrupted (Ctrl+C) |

**Implementation:**

```python
import sys
from enum import IntEnum

class ExitCode(IntEnum):
  SUCCESS = 0
  ERROR = 1
  USAGE = 2
  PREREQ = 3
  EXTERNAL = 4
  INTERRUPTED = 130

def main():
  try:
    app()
  except KeyboardInterrupt:
    console.print("\n[dim]Interrupted[/dim]")
    sys.exit(ExitCode.INTERRUPTED)
```

### **7.3 Exception Display**

From Typer docs on exceptions:

> "Typer will use [Rich] to automatically show you nicely printed errors... omit all the parts of the traceback that come from internal parts."

**Configuration:**

```python
app = typer.Typer(
  pretty_exceptions_enable=True,
  pretty_exceptions_show_locals=False,  # Security: don't leak secrets
  pretty_exceptions_short=True,         # Hide internal stack frames
)
```

### **7.4 Prerequisite Validation**

Before any operation, validate that required tools exist:

```python
def require_tools(*tools: str) -> None:
  """Ensure required external tools are available."""
  missing = []
  for tool in tools:
    if shutil.which(tool) is None:
      missing.append(tool)

  if missing:
    console.print(f"[red]Error:[/red] Missing required tools: {', '.join(missing)}")
    console.print("\nInstall with:")
    for tool in missing:
      console.print(f"  {INSTALL_HINTS.get(tool, f'# Install {tool}')}")
    raise typer.Exit(ExitCode.PREREQ)

# Usage
def release():
  require_tools("gh", "git")
  # ... proceed
```

---

## **8. Configuration Management**

### **8.1 Configuration Hierarchy**

From CLI Guidelines:

> "Apply configuration parameters in order of precedence: Flags → Environment → Project → User → System"

| Source | Example | Use Case |
|--------|---------|----------|
| Flags | `--verbose` | One-off overrides |
| Environment | `OPS_VERBOSE=1` | CI/scripts |
| Project | `ops.toml` | Team-shared defaults |
| User | `~/.config/ops/config.toml` | Personal preferences |

### **8.2 Environment Variables**

From CLI Guidelines:

> "For maximum portability, environment variable names must only contain uppercase letters, numbers, and underscores."

| Variable | Default | Description |
|----------|---------|-------------|
| `OPS_VERBOSE` | `0` | Enable verbose output |
| `OPS_QUIET` | `0` | Suppress non-essential output |
| `OPS_COLOR` | `auto` | Color mode: `auto`, `always`, `never` |
| `OPS_GITHUB_TOKEN` | (from `gh`) | GitHub API token |
| `NO_COLOR` | | Standard: disable all color |

### **8.3 Project Configuration**

Optional `ops.toml` in project root:

```toml
# ops.toml - Project-level ops configuration

[build]
# Skip TypeScript proto generation (if not using frontend)
skip_ts_protos = false

[release]
# GitHub repository (auto-detected from git remote)
repository = "kevinaud/adk-sim-plugin"

# Require CI checks to pass before merge
require_ci = true

[quality]
# Additional pre-commit hooks to run
extra_hooks = []
```

### **8.4 User Configuration**

From Typer docs on `get_app_dir()`:

> "You can get the application directory where you can, for example, save configuration files."

```python
from pathlib import Path
import typer

APP_NAME = "ops"

def get_config_path() -> Path:
  """Get user config directory, respecting XDG spec."""
  app_dir = Path(typer.get_app_dir(APP_NAME))
  return app_dir / "config.toml"
```

---

## **9. Implementation Details**

### **9.1 Main Entry Point**

**`ops/src/ops/cli.py`:**

```python
"""
ops - Developer CLI for adk-sim-plugin

A unified interface for building, testing, and releasing.
"""
import typer
from rich.console import Console

from ops import __version__
from ops.commands import build, dev, docker, quality, release

# Global console instance
console = Console()

# Main app with pretty exceptions
app = typer.Typer(
  name="ops",
  help="Developer CLI for adk-sim-plugin.",
  no_args_is_help=True,
  pretty_exceptions_enable=True,
  pretty_exceptions_show_locals=False,
  pretty_exceptions_short=True,
  rich_markup_mode="rich",
)

# Register command groups
app.add_typer(build.app, name="build")
app.add_typer(dev.app, name="dev")
app.add_typer(docker.app, name="docker")
app.add_typer(quality.app, name="quality")
app.add_typer(release.app, name="release")


@app.command()
def clean(
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show files being removed"),
) -> None:
  """Remove all generated files."""
  from ops.core.clean import clean_generated
  clean_generated(verbose=verbose)


@app.callback(invoke_without_command=True)
def main(
  ctx: typer.Context,
  version: bool = typer.Option(False, "--version", help="Show version and exit"),
) -> None:
  """Developer CLI for adk-sim-plugin."""
  if version:
    console.print(f"ops version {__version__}")
    raise typer.Exit()

  # If no command given, show help
  if ctx.invoked_subcommand is None:
    console.print(ctx.get_help())


if __name__ == "__main__":
  app()
```

### **9.2 Build Commands**

**`ops/src/ops/commands/build.py`:**

```python
"""Build commands for ops."""
from enum import Enum
from functools import lru_cache
from pathlib import Path

import typer
from rich.console import Console

from ops.core.paths import REPO_ROOT, PROTO_MARKER
from ops.core.process import run

app = typer.Typer(
  help="Build project artifacts.",
  no_args_is_help=False,  # Has default action
)
console = Console()


class BuildTarget(str, Enum):
  """Available build targets."""
  protos = "protos"
  frontend = "frontend"
  packages = "packages"
  all = "all"


@lru_cache(maxsize=1)
def _build_protos(force: bool = False) -> bool:
  """Generate proto code. Cached to run at most once per invocation."""
  marker = REPO_ROOT / PROTO_MARKER
  protos = list((REPO_ROOT / "protos").rglob("*.proto"))

  # Check staleness
  if not force and marker.exists():
    marker_mtime = marker.stat().st_mtime
    if all(p.stat().st_mtime < marker_mtime for p in protos):
      console.print("[dim]Protos up to date, skipping[/dim]")
      return False

  console.print("Generating protos...")

  # Backup custom index.ts
  index_ts = REPO_ROOT / "packages/adk-sim-protos-ts/src/index.ts"
  index_backup = None
  if index_ts.exists():
    index_backup = index_ts.read_text()

  # Generate
  run(["buf", "generate"], cwd=REPO_ROOT)

  # Restore index.ts
  if index_backup:
    index_ts.write_text(index_backup)

  # Format generated code
  run(["uv", "run", "ruff", "format", "packages/adk-sim-protos"], cwd=REPO_ROOT)

  # Touch marker
  marker.touch()

  console.print("[green]✓[/green] Protos generated")
  return True


@lru_cache(maxsize=1)
def _build_frontend(force: bool = False) -> bool:
  """Build frontend. Ensures protos are built first."""
  _build_protos(force=force)  # Dependency

  console.print("Building frontend...")
  run(
    ["npm", "run", "build", "--", "--configuration", "production"],
    cwd=REPO_ROOT / "frontend",
    env={"CI": "true"},
  )
  console.print("[green]✓[/green] Frontend built")
  return True


@app.callback(invoke_without_command=True)
def build(
  ctx: typer.Context,
  target: BuildTarget = typer.Argument(BuildTarget.all, help="What to build"),
  clean: bool = typer.Option(False, "--clean", help="Clean before building"),
  force: bool = typer.Option(False, "--skip-cache", help="Force rebuild"),
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show build output"),
) -> None:
  """
  Build project artifacts.

  Examples:
    ops build              Build everything
    ops build protos       Generate proto code only
    ops build --clean      Clean then build
  """
  if clean:
    from ops.core.clean import clean_generated
    clean_generated(verbose=verbose)

  if target == BuildTarget.protos:
    _build_protos(force=force)
  elif target == BuildTarget.frontend:
    _build_frontend(force=force)
  elif target == BuildTarget.packages:
    _build_packages(force=force)
  else:
    _build_all(force=force)

  console.print("\n[green]✓[/green] Build complete")
  console.print("[dim]Next: ops dev[/dim]")
```

### **9.3 Release Commands**

**`ops/src/ops/commands/release.py`:**

```python
"""Release management commands."""
import json
import subprocess
from enum import Enum
from pathlib import Path

import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

from ops.core.git import ensure_clean_tree, get_current_branch
from ops.core.github import GitHubClient
from ops.core.paths import REPO_ROOT

app = typer.Typer(help="Create and publish releases.")
console = Console()


class BumpType(str, Enum):
  """Version bump types."""
  patch = "patch"
  minor = "minor"
  major = "major"


def _get_current_version() -> str:
  """Read version from TypeScript package.json (source of truth)."""
  pkg = REPO_ROOT / "packages/adk-sim-protos-ts/package.json"
  return json.loads(pkg.read_text())["version"]


def _bump_version(current: str, bump: BumpType) -> str:
  """Calculate next version."""
  major, minor, patch = map(int, current.split("."))
  if bump == BumpType.major:
    return f"{major + 1}.0.0"
  elif bump == BumpType.minor:
    return f"{major}.{minor + 1}.0"
  else:
    return f"{major}.{minor}.{patch + 1}"


@app.command()
def status() -> None:
  """Show current version and release status."""
  version = _get_current_version()
  branch = get_current_branch()

  console.print(f"Current version: [cyan]{version}[/cyan]")
  console.print(f"Current branch:  [cyan]{branch}[/cyan]")

  # Check for unreleased changes
  # ... (implementation)


@app.command()
def patch(
  skip_ci: bool = typer.Option(False, "--skip-ci", help="Don't wait for CI checks"),
  yes: bool = typer.Option(False, "--yes", "-y", help="Auto-confirm prompts"),
  dry_run: bool = typer.Option(False, "--dry-run", "-n", help="Show what would happen"),
) -> None:
  """
  Create a patch release (x.y.Z).

  This will:
  1. Create a release branch with bumped version
  2. Open a PR and wait for CI (unless --skip-ci)
  3. Merge the PR (with confirmation unless --yes)
  4. Tag and push (triggers publish workflow)

  Example:
    ops release patch           Interactive release
    ops release patch --yes     Fully automated
    ops release patch --dry-run Show what would happen
  """
  _do_release(BumpType.patch, skip_ci=skip_ci, yes=yes, dry_run=dry_run)


@app.command()
def minor(
  skip_ci: bool = typer.Option(False, "--skip-ci"),
  yes: bool = typer.Option(False, "--yes", "-y"),
  dry_run: bool = typer.Option(False, "--dry-run", "-n"),
) -> None:
  """Create a minor release (x.Y.0)."""
  _do_release(BumpType.minor, skip_ci=skip_ci, yes=yes, dry_run=dry_run)


@app.command()
def major(
  skip_ci: bool = typer.Option(False, "--skip-ci"),
  yes: bool = typer.Option(False, "--yes", "-y"),
  dry_run: bool = typer.Option(False, "--dry-run", "-n"),
) -> None:
  """Create a major release (X.0.0)."""
  _do_release(BumpType.major, skip_ci=skip_ci, yes=yes, dry_run=dry_run)


def _do_release(
  bump: BumpType,
  skip_ci: bool,
  yes: bool,
  dry_run: bool,
) -> None:
  """Execute the release workflow."""
  # 1. Validation
  console.print("Validating prerequisites...")
  ensure_clean_tree()

  current = _get_current_version()
  next_version = _bump_version(current, bump)

  console.print(f"Version: [cyan]{current}[/cyan] → [green]{next_version}[/green]")

  if dry_run:
    console.print("\n[yellow]Dry run - no changes made[/yellow]")
    console.print("\nWould execute:")
    console.print(f"  1. Create branch release/v{next_version}")
    console.print(f"  2. Update version in all package files")
    console.print(f"  3. Create PR and wait for CI")
    console.print(f"  4. Merge PR and tag v{next_version}")
    return

  # 2. Confirmation (unless --yes)
  if not yes:
    proceed = typer.confirm(f"Create {bump.value} release v{next_version}?")
    if not proceed:
      raise typer.Abort()

  # 3. Create release branch and PR
  with Progress(
    SpinnerColumn(),
    TextColumn("[progress.description]{task.description}"),
    console=console,
  ) as progress:
    task = progress.add_task("Creating release branch...", total=None)
    # ... implementation

    progress.update(task, description="Updating version files...")
    # ... implementation

    progress.update(task, description="Creating PR...")
    gh = GitHubClient()
    pr_url = gh.create_pr(
      title=f"chore: release v{next_version}",
      branch=f"release/v{next_version}",
    )

  console.print(f"\n[green]✓[/green] PR created: {pr_url}")

  # 4. Wait for CI (unless --skip-ci)
  if not skip_ci:
    console.print("\nWaiting for CI checks...")
    with Progress(
      SpinnerColumn(),
      TextColumn("[progress.description]{task.description}"),
      console=console,
    ) as progress:
      task = progress.add_task("CI running...", total=None)
      # Poll GitHub API for check status
      # ... implementation

  # 5. Merge and tag
  if not yes:
    proceed = typer.confirm("CI passed. Merge and tag?")
    if not proceed:
      console.print(f"[dim]PR left open: {pr_url}[/dim]")
      return

  # ... merge and tag implementation

  console.print(f"\n[green]✓[/green] Released v{next_version}!")
  console.print("[dim]Publish workflow triggered[/dim]")
```

### **9.4 Core Utilities**

**`ops/src/ops/core/process.py`:**

```python
"""Subprocess execution utilities."""
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from rich.console import Console

console = Console()


def run(
  cmd: list[str],
  cwd: Path | None = None,
  env: dict[str, str] | None = None,
  check: bool = True,
  capture: bool = False,
  verbose: bool = False,
) -> subprocess.CompletedProcess[str]:
  """
  Run a subprocess with sensible defaults.

  Args:
    cmd: Command and arguments
    cwd: Working directory
    env: Additional environment variables
    check: Raise on non-zero exit
    capture: Capture stdout/stderr
    verbose: Show command output in real-time

  Returns:
    CompletedProcess with stdout/stderr if captured

  Raises:
    typer.Exit: On failure with helpful message
  """
  full_env = os.environ.copy()
  if env:
    full_env.update(env)

  if verbose:
    console.print(f"[dim]$ {' '.join(cmd)}[/dim]")

  try:
    result = subprocess.run(
      cmd,
      cwd=cwd,
      env=full_env,
      check=check,
      capture_output=capture,
      text=True,
    )
    return result
  except subprocess.CalledProcessError as e:
    console.print(f"[red]Error:[/red] Command failed: {' '.join(cmd)}")
    if e.stdout:
      console.print(e.stdout)
    if e.stderr:
      console.print(e.stderr, style="red")
    raise typer.Exit(4)  # External tool failure
  except FileNotFoundError:
    console.print(f"[red]Error:[/red] Command not found: {cmd[0]}")
    raise typer.Exit(3)  # Missing prerequisite
```

**`ops/src/ops/core/github.py`:**

```python
"""GitHub API utilities using gh CLI."""
import json
import subprocess
from dataclasses import dataclass

import typer


@dataclass
class PullRequest:
  """Pull request information."""
  number: int
  url: str
  state: str

  @property
  def is_open(self) -> bool:
    return self.state == "open"


class GitHubClient:
  """Wrapper around gh CLI for GitHub operations."""

  def __init__(self) -> None:
    self._ensure_authenticated()

  def _ensure_authenticated(self) -> None:
    """Verify gh is authenticated."""
    try:
      subprocess.run(
        ["gh", "auth", "status"],
        check=True,
        capture_output=True,
      )
    except subprocess.CalledProcessError:
      raise typer.Exit(3)  # Prerequisite failure

  def _run(self, args: list[str]) -> str:
    """Run gh command and return stdout."""
    result = subprocess.run(
      ["gh", *args],
      check=True,
      capture_output=True,
      text=True,
    )
    return result.stdout.strip()

  def create_pr(self, title: str, branch: str, body: str = "") -> str:
    """Create a pull request, return URL."""
    return self._run([
      "pr", "create",
      "--title", title,
      "--body", body,
      "--head", branch,
    ])

  def get_pr_checks(self, pr_number: int) -> list[dict]:
    """Get status of PR checks."""
    output = self._run([
      "pr", "checks", str(pr_number),
      "--json", "name,state",
    ])
    return json.loads(output)

  def merge_pr(self, pr_number: int, squash: bool = True) -> None:
    """Merge a pull request."""
    args = ["pr", "merge", str(pr_number), "--delete-branch"]
    if squash:
      args.append("--squash")
    self._run(args)
```

---

## **10. Migration Plan**

### **10.1 Phase 1: Scaffolding (Week 1)**

**Goal:** Create `ops` package structure, install into workspace

**Tasks:**
1. Create `ops/` directory structure
2. Configure `ops/pyproject.toml` with dependencies
3. Add `ops` to root workspace members and dev dependencies
4. Create basic `cli.py` with `--version` and `--help`
5. Verify `uv sync && ops --help` works

**Success Criteria:**
- `ops --help` shows formatted help
- `ops --version` shows version
- Zero runtime errors

**Deliverable:** PR with scaffolding, passing CI

### **10.2 Phase 2: Build Commands (Week 1-2)**

**Goal:** Port all build logic to `ops build`

**Tasks:**
1. Implement `ops build protos` (port from `make generate`)
2. Implement `ops build frontend` (port from `scripts/build.sh`)
3. Implement `ops build packages` (port from `scripts/build.sh`)
4. Implement dependency caching with `@lru_cache`
5. Implement `ops clean`

**Success Criteria:**
- `ops build` produces identical artifacts to `make build`
- Build is idempotent (running twice is fast)
- `--verbose` shows subprocess output

**Deliverable:** PR with build commands, updated CI to use `ops build`

### **10.3 Phase 3: Dev Commands (Week 2)**

**Goal:** Port development server management

**Tasks:**
1. Implement `ops dev server` (port from `make server`)
2. Implement `ops dev frontend` (port from `make frontend`)
3. Implement `ops docker up/down/logs`

**Success Criteria:**
- `ops dev` starts servers identically to `make server/frontend`
- `ops docker` manages containers correctly

**Deliverable:** PR with dev commands

### **10.4 Phase 4: Quality Commands (Week 2-3)**

**Goal:** Port quality checking and testing

**Tasks:**
1. Implement `ops quality` (wraps pre-commit)
2. Implement `ops quality test` with subcommands
3. Port E2E skip logic from `scripts/should-run-e2e.sh`

**Success Criteria:**
- `ops quality` runs identical checks to `make quality`
- Test commands work correctly

**Deliverable:** PR with quality commands

### **10.5 Phase 5: Release Commands (Week 3)**

**Goal:** Port release automation from `ship.sh`

**Tasks:**
1. Implement version reading/bumping
2. Implement `ops release status`
3. Implement `ops release patch/minor/major`
4. Implement GitHub API integration via `gh`
5. Implement CI monitoring with progress indicators

**Success Criteria:**
- `ops release patch --dry-run` shows correct plan
- Full release workflow works end-to-end

**Deliverable:** PR with release commands

### **10.6 Phase 6: Cutover (Week 4)**

**Goal:** Replace legacy tooling, update documentation

**Tasks:**
1. Update CI workflows to use `ops` commands
2. Update `CLAUDE.md` developer instructions
3. Update `README.md` quick start
4. Archive `Makefile` (keep temporarily for reference)
5. Archive `scripts/` directory

**Success Criteria:**
- All CI checks pass using `ops`
- No developer workflows reference `make` or `scripts/`
- Documentation is current

**Deliverable:** PR with cutover, deleted legacy files

### **10.7 Phase 7: Cleanup (Week 4+)**

**Goal:** Remove legacy files, polish

**Tasks:**
1. Delete `Makefile`
2. Delete `scripts/` directory
3. Add shell completion instructions to docs
4. Consider adding `ops doctor` for environment validation

---

## **11. Best Practices Checklist**

This section summarizes all CLI best practices from the guidelines that we commit to following:

### **11.1 Basic Requirements**

- [ ] Use `typer` argument parsing library
- [ ] Return exit code 0 on success, non-zero on failure
- [ ] Send primary output to `stdout`
- [ ] Send errors and progress to `stderr`

### **11.2 Help System**

- [ ] Display help on `-h` and `--help`
- [ ] Display concise help when run with no arguments
- [ ] Show examples in help text
- [ ] Display most common commands first
- [ ] Use formatting (Rich) for readability
- [ ] Suggest corrections for typos

### **11.3 Output Design**

- [ ] Human-readable output by default
- [ ] Machine-readable with `--json` flag
- [ ] Respect `NO_COLOR` environment variable
- [ ] Disable animations when not a TTY
- [ ] Use color with intention (green=success, red=error)
- [ ] Show progress for long operations
- [ ] Tell user what changed after mutations

### **11.4 Error Handling**

- [ ] Catch and rewrite errors for humans
- [ ] Include fix suggestions in error messages
- [ ] Put most important info at end of output
- [ ] Use red for errors, sparingly
- [ ] Provide debug/traceback when unexpected
- [ ] Make bug reporting easy

### **11.5 Arguments & Flags**

- [ ] Prefer flags to positional arguments
- [ ] Full-length version of all flags (`-v` and `--verbose`)
- [ ] Use standard flag names (`-h`, `-v`, `-q`, `--json`, etc.)
- [ ] Confirm before dangerous operations
- [ ] Support `--dry-run` for risky operations
- [ ] Allow `-` for stdin/stdout where appropriate

### **11.6 Robustness**

- [ ] Validate all user input
- [ ] Respond in <100ms (show spinner otherwise)
- [ ] Show progress for >2s operations
- [ ] Make operations idempotent where possible
- [ ] Handle Ctrl+C gracefully
- [ ] Make it recoverable (can re-run after failure)

### **11.7 Configuration**

- [ ] Follow precedence: flags > env > project > user > system
- [ ] Follow XDG spec for user config location
- [ ] Use `OPS_` prefix for environment variables
- [ ] Document all configuration options

### **11.8 Future-Proofing**

- [ ] Keep changes additive
- [ ] Warn before breaking changes
- [ ] Don't have catch-all subcommands
- [ ] Don't allow arbitrary abbreviations

---

## **12. Risks & Mitigations**

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Learning curve** | Medium | Low | Comprehensive `--help`, examples in docs |
| **Regression during migration** | Medium | High | Parallel operation during cutover, CI validates both |
| **Performance slower than Bash** | Low | Low | Python startup is ~50ms, acceptable for dev tools |
| **Missing edge cases** | Medium | Medium | Extensive testing, gradual rollout |
| **`gh` CLI not installed** | Low | Medium | Clear prerequisite error messages, install hints |
| **Breaking existing scripts** | Medium | Medium | Warn in release notes, provide migration guide |

---

## **13. Success Criteria**

### **13.1 Functional Requirements**

| Requirement | Metric |
|-------------|--------|
| All `make` targets have `ops` equivalents | 100% coverage |
| All `scripts/*.sh` replaced | 0 shell scripts in active use |
| CI uses `ops` commands | All workflows updated |
| Documentation current | `CLAUDE.md`, `README.md` updated |

### **13.2 Quality Requirements**

| Requirement | Metric |
|-------------|--------|
| Type coverage | 100% (pyright strict) |
| Test coverage | >80% for core logic |
| Help text quality | Examples for every command |
| Error message quality | Fix suggestion for every error |

### **13.3 Performance Requirements**

| Requirement | Metric |
|-------------|--------|
| `ops --help` response time | <100ms |
| `ops build` (cached) | <500ms |
| Progress shown for long ops | 100% of ops >2s |

### **13.4 Developer Experience**

| Requirement | Validation |
|-------------|------------|
| Zero-setup installation | `uv sync` is sufficient |
| Discoverable commands | New devs can use without reading docs |
| Helpful errors | Errors include fix suggestions |
| Consistent with expectations | Follows standard CLI conventions |

---

## **Appendix A: Command Reference (Draft)**

```
ops - Developer CLI for adk-sim-plugin

USAGE:
  ops <command> [options]

COMMANDS:
  build       Build project artifacts
  dev         Start development servers
  docker      Manage Docker containers
  quality     Run quality checks and tests
  release     Create and publish releases
  clean       Remove generated files

GLOBAL OPTIONS:
  -v, --verbose    Show detailed output
  -q, --quiet      Suppress non-essential output
  -h, --help       Show help for command
  --version        Show version

EXAMPLES:
  ops dev                      Start dev servers
  ops build                    Build everything
  ops quality                  Run quality checks
  ops release patch            Create patch release
  ops release patch --dry-run  Preview release steps
```

---

## **Appendix B: File Inventory**

**Files to create:**
```
ops/
├── pyproject.toml
└── src/ops/
    ├── __init__.py
    ├── cli.py
    ├── commands/
    │   ├── __init__.py
    │   ├── build.py
    │   ├── dev.py
    │   ├── docker.py
    │   ├── quality.py
    │   └── release.py
    ├── core/
    │   ├── __init__.py
    │   ├── console.py
    │   ├── git.py
    │   ├── github.py
    │   ├── paths.py
    │   └── process.py
    └── py.typed
```

**Files to modify:**
```
pyproject.toml          # Add ops to workspace
.github/workflows/*.yaml  # Use ops commands
CLAUDE.md               # Update developer docs
README.md               # Update quick start
```

**Files to delete (Phase 7):**
```
Makefile
scripts/build.sh
scripts/ship.sh
scripts/presubmit.sh
scripts/check-generated.sh
scripts/should-run-e2e.sh
scripts/get_next_version.py
scripts/sync_versions.py
```
