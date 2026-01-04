"""Session manager for SimulatorSession lifecycle management.

Provides a high-level interface for creating and managing simulation sessions.
Uses SessionRepository for persistence and maintains an in-memory cache for
fast active session lookups.
"""

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from adk_agent_sim.generated.adksim.v1 import SimulatorSession

if TYPE_CHECKING:
  from adk_agent_sim.persistence import (
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
