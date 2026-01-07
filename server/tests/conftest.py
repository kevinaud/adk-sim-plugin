"""Test configuration and shared fixtures."""

from typing import TYPE_CHECKING

import pytest
from adk_sim_server.persistence.database import Database
from adk_sim_server.session_manager import SessionManager
from adk_sim_testing.fixtures import FakeEventRepository, FakeSessionRepository

if TYPE_CHECKING:
  from collections.abc import AsyncGenerator


@pytest.fixture
async def db() -> AsyncGenerator[Database]:
  """Provide an in-memory database connection."""
  database = Database("sqlite+aiosqlite:///:memory:")
  await database.connect()
  await database.create_tables()
  yield database
  await database.disconnect()


@pytest.fixture
def session_repo() -> FakeSessionRepository:
  return FakeSessionRepository()


@pytest.fixture
def event_repo() -> FakeEventRepository:
  return FakeEventRepository()


@pytest.fixture
def manager(
  session_repo: FakeSessionRepository,
  event_repo: FakeEventRepository,
) -> SessionManager:
  return SessionManager(session_repo, event_repo)


def pytest_configure(config: pytest.Config) -> None:
  """Register custom markers."""
  config.addinivalue_line(
    "markers",
    "integration: marks tests as integration tests (require API keys, slower)",
  )
  config.addinivalue_line(
    "markers",
    "e2e: marks tests as end-to-end tests (require Docker, slower)",
  )


def pytest_addoption(parser: pytest.Parser) -> None:
  """Add custom command line options."""
  parser.addoption(
    "--run-integration",
    action="store_true",
    default=False,
    help="run integration tests",
  )
  parser.addoption(
    "--run-e2e",
    action="store_true",
    default=False,
    help="run end-to-end tests (requires Docker)",
  )


def pytest_collection_modifyitems(
  config: pytest.Config,
  items: list[pytest.Item],
) -> None:
  """Skip integration and e2e tests unless their respective flags are passed."""
  if not config.getoption("--run-integration"):
    skip_integration = pytest.mark.skip(reason="need --run-integration option to run")
    for item in items:
      if "integration" in item.keywords:
        item.add_marker(skip_integration)

  if not config.getoption("--run-e2e"):
    skip_e2e = pytest.mark.skip(reason="need --run-e2e option to run")
    for item in items:
      if "e2e" in item.keywords:
        item.add_marker(skip_e2e)
