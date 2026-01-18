"""Test runner commands.

Unified interface for running all test suites across the monorepo.

Examples:
  ops test                    Run all tests
  ops test unit               Run all unit tests
  ops test e2e                Run all E2E tests
  ops test frontend           Run frontend unit + E2E
  ops test frontend e2e --trace  Run frontend E2E with tracing
  ops test server             Run server unit + E2E
  ops test plugin             Run all plugin tests
  ops test plugin:python      Run Python plugin tests only
"""

import subprocess
from collections.abc import Generator
from contextlib import contextmanager
from typing import Annotated

import typer
from rich.panel import Panel

from ops.core.console import console
from ops.core.paths import FRONTEND_DIR, REPO_ROOT
from ops.core.process import require_tools, run

# =============================================================================
# E2E Backend Management
# =============================================================================

E2E_COMPOSE_FILE = REPO_ROOT / "docker-compose.e2e.yaml"
E2E_SEED_SCRIPT = FRONTEND_DIR / "tests" / "e2e" / "utils" / "seed-populated-backend.ts"


def _start_e2e_backends(verbose: bool = False) -> None:
  """Start the E2E Docker backends and wait for them to be healthy."""
  console.print("[dim]Starting E2E backends...[/dim]")
  run(
    ["docker", "compose", "-f", str(E2E_COMPOSE_FILE), "up", "-d", "--build", "--wait"],
    cwd=REPO_ROOT,
    verbose=verbose,
  )
  console.print("[dim]Seeding populated backend...[/dim]")
  run(
    ["npx", "tsx", str(E2E_SEED_SCRIPT)],
    cwd=FRONTEND_DIR,
    verbose=verbose,
  )


def _stop_e2e_backends(verbose: bool = False) -> None:
  """Stop the E2E Docker backends."""
  console.print("[dim]Stopping E2E backends...[/dim]")
  run(
    ["docker", "compose", "-f", str(E2E_COMPOSE_FILE), "down"],
    cwd=REPO_ROOT,
    verbose=verbose,
    check=False,  # Don't fail if containers aren't running
  )


def _e2e_backends_running() -> bool:
  """Check if E2E backends are already running and healthy."""
  result = subprocess.run(
    [
      "docker",
      "compose",
      "-f",
      str(E2E_COMPOSE_FILE),
      "ps",
      "--status",
      "running",
      "--quiet",
    ],
    cwd=REPO_ROOT,
    capture_output=True,
    text=True,
  )
  # If we have running containers, check if all 3 are up
  running_count = len(result.stdout.strip().split("\n")) if result.stdout.strip() else 0
  return running_count >= 3


@contextmanager
def e2e_backends(verbose: bool = False) -> Generator[None]:
  """Context manager that ensures E2E backends are running.

  If backends are already running, leaves them running after the test.
  If backends need to be started, stops them after the test.
  """
  already_running = _e2e_backends_running()

  if already_running:
    console.print("[dim]E2E backends already running[/dim]")
  else:
    _start_e2e_backends(verbose)

  try:
    yield
  finally:
    if not already_running:
      _stop_e2e_backends(verbose)


# =============================================================================
# Test Runner Functions
# =============================================================================


def run_server_unit(verbose: bool = False) -> None:
  """Run server unit tests."""
  run(
    ["uv", "run", "pytest", "server/tests/unit", "-v"],
    cwd=REPO_ROOT,
    verbose=verbose,
  )


def run_server_e2e(verbose: bool = False) -> None:
  """Run server E2E tests (requires Docker)."""
  run(
    ["uv", "run", "pytest", "server/tests/e2e", "--run-e2e", "-v"],
    cwd=REPO_ROOT,
    verbose=verbose,
  )


def run_frontend_unit(verbose: bool = False) -> None:
  """Run frontend Vitest unit tests."""
  run(
    ["npm", "run", "ng", "--", "test", "--watch=false"],
    cwd=FRONTEND_DIR,
    env={"CI": "true"},
    verbose=verbose,
  )


