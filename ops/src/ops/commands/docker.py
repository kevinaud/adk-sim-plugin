"""Docker commands for ops."""

import typer

from ops.core.console import console
from ops.core.paths import REPO_ROOT
from ops.core.process import kill_port, require_tools, run

app = typer.Typer(
  help="Manage Docker containers.",
  no_args_is_help=True,
)

# Ports used by Docker services
DOCKER_PORTS = [50051, 8080, 4200]


@app.command()
def up(
  detach: bool = typer.Option(False, "--detach", "-d", help="Run in background"),
  build: bool = typer.Option(False, "--build", "-b", help="Rebuild images"),
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """
  Start Docker containers.

  Starts the full development stack (backend + frontend).
  Automatically kills any processes using the required ports.

  Examples:
    ops docker up           Start and attach to logs
    ops docker up -d        Start in background
    ops docker up --build   Rebuild images before starting
  """
  require_tools("docker")

  # Kill any processes using Docker ports
  killed_ports = [port for port in DOCKER_PORTS if kill_port(port)]
  if killed_ports:
    ports_str = ", ".join(str(p) for p in killed_ports)
    console.print(f"[yellow]Killed processes on port(s): {ports_str}[/yellow]")

  console.print("Starting Docker containers...")

  cmd = ["docker", "compose", "up", "--remove-orphans"]
  if build:
    cmd.append("--build")
  if detach:
    cmd.append("--detach")

  run(cmd, cwd=REPO_ROOT, verbose=verbose, check=False)

  if detach:
    console.print("\n[green]![/green] Containers started in background")
    console.print("[dim]Use 'ops docker logs' to view logs[/dim]")


@app.command()
def down(
  volumes: bool = typer.Option(False, "--volumes", "-v", help="Remove volumes too"),
  verbose: bool = typer.Option(False, "--verbose", help="Show detailed output"),
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
  service: str | None = typer.Argument(None, help="Service name to show logs for"),
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
  verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed output"),
) -> None:
  """
  List running containers.

  Example:
    ops docker ps
  """
  require_tools("docker")

  run(["docker", "compose", "ps"], cwd=REPO_ROOT, verbose=verbose)
