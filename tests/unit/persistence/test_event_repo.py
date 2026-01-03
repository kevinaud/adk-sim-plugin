"""Tests for the EventRepository."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import select

from adk_agent_sim.generated.adksim.v1 import SessionEvent
from adk_agent_sim.generated.google.ai.generativelanguage.v1beta import (
  GenerateContentRequest,
  GenerateContentResponse,
)
from adk_agent_sim.persistence import EventRepository
from adk_agent_sim.persistence.database import Database
from adk_agent_sim.persistence.schema import events

# In-memory SQLite URL with shared cache for testing
TEST_DB_URL = "sqlite+aiosqlite:///:memory:?cache=shared"


class TestEventRepositoryInsert:
  """Tests for EventRepository.insert()."""

  @pytest.mark.asyncio
  async def test_insert_llm_request_event(self) -> None:
    """Insert an event with llm_request payload extracts correct fields."""
    db = Database(TEST_DB_URL)
    await db.connect()
    await db.create_tables()

    repo = EventRepository(db)

    # Use unique IDs to avoid conflicts with shared in-memory DB
    event_id = f"evt-req-{uuid4()}"
    session_id = f"sess-{uuid4()}"

    # Create a SessionEvent with llm_request payload
    event = SessionEvent(
      event_id=event_id,
      session_id=session_id,
      timestamp=datetime(2026, 1, 3, 12, 0, 0, tzinfo=UTC),
      turn_id="turn-001",
      agent_name="test-agent",
      llm_request=GenerateContentRequest(model="gemini-pro"),
    )

    result = await repo.insert(event)

    # Should return the same event
    assert result == event

    # Verify promoted fields in database
    query = select(events).where(events.c.event_id == event_id)
    rows = await db.fetch_all(query)

    assert len(rows) == 1
    row = rows[0]
    assert row["event_id"] == event_id
    assert row["session_id"] == session_id
    assert row["turn_id"] == "turn-001"
    assert row["payload_type"] == "llm_request"
    # Timestamp should be Unix milliseconds: 2026-01-03T12:00:00Z
    assert row["timestamp"] == 1767441600000
    # Proto blob should be non-empty bytes
    assert isinstance(row["proto_blob"], bytes)
    assert len(row["proto_blob"]) > 0

    await db.disconnect()

  @pytest.mark.asyncio
  async def test_insert_llm_response_event(self) -> None:
    """Insert an event with llm_response payload extracts correct fields."""
    db = Database(TEST_DB_URL)
    await db.connect()
    await db.create_tables()

    repo = EventRepository(db)

    # Use unique IDs to avoid conflicts with shared in-memory DB
    event_id = f"evt-resp-{uuid4()}"
    session_id = f"sess-{uuid4()}"

    # Create a SessionEvent with llm_response payload
    event = SessionEvent(
      event_id=event_id,
      session_id=session_id,
      timestamp=datetime(2026, 1, 3, 12, 0, 1, tzinfo=UTC),
      turn_id="turn-001",
      agent_name="test-agent",
      llm_response=GenerateContentResponse(),
    )

    result = await repo.insert(event)

    # Should return the same event
    assert result == event

    # Verify promoted fields in database
    query = select(events).where(events.c.event_id == event_id)
    rows = await db.fetch_all(query)

    assert len(rows) == 1
    row = rows[0]
    assert row["event_id"] == event_id
    assert row["session_id"] == session_id
    assert row["turn_id"] == "turn-001"
    assert row["payload_type"] == "llm_response"
    # Timestamp should be 1 second later
    assert row["timestamp"] == 1767441601000

    await db.disconnect()

  @pytest.mark.asyncio
  async def test_insert_preserves_proto_blob(self) -> None:
    """Inserted proto blob can be deserialized back to original event."""
    db = Database(TEST_DB_URL)
    await db.connect()
    await db.create_tables()

    repo = EventRepository(db)

    # Use unique IDs to avoid conflicts with shared in-memory DB
    event_id = f"evt-blob-{uuid4()}"
    session_id = f"sess-{uuid4()}"

    # Create event with some data
    event = SessionEvent(
      event_id=event_id,
      session_id=session_id,
      timestamp=datetime(2026, 1, 3, 12, 30, 0, tzinfo=UTC),
      turn_id="turn-002",
      agent_name="my-agent",
      llm_request=GenerateContentRequest(model="gemini-1.5-flash"),
    )

    await repo.insert(event)

    # Retrieve and deserialize
    query = select(events.c.proto_blob).where(events.c.event_id == event_id)
    rows = await db.fetch_all(query)
    proto_blob = rows[0]["proto_blob"]

    restored = SessionEvent().parse(proto_blob)

    assert restored.event_id == event_id
    assert restored.session_id == session_id
    assert restored.turn_id == "turn-002"
    assert restored.agent_name == "my-agent"
    assert restored.llm_request.model == "gemini-1.5-flash"

    await db.disconnect()
