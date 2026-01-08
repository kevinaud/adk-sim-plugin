"""Test configuration and shared fixtures for server tests."""

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

