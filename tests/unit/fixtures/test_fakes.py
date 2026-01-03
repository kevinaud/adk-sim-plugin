"""Tests for fake repositories.

Verifies that fake repositories behave identically to real repos.
"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from adk_agent_sim.generated.adksim.v1 import SessionEvent, SimulatorSession
from adk_agent_sim.generated.google.ai.generativelanguage.v1beta import (
  GenerateContentRequest,
  GenerateContentResponse,
)
from tests.fixtures import FakeEventRepository, FakeSessionRepository


class TestFakeSessionRepository:
  """Tests for FakeSessionRepository."""

  @pytest.mark.asyncio
  async def test_create_stores_session(self) -> None:
    """Create stores session and returns it."""
    repo = FakeSessionRepository()
    session = SimulatorSession(
      id=f"sess-{uuid4()}",
      created_at=datetime(2026, 1, 3, 12, 0, 0, tzinfo=UTC),
      description="Test session",
    )

    result = await repo.create(session)

    assert result == session
    assert repo.get_status(session.id) == "active"

  @pytest.mark.asyncio
  async def test_create_with_custom_status(self) -> None:
    """Create stores session with custom status."""
    repo = FakeSessionRepository()
    session = SimulatorSession(id=f"sess-{uuid4()}")

    await repo.create(session, status="completed")

    assert repo.get_status(session.id) == "completed"

  @pytest.mark.asyncio
  async def test_get_by_id_returns_session(self) -> None:
    """Get by ID returns stored session."""
    repo = FakeSessionRepository()
    session = SimulatorSession(
      id=f"sess-{uuid4()}",
      description="Test",
    )
    await repo.create(session)

    result = await repo.get_by_id(session.id)

    assert result == session

  @pytest.mark.asyncio
  async def test_get_by_id_returns_none_for_nonexistent(self) -> None:
    """Get by ID returns None for non-existent session."""
    repo = FakeSessionRepository()

    result = await repo.get_by_id("nonexistent")

    assert result is None

  @pytest.mark.asyncio
  async def test_list_all_returns_all_sessions(self) -> None:
    """List all returns all stored sessions."""
    repo = FakeSessionRepository()
    session1 = SimulatorSession(id="sess-001")
    session2 = SimulatorSession(id="sess-002")
    await repo.create(session1)
    await repo.create(session2)

    sessions, next_token = await repo.list_all()

    assert len(sessions) == 2
    assert next_token is None

  @pytest.mark.asyncio
  async def test_list_all_pagination(self) -> None:
    """List all supports pagination."""
    repo = FakeSessionRepository()
    for i in range(5):
      await repo.create(SimulatorSession(id=f"sess-{i:03d}"))

    # Get first page
    page1, token1 = await repo.list_all(page_size=2)
    assert len(page1) == 2
    assert token1 is not None

    # Get second page
    page2, token2 = await repo.list_all(page_size=2, page_token=token1)
    assert len(page2) == 2
    assert token2 is not None

    # Get third page
    page3, token3 = await repo.list_all(page_size=2, page_token=token2)
    assert len(page3) == 1
    assert token3 is None

  @pytest.mark.asyncio
  async def test_update_status_updates_existing(self) -> None:
    """Update status modifies existing session."""
    repo = FakeSessionRepository()
    session = SimulatorSession(id=f"sess-{uuid4()}")
    await repo.create(session, status="active")

    result = await repo.update_status(session.id, "completed")

    assert result is True
    assert repo.get_status(session.id) == "completed"

  @pytest.mark.asyncio
  async def test_update_status_returns_false_for_nonexistent(self) -> None:
    """Update status returns False for non-existent session."""
    repo = FakeSessionRepository()

    result = await repo.update_status("nonexistent", "completed")

    assert result is False

  def test_clear_removes_all_sessions(self) -> None:
    """Clear removes all stored sessions."""
    repo = FakeSessionRepository()
    repo._sessions["test"] = (SimulatorSession(id="test"), "active")

    repo.clear()

    assert len(repo._sessions) == 0


class TestFakeEventRepository:
  """Tests for FakeEventRepository."""

  @pytest.mark.asyncio
  async def test_insert_stores_event(self) -> None:
    """Insert stores event and returns it."""
    repo = FakeEventRepository()
    event = SessionEvent(
      event_id=f"evt-{uuid4()}",
      session_id="sess-001",
      timestamp=datetime(2026, 1, 3, 12, 0, 0, tzinfo=UTC),
      turn_id="turn-001",
      agent_name="test-agent",
      llm_request=GenerateContentRequest(model="gemini-pro"),
    )

    result = await repo.insert(event)

    assert result == event
    assert len(repo._events) == 1

  @pytest.mark.asyncio
  async def test_get_by_session_returns_events_ordered(self) -> None:
    """Get by session returns events in timestamp order."""
    repo = FakeEventRepository()
    session_id = f"sess-{uuid4()}"

    # Insert out of order
    event2 = SessionEvent(
      event_id="evt-2",
      session_id=session_id,
      timestamp=datetime(2026, 1, 3, 12, 0, 2, tzinfo=UTC),
      turn_id="turn-001",
      llm_request=GenerateContentRequest(),
    )
    event1 = SessionEvent(
      event_id="evt-1",
      session_id=session_id,
      timestamp=datetime(2026, 1, 3, 12, 0, 0, tzinfo=UTC),
      turn_id="turn-001",
      llm_request=GenerateContentRequest(),
    )
    await repo.insert(event2)
    await repo.insert(event1)

    result = await repo.get_by_session(session_id)

    assert len(result) == 2
    assert result[0].event_id == "evt-1"
    assert result[1].event_id == "evt-2"

  @pytest.mark.asyncio
  async def test_get_by_session_filters_by_session(self) -> None:
    """Get by session only returns events for specified session."""
    repo = FakeEventRepository()
    event_a = SessionEvent(
      event_id="evt-a",
      session_id="sess-a",
      timestamp=datetime(2026, 1, 3, 12, 0, 0, tzinfo=UTC),
      turn_id="turn-001",
      llm_request=GenerateContentRequest(),
    )
    event_b = SessionEvent(
      event_id="evt-b",
      session_id="sess-b",
      timestamp=datetime(2026, 1, 3, 12, 0, 0, tzinfo=UTC),
      turn_id="turn-001",
      llm_request=GenerateContentRequest(),
    )
    await repo.insert(event_a)
    await repo.insert(event_b)

    result = await repo.get_by_session("sess-a")

    assert len(result) == 1
    assert result[0].event_id == "evt-a"

  @pytest.mark.asyncio
  async def test_get_by_session_returns_empty_for_nonexistent(self) -> None:
    """Get by session returns empty list for non-existent session."""
    repo = FakeEventRepository()

    result = await repo.get_by_session("nonexistent")

    assert result == []

  @pytest.mark.asyncio
  async def test_get_by_turn_id_returns_events_ordered(self) -> None:
    """Get by turn returns events in timestamp order."""
    repo = FakeEventRepository()
    turn_id = f"turn-{uuid4()}"

    request = SessionEvent(
      event_id="evt-req",
      session_id="sess-001",
      timestamp=datetime(2026, 1, 3, 12, 0, 0, tzinfo=UTC),
      turn_id=turn_id,
      llm_request=GenerateContentRequest(),
    )
    response = SessionEvent(
      event_id="evt-resp",
      session_id="sess-001",
      timestamp=datetime(2026, 1, 3, 12, 0, 1, tzinfo=UTC),
      turn_id=turn_id,
      llm_response=GenerateContentResponse(),
    )
    await repo.insert(response)  # Insert out of order
    await repo.insert(request)

    result = await repo.get_by_turn_id(turn_id)

    assert len(result) == 2
    assert result[0].event_id == "evt-req"
    assert result[1].event_id == "evt-resp"

  @pytest.mark.asyncio
  async def test_get_by_turn_id_returns_empty_for_nonexistent(self) -> None:
    """Get by turn returns empty list for non-existent turn."""
    repo = FakeEventRepository()

    result = await repo.get_by_turn_id("nonexistent")

    assert result == []

  def test_clear_removes_all_events(self) -> None:
    """Clear removes all stored events."""
    repo = FakeEventRepository()
    repo._events.append(SessionEvent(event_id="test"))

    repo.clear()

    assert len(repo._events) == 0
