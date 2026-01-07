"""SQLAlchemy Core schema definitions for the persistence layer.

Uses the Promoted Field pattern: full proto objects are stored as BLOBs,
with only queryable fields (IDs, timestamps, status) promoted to dedicated
SQL columns for efficient filtering and indexing.
"""

from sqlalchemy import (
  Column,
  ForeignKey,
  Index,
  Integer,
  LargeBinary,
  MetaData,
  String,
  Table,
)

metadata = MetaData()

# Session table with promoted fields for querying
sessions = Table(
  "sessions",
  metadata,
  # Promoted fields (queryable)
  Column("id", String, primary_key=True),
  Column("created_at", Integer, nullable=False),  # Unix timestamp (seconds)
  Column("status", String, nullable=False, default="active"),
  # Full proto blob
  Column("proto_blob", LargeBinary, nullable=False),
)

# Event table with promoted fields for querying
events = Table(
  "events",
  metadata,
  # Promoted fields (queryable)
  Column("event_id", String, primary_key=True),
  Column(
    "session_id",
    String,
    ForeignKey("sessions.id", ondelete="CASCADE"),
    nullable=False,
  ),
  Column("timestamp", Integer, nullable=False),  # Unix timestamp (milliseconds)
  Column("turn_id", String, nullable=False),
  Column("payload_type", String, nullable=False),  # "request" | "response"
  # Full proto blob
  Column("proto_blob", LargeBinary, nullable=False),
)

# Composite index for session timeline queries (get events in order)
Index("idx_events_session_time", events.c.session_id, events.c.timestamp)

# Index for turn_id correlation lookups (match request to response)
Index("idx_events_turn", events.c.turn_id)
