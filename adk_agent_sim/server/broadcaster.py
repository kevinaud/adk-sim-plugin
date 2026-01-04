"""Event broadcaster for session event pub/sub.

Provides a pub/sub mechanism for broadcasting session events to
multiple subscribers. Each session has its own set of subscribers,
and events are broadcast to all subscribers for that session.
"""

import asyncio
from collections import defaultdict
from typing import TYPE_CHECKING

if TYPE_CHECKING:
  from collections.abc import AsyncIterator

  from adk_agent_sim.generated.adksim.v1 import SessionEvent


class EventBroadcaster:
  """Broadcasts session events to all subscribers for a session.

  Manages per-session subscriber queues. When an event is broadcast,
  it is pushed to all subscriber queues for that session. Each subscriber
  receives events via an async iterator.

  Attributes:
      _subscribers: Dict mapping session_id to set of subscriber queues.

  Example:
      broadcaster = EventBroadcaster()

      # Subscribe to a session
      async for event in broadcaster.subscribe("session-1"):
          handle_event(event)

      # Broadcast an event (in another task)
      await broadcaster.broadcast("session-1", event)
  """

  def __init__(self) -> None:
    """Initialize the broadcaster with empty subscriber sets."""
    self._subscribers: dict[str, set[asyncio.Queue[SessionEvent]]] = defaultdict(set)

  async def subscribe(self, session_id: str) -> AsyncIterator[SessionEvent]:
    """Subscribe to events for a session.

    Creates a new subscriber queue for the session and yields events
    as they are broadcast. The subscription is automatically cleaned up
    when the iterator is closed (e.g., via break or exception).

    Args:
        session_id: The session ID to subscribe to.

    Yields:
        SessionEvent objects as they are broadcast to this session.
    """
    queue: asyncio.Queue[SessionEvent] = asyncio.Queue()
    self._subscribers[session_id].add(queue)

    try:
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

    Pushes the event to all subscriber queues for the given session.
    If there are no subscribers, the event is silently dropped.

    Args:
        session_id: The session ID to broadcast to.
        event: The SessionEvent to broadcast.
    """
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
