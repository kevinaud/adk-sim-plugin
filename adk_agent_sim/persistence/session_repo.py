"""Session repository for SimulatorSession persistence.

Implements the Promoted Field pattern: stores full proto as blob with
queryable fields extracted into SQL columns for efficient filtering.
"""

import base64
from typing import TYPE_CHECKING

if TYPE_CHECKING:
  from adk_agent_sim.generated.adksim.v1 import SimulatorSession
  from adk_agent_sim.persistence.database import Database


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
    self, session: SimulatorSession, status: str = "active"
  ) -> SimulatorSession:
    """Create a new session in the database.

    Extracts promoted fields (id, created_at) for queryable columns
    and serializes the full proto to the blob column.

    Args:
        session: The SimulatorSession proto to persist.
        status: Session status (default: "active").

    Returns:
        The same session object that was stored.
    """
    # Extract promoted fields
    session_id = session.id
    # Convert datetime to Unix timestamp (seconds)
    created_at = int(session.created_at.timestamp())
    # Serialize full proto to bytes
    proto_blob = bytes(session)

    # Insert into sessions table
    query = """
      INSERT INTO sessions (id, created_at, status, proto_blob)
      VALUES (:id, :created_at, :status, :proto_blob)
    """
    values = {
      "id": session_id,
      "created_at": created_at,
      "status": status,
      "proto_blob": proto_blob,
    }
    await self._database.execute(query, values)

    return session

  async def get_by_id(self, session_id: str) -> SimulatorSession | None:
    """Retrieve a session by its ID.

    Args:
        session_id: The unique identifier of the session.

    Returns:
        The deserialized SimulatorSession if found, None otherwise.
    """
    # Import here to avoid circular imports at module level
    from adk_agent_sim.generated.adksim.v1 import SimulatorSession

    query = "SELECT proto_blob FROM sessions WHERE id = :id"
    row = await self._database.fetch_one(query, {"id": session_id})

    if row is None:
      return None

    # Deserialize proto blob back to SimulatorSession
    return SimulatorSession.FromString(row["proto_blob"])

  async def list_all(
    self, page_size: int = 10, page_token: str | None = None
  ) -> tuple[list[SimulatorSession], str | None]:
    """List sessions with cursor-based pagination.

    Args:
        page_size: Maximum number of sessions to return.
        page_token: Base64-encoded timestamp cursor for pagination.

    Returns:
        Tuple of (list of sessions, next_page_token or None).
    """
    from adk_agent_sim.generated.adksim.v1 import SimulatorSession

    # Decode page_token to get cursor timestamp
    if page_token:
      cursor_ts = int(base64.b64decode(page_token).decode("utf-8"))
      query = """
        SELECT proto_blob, created_at FROM sessions
        WHERE created_at < :cursor
        ORDER BY created_at DESC
        LIMIT :limit
      """
      values = {"cursor": cursor_ts, "limit": page_size + 1}
    else:
      query = """
        SELECT proto_blob, created_at FROM sessions
        ORDER BY created_at DESC
        LIMIT :limit
      """
      values = {"limit": page_size + 1}

    rows = await self._database.fetch_all(query, values)

    # Check if there are more results
    has_more = len(rows) > page_size
    rows = rows[:page_size]

    sessions = [SimulatorSession.FromString(row["proto_blob"]) for row in rows]

    # Generate next_page_token if more results exist
    next_token = None
    if has_more and rows:
      last_ts = rows[-1]["created_at"]
      next_token = base64.b64encode(str(last_ts).encode("utf-8")).decode("utf-8")

    return sessions, next_token

  async def update_status(self, session_id: str, status: str) -> bool:
    """Update the status of a session.

    Args:
        session_id: The unique identifier of the session.
        status: The new status value.

    Returns:
        True if the session was updated, False if not found.
    """
    query = "UPDATE sessions SET status = :status WHERE id = :id"
    result = await self._database.execute(query, {"id": session_id, "status": status})
    return result > 0