def run_frontend_component(verbose: bool = False, use_docker: bool | None = None) -> None:
  """Run Playwright component tests.

  Args:
    verbose: Show detailed output.
    use_docker: Use Docker for consistent visual regression testing.
      - None (default): Auto-detect (use Docker in CI)
      - True: Always use Docker
      - False: Never use Docker
  """
  import os

  # Auto-detect: use Docker in CI for consistent visual regression snapshots
  if use_docker is None:
    use_docker = os.environ.get("CI") == "true"

  if use_docker:
    # Run in official Playwright Docker image for pixel-perfect consistency
    # See mddocs/frontend/research/deep-research/visual-regression-ci-investigation-report.md
    console.print("[dim]Using Playwright Docker for consistent snapshots[/dim]")

    # Get current user/group IDs to run container as same user
    # This prevents permission issues with files created in the container
    uid = os.getuid()
    gid = os.getgid()

    run(
      [
        "docker",
        "run",
        "--rm",
        "-v",
        f"{REPO_ROOT}:/app",
        "-w",
        "/app/frontend",
        "--ipc=host",
        "-u",
        f"{uid}:{gid}",
        "mcr.microsoft.com/playwright:v1.57.0-noble",
        "npm",
        "exec",
        "playwright",
        "test",
        "--",
        "-c",
        "playwright-ct.config.ts",
      ],
      cwd=REPO_ROOT,
      verbose=verbose,
    )
  else:
    run(
      ["npm", "exec", "playwright", "test", "--", "-c", "playwright-ct.config.ts"],
      cwd=FRONTEND_DIR,
      verbose=verbose,
    )


def run_frontend_e2e(verbose: bool = False, trace: bool = False) -> None:
  """Run Playwright E2E tests.

  Automatically starts/stops E2E Docker backends as needed.
  """
  with e2e_backends(verbose):
    cmd = ["npm", "exec", "playwright", "test", "--", "-c", "playwright.config.ts"]
    if trace:
      cmd.extend(["--trace", "on"])
    run(cmd, cwd=FRONTEND_DIR, verbose=verbose)


def run_plugin_python(verbose: bool = False) -> None:
  """Run Python plugin tests."""
  run(
    ["uv", "run", "pytest", "plugins/python/tests", "-v"],
    cwd=REPO_ROOT,
    verbose=verbose,
  )


# =============================================================================
# Frontend Subcommand
# =============================================================================

frontend_app = typer.Typer(help="Run frontend tests.")


