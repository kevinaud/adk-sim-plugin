"""Server startup script for the ADK Agent Simulator."""

import asyncio
import sys
from pathlib import Path

from grpclib.reflection.service import ServerReflection
from grpclib.server import Server
from grpclib.utils import graceful_exit
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

logger = get_logger("main")


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


async def serve() -> None:
  """Start the gRPC server with all services configured."""
  # Configure logging first
  configure_logging()

  # Ensure database directory exists before connecting
  _ensure_database_dir(settings.database_url)

  # Initialize persistence layer
  database = Database(settings.database_url)
  await database.connect()
  await database.create_tables()

  session_repo = SessionRepository(database)
  event_repo = EventRepository(database)
  session_manager = SessionManager(session_repo, event_repo)
  request_queue = RequestQueue()
  event_broadcaster = EventBroadcaster()

  # Create the service
  _simulator_service = SimulatorService(
    session_manager, event_repo, request_queue, event_broadcaster
  )

  # Enable Reflection for debugging tools like grpcurl
  services = ServerReflection.extend([_simulator_service])

  # Create and start the server
  server = Server(services)
  host, port = "0.0.0.0", 50051

  logger.info("Starting ADK Agent Simulator server on %s:%d", host, port)
  print(f"ADK Agent Simulator serving on {host}:{port} with Reflection enabled...")

  with graceful_exit([server]):
    await server.start(host, port)
    logger.info("Server started successfully")
    await server.wait_closed()
    await database.disconnect()


def main() -> None:
  """Entry point for the server."""
  asyncio.run(serve())


if __name__ == "__main__":
  main()
