"""Server startup script for the ADK Agent Simulator."""

import asyncio

from grpclib.reflection.service import ServerReflection
from grpclib.server import Server
from grpclib.utils import graceful_exit

from adk_agent_sim.persistence.database import Database
from adk_agent_sim.persistence.event_repo import EventRepository
from adk_agent_sim.persistence.session_repo import SessionRepository
from adk_agent_sim.server.broadcaster import EventBroadcaster
from adk_agent_sim.server.logging import configure_logging, get_logger
from adk_agent_sim.server.queue import RequestQueue
from adk_agent_sim.server.services.simulator_service import SimulatorService
from adk_agent_sim.server.session_manager import SessionManager
from adk_agent_sim.settings import settings

logger = get_logger("main")


async def serve() -> None:
  """Start the gRPC server with all services configured."""
  # Configure logging first
  configure_logging()

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

  services: list = [_simulator_service]

  # Enable Reflection for debugging tools like grpcurl
  services = ServerReflection.extend(services)

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
