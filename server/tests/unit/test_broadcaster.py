"""Tests for EventBroadcaster."""

import asyncio
from datetime import UTC, datetime

import pytest
from adk_sim_protos.adksim.v1 import SessionEvent
from adk_sim_server.broadcaster import EventBroadcaster


def _make_event(session_id: str, event_id: str) -> SessionEvent:
  """Create a SessionEvent for testing."""
  return SessionEvent(
    event_id=event_id,
    session_id=session_id,
    timestamp=datetime.now(UTC),
    turn_id=f"turn-{event_id}",
  )


def _is_history_complete(event: SessionEvent) -> bool:
  """Check if an event is a history_complete marker."""
  # Check using betterproto's presence detection
  return bool(event.history_complete.event_count >= 0 and not event.event_id)


async def _empty_history() -> list[SessionEvent]:
  """Return empty history for tests that don't need replay."""
  return []


class TestEventBroadcaster:
  """Test suite for EventBroadcaster."""

  def test_initialization(self) -> None:
    """Test that EventBroadcaster can be initialized."""
    broadcaster = EventBroadcaster()
    assert broadcaster is not None

  def test_subscriber_count_empty(self) -> None:
    """Test that subscriber_count returns 0 for no subscribers."""
    broadcaster = EventBroadcaster()

    count = broadcaster.subscriber_count("session-1")

    assert count == 0

  @pytest.mark.asyncio
  async def test_subscribe_creates_subscriber(self) -> None:
    """Test that subscribe creates a subscriber."""
    broadcaster = EventBroadcaster()
    events_received = 0

    # Start subscription in a task
    # With empty history, we get history_complete marker first, then live events
    async def subscriber() -> None:
      nonlocal events_received
      async for _ in broadcaster.subscribe("session-1", _empty_history):
        events_received += 1
        # Break after receiving history_complete + one live event
        if events_received >= 2:
          break

    task = asyncio.create_task(subscriber())
    await asyncio.sleep(0.01)  # Let the subscription start

    assert broadcaster.subscriber_count("session-1") == 1

    # Broadcast to unblock the subscriber (after history_complete)
    await broadcaster.broadcast("session-1", _make_event("session-1", "e1"))
    await task

  @pytest.mark.asyncio
  async def test_broadcast_delivers_to_subscriber(self) -> None:
    """Test that broadcast delivers events to subscribers."""
    broadcaster = EventBroadcaster()
    received_events: list[SessionEvent] = []

    async def subscriber() -> None:
      async for event in broadcaster.subscribe("session-1", _empty_history):
        received_events.append(event)
        # history_complete + 2 live events = 3 total
        if len(received_events) >= 3:
          break

    task = asyncio.create_task(subscriber())
    await asyncio.sleep(0.01)

    event1 = _make_event("session-1", "event-1")
    event2 = _make_event("session-1", "event-2")
    await broadcaster.broadcast("session-1", event1)
    await broadcaster.broadcast("session-1", event2)

    await task

    # First event is history_complete marker, then live events
    assert len(received_events) == 3
    assert _is_history_complete(received_events[0])
    assert received_events[1].event_id == "event-1"
    assert received_events[2].event_id == "event-2"

  @pytest.mark.asyncio
  async def test_broadcast_to_multiple_subscribers(self) -> None:
    """Test that broadcast delivers to all subscribers."""
    broadcaster = EventBroadcaster()
    received_1: list[SessionEvent] = []
    received_2: list[SessionEvent] = []

    async def subscriber_1() -> None:
      async for event in broadcaster.subscribe("session-1", _empty_history):
        received_1.append(event)
        # history_complete + 1 live event = 2 total
        if len(received_1) >= 2:
          break

    async def subscriber_2() -> None:
      async for event in broadcaster.subscribe("session-1", _empty_history):
        received_2.append(event)
        if len(received_2) >= 2:
          break

    task1 = asyncio.create_task(subscriber_1())
    task2 = asyncio.create_task(subscriber_2())
    await asyncio.sleep(0.01)

    assert broadcaster.subscriber_count("session-1") == 2

    event = _make_event("session-1", "shared-event")
    await broadcaster.broadcast("session-1", event)

    await task1
    await task2

    # Both should receive history_complete + shared-event
    assert len(received_1) == 2
    assert len(received_2) == 2
    assert _is_history_complete(received_1[0])
    assert _is_history_complete(received_2[0])
    assert received_1[1].event_id == "shared-event"
    assert received_2[1].event_id == "shared-event"

  @pytest.mark.asyncio
  async def test_per_session_isolation(self) -> None:
    """Test that subscribers only receive events for their session."""
    broadcaster = EventBroadcaster()
    received_s1: list[SessionEvent] = []
    received_s2: list[SessionEvent] = []

    async def subscriber_s1() -> None:
      async for event in broadcaster.subscribe("session-1", _empty_history):
        received_s1.append(event)
        # history_complete + 1 live = 2 total
        if len(received_s1) >= 2:
          break

    async def subscriber_s2() -> None:
      async for event in broadcaster.subscribe("session-2", _empty_history):
        received_s2.append(event)
        if len(received_s2) >= 2:
          break

    task1 = asyncio.create_task(subscriber_s1())
    task2 = asyncio.create_task(subscriber_s2())
    await asyncio.sleep(0.01)

    # Broadcast to session-1 only
    await broadcaster.broadcast("session-1", _make_event("session-1", "s1-e1"))
    await task1

    # Session 1 should have history_complete + live event
    # Session 2 should only have history_complete (from its own subscription)
    assert len(received_s1) == 2
    assert len(received_s2) == 1  # Just history_complete so far
    assert _is_history_complete(received_s2[0])

    # Now broadcast to session-2
    await broadcaster.broadcast("session-2", _make_event("session-2", "s2-e1"))
    await task2

    assert len(received_s2) == 2

  @pytest.mark.asyncio
  async def test_subscriber_cleanup_on_break(self) -> None:
    """Test that subscribers are cleaned up when iteration stops."""
    broadcaster = EventBroadcaster()
    events_received = 0

    async def subscriber() -> None:
      nonlocal events_received
      async for _ in broadcaster.subscribe("session-1", _empty_history):
        events_received += 1
        # Break after history_complete + 1 live event
        if events_received >= 2:
          break

    task = asyncio.create_task(subscriber())
    await asyncio.sleep(0.01)

    assert broadcaster.subscriber_count("session-1") == 1

    await broadcaster.broadcast("session-1", _make_event("session-1", "e1"))
    await task

    # Give cleanup time to run
    await asyncio.sleep(0.01)

    assert broadcaster.subscriber_count("session-1") == 0

  @pytest.mark.asyncio
  async def test_broadcast_to_no_subscribers_succeeds(self) -> None:
    """Test that broadcasting without subscribers doesn't raise."""
    broadcaster = EventBroadcaster()

    # Should not raise
    await broadcaster.broadcast("session-1", _make_event("session-1", "e1"))

    # Still no subscribers
    assert broadcaster.subscriber_count("session-1") == 0


