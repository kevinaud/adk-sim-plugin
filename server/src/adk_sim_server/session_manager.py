"""Session manager for SimulatorSession lifecycle management.

Provides a high-level interface for creating and managing simulation sessions.
Uses SessionRepository for persistence and maintains an in-memory cache for
fast active session lookups.
"""

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from adk_sim_protos.adksim.v1 import SimulatorSession

if TYPE_CHECKING:
  from adk_sim_server.persistence import (
    PaginatedSessions,
    SessionEventRepository,
    SessionRepositoryProtocol,
  )


class SessionManager:
  """Manages the lifecycle of simulator sessions.

  Handles session creation, retrieval, and caching of active sessions.
  Uses SessionRepository for persistence and EventRepository for event
  storage.

  Attributes:
      _session_repo: Repository for session persistence.
      _event_repo: Repository for event persistence.
      _active_sessions: In-memory cache of active sessions for fast lookup.

  Example:
      manager = SessionManager(session_repo, event_repo)
      session = await manager.create_session("Test session")
  """

  def __init__(
    self,
    session_repo: SessionRepositoryProtocol,
    event_repo: SessionEventRepository,
  ) -> None:
    """Initialize the session manager.

    Args:
        session_repo: Repository for session persistence.
        event_repo: Repository for event persistence.
    """
    self._session_repo = session_repo
    self._event_repo = event_repo
    self._active_sessions: dict[str, SimulatorSession] = {}

  async def create_session(
    self,
    description: str | None = None,
  ) -> SimulatorSession:
    """Create a new simulation session.

    Generates a new session with a unique UUID and current timestamp,
    persists it to the repository, and caches it for fast lookup.

    Args:
        description: Optional human-readable description for the session.

    Returns:
        The newly created SimulatorSession.
    """
    # Generate unique session ID
    session_id = str(uuid.uuid4())

    # Create timestamp for created_at
    created_at = datetime.now(UTC)

    # Create the SimulatorSession proto message
    session = SimulatorSession(
      id=session_id,
      created_at=created_at,
      description=description or "",
    )

    # Persist to repository
    await self._session_repo.create(session)

    # Cache in memory for fast lookup
    self._active_sessions[session_id] = session

    return session

  async def get_session(self, session_id: str) -> SimulatorSession | None:
    """Retrieve a session by ID, checking memory cache first then database.

    Implements a read-through caching pattern:
    1. First checks the in-memory active sessions cache
    2. If not found, queries the database via the session repository
    3. If found in database, loads it into the memory cache (reconnection)

    Args:
        session_id: The unique identifier of the session to retrieve.

    Returns:
        The SimulatorSession if found, or None if the session doesn't exist.
    """
    # Check memory cache first for fast lookup
    if session_id in self._active_sessions:
      return self._active_sessions[session_id]

    # Cache miss - try loading from database
    session = await self._session_repo.get_by_id(session_id)

    if session is not None:
      # Reconnection scenario: load into cache for subsequent lookups
      self._active_sessions[session_id] = session

    return session

  async def list_sessions(
    self, page_size: int, page_token: str | None
  ) -> PaginatedSessions:
    """List sessions with pagination.

    Args:
        page_size: Maximum number of sessions to return.
        page_token: Token for the next page, or None for the first page.

    Returns:
        PaginatedSessions containing the list of sessions and next page token.
    """
    return await self._session_repo.list_all(page_size, page_token)
