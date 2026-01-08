"""Event broadcaster for session event pub/sub.

Provides a pub/sub mechanism for broadcasting session events to
multiple subscribers. Each session has its own set of subscribers,
and events are broadcast to all subscribers for that session.

Includes per-session locking to ensure atomic history retrieval
and subscriber registration, preventing race conditions where events
could be missed during the subscription process.
"""

import asyncio
from collections import defaultdict
from typing import TYPE_CHECKING

if TYPE_CHECKING:
  from collections.abc import AsyncIterator, Awaitable, Callable

  from adk_sim_protos.adksim.v1 import SessionEvent


class EventBroadcaster:
  """Broadcasts session events to all subscribers for a session.

  Manages per-session subscriber queues with locking to prevent race
  conditions. When subscribing, history retrieval and queue registration
  happen atomically relative to broadcasts, ensuring no events are missed.

  Attributes:
      _subscribers: Dict mapping session_id to set of subscriber queues.
      _locks: Dict mapping session_id to asyncio.Lock for atomic operations.

  Example:
      broadcaster = EventBroadcaster()

      # Subscribe with history replay
      async def fetch_history() -> list[SessionEvent]:
          return await event_repo.get_by_session("session-1")

      async for event in broadcaster.subscribe("session-1", fetch_history):
          handle_event(event)

      # Broadcast an event (in another task)
      await broadcaster.broadcast("session-1", event)
  """

  def __init__(self) -> None:
    """Initialize the broadcaster with empty subscriber sets and locks."""
    self._subscribers: dict[str, set[asyncio.Queue[SessionEvent]]] = defaultdict(set)
    self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

  async def subscribe(
    self,
    session_id: str,
    history_fetcher: Callable[[], Awaitable[list[SessionEvent]]],
  ) -> AsyncIterator[SessionEvent]:
    """Subscribe to events for a session with history replay.

    Creates a new subscriber queue for the session. History retrieval and
    queue registration are done atomically (under lock) to prevent race
    conditions where events could be missed.

    The flow is:
    1. Create the subscriber queue
    2. Acquire the session lock
    3. Inside lock: Fetch history via the callback
    4. Inside lock: Register the queue to subscribers
    5. Release lock
    6. Yield all historical events
    7. Yield live events from the queue
    8. On cleanup: Remove the queue from subscribers

    Args:
        session_id: The session ID to subscribe to.
        history_fetcher: Async callback that returns historical events.

    Yields:
        SessionEvent objects - first historical, then live as they arrive.
    """
    queue: asyncio.Queue[SessionEvent] = asyncio.Queue()

    # Atomically fetch history and register subscriber
    async with self._locks[session_id]:
      history = await history_fetcher()
      self._subscribers[session_id].add(queue)

    try:
      # Yield historical events first
      for event in history:
        yield event

      # Then yield live events
      while True:
        event = await queue.get()
        yield event
    finally:
      # Clean up when the iterator is closed
      self._subscribers[session_id].discard(queue)
      if not self._subscribers[session_id]:
        del self._subscribers[session_id]

  async def broadcast(self, session_id: str, event: SessionEvent) -> None:
    """Broadcast an event to all subscribers for a session.

    Acquires the session lock to ensure atomic delivery to all current
    subscribers. This prevents race conditions with concurrent subscribes.

    Args:
        session_id: The session ID to broadcast to.
        event: The SessionEvent to broadcast.
    """
    async with self._locks[session_id]:
      if session_id not in self._subscribers:
        return

      for queue in self._subscribers[session_id]:
        await queue.put(event)

  def subscriber_count(self, session_id: str) -> int:
    """Get the number of subscribers for a session.

    Args:
        session_id: The session ID to check.

    Returns:
        The number of active subscribers for the session.
    """
    return len(self._subscribers.get(session_id, set()))