@frontend_app.callback(invoke_without_command=True)
def frontend_callback(
  ctx: typer.Context,
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """
  Run all frontend tests (unit + E2E).

  Examples:
    ops test frontend           Run unit, component, and E2E tests
    ops test frontend unit      Run only Vitest unit tests
    ops test frontend e2e       Run Playwright E2E and component tests
  """
  if ctx.invoked_subcommand is None:
    require_tools("npm")
    console.print(Panel("Frontend Tests", style="blue"))

    console.print("\n[bold]Running unit tests...[/bold]")
    run_frontend_unit(verbose)
    console.print("[green]![/green] Unit tests passed")

    console.print("\n[bold]Running component tests...[/bold]")
    run_frontend_component(verbose)
    console.print("[green]![/green] Component tests passed")

    console.print("\n[bold]Running E2E tests...[/bold]")
    run_frontend_e2e(verbose)
    console.print("[green]![/green] E2E tests passed")

    console.print("\n[green]! All frontend tests passed![/green]")


@frontend_app.command("unit")
def frontend_unit(
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """Run frontend Vitest unit tests."""
  require_tools("npm")
  console.print(Panel("Frontend Unit Tests", style="blue"))
  run_frontend_unit(verbose)
  console.print("\n[green]! Frontend unit tests passed![/green]")


@frontend_app.command("e2e")
def frontend_e2e(
  trace: bool = typer.Option(
    False, "--trace", help="Generate traces for all tests (slower)"
  ),
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """
  Run frontend E2E tests (Playwright E2E + component tests).

  Examples:
    ops test frontend e2e           Run E2E and component tests
    ops test frontend e2e --trace   Run with full trace capture
  """
  require_tools("npm")
  console.print(Panel("Frontend E2E Tests", style="blue"))

  if trace:
    console.print("[dim]Trace mode enabled - traces saved to test-results/[/dim]")

  console.print("\n[bold]Running component tests...[/bold]")
  run_frontend_component(verbose)
  console.print("[green]![/green] Component tests passed")

  console.print("\n[bold]Running E2E tests...[/bold]")
  run_frontend_e2e(verbose, trace=trace)
  console.print("[green]![/green] E2E tests passed")

  console.print("\n[green]! All frontend E2E tests passed![/green]")

  if trace:
    console.print(
      "\n[dim]View traces with: npx playwright show-trace "
      "frontend/test-results/<test-name>/trace.zip[/dim]"
    )


# =============================================================================
# Server Subcommand
# =============================================================================

server_app = typer.Typer(help="Run server tests.")


@server_app.callback(invoke_without_command=True)
def server_callback(
  ctx: typer.Context,
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """
  Run all server tests (unit + E2E).

  Examples:
    ops test server        Run unit and E2E tests
    ops test server unit   Run only unit tests
    ops test server e2e    Run only E2E tests (requires Docker)
  """
  if ctx.invoked_subcommand is None:
    require_tools("uv")
    console.print(Panel("Server Tests", style="blue"))

    console.print("\n[bold]Running unit tests...[/bold]")
    run_server_unit(verbose)
    console.print("[green]![/green] Unit tests passed")

    console.print("\n[bold]Running E2E tests...[/bold]")
    run_server_e2e(verbose)
    console.print("[green]![/green] E2E tests passed")

    console.print("\n[green]! All server tests passed![/green]")


@server_app.command("unit")
def server_unit(
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """Run server unit tests."""
  require_tools("uv")
  console.print(Panel("Server Unit Tests", style="blue"))
  run_server_unit(verbose)
  console.print("\n[green]! Server unit tests passed![/green]")


@server_app.command("e2e")
def server_e2e(
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """Run server E2E tests (requires Docker)."""
  require_tools("uv", "docker")
  console.print(Panel("Server E2E Tests", style="blue"))
  run_server_e2e(verbose)
  console.print("\n[green]! Server E2E tests passed![/green]")


# =============================================================================
# Plugin Subcommand
# =============================================================================

plugin_app = typer.Typer(help="Run plugin tests.")


@plugin_app.callback(invoke_without_command=True)
def plugin_callback(
  ctx: typer.Context,
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """
  Run all plugin tests.

  Currently only Python plugin is implemented. TypeScript and Java
  plugins will be added in the future.

  Examples:
    ops test plugin         Run all plugin tests
    ops test plugin:python  Run Python plugin tests only
  """
  if ctx.invoked_subcommand is None:
    require_tools("uv")
    console.print(Panel("Plugin Tests", style="blue"))

    console.print("\n[bold]Running Python plugin tests...[/bold]")
    run_plugin_python(verbose)
    console.print("[green]![/green] Python plugin tests passed")

    # Future: Add TypeScript and Java plugin tests here

    console.print("\n[green]! All plugin tests passed![/green]")


# Plugin-specific commands use colon syntax: plugin:python, plugin:ts, etc.
# We register these as separate commands on the main app below.


# =============================================================================
# Main Test App
# =============================================================================

app = typer.Typer(
  help="Run tests across the monorepo.",
  no_args_is_help=False,
)

# Register subcommands
app.add_typer(frontend_app, name="frontend")
app.add_typer(server_app, name="server")
app.add_typer(plugin_app, name="plugin")


@app.callback(invoke_without_command=True)
def test_callback(
  ctx: typer.Context,
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """
  Run tests across the monorepo.

  With no arguments, runs ALL test suites. Use subcommands to run
  specific test suites.

  Examples:
    ops test                 Run all tests
    ops test unit            Run all unit tests
    ops test e2e             Run all E2E tests
    ops test frontend        Run frontend tests
    ops test server          Run server tests
    ops test plugin          Run plugin tests
    ops test plugin:python   Run Python plugin tests
  """
  if ctx.invoked_subcommand is None:
    # Run all tests
    require_tools("npm", "uv")
    console.print(Panel("All Tests", style="blue"))

    steps = [
      ("Server unit tests", lambda: run_server_unit(verbose)),
      ("Frontend unit tests", lambda: run_frontend_unit(verbose)),
      ("Plugin tests", lambda: run_plugin_python(verbose)),
      ("Frontend component tests", lambda: run_frontend_component(verbose)),
      ("Frontend E2E tests", lambda: run_frontend_e2e(verbose)),
      ("Server E2E tests", lambda: run_server_e2e(verbose)),
    ]

    failed: list[str] = []
    for name, func in steps:
      console.print(f"\n[bold]{name}...[/bold]")
      try:
        func()
        console.print(f"[green]![/green] {name} passed")
      except Exception as e:
        console.print(f"[red]![/red] {name} failed: {e}")
        failed.append(name)

    console.print()
    if failed:
      console.print(f"[red]! Tests failed:[/red] {', '.join(failed)}")
      raise typer.Exit(1)
    console.print("[green]! All tests passed![/green]")


@app.command("unit")
def all_unit(
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """
  Run all unit tests across the monorepo.

  Includes:
  - Server unit tests (pytest)
  - Frontend unit tests (Vitest)
  - Plugin tests (pytest)
  """
  require_tools("npm", "uv")
  console.print(Panel("All Unit Tests", style="blue"))

  console.print("\n[bold]Running server unit tests...[/bold]")
  run_server_unit(verbose)
  console.print("[green]![/green] Server unit tests passed")

  console.print("\n[bold]Running frontend unit tests...[/bold]")
  run_frontend_unit(verbose)
  console.print("[green]![/green] Frontend unit tests passed")

  console.print("\n[bold]Running plugin tests...[/bold]")
  run_plugin_python(verbose)
  console.print("[green]![/green] Plugin tests passed")

  console.print("\n[green]! All unit tests passed![/green]")


@app.command("e2e")
def all_e2e(
  trace: Annotated[
    bool,
    typer.Option("--trace", help="Generate traces for frontend E2E tests"),
  ] = False,
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """
  Run all E2E tests across the monorepo.

  Includes:
  - Frontend component tests (Playwright CT)
  - Frontend E2E tests (Playwright)
  - Server E2E tests (pytest, requires Docker)
  """
  require_tools("npm", "uv", "docker")
  console.print(Panel("All E2E Tests", style="blue"))

  if trace:
    console.print("[dim]Trace mode enabled for frontend E2E tests[/dim]")

  console.print("\n[bold]Running frontend component tests...[/bold]")
  run_frontend_component(verbose)
  console.print("[green]![/green] Frontend component tests passed")

  console.print("\n[bold]Running frontend E2E tests...[/bold]")
  run_frontend_e2e(verbose, trace=trace)
  console.print("[green]![/green] Frontend E2E tests passed")

  console.print("\n[bold]Running server E2E tests...[/bold]")
  run_server_e2e(verbose)
  console.print("[green]![/green] Server E2E tests passed")

  console.print("\n[green]! All E2E tests passed![/green]")

  if trace:
    console.print(
      "\n[dim]View traces with: npx playwright show-trace "
      "frontend/test-results/<test-name>/trace.zip[/dim]"
    )


# Plugin-specific commands (colon syntax)
@app.command("plugin:python")
def plugin_python_cmd(
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """Run Python plugin tests only."""
  require_tools("uv")
  console.print(Panel("Python Plugin Tests", style="blue"))
  run_plugin_python(verbose)
  console.print("\n[green]! Python plugin tests passed![/green]")


# Future: Add plugin:ts and plugin:java commands here
