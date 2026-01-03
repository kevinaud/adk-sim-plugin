"""Tests for SessionRepository."""

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from adk_agent_sim.generated.adksim.v1 import SessionStatus, SimulatorSession
from adk_agent_sim.persistence import SessionRepository
from adk_agent_sim.persistence.database import Database
from adk_agent_sim.persistence.schema import sessions

# In-memory SQLite URL with shared cache for testing
TEST_DB_URL = "sqlite+aiosqlite:///:memory:?cache=shared"


class TestSessionRepositoryCreate:
  """Tests for SessionRepository.create()."""

  @pytest.mark.asyncio
  async def test_create_session_stores_in_database(self) -> None:
    """create() stores a session that can be retrieved from the database."""
    db = Database(TEST_DB_URL)
    await db.connect()
    await db.create_tables()
    repo = SessionRepository(db)

    session_id = f"test-session-{uuid.uuid4()}"
    session = SimulatorSession(
      id=session_id,
      created_at=datetime(2025, 1, 3, 12, 0, 0, tzinfo=UTC),
      description="Test session",
    )

    result = await repo.create(session)

    # Should return the same session
    assert result == session

    # Verify it was stored in the database using SQLAlchemy Core
    query = select(sessions).where(sessions.c.id == session_id)
    rows = await db.fetch_all(query)
    assert len(rows) == 1
    assert rows[0]["id"] == session_id

    await db.disconnect()

  @pytest.mark.asyncio
  async def test_create_session_extracts_promoted_fields(self) -> None:
    """create() correctly extracts id, created_at, and status columns."""
    db = Database(TEST_DB_URL)
    await db.connect()
    await db.create_tables()
    repo = SessionRepository(db)

    session_id = f"promoted-fields-{uuid.uuid4()}"
    created_time = datetime(2025, 6, 15, 10, 30, 0, tzinfo=UTC)
    session = SimulatorSession(
      id=session_id,
      created_at=created_time,
      description="Testing promoted fields",
    )

    await repo.create(session, status=SessionStatus.COMPLETED)

    query = select(
      sessions.c.id,
      sessions.c.created_at,
      sessions.c.status,
    ).where(sessions.c.id == session_id)
    rows = await db.fetch_all(query)
    assert len(rows) == 1

    row = rows[0]
    assert row["id"] == session_id
    assert row["created_at"] == int(created_time.timestamp())
    assert row["status"] == "COMPLETED"

    await db.disconnect()

  @pytest.mark.asyncio
  async def test_create_session_serializes_proto_blob(self) -> None:
    """create() stores full serialized proto in proto_blob column."""
    db = Database(TEST_DB_URL)
    await db.connect()
    await db.create_tables()
    repo = SessionRepository(db)

    session_id = f"proto-blob-{uuid.uuid4()}"
    session = SimulatorSession(
      id=session_id,
      created_at=datetime(2025, 1, 1, 0, 0, 0, tzinfo=UTC),
      description="Full proto with description",
    )

    await repo.create(session)

    query = select(sessions.c.proto_blob).where(sessions.c.id == session_id)
    rows = await db.fetch_all(query)
    assert len(rows) == 1

    # Deserialize the stored blob and verify all fields
    stored_blob = rows[0]["proto_blob"]
    restored_session = SimulatorSession().parse(stored_blob)

    assert restored_session.id == session.id
    assert restored_session.created_at == session.created_at
    assert restored_session.description == session.description

    await db.disconnect()

  @pytest.mark.asyncio
  async def test_create_session_default_status_is_active(self) -> None:
    """create() uses 'active' as the default status."""
    db = Database(TEST_DB_URL)
    await db.connect()
    await db.create_tables()
    repo = SessionRepository(db)

    session_id = f"default-status-{uuid.uuid4()}"
    session = SimulatorSession(
      id=session_id,
      created_at=datetime.now(UTC),
    )

    await repo.create(session)

    query = select(sessions.c.status).where(sessions.c.id == session_id)
    rows = await db.fetch_all(query)
    assert len(rows) == 1
    assert rows[0]["status"] == "ACTIVE"

    await db.disconnect()
