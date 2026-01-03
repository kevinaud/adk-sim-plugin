"""Session repository for SimulatorSession persistence.

Implements the Promoted Field pattern: stores full proto as blob with
queryable fields extracted into SQL columns for efficient filtering.
"""

from typing import TYPE_CHECKING

from sqlalchemy import select

from adk_agent_sim.generated.adksim.v1 import SessionStatus
from adk_agent_sim.persistence.schema import sessions

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
    from adk_agent_sim.generated.adksim.v1 import SimulatorSession

    # Build select query using SQLAlchemy Core
    query = select(sessions.c.proto_blob).where(sessions.c.id == session_id)
    row = await self._database.fetch_one(query)

    if row is None:
      return None

    # Deserialize proto blob back to SimulatorSession
    return SimulatorSession().parse(row["proto_blob"])
