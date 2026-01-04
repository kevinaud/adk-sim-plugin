"""Tests for RequestQueue."""

from datetime import UTC, datetime

import pytest

from adk_agent_sim.generated.adksim.v1 import SessionEvent
from adk_agent_sim.server.queue import RequestQueue


def _make_event(session_id: str, event_id: str) -> SessionEvent:
  """Create a SessionEvent for testing."""
  return SessionEvent(
    event_id=event_id,
    session_id=session_id,
    timestamp=datetime.now(UTC),
    turn_id=f"turn-{event_id}",
  )


class TestRequestQueue:
  """Test suite for RequestQueue."""

  def test_initialization(self) -> None:
    """Test that RequestQueue can be initialized."""
    queue = RequestQueue()
    assert queue is not None

  @pytest.mark.asyncio
  async def test_enqueue_adds_event(self) -> None:
    """Test that enqueue adds an event to the queue."""
    queue = RequestQueue()
    event = _make_event("session-1", "event-1")

    await queue.enqueue(event)

    assert not queue.is_empty("session-1")

  @pytest.mark.asyncio
  async def test_dequeue_returns_event(self) -> None:
    """Test that dequeue returns the enqueued event."""
    queue = RequestQueue()
    event = _make_event("session-1", "event-1")
    await queue.enqueue(event)

    result = await queue.dequeue("session-1")

    assert result.event_id == "event-1"
    assert result.session_id == "session-1"

  @pytest.mark.asyncio
  async def test_fifo_order(self) -> None:
    """Test that events are dequeued in FIFO order."""
    queue = RequestQueue()
    event1 = _make_event("session-1", "event-1")
    event2 = _make_event("session-1", "event-2")
    event3 = _make_event("session-1", "event-3")

    await queue.enqueue(event1)
    await queue.enqueue(event2)
    await queue.enqueue(event3)

    result1 = await queue.dequeue("session-1")
    result2 = await queue.dequeue("session-1")
    result3 = await queue.dequeue("session-1")

    assert result1.event_id == "event-1"
    assert result2.event_id == "event-2"
    assert result3.event_id == "event-3"

  @pytest.mark.asyncio
  async def test_per_session_isolation(self) -> None:
    """Test that each session has its own independent queue."""
    queue = RequestQueue()
    event_s1_e1 = _make_event("session-1", "s1-event-1")
    event_s1_e2 = _make_event("session-1", "s1-event-2")
    event_s2_e1 = _make_event("session-2", "s2-event-1")

    await queue.enqueue(event_s1_e1)
    await queue.enqueue(event_s2_e1)
    await queue.enqueue(event_s1_e2)

    # Dequeue from session 2 first
    result_s2 = await queue.dequeue("session-2")
    assert result_s2.event_id == "s2-event-1"

    # Session 1 should still have its events in order
    result_s1_1 = await queue.dequeue("session-1")
    result_s1_2 = await queue.dequeue("session-1")
    assert result_s1_1.event_id == "s1-event-1"
    assert result_s1_2.event_id == "s1-event-2"

  @pytest.mark.asyncio
  async def test_get_current_returns_head(self) -> None:
    """Test that get_current returns the head without removing it."""
    queue = RequestQueue()
    event1 = _make_event("session-1", "event-1")
    event2 = _make_event("session-1", "event-2")

    await queue.enqueue(event1)
    await queue.enqueue(event2)

    # get_current should return first event
    current = await queue.get_current("session-1")
    assert current is not None
    assert current.event_id == "event-1"

    # Calling get_current again should return the same event
    current_again = await queue.get_current("session-1")
    assert current_again is not None
    assert current_again.event_id == "event-1"

  @pytest.mark.asyncio
  async def test_get_current_returns_none_for_empty_queue(self) -> None:
    """Test that get_current returns None for empty queue."""
    queue = RequestQueue()

    current = await queue.get_current("nonexistent-session")

    assert current is None

  @pytest.mark.asyncio
  async def test_get_current_updates_after_dequeue(self) -> None:
    """Test that get_current returns next event after dequeue."""
    queue = RequestQueue()
    event1 = _make_event("session-1", "event-1")
    event2 = _make_event("session-1", "event-2")

    await queue.enqueue(event1)
    await queue.enqueue(event2)

    # Current should be first event
    current = await queue.get_current("session-1")
    assert current is not None
    assert current.event_id == "event-1"

    # After dequeue, current should update to second event
    await queue.dequeue("session-1")
    current = await queue.get_current("session-1")
    assert current is not None
    assert current.event_id == "event-2"

  @pytest.mark.asyncio
  async def test_get_current_returns_none_after_last_dequeue(self) -> None:
    """Test that get_current returns None after last event is dequeued."""
    queue = RequestQueue()
    event = _make_event("session-1", "event-1")

    await queue.enqueue(event)
    await queue.dequeue("session-1")

    current = await queue.get_current("session-1")
    assert current is None

  @pytest.mark.asyncio
  async def test_is_empty_for_new_session(self) -> None:
    """Test that is_empty returns True for sessions with no events."""
    queue = RequestQueue()

    assert queue.is_empty("nonexistent-session")

  @pytest.mark.asyncio
  async def test_is_empty_after_all_dequeued(self) -> None:
    """Test that is_empty returns True after all events are dequeued."""
    queue = RequestQueue()
    event = _make_event("session-1", "event-1")

    await queue.enqueue(event)
    assert not queue.is_empty("session-1")

    await queue.dequeue("session-1")
    assert queue.is_empty("session-1")
