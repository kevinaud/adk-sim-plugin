"""CI pipeline commands.

These commands encapsulate all CI logic, allowing:
- Local reproduction of CI failures
- Single source of truth for validation logic
- Testable CI pipeline steps
"""

import json
import re
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path
from typing import TYPE_CHECKING

import typer
from rich.panel import Panel

from ops.commands.test import (
  run_frontend_component,
  run_frontend_e2e,
  run_frontend_unit,
  run_plugin_python,
  run_server_e2e,
  run_server_unit,
)
from ops.core.console import console
from ops.core.git import get_changed_files, get_upstream_branch
from ops.core.paths import REPO_ROOT
from ops.core.process import require_tools, run

if TYPE_CHECKING:
  from collections.abc import Callable

app = typer.Typer(
  help="CI pipeline commands. Run the same checks locally that CI runs.",
)


# Patterns for files that don't affect runtime (can skip E2E)
SKIP_E2E_PATTERNS = [
  r"^mddocs/",
  r"^\.github/agents/",
  r"^\.claude/",
  r"^README\.md$",
  r"^CLAUDE\.md$",
  r"^\.vscode/",
]


def _should_run_e2e() -> bool:
  """
  Determine if E2E tests should run based on changed files.

  Skip E2E if only documentation/config files changed.
  """
  try:
    upstream = get_upstream_branch()
    changed_files = get_changed_files(upstream)

    if not changed_files:
      return True  # Safety default

    skip_regex = "|".join(SKIP_E2E_PATTERNS)
    return any(f and not re.match(skip_regex, f) for f in changed_files)

  except Exception:
    return True  # Safety default on any error


def _install_deps() -> None:
  """Ensure all dependencies are installed."""
  run(["npm", "install", "--silent"], cwd=REPO_ROOT)
  run(["uv", "sync", "--frozen"], cwd=REPO_ROOT)


def _build_ts() -> None:
  """Build TypeScript packages."""
  run(
    ["npm", "run", "build", "--workspace=packages/adk-sim-protos-ts"],
    cwd=REPO_ROOT,
  )
  run(
    ["npm", "run", "build", "--workspace=packages/adk-converters-ts"],
    cwd=REPO_ROOT,
  )


def _run_quality() -> None:
  """Run quality checks via ops quality."""
  from ops.commands.quality import check as quality_check

  quality_check(verbose=False)


@app.callback(invoke_without_command=True)
def ci_callback(ctx: typer.Context) -> None:
  """
  Run full CI validation.

  This runs the exact same checks that the CI workflow runs,
  allowing you to catch issues before pushing.

  Examples:
    ops ci              Run all CI checks
    ops ci check        Same as above (explicit)
    ops ci build        Build release artifacts
    ops ci verify       Verify artifacts work
  """
  if ctx.invoked_subcommand is None:
    # Default to full check
    ctx.invoke(check)


