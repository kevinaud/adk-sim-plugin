"""Request queue for sequential request handling per session.

Provides a FIFO queue per session to ensure requests are processed
in order. Each session has its own queue to enable concurrent
sessions while maintaining sequential processing within each session.
"""

import asyncio
from collections import defaultdict
from typing import TYPE_CHECKING

if TYPE_CHECKING:
  from adk_agent_sim.generated.adksim.v1 import SessionEvent


class RequestQueue:
  """FIFO queue for session events, one queue per session.

  Manages incoming LLM request events, ensuring they are processed
  in order within each session. Each session has an independent queue
  allowing multiple sessions to operate concurrently.

  Attributes:
      _queues: Dict mapping session_id to asyncio.Queue of events.
      _peeked: Dict mapping session_id to the peeked (current) event.

  Example:
      queue = RequestQueue()
      await queue.enqueue(event)
      current = await queue.get_current(session_id)
      processed = await queue.dequeue(session_id)
  """

  def __init__(self) -> None:
    """Initialize the request queue with empty per-session queues."""
    self._queues: dict[str, asyncio.Queue[SessionEvent]] = defaultdict(asyncio.Queue)
    # Stores events that have been peeked (for get_current) but not yet dequeued
    self._peeked: dict[str, SessionEvent | None] = {}

  async def enqueue(self, event: SessionEvent) -> None:
    """Add an event to the appropriate session's queue.

    The event is added to the end of the queue for its session,
    creating a new queue if this is the first event for that session.

    Args:
        event: The SessionEvent to enqueue. Must have session_id set.
    """
    await self._queues[event.session_id].put(event)

  async def dequeue(self, session_id: str) -> SessionEvent:
    """Remove and return the next event from a session's queue.

    Blocks until an event is available in the queue for this session.

    Args:
        session_id: The session ID to dequeue from.

    Returns:
        The next SessionEvent in the queue.
    """
    # If we have a peeked event, return it and clear the peek
    if session_id in self._peeked and self._peeked[session_id] is not None:
      event = self._peeked[session_id]
      self._peeked[session_id] = None
      assert event is not None  # Type narrowing for Pyright
      return event

    # Otherwise get from the queue
    return await self._queues[session_id].get()

  async def get_current(self, session_id: str) -> SessionEvent | None:
    """Get the current (head) event without removing it.

    Returns the event currently at the head of the queue for a session,
    or None if the session's queue is empty.

    Args:
        session_id: The session ID to check.

    Returns:
        The current SessionEvent, or None if the queue is empty.
    """
    # If we already peeked, return that
    if session_id in self._peeked and self._peeked[session_id] is not None:
      return self._peeked[session_id]

    # If queue is empty, return None
    if session_id not in self._queues or self._queues[session_id].empty():
      return None

    # Peek by getting and storing
    event = await self._queues[session_id].get()
    self._peeked[session_id] = event
    return event

  def is_empty(self, session_id: str) -> bool:
    """Check if a session's queue is empty.

    Args:
        session_id: The session ID to check.

    Returns:
        True if the queue is empty or doesn't exist, False otherwise.
    """
    has_peeked = session_id in self._peeked and self._peeked[session_id] is not None
    has_queued = session_id in self._queues and not self._queues[session_id].empty()
    return not has_peeked and not has_queued
