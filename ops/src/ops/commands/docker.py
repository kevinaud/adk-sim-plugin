"""Docker commands for ops."""

import typer

from ops.core.console import console
from ops.core.paths import REPO_ROOT
from ops.core.process import require_tools, run

app = typer.Typer(
  help="Manage Docker containers.",
  no_args_is_help=True,
)


@app.command()
def up(
  detach: bool = typer.Option(
    False, "--detach", "-d", help="Run in background"
  ),
  verbose: bool = typer.Option(
    False, "--verbose", "-v", help="Show detailed output"
  ),
) -> None:
  """
  Start Docker containers.

  Starts the full development stack (backend + frontend).

  Examples:
    ops docker up        Start and attach to logs
    ops docker up -d     Start in background
  """
  require_tools("docker")

  console.print("Starting Docker containers...")

  cmd = ["docker", "compose", "up"]
  if detach:
    cmd.append("--detach")

  run(cmd, cwd=REPO_ROOT, verbose=verbose, check=False)

  if detach:
    console.print("\n[green]![/green] Containers started in background")
    console.print("[dim]Use 'ops docker logs' to view logs[/dim]")


@app.command()
def down(
  volumes: bool = typer.Option(
    False, "--volumes", "-v", help="Remove volumes too"
  ),
  verbose: bool = typer.Option(
    False, "--verbose", help="Show detailed output"
  ),
) -> None:
  """
  Stop Docker containers.

  Examples:
    ops docker down      Stop containers
    ops docker down -v   Stop and remove volumes
  """
  require_tools("docker")

  console.print("Stopping Docker containers...")

  cmd = ["docker", "compose", "down"]
  if volumes:
    cmd.append("--volumes")

  run(cmd, cwd=REPO_ROOT, verbose=verbose)

  console.print("[green]![/green] Containers stopped")


@app.command()
def logs(
  follow: bool = typer.Option(
    True, "--follow/--no-follow", "-f", help="Follow log output"
  ),
  service: str | None = typer.Argument(
    None, help="Service name to show logs for"
  ),
) -> None:
  """
  View container logs.

  Examples:
    ops docker logs              Follow all logs
    ops docker logs backend      Follow backend logs only
    ops docker logs --no-follow  Show logs without following
  """
  require_tools("docker")

  cmd = ["docker", "compose", "logs"]
  if follow:
    cmd.append("--follow")
  if service:
    cmd.append(service)

  run(cmd, cwd=REPO_ROOT, check=False)


@app.command()
def ps(
  verbose: bool = typer.Option(
    False, "--verbose", "-v", help="Show detailed output"
  ),
) -> None:
  """
  List running containers.

  Example:
    ops docker ps
  """
  require_tools("docker")

  run(["docker", "compose", "ps"], cwd=REPO_ROOT, verbose=verbose)
