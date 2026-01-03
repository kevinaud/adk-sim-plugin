"""Tests for SessionManager."""

import uuid

import pytest

from adk_agent_sim.generated.adksim.v1 import SimulatorSession
from adk_agent_sim.server.session_manager import SessionManager
from tests.fixtures import FakeEventRepository, FakeSessionRepository


class TestSessionManager:
  """Test suite for SessionManager."""

  def test_initialization(self) -> None:
    """Test that SessionManager can be initialized with repositories."""
    session_repo = FakeSessionRepository()
    event_repo = FakeEventRepository()

    manager = SessionManager(session_repo, event_repo)

    assert manager is not None
    assert manager._session_repo is session_repo
    assert manager._event_repo is event_repo
    assert manager._active_sessions == {}


class TestCreateSession:
  """Test suite for SessionManager.create_session()."""

  @pytest.mark.asyncio
  async def test_create_session_returns_simulator_session(self) -> None:
    """Test that create_session returns a SimulatorSession instance."""
    session_repo = FakeSessionRepository()
    event_repo = FakeEventRepository()
    manager = SessionManager(session_repo, event_repo)

    session = await manager.create_session()

    assert isinstance(session, SimulatorSession)

  @pytest.mark.asyncio
  async def test_create_session_generates_valid_uuid(self) -> None:
    """Test that create_session generates a valid UUID for session ID."""
    session_repo = FakeSessionRepository()
    event_repo = FakeEventRepository()
    manager = SessionManager(session_repo, event_repo)

    session = await manager.create_session()

    # Verify the ID is a valid UUID (will raise if invalid)
    parsed_uuid = uuid.UUID(session.id)
    assert str(parsed_uuid) == session.id

  @pytest.mark.asyncio
  async def test_create_session_has_timestamp(self) -> None:
    """Test that create_session sets a created_at timestamp."""
    session_repo = FakeSessionRepository()
    event_repo = FakeEventRepository()
    manager = SessionManager(session_repo, event_repo)

    session = await manager.create_session()

    # created_at should be a valid datetime
    assert session.created_at is not None
    # Verify it's a reasonable timestamp (not the epoch)
    assert session.created_at.year >= 2024

  @pytest.mark.asyncio
  async def test_create_session_with_description(self) -> None:
    """Test that create_session stores the provided description."""
    session_repo = FakeSessionRepository()
    event_repo = FakeEventRepository()
    manager = SessionManager(session_repo, event_repo)

    description = "Test simulation session"
    session = await manager.create_session(description=description)

    assert session.description == description

  @pytest.mark.asyncio
  async def test_create_session_without_description(self) -> None:
    """Test that create_session works without a description."""
    session_repo = FakeSessionRepository()
    event_repo = FakeEventRepository()
    manager = SessionManager(session_repo, event_repo)

    session = await manager.create_session()

    assert session.description == ""

  @pytest.mark.asyncio
  async def test_create_session_persists_to_repository(self) -> None:
    """Test that create_session persists the session to the repository."""
    session_repo = FakeSessionRepository()
    event_repo = FakeEventRepository()
    manager = SessionManager(session_repo, event_repo)

    session = await manager.create_session(description="Persisted session")

    # Verify session was persisted by retrieving it from the repository
    retrieved = await session_repo.get_by_id(session.id)
    assert retrieved is not None
    assert retrieved.id == session.id
    assert retrieved.description == "Persisted session"

  @pytest.mark.asyncio
  async def test_create_session_caches_in_memory(self) -> None:
    """Test that create_session caches the session in memory."""
    session_repo = FakeSessionRepository()
    event_repo = FakeEventRepository()
    manager = SessionManager(session_repo, event_repo)

    session = await manager.create_session()

    # Verify session is in the active_sessions cache
    assert session.id in manager._active_sessions
    assert manager._active_sessions[session.id] is session

  @pytest.mark.asyncio
  async def test_create_multiple_sessions_generates_unique_ids(self) -> None:
    """Test that multiple calls generate unique session IDs."""
    session_repo = FakeSessionRepository()
    event_repo = FakeEventRepository()
    manager = SessionManager(session_repo, event_repo)

    session1 = await manager.create_session()
    session2 = await manager.create_session()
    session3 = await manager.create_session()

    # All IDs should be unique
    ids = {session1.id, session2.id, session3.id}
    assert len(ids) == 3

  @pytest.mark.asyncio
  async def test_create_multiple_sessions_all_cached(self) -> None:
    """Test that multiple sessions are all cached in memory."""
    session_repo = FakeSessionRepository()
    event_repo = FakeEventRepository()
    manager = SessionManager(session_repo, event_repo)

    session1 = await manager.create_session()
    session2 = await manager.create_session()

    assert len(manager._active_sessions) == 2
    assert session1.id in manager._active_sessions
    assert session2.id in manager._active_sessions


class TestGetSession:
  """Test suite for SessionManager.get_session()."""

  @pytest.mark.asyncio
  async def test_get_session_cache_hit(self) -> None:
    """Test that get_session returns session from memory cache."""
    session_repo = FakeSessionRepository()
    event_repo = FakeEventRepository()
    manager = SessionManager(session_repo, event_repo)

    # Create a session (will be cached)
    created = await manager.create_session(description="Cached session")

    # Retrieve it - should hit the cache
    retrieved = await manager.get_session(created.id)

    assert retrieved is not None
    assert retrieved.id == created.id
    assert retrieved is created  # Same object reference (cache hit)

  @pytest.mark.asyncio
  async def test_get_session_cache_miss_db_hit(self) -> None:
    """Test that get_session loads from DB when not in cache."""
    session_repo = FakeSessionRepository()
    event_repo = FakeEventRepository()
    manager = SessionManager(session_repo, event_repo)

    # Create a session
    created = await manager.create_session(description="DB session")
    session_id = created.id

    # Clear the cache to simulate a reconnection scenario
    manager._active_sessions.clear()

    # Retrieve it - should hit the database and reload into cache
    retrieved = await manager.get_session(session_id)

    assert retrieved is not None
    assert retrieved.id == session_id
    assert retrieved.description == "DB session"
    # Should now be cached
    assert session_id in manager._active_sessions

  @pytest.mark.asyncio
  async def test_get_session_not_found(self) -> None:
    """Test that get_session returns None for non-existent session."""
    session_repo = FakeSessionRepository()
    event_repo = FakeEventRepository()
    manager = SessionManager(session_repo, event_repo)

    # Try to retrieve a session that doesn't exist
    retrieved = await manager.get_session("non-existent-id")

    assert retrieved is None

  @pytest.mark.asyncio
  async def test_get_session_caches_on_reconnection(self) -> None:
    """Test that sessions loaded from DB are cached for subsequent lookups."""
    session_repo = FakeSessionRepository()
    event_repo = FakeEventRepository()
    manager = SessionManager(session_repo, event_repo)

    # Create and then clear cache
    created = await manager.create_session()
    session_id = created.id
    manager._active_sessions.clear()

    # First retrieval - should load from DB
    first_retrieval = await manager.get_session(session_id)

    # Second retrieval - should hit the cache
    second_retrieval = await manager.get_session(session_id)

    assert first_retrieval is not None
    assert second_retrieval is not None
    assert first_retrieval is second_retrieval  # Same object (cache hit)
