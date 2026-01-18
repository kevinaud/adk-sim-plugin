"""Quality and testing commands for ops."""

from enum import Enum

import typer

from ops.core.console import console
from ops.core.paths import FRONTEND_DIR, REPO_ROOT
from ops.core.process import require_tools, run

app = typer.Typer(
  help="Run quality checks and tests.",
  no_args_is_help=False,
)


class TestScope(str, Enum):
  """Test scope options."""

  unit = "unit"
  integration = "integration"
  e2e = "e2e"
  all = "all"


@app.command()
def check(
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """
  Run quality checks (format, lint, type check).

  This applies formatters (jj fix) then runs fast verifiers (no tests).
  Use 'ops quality test' to also run tests.

  Examples:
    ops quality check    Run quality checks
    ops quality          Same as above (default)
  """
  import os
  import shutil

  require_tools("uv", "npm", "buf")

  console.print("Running quality checks...\n")

  # Apply formatters (jj fix) if jj is available
  # In CI environments, jj may not be installed
  has_jj = shutil.which("jj") is not None
  is_ci = os.environ.get("CI") == "true"

  if has_jj:
    console.print("[bold]Applying formatters...[/bold]")
    run(["jj", "fix"], cwd=REPO_ROOT, verbose=verbose, check=False)
    console.print("[green]✓[/green] Formatters applied\n")
  elif is_ci:
    console.print("[dim]Skipping jj fix (not available in CI)[/dim]\n")
  else:
    console.print("[yellow]⚠[/yellow] jj not found, skipping formatters\n")

  # Fast checks
  checks: list[tuple[str, list[str]]] = [
    ("Buf lint", ["buf", "lint", "--config", "buf.yaml", "protos"]),
    ("Pyright", ["uv", "run", "pyright"]),
    ("ESLint", ["npm", "run", "lint", "--workspace=frontend"]),
    ("Prettier", ["npm", "run", "format:check", "--workspace=frontend"]),
  ]

  for name, cmd in checks:
    console.print(f"[bold]{name}...[/bold]")
    try:
      run(cmd, cwd=REPO_ROOT, verbose=verbose)
      console.print(f"[green]✓[/green] {name}")
    except Exception as e:
      console.print(f"[red]✗[/red] {name}: {e}")
      raise typer.Exit(1) from None

  console.print("\n[green]![/green] Quality checks passed")


@app.command()
def fix(
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """
  Run formatters to auto-fix code style issues.

  This runs jj fix (ruff, prettier, buf format on modified files).

  Example:
    ops quality fix
  """
  require_tools("jj")

  console.print("Running formatters via jj fix...")

  run(
    ["jj", "fix"],
    cwd=REPO_ROOT,
    verbose=verbose,
    check=False,  # jj fix may exit non-zero if no changes
  )

  console.print("\n[green]![/green] Auto-fix complete")
  console.print("[dim]Run 'ops quality check' to verify[/dim]")


@app.command("test")
def run_tests(
  scope: TestScope = typer.Argument(
    TestScope.all,
    help="Test scope [unit|integration|e2e|all]",
  ),
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
  fail_fast: bool = typer.Option(
    False, "--fail-fast", "-x", help="Stop on first failure"
  ),
) -> None:
  """
  Run test suite.

  Examples:
    ops quality test           Run all tests
    ops quality test unit      Run unit tests only
    ops quality test e2e       Run E2E tests (requires Docker)
    ops quality test -x        Stop on first failure
  """
  require_tools("uv")

  pytest_args = ["-v"] if verbose else []
  if fail_fast:
    pytest_args.append("-x")

  if scope in (TestScope.unit, TestScope.all):
    console.print("Running Python unit tests...")
    run(
      [
        "uv",
        "run",
        "pytest",
        "server/tests/unit",
        "plugins/python/tests",
        *pytest_args,
      ],
      cwd=REPO_ROOT,
      verbose=verbose,
    )

  if scope in (TestScope.integration, TestScope.all):
    console.print("Running integration tests...")
    # Integration tests are typically in unit directory but marked
    run(
      ["uv", "run", "pytest", "-m", "integration", *pytest_args],
      cwd=REPO_ROOT,
      verbose=verbose,
      check=False,  # May not have any
    )

  if scope in (TestScope.e2e, TestScope.all):
    console.print("Running E2E tests...")
    console.print("[dim]E2E tests require Docker to be running[/dim]")

    # Backend E2E
    run(
      ["uv", "run", "pytest", "server/tests/e2e", "--run-e2e", *pytest_args],
      cwd=REPO_ROOT,
      verbose=verbose,
    )

    # Frontend E2E
    run(
      ["npm", "exec", "playwright", "test", "--", "-c", "playwright.config.ts"],
      cwd=FRONTEND_DIR,
      verbose=verbose,
    )

  console.print("\n[green]![/green] Tests passed")


@app.callback(invoke_without_command=True)
def quality_callback(
  ctx: typer.Context,
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """
  Run quality checks and tests.

  Examples:
    ops quality           Run quick quality checks (default)
    ops quality check     Same as above
    ops quality fix       Auto-fix issues
    ops quality test      Run test suite
  """
  if ctx.invoked_subcommand is None:
    # Default to check
    ctx.invoke(check, verbose=verbose)
