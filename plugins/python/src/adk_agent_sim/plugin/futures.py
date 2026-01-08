"""PendingFutureRegistry - Map turn_id to Future for blocking await.

This module provides the PendingFutureRegistry class that tracks pending LLM
requests and resolves them when the human provides a response through the
simulator frontend.

Usage:
    from adk_agent_sim.plugin.futures import PendingFutureRegistry

    registry = PendingFutureRegistry()

    # In the request path
    future = registry.create("turn-123")

    # In the listen loop (when response arrives)
    registry.resolve("turn-123", response)

    # The awaiter receives the response
    response = await future
"""

import asyncio
from typing import TYPE_CHECKING

if TYPE_CHECKING:
  from adk_sim_protos.google.ai.generativelanguage.v1beta import (
    GenerateContentResponse,
  )


class PendingFutureRegistry:
  """Registry for pending LLM request futures.

  This class maps turn_id strings to asyncio.Future objects, allowing the
  plugin to block on LLM requests until a human provides a response through
  the simulator frontend.

  Thread Safety:
      This class is designed for single-threaded asyncio usage. All operations
      should be performed from the same event loop.

  Attributes:
      _pending: Internal dictionary mapping turn_id to asyncio.Future.
  """

  def __init__(self) -> None:
    """Initialize the PendingFutureRegistry with an empty pending dictionary."""
    self._pending: dict[str, asyncio.Future[GenerateContentResponse]] = {}

  def create(self, turn_id: str) -> asyncio.Future[GenerateContentResponse]:
    """Create and store a new Future for the given turn_id.

    Creates a new asyncio.Future associated with the turn_id. The future
    will be resolved when resolve() is called with the same turn_id.

    Args:
        turn_id: Unique identifier for this LLM request turn.

    Returns:
        An asyncio.Future that will contain the GenerateContentResponse
        when resolved.

    Raises:
        ValueError: If a future already exists for this turn_id.
    """
    if turn_id in self._pending:
      msg = f"Future already exists for turn_id: {turn_id}"
      raise ValueError(msg)

    loop = asyncio.get_running_loop()
    future: asyncio.Future[GenerateContentResponse] = loop.create_future()
    self._pending[turn_id] = future
    return future

  def resolve(self, turn_id: str, response: GenerateContentResponse) -> bool:
    """Resolve the Future for the given turn_id with the response.

    Sets the result on the Future associated with turn_id, allowing any
    awaiter to receive the response.

    Args:
        turn_id: Unique identifier for this LLM request turn.
        response: The GenerateContentResponse to set as the future's result.

    Returns:
        True if the future was resolved, False if no pending future exists
        for this turn_id (supports idempotent event handling).
    """
    future = self._pending.pop(turn_id, None)
    if future is None:
      return False

    if not future.done():
      future.set_result(response)
    return True

  def cancel_all(self) -> int:
    """Cancel all pending futures for shutdown cleanup.

    Cancels all pending futures and clears the registry. This should be
    called during plugin shutdown to clean up any pending requests.

    Returns:
        The number of futures that were cancelled.
    """
    count = 0
    for future in self._pending.values():
      if not future.done():
        future.cancel()
        count += 1
    self._pending.clear()
    return count

  def __len__(self) -> int:
    """Return the number of pending futures."""
    return len(self._pending)

  def has_pending(self, turn_id: str) -> bool:
    """Check if a future exists for the given turn_id.

    Args:
        turn_id: The turn_id to check.

    Returns:
        True if a pending future exists for this turn_id.
    """
    return turn_id in self._pending