class TestEventBroadcasterHistory:
  """Tests for history replay functionality."""

  @pytest.mark.asyncio
  async def test_subscribe_yields_history_first(self) -> None:
    """Test that subscribe yields historical events before live events."""
    broadcaster = EventBroadcaster()
    received_events: list[SessionEvent] = []

    # Create history events
    history = [
      _make_event("session-1", "history-1"),
      _make_event("session-1", "history-2"),
    ]

    async def fetch_history() -> list[SessionEvent]:
      return history

    async def subscriber() -> None:
      async for event in broadcaster.subscribe("session-1", fetch_history):
        received_events.append(event)
        # 2 history + 1 history_complete + 1 live = 4 total
        if len(received_events) >= 4:
          break

    task = asyncio.create_task(subscriber())
    await asyncio.sleep(0.01)

    # Broadcast a live event
    await broadcaster.broadcast("session-1", _make_event("session-1", "live-1"))

    await task

    assert len(received_events) == 4
    # History events come first, in order
    assert received_events[0].event_id == "history-1"
    assert received_events[1].event_id == "history-2"
    # Then history_complete marker
    assert _is_history_complete(received_events[2])
    assert received_events[2].history_complete.event_count == 2
    # Then live event
    assert received_events[3].event_id == "live-1"

  @pytest.mark.asyncio
  async def test_history_and_subscription_atomic(self) -> None:
    """Test that history fetch and registration are atomic.

    This test verifies that events broadcast during the time between
    history fetch and subscription registration are not lost.
    """
    broadcaster = EventBroadcaster()
    received_events: list[SessionEvent] = []
    history_fetch_started = asyncio.Event()
    history_fetch_complete = asyncio.Event()

    # Create a slow history fetcher to simulate the race condition window
    async def slow_history_fetcher() -> list[SessionEvent]:
      history_fetch_started.set()
      await asyncio.sleep(0.05)  # Simulate slow DB query
      history_fetch_complete.set()
      return [_make_event("session-1", "history-1")]

    async def subscriber() -> None:
      async for event in broadcaster.subscribe("session-1", slow_history_fetcher):
        received_events.append(event)
        # 1 history + 1 history_complete + 1 live = 3 total
        if len(received_events) >= 3:
          break

    async def broadcaster_task() -> None:
      # Wait for history fetch to start
      await history_fetch_started.wait()
      # Try to broadcast while history is being fetched
      # This should be blocked by the lock until after registration
      await broadcaster.broadcast("session-1", _make_event("session-1", "live-1"))

    task = asyncio.create_task(subscriber())
    broadcast_task = asyncio.create_task(broadcaster_task())

    await task
    await broadcast_task

    # All events should be received: history, history_complete, live
    assert len(received_events) == 3
    assert received_events[0].event_id == "history-1"
    assert _is_history_complete(received_events[1])
    assert received_events[2].event_id == "live-1"

  @pytest.mark.asyncio
  async def test_empty_history_yields_only_live_events(self) -> None:
    """Test that empty history still works correctly."""
    broadcaster = EventBroadcaster()
    received_events: list[SessionEvent] = []

    async def subscriber() -> None:
      async for event in broadcaster.subscribe("session-1", _empty_history):
        received_events.append(event)
        # history_complete + 1 live = 2 total
        if len(received_events) >= 2:
          break

    task = asyncio.create_task(subscriber())
    await asyncio.sleep(0.01)

    await broadcaster.broadcast("session-1", _make_event("session-1", "live-1"))

    await task

    assert len(received_events) == 2
    # First is history_complete with event_count=0
    assert _is_history_complete(received_events[0])
    assert received_events[0].history_complete.event_count == 0
    # Then live event
    assert received_events[1].event_id == "live-1"
