"""Tests for SessionManager."""

import uuid
from typing import TYPE_CHECKING

import pytest

from adk_agent_sim.generated.adksim.v1 import SimulatorSession

if TYPE_CHECKING:
  from adk_agent_sim.server.session_manager import SessionManager
  from tests.fixtures import FakeEventRepository, FakeSessionRepository


class TestSessionManager:
  """Test suite for SessionManager."""

  def test_initialization(
    self,
    manager: "SessionManager",  # noqa: UP037
    session_repo: "FakeSessionRepository",  # noqa: UP037
    event_repo: "FakeEventRepository",  # noqa: UP037
  ) -> None:
    """Test that SessionManager can be initialized with repositories."""
    assert manager is not None
    assert manager._session_repo is session_repo
    assert manager._event_repo is event_repo
    assert manager._active_sessions == {}


class TestCreateSession:
  """Test suite for SessionManager.create_session()."""

  @pytest.mark.asyncio
  async def test_create_session_returns_simulator_session(
    self, manager: SessionManager
  ) -> None:
    """Test that create_session returns a SimulatorSession instance."""
    session = await manager.create_session()

    assert isinstance(session, SimulatorSession)

  @pytest.mark.asyncio
  async def test_create_session_generates_valid_uuid(
    self, manager: SessionManager
  ) -> None:
    """Test that create_session generates a valid UUID for session ID."""
    session = await manager.create_session()

    # Verify the ID is a valid UUID (will raise if invalid)
    parsed_uuid = uuid.UUID(session.id)
    assert str(parsed_uuid) == session.id

  @pytest.mark.asyncio
  async def test_create_session_has_timestamp(self, manager: SessionManager) -> None:
    """Test that create_session sets a created_at timestamp."""
    session = await manager.create_session()

    # created_at should be a valid datetime
    assert session.created_at is not None
    # Verify it's a reasonable timestamp (not the epoch)
    assert session.created_at.year >= 2024

  @pytest.mark.asyncio
  async def test_create_session_with_description(self, manager: SessionManager) -> None:
    """Test that create_session stores the provided description."""
    description = "Test simulation session"
    session = await manager.create_session(description=description)

    assert session.description == description

  @pytest.mark.asyncio
  async def test_create_session_without_description(
    self, manager: SessionManager
  ) -> None:
    """Test that create_session works without a description."""
    session = await manager.create_session()

    assert session.description == ""

  @pytest.mark.asyncio
  async def test_create_session_persists_to_repository(
    self,
    manager: SessionManager,
    session_repo: FakeSessionRepository,
  ) -> None:
    """Test that create_session persists the session to the repository."""
    session = await manager.create_session(description="Persisted session")

    # Verify session was persisted by retrieving it from the repository
    retrieved = await session_repo.get_by_id(session.id)
    assert retrieved is not None
    assert retrieved.id == session.id
    assert retrieved.description == "Persisted session"

  @pytest.mark.asyncio
  async def test_create_session_caches_in_memory(self, manager: SessionManager) -> None:
    """Test that create_session caches the session in memory."""
    session = await manager.create_session()

    # Verify session is in the active_sessions cache
    assert session.id in manager._active_sessions
    assert manager._active_sessions[session.id] is session

  @pytest.mark.asyncio
  async def test_create_multiple_sessions_generates_unique_ids(
    self, manager: SessionManager
  ) -> None:
    """Test that multiple calls generate unique session IDs."""
    session1 = await manager.create_session()
    session2 = await manager.create_session()
    session3 = await manager.create_session()

    # All IDs should be unique
    ids = {session1.id, session2.id, session3.id}
    assert len(ids) == 3

  @pytest.mark.asyncio
  async def test_create_multiple_sessions_all_cached(
    self, manager: SessionManager
  ) -> None:
    """Test that multiple sessions are all cached in memory."""
    session1 = await manager.create_session()
    session2 = await manager.create_session()

    assert len(manager._active_sessions) == 2
    assert session1.id in manager._active_sessions
    assert session2.id in manager._active_sessions
