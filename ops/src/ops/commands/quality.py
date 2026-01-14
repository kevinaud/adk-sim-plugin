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
  verbose: bool = typer.Option(
    False, "--verbose", "-v", help="Show detailed output"
  ),
) -> None:
  """
  Run quality checks (lint, format, type check).

  This runs pre-commit hooks on all files (commit stage only).
  Use 'ops quality test' to also run tests.

  Examples:
    ops quality check    Run quality checks
    ops quality          Same as above (default)
  """
  require_tools("uv")

  console.print("Running quality checks...")

  run(
    ["uv", "run", "pre-commit", "run", "--all-files"],
    cwd=REPO_ROOT,
    verbose=verbose,
  )

  console.print("\n[green]![/green] Quality checks passed")


@app.command()
def fix(
  verbose: bool = typer.Option(
    False, "--verbose", "-v", help="Show detailed output"
  ),
) -> None:
  """
  Run quality checks with auto-fix enabled.

  This formats code and fixes auto-fixable lint issues.

  Example:
    ops quality fix
  """
  require_tools("uv")

  console.print("Running quality checks with auto-fix...")

  # Run ruff format first
  run(
    ["uv", "run", "ruff", "format", "."],
    cwd=REPO_ROOT,
    verbose=verbose,
  )

  # Run ruff check with --fix
  run(
    ["uv", "run", "ruff", "check", "--fix", "."],
    cwd=REPO_ROOT,
    verbose=verbose,
    check=False,  # May have unfixable issues
  )

  # Run prettier on frontend
  run(
    ["npm", "run", "format"],
    cwd=FRONTEND_DIR,
    verbose=verbose,
    check=False,
  )

  console.print("\n[green]![/green] Auto-fix complete")
  console.print("[dim]Run 'ops quality check' to verify[/dim]")


@app.command("test")
def run_tests(
  scope: TestScope = typer.Argument(
    TestScope.all,
    help="Test scope [unit|integration|e2e|all]",
  ),
  verbose: bool = typer.Option(
    False, "--verbose", "-v", help="Show detailed output"
  ),
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
  verbose: bool = typer.Option(
    False, "--verbose", "-v", help="Show detailed output"
  ),
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
