"""Fake EventRepository for unit testing.

Provides an in-memory implementation with the same interface as the real
EventRepository, allowing tests to run without database dependencies.
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
  from adk_agent_sim.generated.adksim.v1 import SessionEvent


class FakeEventRepository:
  """In-memory fake EventRepository for testing."""

  def __init__(self) -> None:
    """Initialize with empty storage."""
    self._events: list[SessionEvent] = []

  async def insert(self, event: SessionEvent) -> SessionEvent:
    """Append an event to storage.

    Args:
        event: The SessionEvent to store.

    Returns:
        The stored event.
    """
    self._events.append(event)
    return event

  async def get_by_session(self, session_id: str) -> list[SessionEvent]:
    """Get all events for a session ordered by timestamp.

    Args:
        session_id: The session ID to filter by.

    Returns:
        List of SessionEvents ordered by timestamp (oldest first).
    """
    matching = [e for e in self._events if e.session_id == session_id]
    return sorted(matching, key=lambda e: e.timestamp)

  async def get_by_turn_id(self, turn_id: str) -> list[SessionEvent]:
    """Get all events for a turn ordered by timestamp.

    Args:
        turn_id: The turn ID to filter by.

    Returns:
        List of SessionEvents ordered by timestamp (oldest first).
    """
    matching = [e for e in self._events if e.turn_id == turn_id]
    return sorted(matching, key=lambda e: e.timestamp)

  def clear(self) -> None:
    """Clear all stored events (test helper method)."""
    self._events.clear()
