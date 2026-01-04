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

# In-memory SQLite URL with shared cache for testing.
# See note in test_database.py re: `uri=true` to avoid creating a CWD file.
TEST_DB_URL = "sqlite+aiosqlite:///file::memory:?cache=shared&uri=true"


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


class TestEventRepositoryGetBySession:
  """Tests for EventRepository.get_by_session()."""

  @pytest.mark.asyncio
  async def test_get_by_session_returns_events_in_timestamp_order(self) -> None:
    """Events are returned ordered by timestamp (oldest first)."""
    db = Database(TEST_DB_URL)
    await db.connect()
    await db.create_tables()

    repo = EventRepository(db)
    session_id = f"sess-{uuid4()}"

    # Insert events out of timestamp order
    event2 = SessionEvent(
      event_id=f"evt-2-{uuid4()}",
      session_id=session_id,
      timestamp=datetime(2026, 1, 3, 12, 0, 2, tzinfo=UTC),
      turn_id="turn-002",
      agent_name="agent",
      llm_request=GenerateContentRequest(model="gemini-pro"),
    )
    event1 = SessionEvent(
      event_id=f"evt-1-{uuid4()}",
      session_id=session_id,
      timestamp=datetime(2026, 1, 3, 12, 0, 0, tzinfo=UTC),
      turn_id="turn-001",
      agent_name="agent",
      llm_request=GenerateContentRequest(model="gemini-pro"),
    )
    event3 = SessionEvent(
      event_id=f"evt-3-{uuid4()}",
      session_id=session_id,
      timestamp=datetime(2026, 1, 3, 12, 0, 1, tzinfo=UTC),
      turn_id="turn-001",
      agent_name="agent",
      llm_response=GenerateContentResponse(),
    )

    await repo.insert(event2)
    await repo.insert(event1)
    await repo.insert(event3)

    result = await repo.get_by_session(session_id)

    assert len(result) == 3
    # Ordered by timestamp: event1 (12:00:00), event3 (12:00:01), event2 (12:00:02)
    assert result[0].event_id == event1.event_id
    assert result[1].event_id == event3.event_id
    assert result[2].event_id == event2.event_id

    await db.disconnect()

  @pytest.mark.asyncio
  async def test_get_by_session_returns_empty_for_nonexistent(self) -> None:
    """Returns empty list for non-existent session."""
    db = Database(TEST_DB_URL)
    await db.connect()
    await db.create_tables()

    repo = EventRepository(db)

    result = await repo.get_by_session("nonexistent-session-id")

    assert result == []

    await db.disconnect()

  @pytest.mark.asyncio
  async def test_get_by_session_filters_by_session_id(self) -> None:
    """Only returns events for the specified session."""
    db = Database(TEST_DB_URL)
    await db.connect()
    await db.create_tables()

    repo = EventRepository(db)
    session_a = f"sess-a-{uuid4()}"
    session_b = f"sess-b-{uuid4()}"

    event_a = SessionEvent(
      event_id=f"evt-a-{uuid4()}",
      session_id=session_a,
      timestamp=datetime(2026, 1, 3, 12, 0, 0, tzinfo=UTC),
      turn_id="turn-001",
      agent_name="agent",
      llm_request=GenerateContentRequest(model="gemini-pro"),
    )
    event_b = SessionEvent(
      event_id=f"evt-b-{uuid4()}",
      session_id=session_b,
      timestamp=datetime(2026, 1, 3, 12, 0, 0, tzinfo=UTC),
      turn_id="turn-001",
      agent_name="agent",
      llm_request=GenerateContentRequest(model="gemini-pro"),
    )

    await repo.insert(event_a)
    await repo.insert(event_b)

    result = await repo.get_by_session(session_a)

    assert len(result) == 1
    assert result[0].event_id == event_a.event_id

    await db.disconnect()


class TestEventRepositoryGetByTurnId:
  """Tests for EventRepository.get_by_turn_id()."""

  @pytest.mark.asyncio
  async def test_get_by_turn_id_returns_request_response_pair(self) -> None:
    """Returns request and response events for a turn."""
    db = Database(TEST_DB_URL)
    await db.connect()
    await db.create_tables()

    repo = EventRepository(db)
    session_id = f"sess-{uuid4()}"
    turn_id = f"turn-{uuid4()}"

    # Insert request and response for same turn
    request_event = SessionEvent(
      event_id=f"evt-req-{uuid4()}",
      session_id=session_id,
      timestamp=datetime(2026, 1, 3, 12, 0, 0, tzinfo=UTC),
      turn_id=turn_id,
      agent_name="agent",
      llm_request=GenerateContentRequest(model="gemini-pro"),
    )
    response_event = SessionEvent(
      event_id=f"evt-resp-{uuid4()}",
      session_id=session_id,
      timestamp=datetime(2026, 1, 3, 12, 0, 1, tzinfo=UTC),
      turn_id=turn_id,
      agent_name="agent",
      llm_response=GenerateContentResponse(),
    )

    await repo.insert(request_event)
    await repo.insert(response_event)

    result = await repo.get_by_turn_id(turn_id)

    assert len(result) == 2
    # Should be ordered by timestamp: request first, then response
    assert result[0].event_id == request_event.event_id
    assert result[0].llm_request.model == "gemini-pro"
    assert result[1].event_id == response_event.event_id

    await db.disconnect()

  @pytest.mark.asyncio
  async def test_get_by_turn_id_returns_empty_for_nonexistent(self) -> None:
    """Returns empty list for non-existent turn_id."""
    db = Database(TEST_DB_URL)
    await db.connect()
    await db.create_tables()

    repo = EventRepository(db)

    result = await repo.get_by_turn_id("nonexistent-turn-id")

    assert result == []

    await db.disconnect()
