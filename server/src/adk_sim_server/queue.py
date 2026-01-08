"""Request queue for sequential request handling per session.

Provides a FIFO queue per session to ensure requests are processed
in order. Each session has its own queue to enable concurrent
sessions while maintaining sequential processing within each session.
"""

import asyncio
from collections import defaultdict
from typing import TYPE_CHECKING, TypeVar

if TYPE_CHECKING:
  from adk_sim_protos.adksim.v1 import SessionEvent

T = TypeVar("T")


class PeekableQueue(asyncio.Queue[T]):
  """A subclass of asyncio.Queue that allows peeking at the first item."""

  def peek(self) -> T:
    """Return the first item without removing it. Raises QueueEmpty if empty."""
    if self.empty():
      raise asyncio.QueueEmpty
    # Access internal deque - this is implementation detail but stable in CPython
    internal_queue: list[T] = self._queue  # type: ignore[attr-defined]
    return internal_queue[0]


class RequestQueue:
  """FIFO queue for session events, one queue per session.

  Manages incoming LLM request events, ensuring they are processed
  in order within each session. Each session has an independent queue
  allowing multiple sessions to operate concurrently.

  Attributes:
      _queues: Dict mapping session_id to PeekableQueue of events.

  Example:
      queue = RequestQueue()
      await queue.enqueue(event)
      current = queue.get_current(session_id)
      processed = await queue.dequeue(session_id)
  """

  def __init__(self) -> None:
    """Initialize the request queue with empty per-session queues."""
    self._queues: dict[str, PeekableQueue[SessionEvent]] = defaultdict(PeekableQueue)

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
    return await self._queues[session_id].get()

  def get_current(self, session_id: str) -> SessionEvent | None:
    """Get the current (head) event without removing it.

    Returns the event currently at the head of the queue for a session,
    or None if the session's queue is empty.

    Args:
        session_id: The session ID to check.

    Returns:
        The current SessionEvent, or None if the queue is empty.
    """
    if session_id not in self._queues or self._queues[session_id].empty():
      return None

    return self._queues[session_id].peek()

  def is_empty(self, session_id: str) -> bool:
    """Check if a session's queue is empty.

    Args:
        session_id: The session ID to check.

    Returns:
        True if the queue is empty or doesn't exist, False otherwise.
    """
    return session_id not in self._queues or self._queues[session_id].empty()
