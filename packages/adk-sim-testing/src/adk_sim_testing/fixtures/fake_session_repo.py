"""Fake SessionRepository for unit testing.

Provides an in-memory implementation of the SessionRepository interface
for use in unit tests. This fake stores sessions in a dictionary and
implements the same async interface as the real repository.
"""

from typing import TYPE_CHECKING, Any

from adk_sim_protos.adksim.v1 import SessionStatus
from adk_sim_server.persistence.core import PaginatedSessions

if TYPE_CHECKING:
  from adk_sim_protos.adksim.v1 import SimulatorSession


class FakeSessionRepository:
  """In-memory fake of SessionRepository for unit testing.

  Stores sessions in a dictionary with (session, status) tuples.
  No database connection required - all operations are in-memory.

  Example:
      repo = FakeSessionRepository()
      await repo.create(session)
      retrieved = await repo.get_by_id(session.id)
      assert retrieved == session
  """

  def __init__(self) -> None:
    """Initialize with empty storage."""
    # Using Any for runtime since SimulatorSession is only available for type checking
    self._sessions: dict[str, tuple[Any, SessionStatus]] = {}

  async def create(
    self,
    session: SimulatorSession,
    status: SessionStatus = SessionStatus.ACTIVE,
  ) -> SimulatorSession:
    """Store a session in the in-memory dict.

    Args:
        session: The SimulatorSession to store.
        status: Initial status for the session.

    Returns:
        The stored session (unchanged).
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
    if entry is None:
      return None
    return entry[0]

  async def list_all(
    self,
    page_size: int = 10,
    page_token: str | None = None,
  ) -> PaginatedSessions:
    """Return paginated list of sessions.

    Sessions are returned in descending order of creation time.

    Args:
        page_size: Maximum number of sessions to return.
        page_token: Opaque token for pagination (session ID to start after).

    Returns:
        PaginatedSessions with list of sessions and next page token.
    """
    # Get all sessions and sort by created_at descending
    all_sessions = [entry[0] for entry in self._sessions.values()]
    all_sessions.sort(key=lambda s: s.created_at, reverse=True)
    all_ids = [s.id for s in all_sessions]

    # Find starting index based on page_token
    start_idx = 0
    if page_token is not None:
      try:
        token_idx = all_ids.index(page_token)
        start_idx = token_idx + 1
      except ValueError:
        # Token not found, start from beginning
        start_idx = 0

    # Get the page of sessions
    end_idx = start_idx + page_size
    page_sessions = all_sessions[start_idx:end_idx]

    # Determine next page token
    next_token: str | None = None
    if end_idx < len(all_ids):
      next_token = page_sessions[-1].id if page_sessions else None

    return PaginatedSessions(sessions=page_sessions, next_page_token=next_token)

  async def update_status(self, session_id: str, status: SessionStatus) -> bool:
    """Update the status of a stored session.

    Args:
        session_id: The session ID to update.
        status: The new status value.

    Returns:
        True if the session was found and updated, False otherwise.
    """
    entry = self._sessions.get(session_id)
    if entry is None:
      return False

    session, _ = entry
    self._sessions[session_id] = (session, status)
    return True

  def get_status(self, session_id: str) -> SessionStatus | None:
    """Get the status of a session (helper for test assertions).

    Args:
        session_id: The session ID to look up.

    Returns:
        The status if found, None otherwise.
    """
    entry = self._sessions.get(session_id)
    if entry is None:
      return None
    return entry[1]

  def clear(self) -> None:
    """Clear all stored sessions (helper for test reset)."""
    self._sessions.clear()