@app.command()
def check(
  skip_e2e: bool = typer.Option(False, "--skip-e2e", help="Skip E2E tests (faster)"),
  fail_fast: bool = typer.Option(
    False, "--fail-fast", "-x", help="Stop on first failure"
  ),
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """
  Run full CI validation suite.

  This is equivalent to what runs on every PR:
  1. Ensure dependencies are installed
  2. Build TypeScript packages
  3. Run quality checks (jj quality)
  4. Run all test suites

  Examples:
    ops ci check                 Full validation
    ops ci check --skip-e2e      Skip slow E2E tests
    ops ci check --fail-fast     Stop on first failure
  """
  require_tools("npm", "uv")

  console.print(Panel("CI Validation Suite", style="blue"))

  # Build test functions that run server + plugin unit tests together
  def _run_backend_tests() -> None:
    run_server_unit()
    run_plugin_python()

  steps: list[tuple[str, Callable[[], None]]] = [
    ("Installing dependencies", _install_deps),
    ("Building TypeScript packages", _build_ts),
    ("Running quality checks", _run_quality),
    ("Running backend tests", _run_backend_tests),
    ("Running frontend tests", run_frontend_unit),
    ("Running component tests", run_frontend_component),
  ]

  run_e2e = not skip_e2e and _should_run_e2e()
  if run_e2e:
    steps.extend(
      [
        ("Running frontend E2E tests", run_frontend_e2e),
        ("Running backend E2E tests", run_server_e2e),
      ]
    )
  elif not skip_e2e:
    console.print("[dim]Skipping E2E tests (only docs changed)[/dim]")
  else:
    console.print("[dim]Skipping E2E tests (--skip-e2e)[/dim]")

  failed: list[str] = []
  for name, func in steps:
    console.print(f"\n[bold]{name}...[/bold]")
    try:
      func()
      console.print(f"[green]![/green] {name}")
    except Exception as e:
      console.print(f"[red]![/red] {name}: {e}")
      failed.append(name)
      if fail_fast:
        break

  console.print()
  if failed:
    console.print(f"[red]! CI failed:[/red] {', '.join(failed)}")
    raise typer.Exit(1)
  console.print("[green]! All CI checks passed![/green]")


@app.command("push")
def push_cmd(
  bookmark: str | None = typer.Option(
    None, "--bookmark", "-b", help="Push specific bookmark"
  ),
  all_bookmarks: bool = typer.Option(False, "--all", help="Push all bookmarks"),
  skip_e2e: bool = typer.Option(False, "--skip-e2e", help="Skip E2E tests (faster)"),
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """
  Run full quality gate pipeline and push if all checks pass.

  This is the secure push workflow that ensures code quality before pushing:
  1. Apply formatters (jj fix)
  2. Run fast checks (lint, type-check)
  3. Build verification (Angular AOT)
  4. Run all test suites
  5. Regenerate proto code
  6. Push to remote

  Examples:
    ops ci push                    Full validation + push
    ops ci push --bookmark my-pr   Push specific bookmark
    ops ci push --all              Push all bookmarks
    ops ci push --skip-e2e         Skip E2E tests (faster)
  """
  import time

  from ops.commands.build import build_protos, clean_generated

  require_tools("npm", "uv", "jj")

  start_time = time.time()

  console.print(Panel("Secure Push - Quality Gate Pipeline", style="blue"))

  # ============================================================
  # Phase 1: Apply Formatters
  # ============================================================
  console.print("\n[bold]Phase 1: Applying formatters...[/bold]")
  run(["jj", "fix"], cwd=REPO_ROOT, check=False, verbose=verbose)
  console.print("[green]✓[/green] Formatters applied")

  # ============================================================
  # Phase 2: Fast Checks (Lint + Type Check)
  # ============================================================
  console.print("\n[bold]Phase 2: Running fast checks...[/bold]")

  fast_checks: list[tuple[str, list[str]]] = [
    ("Buf lint", ["buf", "lint", "--config", "buf.yaml", "protos"]),
    ("Pyright", ["uv", "run", "pyright"]),
    ("ESLint", ["npm", "run", "lint", "--workspace=frontend"]),
    ("Prettier", ["npm", "run", "format:check", "--workspace=frontend"]),
  ]

  for name, cmd in fast_checks:
    try:
      run(cmd, cwd=REPO_ROOT, verbose=verbose)
      console.print(f"[green]✓[/green] {name}")
    except Exception as e:
      console.print(f"[red]✗[/red] {name}: {e}")
      console.print("\n[red]Push aborted. Fix the issues and try again.[/red]")
      raise typer.Exit(1)

  # ============================================================
  # Phase 3: Build Verification
  # ============================================================
  console.print("\n[bold]Phase 3: Build verification...[/bold]")

  try:
    run(
      ["npm", "run", "build", "--", "--configuration", "production", "--no-progress"],
      cwd=REPO_ROOT / "frontend",
      env={"CI": "true"},
      verbose=verbose,
    )
    console.print("[green]✓[/green] Angular build")
  except Exception as e:
    console.print(f"[red]✗[/red] Angular build: {e}")
    console.print("\n[red]Push aborted. Fix the issues and try again.[/red]")
    raise typer.Exit(1)

  # ============================================================
  # Phase 4: Test Suite
  # ============================================================
  console.print("\n[bold]Phase 4: Running tests...[/bold]")

  # Backend tests
  try:
    run_server_unit(verbose)
    run_plugin_python(verbose)
    console.print("[green]✓[/green] Backend tests")
  except Exception as e:
    console.print(f"[red]✗[/red] Backend tests: {e}")
    console.print("\n[red]Push aborted. Fix the issues and try again.[/red]")
    raise typer.Exit(1)

  # TypeScript package tests
  try:
    run(
      ["npm", "test"], cwd=REPO_ROOT / "packages" / "adk-converters-ts", verbose=verbose
    )
    console.print("[green]✓[/green] adk-converters-ts tests")
  except Exception as e:
    console.print(f"[red]✗[/red] adk-converters-ts tests: {e}")
    console.print("\n[red]Push aborted. Fix the issues and try again.[/red]")
    raise typer.Exit(1)

  # Frontend unit tests
  try:
    run_frontend_unit(verbose)
    console.print("[green]✓[/green] Frontend unit tests")
  except Exception as e:
    console.print(f"[red]✗[/red] Frontend unit tests: {e}")
    console.print("\n[red]Push aborted. Fix the issues and try again.[/red]")
    raise typer.Exit(1)

  # E2E tests (conditional)
  run_e2e = not skip_e2e and _should_run_e2e()
  if run_e2e:
    try:
      run_frontend_e2e(verbose)
      console.print("[green]✓[/green] Frontend E2E tests (includes component tests)")
    except Exception as e:
      console.print(f"[red]✗[/red] Frontend E2E tests: {e}")
      console.print("\n[red]Push aborted. Fix the issues and try again.[/red]")
      raise typer.Exit(1)

    try:
      run_server_e2e(verbose)
      console.print("[green]✓[/green] Backend E2E tests")
    except Exception as e:
      console.print(f"[red]✗[/red] Backend E2E tests: {e}")
      console.print("\n[red]Push aborted. Fix the issues and try again.[/red]")
      raise typer.Exit(1)
  elif skip_e2e:
    console.print("[dim]Skipping E2E tests (--skip-e2e)[/dim]")
  else:
    console.print("[dim]Skipping E2E tests (only docs changed)[/dim]")

  # ============================================================
  # Phase 5: Regenerate Proto Code
  # ============================================================
  console.print("\n[bold]Phase 5: Regenerating proto code...[/bold]")

  try:
    clean_generated(verbose=verbose)
    build_protos(force=True, verbose=verbose)
    run(["jj", "fix"], cwd=REPO_ROOT, check=False, verbose=verbose)
    console.print("[green]✓[/green] Proto code regenerated")
  except Exception as e:
    console.print(f"[red]✗[/red] Proto regeneration: {e}")
    console.print("\n[red]Push aborted. Fix the issues and try again.[/red]")
    raise typer.Exit(1)

  # ============================================================
  # Phase 6: Push
  # ============================================================
  duration = int(time.time() - start_time)
  console.print()
  console.print(Panel(f"All checks passed in {duration}s!", style="green"))
  console.print()

  console.print("[bold]Pushing to remote...[/bold]")

  push_cmd_args = ["jj", "git", "push"]
  if bookmark:
    push_cmd_args.extend(["--bookmark", bookmark])
  elif all_bookmarks:
    push_cmd_args.append("--all")

  try:
    run(push_cmd_args, cwd=REPO_ROOT, verbose=verbose)
    console.print("\n[green]Push complete![/green]")
  except Exception as e:
    console.print(f"[red]✗[/red] Push failed: {e}")
    raise typer.Exit(1)


@app.command("build")
def build_cmd(
  output_dir: Path = typer.Option(
    Path("dist"), "--output", "-o", help="Output directory for artifacts"
  ),
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """
  Build all release artifacts.

  Builds:
  - Python wheels and sdists for all packages
  - TypeScript packages (compiled)
  - Frontend bundle (embedded in server)

  This is what runs in the publish workflow before upload.

  Examples:
    ops ci build                  Build to ./dist/
    ops ci build -o /tmp/release  Build to custom directory
  """
  require_tools("uv", "npm")

  console.print(Panel("Building Release Artifacts", style="blue"))

  # Use the build module
  from ops.commands.build import build_all

  build_all(force=True, verbose=verbose)

  # Build Python packages to output dir
  console.print("\n[bold]Building Python packages...[/bold]")
  output_dir.mkdir(parents=True, exist_ok=True)

  packages = [
    "adk-sim-protos",
    "adk-sim-testing",
    "adk-sim-server",
    "adk-agent-sim",
  ]

  for pkg in packages:
    run(
      ["uv", "build", "--package", pkg, "--out-dir", str(output_dir)],
      cwd=REPO_ROOT,
      verbose=verbose,
    )
    console.print(f"[green]![/green] Built {pkg}")

  # List artifacts
  console.print(f"\n[bold]Artifacts in {output_dir}:[/bold]")
  for artifact in sorted(output_dir.glob("*")):
    size = artifact.stat().st_size
    console.print(f"  {artifact.name} ({size:,} bytes)")


@app.command()
def verify(
  dist_dir: Path = typer.Option(
    Path("dist"), "--dist", "-d", help="Directory containing built artifacts"
  ),
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """
  Verify built artifacts are installable and functional.

  Creates a fresh virtual environment, installs the built packages,
  and runs smoke tests to ensure everything works.

  Examples:
    ops ci verify                 Verify artifacts in ./dist/
    ops ci build && ops ci verify Build then verify
  """
  require_tools("uv")

  console.print(Panel("Verifying Artifacts", style="blue"))

  with tempfile.TemporaryDirectory() as tmpdir:
    venv_path = Path(tmpdir) / ".venv"

    # Create isolated venv
    console.print("[bold]Creating verification environment...[/bold]")
    run(["uv", "venv", str(venv_path)], verbose=verbose)

    python_bin = venv_path / "bin" / "python"

    # Install from local dist
    console.print("[bold]Installing packages...[/bold]")
    run(
      [
        "uv",
        "pip",
        "install",
        "--python",
        str(python_bin),
        "adk-sim-server",
        "--find-links",
        str(dist_dir),
        "--prerelease=allow",
      ],
      verbose=verbose,
    )

    # Smoke test: imports
    console.print("[bold]Testing imports...[/bold]")
    run(
      [
        str(python_bin),
        "-c",
        "import adk_sim_server; import adk_sim_protos; print('! Imports OK')",
      ],
      verbose=verbose,
    )

    # Smoke test: server starts and serves frontend
    console.print("[bold]Testing server startup...[/bold]")

    adk_sim_bin = venv_path / "bin" / "adk-sim"
    proc = subprocess.Popen(
      [str(adk_sim_bin)],
      stdout=subprocess.PIPE,
      stderr=subprocess.PIPE,
    )
    try:
      time.sleep(3)

      # Check server responds
      response = urllib.request.urlopen("http://localhost:8080/")
      html = response.read().decode()

      if "<app-root>" not in html:
        msg = "Frontend not served correctly"
        raise RuntimeError(msg)

      console.print("[green]![/green] Server serves frontend")
    finally:
      proc.terminate()
      proc.wait()

  console.print("\n[green]! All verification checks passed![/green]")


@app.command()
def matrix(
  matrix_type: str = typer.Argument(..., help="Matrix type: 'python' or 'node'"),
) -> None:
  """
  Output CI matrix configuration as JSON.

  Used by GitHub Actions for dynamic matrix strategies.
  Allows matrix definition to live in code, not YAML.

  Examples:
    ops ci matrix python    Output Python version matrix
    ops ci matrix node      Output Node version matrix

  In workflow:
    matrix: ${{ fromJson(steps.matrix.outputs.matrix) }}
  """
  matrices = {
    "python": {
      "version": ["3.12", "3.13", "3.14"],
      "os": ["ubuntu-latest"],
    },
    "node": {
      "version": ["20", "22", "24"],
      "os": ["ubuntu-latest"],
    },
  }

  if matrix_type not in matrices:
    console.print(f"[red]Unknown matrix type: {matrix_type}[/red]")
    console.print(f"Available: {', '.join(matrices.keys())}")
    raise typer.Exit(2)

  # Output raw JSON for GHA consumption (to stdout, not console)
  print(json.dumps(matrices[matrix_type]))


@app.command("should-run-e2e")
def should_run_e2e_cmd() -> None:
  """
  Check if E2E tests should run based on changed files.

  Exits 0 if E2E tests should run, exits 1 if they can be skipped.
  Used by jj secure-push to conditionally skip E2E tests.

  Example:
    ops ci should-run-e2e && pytest --run-e2e
  """
  if _should_run_e2e():
    console.print("E2E tests required (runtime files changed)")
    raise typer.Exit(0)
  console.print("[dim]E2E tests can be skipped (only docs/config changed)[/dim]")
  raise typer.Exit(1)


@app.command("test")
def test_cmd(
  workflow: str = typer.Argument(
    "ci", help="Workflow name to test (e.g., 'ci', 'publish')"
  ),
  dry_run: bool = typer.Option(
    False, "--dry-run", "-n", help="Show act command without executing"
  ),
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """
  Run GitHub Actions workflows locally using act.

  Uses nektos/act to execute workflows in a local Docker environment.
  This is useful for testing workflow changes before pushing.

  The 'publish' workflow automatically sets DRY_RUN=true to skip
  actual publishing to PyPI/npm.

  Examples:
    ops ci test              Run ci.yaml locally
    ops ci test ci           Same as above (explicit)
    ops ci test publish      Run publish.yaml in dry-run mode
    ops ci test ci --dry-run Show command without executing
  """
  require_tools("act", "docker")

  console.print(Panel(f"Testing Workflow: {workflow}", style="blue"))

  workflow_file = REPO_ROOT / ".github" / "workflows" / f"{workflow}.yaml"
  if not workflow_file.exists():
    console.print(f"[red]Error:[/red] Workflow not found: {workflow_file}")
    raise typer.Exit(1)

  # Build act command
  # Use medium image for better compatibility with common actions
  cmd = [
    "act",
    "-W",
    str(workflow_file),
    "--container-architecture",
    "linux/amd64",
  ]

  # Enable artifact server for workflows that upload/download artifacts
  artifacts_dir = REPO_ROOT / ".artifacts"
  artifacts_dir.mkdir(exist_ok=True)
  cmd.extend(["--artifact-server-path", str(artifacts_dir)])

  # For publish workflow, use workflow_dispatch event with dry_run input
  if workflow == "publish":
    # Must explicitly trigger workflow_dispatch event to access inputs
    cmd.insert(1, "workflow_dispatch")
    cmd.extend(["--input", "dry_run=true"])
    console.print("[dim]Using workflow_dispatch with dry_run=true[/dim]")

  if verbose:
    cmd.append("--verbose")

  if dry_run:
    console.print(f"[dim]Would run:[/dim] {' '.join(cmd)}")
    return

  console.print(f"[dim]Running:[/dim] {' '.join(cmd)}")
  run(cmd, cwd=REPO_ROOT, verbose=verbose)

  console.print(f"\n[green]![/green] Workflow '{workflow}' completed successfully!")


@app.command("check-generated")
def check_generated_cmd(
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """
  Ensure generated code is up-to-date.

  Regenerates proto code and formats it. With Jujutsu, the working copy
  is always part of the current change, so we simply regenerate to ensure
  the generated code matches the proto definitions.

  Example:
    ops ci check-generated
  """
  from ops.commands.build import build_protos, clean_generated

  console.print("Regenerating proto code...")

  # Clean and regenerate
  clean_generated(verbose=verbose)
  build_protos(force=True, verbose=verbose)

  # Format the generated code
  run(
    ["jj", "fix"],
    cwd=REPO_ROOT,
    verbose=verbose,
    check=False,  # jj fix may exit non-zero if no changes needed
  )

  console.print("[green]![/green] Generated code is up-to-date!")
