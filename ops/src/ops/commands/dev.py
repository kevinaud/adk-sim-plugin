"""Development server commands for ops."""

import typer

from ops.core.console import console
from ops.core.paths import FRONTEND_DIR, REPO_ROOT
from ops.core.process import kill_port, require_tools, run

app = typer.Typer(
  help="Start development servers.",
  no_args_is_help=False,
)

# Default ports used by the backend server
GRPC_PORT = 50051
WEB_PORT = 8080


@app.command()
def server(
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """
  Start the backend gRPC server.

  The server runs with auto-reload using watchfiles.
  Automatically kills any processes using ports 50051 (gRPC) and 8080 (web).

  Example:
    ops dev server
  """
  require_tools("uv")

  # Kill any processes already using the server ports
  killed_ports = [port for port in (GRPC_PORT, WEB_PORT) if kill_port(port)]

  if killed_ports:
    ports_str = ", ".join(str(p) for p in killed_ports)
    console.print(f"[yellow]Killed processes on port(s): {ports_str}[/yellow]")

  console.print("Starting backend server...")
  console.print("[dim]Press Ctrl+C to stop[/dim]\n")

  run(
    [
      "uv",
      "run",
      "watchfiles",
      "--filter",
      "python",
      "adk-sim",
      "server/src",
      "packages",
      "plugins",
    ],
    cwd=REPO_ROOT,
    verbose=verbose,
    check=False,  # Don't fail on Ctrl+C
  )


@app.command()
def frontend(
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """
  Start the frontend Angular dev server.

  The server runs on http://localhost:4200 with hot reload.

  Example:
    ops dev frontend
  """
  require_tools("npm")

  console.print("Starting frontend dev server...")
  console.print("[dim]Server will be available at http://localhost:4200[/dim]")
  console.print("[dim]Press Ctrl+C to stop[/dim]\n")

  run(
    ["npm", "start"],
    cwd=FRONTEND_DIR,
    verbose=verbose,
    check=False,  # Don't fail on Ctrl+C
  )


@app.callback(invoke_without_command=True)
def dev_callback(
  ctx: typer.Context,
) -> None:
  """
  Start development servers.

  Examples:
    ops dev server     Start backend server
    ops dev frontend   Start frontend dev server
  """
  if ctx.invoked_subcommand is None:
    console.print(ctx.get_help())
