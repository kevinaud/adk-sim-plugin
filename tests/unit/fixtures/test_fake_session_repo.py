"""Tests for FakeSessionRepository.

Verifies the fake correctly implements the SessionRepository interface
and can be used reliably in unit tests.
"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from adk_agent_sim.generated.adksim.v1 import SessionStatus, SimulatorSession
from tests.fixtures import FakeSessionRepository


def make_session(
  session_id: str | None = None,
  description: str = "test session",
) -> SimulatorSession:
  """Create a SimulatorSession for testing."""
  return SimulatorSession(
    id=session_id or str(uuid4()),
    created_at=datetime.now(UTC),
    description=description,
  )


class TestFakeSessionRepositoryCreateAndGet:
  """Tests for create() and get_by_id()."""

  @pytest.mark.asyncio
  async def test_create_stores_session(self) -> None:
    """Create stores a session that can be retrieved."""
    repo = FakeSessionRepository()
    session = make_session()

    result = await repo.create(session)

    assert result == session

  @pytest.mark.asyncio
  async def test_get_by_id_returns_stored_session(self) -> None:
    """get_by_id retrieves a previously stored session."""
    repo = FakeSessionRepository()
    session = make_session()
    await repo.create(session)

    result = await repo.get_by_id(session.id)

    assert result == session

  @pytest.mark.asyncio
  async def test_get_by_id_returns_none_for_missing(self) -> None:
    """get_by_id returns None for non-existent session."""
    repo = FakeSessionRepository()

    result = await repo.get_by_id("nonexistent-id")

    assert result is None

  @pytest.mark.asyncio
  async def test_create_with_custom_status(self) -> None:
    """Create with custom status stores correctly."""
    repo = FakeSessionRepository()
    session = make_session()

    await repo.create(session, status=SessionStatus.COMPLETED)

    assert repo.get_status(session.id) == SessionStatus.COMPLETED

  @pytest.mark.asyncio
  async def test_create_default_status_is_active(self) -> None:
    """Create without status defaults to ACTIVE."""
    repo = FakeSessionRepository()
    session = make_session()

    await repo.create(session)

    assert repo.get_status(session.id) == SessionStatus.ACTIVE


class TestFakeSessionRepositoryListAll:
  """Tests for list_all() with pagination."""

  @pytest.mark.asyncio
  async def test_list_all_empty_repo(self) -> None:
    """list_all on empty repo returns empty list."""
    repo = FakeSessionRepository()

    result = await repo.list_all()

    assert result.sessions == []
    assert result.next_page_token is None

  @pytest.mark.asyncio
  async def test_list_all_returns_all_sessions(self) -> None:
    """list_all returns all sessions when under page size."""
    repo = FakeSessionRepository()
    session1 = make_session()
    session2 = make_session()
    await repo.create(session1)
    await repo.create(session2)

    result = await repo.list_all()

    assert len(result.sessions) == 2
    assert session1 in result.sessions
    assert session2 in result.sessions
    assert result.next_page_token is None

  @pytest.mark.asyncio
  async def test_list_all_respects_page_size(self) -> None:
    """list_all respects page_size parameter."""
    repo = FakeSessionRepository()
    for _ in range(5):
      await repo.create(make_session())

    result = await repo.list_all(page_size=3)

    assert len(result.sessions) == 3
    assert result.next_page_token is not None

  @pytest.mark.asyncio
  async def test_list_all_pagination_continues(self) -> None:
    """list_all with page_token continues from correct position."""
    repo = FakeSessionRepository()
    all_sessions = [make_session() for _ in range(5)]
    for s in all_sessions:
      await repo.create(s)

    # Get first page
    page1 = await repo.list_all(page_size=2)
    assert len(page1.sessions) == 2
    assert page1.next_page_token is not None

    # Get second page using token
    page2 = await repo.list_all(page_size=2, page_token=page1.next_page_token)
    assert len(page2.sessions) == 2
    assert page2.next_page_token is not None

    # Get third page (last)
    page3 = await repo.list_all(page_size=2, page_token=page2.next_page_token)
    assert len(page3.sessions) == 1
    assert page3.next_page_token is None

    # Verify all sessions were returned across pages
    all_returned = page1.sessions + page2.sessions + page3.sessions
    assert len(all_returned) == 5

  @pytest.mark.asyncio
  async def test_list_all_invalid_token_starts_from_beginning(self) -> None:
    """list_all with invalid page_token starts from beginning."""
    repo = FakeSessionRepository()
    session1 = make_session()
    session2 = make_session()
    await repo.create(session1)
    await repo.create(session2)

    result = await repo.list_all(page_token="invalid-token")

    assert len(result.sessions) == 2


class TestFakeSessionRepositoryUpdateStatus:
  """Tests for update_status()."""

  @pytest.mark.asyncio
  async def test_update_status_success(self) -> None:
    """update_status updates status of existing session."""
    repo = FakeSessionRepository()
    session = make_session()
    await repo.create(session, status=SessionStatus.ACTIVE)

    result = await repo.update_status(session.id, SessionStatus.COMPLETED)

    assert result is True
    assert repo.get_status(session.id) == SessionStatus.COMPLETED

  @pytest.mark.asyncio
  async def test_update_status_returns_false_for_missing(self) -> None:
    """update_status returns False for non-existent session."""
    repo = FakeSessionRepository()

    result = await repo.update_status("nonexistent-id", SessionStatus.COMPLETED)

    assert result is False

  @pytest.mark.asyncio
  async def test_update_status_preserves_session_data(self) -> None:
    """update_status doesn't modify session data."""
    repo = FakeSessionRepository()
    session = make_session(description="original description")
    await repo.create(session)

    await repo.update_status(session.id, SessionStatus.COMPLETED)

    retrieved = await repo.get_by_id(session.id)
    assert retrieved is not None
    assert retrieved.description == "original description"


class TestFakeSessionRepositoryHelpers:
  """Tests for helper methods."""

  @pytest.mark.asyncio
  async def test_get_status_returns_status(self) -> None:
    """get_status returns the status of a session."""
    repo = FakeSessionRepository()
    session = make_session()
    await repo.create(session, status=SessionStatus.CANCELLED)

    assert repo.get_status(session.id) == SessionStatus.CANCELLED

  @pytest.mark.asyncio
  async def test_get_status_returns_none_for_missing(self) -> None:
    """get_status returns None for non-existent session."""
    repo = FakeSessionRepository()

    assert repo.get_status("nonexistent") is None

  @pytest.mark.asyncio
  async def test_clear_removes_all_sessions(self) -> None:
    """clear removes all stored sessions."""
    repo = FakeSessionRepository()
    await repo.create(make_session())
    await repo.create(make_session())

    repo.clear()

    result = await repo.list_all()
    assert result.sessions == []
