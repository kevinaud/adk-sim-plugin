"""Session repository for SimulatorSession persistence.

Implements the Promoted Field pattern: stores full proto as blob with
queryable fields extracted into SQL columns for efficient filtering.
"""

import base64
from typing import TYPE_CHECKING

from adk_sim_protos.adksim.v1 import SessionStatus
from sqlalchemy import select

from adk_sim_server.persistence.core import PaginatedSessions
from adk_sim_server.persistence.schema import sessions

if TYPE_CHECKING:
  from adk_sim_protos.adksim.v1 import SimulatorSession

  from adk_sim_server.persistence.database import Database


class SessionRepository:
  """Repository for SimulatorSession CRUD operations.

  Uses the Promoted Field pattern to store sessions with both
  queryable SQL columns and the full proto blob.
  """

  def __init__(self, database: Database) -> None:
    """Initialize the repository with a database connection.

    Args:
        database: The async database connection manager.
    """
    self._database = database

  async def create(
    self,
    session: SimulatorSession,
    status: SessionStatus = SessionStatus.ACTIVE,
  ) -> SimulatorSession:
    """Create a new session in the database.

    Extracts promoted fields (id, created_at) for queryable columns
    and serializes the full proto to the blob column.

    Args:
        session: The SimulatorSession proto to persist.
        status: Session status (default: ACTIVE).

    Returns:
        The same session object that was stored.
    """
    # Extract promoted fields
    session_id = session.id
    # Convert datetime to Unix timestamp (seconds)
    created_at = int(session.created_at.timestamp())
    # Serialize full proto to bytes
    proto_blob = bytes(session)

    # Build insert query using SQLAlchemy Core
    query = sessions.insert().values(
      id=session_id,
      created_at=created_at,
      status=status.name,
      proto_blob=proto_blob,
    )
    await self._database.execute(query)

    return session

  async def get_by_id(self, session_id: str) -> SimulatorSession | None:
    """Retrieve a session by its ID.

    Args:
        session_id: The unique identifier of the session.

    Returns:
        The deserialized SimulatorSession if found, None otherwise.
    """
    # Import here to deserialize proto
    from adk_sim_protos.adksim.v1 import SimulatorSession

    # Build select query using SQLAlchemy Core
    query = select(sessions.c.proto_blob).where(sessions.c.id == session_id)
    row = await self._database.fetch_one(query)

    if row is None:
      return None

    # Deserialize proto blob back to SimulatorSession
    return SimulatorSession().parse(row["proto_blob"])

  async def list_all(
    self, page_size: int = 10, page_token: str | None = None
  ) -> PaginatedSessions:
    """List sessions with cursor-based pagination.

    Args:
        page_size: Maximum number of sessions to return.
        page_token: Base64-encoded timestamp cursor for pagination.

    Returns:
        PaginatedSessions containing the sessions and optional next page token.
    """
    # Import here to deserialize proto
    from adk_sim_protos.adksim.v1 import SimulatorSession

    # Build query using SQLAlchemy Core
    query = select(sessions.c.proto_blob, sessions.c.created_at).order_by(
      sessions.c.created_at.desc()
    )

    # Decode page_token to get cursor timestamp
    if page_token:
      cursor_ts = int(base64.b64decode(page_token).decode("utf-8"))
      query = query.where(sessions.c.created_at < cursor_ts)

    query = query.limit(page_size + 1)

    rows = await self._database.fetch_all(query)

    # Check if there are more results
    has_more = len(rows) > page_size
    rows = rows[:page_size]

    session_list = [SimulatorSession().parse(row["proto_blob"]) for row in rows]

    # Generate next_page_token if more results exist
    next_token = None
    if has_more and rows:
      last_ts = rows[-1]["created_at"]
      next_token = base64.b64encode(str(last_ts).encode("utf-8")).decode("utf-8")

    return PaginatedSessions(sessions=session_list, next_page_token=next_token)

  async def update_status(self, session_id: str, status: SessionStatus) -> bool:
    """Update the status of a session.

    Args:
        session_id: The unique identifier of the session.
        status: The new status value.

    Returns:
        True if the session was updated, False if not found.
    """
    # Build update query using SQLAlchemy Core
    query = (
      sessions.update().where(sessions.c.id == session_id).values(status=status.name)
    )
    result = await self._database.execute(query)
    return result > 0
