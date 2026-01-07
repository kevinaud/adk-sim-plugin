"""Event repository for persisting SessionEvent protos.

Uses the Promoted Field pattern: full proto stored as BLOB with
queryable fields (event_id, session_id, timestamp, turn_id, payload_type)
promoted to dedicated columns.
"""

from typing import TYPE_CHECKING

import betterproto
from adk_sim_protos.adksim.v1 import SessionEvent
from sqlalchemy import select

from adk_sim_server.persistence.schema import events

if TYPE_CHECKING:
  from adk_sim_server.persistence.database import Database


class EventRepository:
  """Repository for SessionEvent persistence operations."""

  def __init__(self, database: Database) -> None:
    """Initialize the repository with a database connection.

    Args:
        database: The database connection manager.
    """
    self._database = database

  async def insert(self, event: SessionEvent) -> SessionEvent:
    """Insert a SessionEvent into the database.

    Extracts promoted fields from the event and stores the full
    proto as a BLOB for future retrieval.

    Args:
        event: The SessionEvent to insert.

    Returns:
        The inserted SessionEvent (unchanged).
    """
    # Determine payload type from oneof field using betterproto helper
    field_name, _ = betterproto.which_one_of(event, "payload")
    payload_type = field_name if field_name else "unknown"

    # Convert timestamp to Unix milliseconds
    timestamp_ms = int(event.timestamp.timestamp() * 1000)

    # Serialize the full proto to bytes
    proto_blob = bytes(event)

    # Build insert query using SQLAlchemy Core
    query = events.insert().values(
      event_id=event.event_id,
      session_id=event.session_id,
      timestamp=timestamp_ms,
      turn_id=event.turn_id,
      payload_type=payload_type,
      proto_blob=proto_blob,
    )

    await self._database.execute(query)

    return event

  async def get_by_session(self, session_id: str) -> list[SessionEvent]:
    """Get all events for a session ordered by timestamp.

    Args:
        session_id: The session ID to filter by.

    Returns:
        List of SessionEvents ordered by timestamp ASC (oldest first).
    """
    # Build query using SQLAlchemy Core
    query = (
      select(events.c.proto_blob)
      .where(events.c.session_id == session_id)
      .order_by(events.c.timestamp.asc())
    )

    rows = await self._database.fetch_all(query)

    return [SessionEvent().parse(row["proto_blob"]) for row in rows]

  async def get_by_turn_id(self, turn_id: str) -> list[SessionEvent]:
    """Get all events for a turn (usually request/response pair).

    Args:
        turn_id: The turn ID to filter by.

    Returns:
        List of SessionEvents ordered by timestamp ASC.
    """
    # Build query using SQLAlchemy Core
    query = (
      select(events.c.proto_blob)
      .where(events.c.turn_id == turn_id)
      .order_by(events.c.timestamp.asc())
    )

    rows = await self._database.fetch_all(query)

    return [SessionEvent().parse(row["proto_blob"]) for row in rows]
