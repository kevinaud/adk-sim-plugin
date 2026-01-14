"""E2E test fixtures using pytest-docker."""

import socket
from collections.abc import AsyncGenerator
from pathlib import Path

import pytest
from grpclib.client import Channel
from pytest_docker.plugin import Services


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
  """Apply default timeout of 120 seconds to all e2e tests."""
  for item in items:
    if not item.get_closest_marker("timeout"):
      item.add_marker(pytest.mark.timeout(120))


@pytest.fixture(scope="session")
def docker_compose_file() -> Path:
  """Return path to the test docker-compose file."""
  return Path(__file__).parents[3] / "docker-compose.test.yaml"


def _is_server_responsive(host: str, port: int) -> bool:
  """Check if the gRPC server is accepting connections."""
  try:
    with socket.create_connection((host, port), timeout=1):
      return True
  except OSError:
    return False


@pytest.fixture(scope="session")
def simulator_server(docker_services: Services) -> tuple[str, int]:
  """Wait for the simulator server to be responsive and return (host, port)."""
  host = "localhost"
  port = docker_services.port_for("backend", 50051)

  docker_services.wait_until_responsive(
    timeout=60.0,
    pause=0.5,
    check=lambda: _is_server_responsive(host, port),
  )

  return (host, port)


@pytest.fixture
async def grpc_channel(
  simulator_server: tuple[str, int],
) -> AsyncGenerator[Channel]:
  """Create and yield a connected gRPC channel, close on teardown."""
  host, port = simulator_server
  channel = Channel(host=host, port=port)
  yield channel
  channel.close()
