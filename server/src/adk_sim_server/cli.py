"""CLI entrypoint for the ADK Agent Simulator.

This module provides the command-line interface for running the ADK Agent
Simulator server. It starts both the gRPC server (for plugin communication)
and the HTTP server (for web UI) concurrently.

Usage:
    adk-sim --port 50051 --web-port 8080
"""

import asyncio
import sys
from pathlib import Path
from typing import Annotated

import typer
import uvicorn
from grpclib.reflection.service import ServerReflection
from grpclib.server import Server
from sqlalchemy.engine import make_url

from adk_sim_server.broadcaster import EventBroadcaster
from adk_sim_server.logging import configure_logging, get_logger
from adk_sim_server.persistence.database import Database
from adk_sim_server.persistence.event_repo import EventRepository
from adk_sim_server.persistence.session_repo import SessionRepository
from adk_sim_server.queue import RequestQueue
from adk_sim_server.services.simulator_service import SimulatorService
from adk_sim_server.session_manager import SessionManager
from adk_sim_server.settings import settings
from adk_sim_server.web import create_app

logger = get_logger("cli")

# Create typer app - single command mode
app = typer.Typer(
  name="adk-sim",
  help="ADK Agent Simulator - Run the simulation server.",
  add_completion=False,
  no_args_is_help=False,
)


def _ensure_database_dir(url: str) -> None:
  """Ensures the database directory exists; exits on permission error."""
  if not url.startswith("sqlite"):
    return

  db_dir: Path | None = None
  try:
    parsed = make_url(url)
    database_path = parsed.database

    # Skip in-memory databases
    if (
      not database_path
      or database_path == ":memory:"
      or database_path.startswith("file::memory:")
    ):
      return

    db_file = Path(database_path)
    db_dir = db_file.parent
    db_dir.mkdir(parents=True, exist_ok=True)

  except PermissionError:
    logger.critical(
      "❌ PERMISSION ERROR: Cannot create database directory at: %s\n"
      "   Please ensure you have write permissions or set "
      "ADK_AGENT_SIM_DATABASE_URL to a writable path.",
      db_dir,
    )
    sys.exit(1)
  except Exception as e:
    logger.critical("❌ Failed to prepare database path: %s", e)
    sys.exit(1)


async def _run_grpc_server(
  service: SimulatorService,
  host: str,
  port: int,
  shutdown_event: asyncio.Event,
) -> None:
  """Run the gRPC server.

  Args:
      service: The SimulatorService instance.
      host: Host to bind to.
      port: Port to bind to.
      shutdown_event: Event to signal shutdown.
  """
  services = ServerReflection.extend([service])
  server = Server(services)

  logger.info("Starting gRPC server on %s:%d", host, port)

  await server.start(host, port)
  logger.info("gRPC server started successfully")

  # Wait for shutdown signal
  await shutdown_event.wait()

  logger.info("Shutting down gRPC server...")
  server.close()
  await server.wait_closed()


async def _run_web_server(
  service: SimulatorService,
  host: str,
  port: int,
  shutdown_event: asyncio.Event,
) -> None:
  """Run the web/HTTP server.

  Args:
      service: The SimulatorService instance.
      host: Host to bind to.
      port: Port to bind to.
      shutdown_event: Event to signal shutdown.
  """
  starlette_app = create_app(service)

  config = uvicorn.Config(
    app=starlette_app,
    host=host,
    port=port,
    log_level="info",
  )
  server = uvicorn.Server(config)

  logger.info("Starting web server on %s:%d", host, port)

  # Run uvicorn server
  await server.serve()

  # Signal shutdown when web server stops
  shutdown_event.set()


async def serve(
  grpc_port: int = 50051,
  web_port: int = 8080,
  db_url: str | None = None,
) -> None:
  """Start both gRPC and web servers concurrently.

  Args:
      grpc_port: Port for the gRPC server (default: 50051).
      web_port: Port for the web server (default: 8080).
      db_url: Database URL (default: from settings).
  """
  configure_logging()

  # Use provided db_url or fall back to settings
  database_url = db_url or settings.database_url
  _ensure_database_dir(database_url)

  # Initialize persistence layer
  database = Database(database_url)
  await database.connect()
  await database.create_tables()

  # Initialize services
  session_repo = SessionRepository(database)
  event_repo = EventRepository(database)
  session_manager = SessionManager(session_repo, event_repo)
  request_queue = RequestQueue()
  event_broadcaster = EventBroadcaster()

  # Create the simulator service (shared between gRPC and web)
  simulator_service = SimulatorService(
    session_manager, event_repo, request_queue, event_broadcaster
  )

  # Shutdown coordination
  shutdown_event = asyncio.Event()

  host = "0.0.0.0"

  print("ADK Agent Simulator starting...")
  print(f"  gRPC server: {host}:{grpc_port}")
  print(f"  Web server:  {host}:{web_port}")

  try:
    # Run both servers concurrently
    await asyncio.gather(
      _run_grpc_server(simulator_service, host, grpc_port, shutdown_event),
      _run_web_server(simulator_service, host, web_port, shutdown_event),
    )
  except asyncio.CancelledError:
    logger.info("Server shutdown requested")
  finally:
    await database.disconnect()
    logger.info("Server shutdown complete")


@app.callback(invoke_without_command=True)
def run(
  port: Annotated[int, typer.Option("--port", "-p", help="gRPC server port")] = 50051,
  web_port: Annotated[
    int, typer.Option("--web-port", "-w", help="Web/HTTP server port")
  ] = 8080,
  db_url: Annotated[
    str | None,
    typer.Option(
      "--db-url", "-d", help="Database URL", envvar="ADK_AGENT_SIM_DATABASE_URL"
    ),
  ] = None,
) -> None:
  """Run the ADK Agent Simulator server.

  Starts both the gRPC server (for plugin communication) and the web server
  (for the browser UI) concurrently.
  """
  asyncio.run(serve(grpc_port=port, web_port=web_port, db_url=db_url))


if __name__ == "__main__":
  app()
