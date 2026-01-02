"""Server startup script for the ADK Agent Simulator."""

import asyncio

from grpclib.reflection.service import ServerReflection
from grpclib.server import Server
from grpclib.utils import graceful_exit

from adk_agent_sim.server.logging import configure_logging, get_logger
from adk_agent_sim.server.services.simulator_service import SimulatorService

logger = get_logger("main")


async def serve() -> None:
  """Start the gRPC server with all services configured."""
  # Configure logging first
  configure_logging()

  # Create the service
  simulator_service = SimulatorService()

  # TODO: SimulatorService needs to inherit from the generated base class
  # For now, we'll use an empty services list until protos are wired up
  services: list = []

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


def main() -> None:
  """Entry point for the server."""
  asyncio.run(serve())


if __name__ == "__main__":
  main()
