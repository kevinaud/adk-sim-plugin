"""Tests for FakeEventRepository.

Verifies the fake correctly implements the EventRepository interface
and can be used reliably in unit tests.
"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from adk_agent_sim.generated.adksim.v1 import SessionEvent
from tests.fixtures import FakeEventRepository


def make_event(
  session_id: str,
  turn_id: str,
  timestamp: datetime | None = None,
  event_id: str | None = None,
) -> SessionEvent:
  """Create a SessionEvent for testing."""
  return SessionEvent(
    event_id=event_id or str(uuid4()),
    session_id=session_id,
    turn_id=turn_id,
    timestamp=timestamp or datetime.now(UTC),
  )


class TestFakeEventRepositoryInsert:
  """Tests for insert()."""

  @pytest.mark.asyncio
  async def test_insert_stores_event(self) -> None:
    """Insert stores an event that can be retrieved."""
    repo = FakeEventRepository()
    event = make_event(session_id="sess-1", turn_id="turn-1")

    result = await repo.insert(event)

    assert result == event

  @pytest.mark.asyncio
  async def test_insert_multiple_events(self) -> None:
    """Insert stores multiple events."""
    repo = FakeEventRepository()
    event1 = make_event(session_id="sess-1", turn_id="turn-1")
    event2 = make_event(session_id="sess-1", turn_id="turn-2")

    await repo.insert(event1)
    await repo.insert(event2)

    events = await repo.get_by_session("sess-1")
    assert len(events) == 2


class TestFakeEventRepositoryGetBySession:
  """Tests for get_by_session()."""

  @pytest.mark.asyncio
  async def test_get_by_session_returns_correct_events(self) -> None:
    """get_by_session returns only events for the given session."""
    repo = FakeEventRepository()
    event1 = make_event(session_id="sess-1", turn_id="turn-1")
    event2 = make_event(session_id="sess-2", turn_id="turn-2")
    await repo.insert(event1)
    await repo.insert(event2)

    result = await repo.get_by_session("sess-1")

    assert len(result) == 1
    assert result[0] == event1

  @pytest.mark.asyncio
  async def test_get_by_session_returns_timestamp_order(self) -> None:
    """get_by_session returns events ordered by timestamp ASC."""
    repo = FakeEventRepository()
    now = datetime.now(UTC)
    event_old = make_event(
      session_id="sess-1",
      turn_id="turn-1",
      timestamp=now - timedelta(minutes=10),
    )
    event_new = make_event(
      session_id="sess-1",
      turn_id="turn-2",
      timestamp=now,
    )
    # Insert in reverse order to verify sorting
    await repo.insert(event_new)
    await repo.insert(event_old)

    result = await repo.get_by_session("sess-1")

    assert len(result) == 2
    assert result[0] == event_old
    assert result[1] == event_new

  @pytest.mark.asyncio
  async def test_get_by_session_returns_empty_for_nonexistent(self) -> None:
    """get_by_session returns empty list for non-existent session."""
    repo = FakeEventRepository()

    result = await repo.get_by_session("nonexistent-session")

    assert result == []


class TestFakeEventRepositoryGetByTurnId:
  """Tests for get_by_turn_id()."""

  @pytest.mark.asyncio
  async def test_get_by_turn_id_returns_request_response_pair(self) -> None:
    """get_by_turn_id returns both request and response events for a turn."""
    repo = FakeEventRepository()
    now = datetime.now(UTC)
    request_event = make_event(
      session_id="sess-1",
      turn_id="turn-1",
      timestamp=now,
    )
    response_event = make_event(
      session_id="sess-1",
      turn_id="turn-1",
      timestamp=now + timedelta(seconds=1),
    )
    await repo.insert(request_event)
    await repo.insert(response_event)

    result = await repo.get_by_turn_id("turn-1")

    assert len(result) == 2
    assert result[0] == request_event
    assert result[1] == response_event

  @pytest.mark.asyncio
  async def test_get_by_turn_id_returns_empty_for_nonexistent(self) -> None:
    """get_by_turn_id returns empty list for non-existent turn_id."""
    repo = FakeEventRepository()

    result = await repo.get_by_turn_id("nonexistent-turn")

    assert result == []


class TestFakeEventRepositoryClear:
  """Tests for clear() helper."""

  @pytest.mark.asyncio
  async def test_clear_removes_all_events(self) -> None:
    """Clear removes all stored events."""
    repo = FakeEventRepository()
    await repo.insert(make_event(session_id="sess-1", turn_id="turn-1"))
    await repo.insert(make_event(session_id="sess-2", turn_id="turn-2"))

    repo.clear()

    assert await repo.get_by_session("sess-1") == []
    assert await repo.get_by_session("sess-2") == []
