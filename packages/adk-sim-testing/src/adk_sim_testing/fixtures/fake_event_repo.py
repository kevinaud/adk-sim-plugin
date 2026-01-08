"""Fake EventRepository for unit testing.

Provides an in-memory implementation of the EventRepository interface
for use in unit tests. This fake stores events in a list and
implements the same async interface as the real repository.
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
  from adk_sim_protos.adksim.v1 import SessionEvent


class FakeEventRepository:
  """In-memory fake of EventRepository for unit testing.

  Stores events in a list for simple retrieval by session_id or turn_id.
  No database connection required - all operations are in-memory.

  Example:
      repo = FakeEventRepository()
      await repo.insert(event)
      events = await repo.get_by_session(session_id)
  """

  def __init__(self) -> None:
    """Initialize with empty storage."""
    self._events: list[SessionEvent] = []

  async def insert(self, event: SessionEvent) -> SessionEvent:
    """Store an event in the in-memory list.

    Args:
        event: The SessionEvent to store.

    Returns:
        The stored event (unchanged).
    """
    self._events.append(event)
    return event

  async def get_by_session(self, session_id: str) -> list[SessionEvent]:
    """Get all events for a session ordered by timestamp.

    Args:
        session_id: The session ID to filter by.

    Returns:
        List of SessionEvents ordered by timestamp ASC (oldest first).
    """
    session_events = [e for e in self._events if e.session_id == session_id]
    return sorted(session_events, key=lambda e: e.timestamp)

  async def get_by_turn_id(self, turn_id: str) -> list[SessionEvent]:
    """Get all events for a turn (usually request/response pair).

    Args:
        turn_id: The turn ID to filter by.

    Returns:
        List of SessionEvents ordered by timestamp ASC.
    """
    turn_events = [e for e in self._events if e.turn_id == turn_id]
    return sorted(turn_events, key=lambda e: e.timestamp)
