"""Fake SessionRepository for unit testing.

Provides an in-memory implementation with the same interface as the real
SessionRepository, allowing tests to run without database dependencies.
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
  from adk_agent_sim.generated.adksim.v1 import SimulatorSession


class FakeSessionRepository:
  """In-memory fake SessionRepository for testing."""

  def __init__(self) -> None:
    """Initialize with empty storage."""
    self._sessions: dict[str, tuple[SimulatorSession, str]] = {}

  async def create(
    self, session: SimulatorSession, status: str = "active"
  ) -> SimulatorSession:
    """Store a session in memory.

    Args:
        session: The SimulatorSession to store.
        status: The session status (default: "active").

    Returns:
        The stored session.
    """
    self._sessions[session.id] = (session, status)
    return session

  async def get_by_id(self, session_id: str) -> SimulatorSession | None:
    """Retrieve a session by ID.

    Args:
        session_id: The session ID to look up.

    Returns:
        The SimulatorSession if found, None otherwise.
    """
    entry = self._sessions.get(session_id)
    return entry[0] if entry else None

  async def list_all(
    self, page_size: int = 100, page_token: str | None = None
  ) -> tuple[list[SimulatorSession], str | None]:
    """Return paginated list of sessions.

    Args:
        page_size: Maximum number of sessions to return.
        page_token: Token for pagination (session_id to start after).

    Returns:
        Tuple of (sessions list, next_page_token or None).
    """
    # Sort sessions by ID for deterministic ordering
    sorted_items = sorted(self._sessions.items(), key=lambda x: x[0])

    # Apply pagination token (skip until we find the token)
    if page_token:
      start_idx = 0
      for i, (session_id, _) in enumerate(sorted_items):
        if session_id == page_token:
          start_idx = i + 1
          break
      sorted_items = sorted_items[start_idx:]

    # Get page of results
    page_items = sorted_items[:page_size]
    sessions = [entry[0] for _, entry in page_items]

    # Determine next page token
    next_token = None
    if len(sorted_items) > page_size:
      next_token = page_items[-1][0]  # Last session's ID

    return sessions, next_token

  async def update_status(self, session_id: str, status: str) -> bool:
    """Update a session's status.

    Args:
        session_id: The session ID to update.
        status: The new status value.

    Returns:
        True if session was found and updated, False otherwise.
    """
    if session_id not in self._sessions:
      return False

    session, _ = self._sessions[session_id]
    self._sessions[session_id] = (session, status)
    return True

  def get_status(self, session_id: str) -> str | None:
    """Get a session's status (test helper method).

    Args:
        session_id: The session ID to look up.

    Returns:
        The status string if found, None otherwise.
    """
    entry = self._sessions.get(session_id)
    return entry[1] if entry else None

  def clear(self) -> None:
    """Clear all stored sessions (test helper method)."""
    self._sessions.clear()
