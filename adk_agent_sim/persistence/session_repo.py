"""Session repository for SimulatorSession persistence.

Implements the Promoted Field pattern: stores full proto as blob with
queryable fields extracted into SQL columns for efficient filtering.
"""

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
