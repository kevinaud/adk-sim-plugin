"""Tests for SessionRepository."""

import uuid
from datetime import UTC, datetime

import pytest

from adk_agent_sim.generated.adksim.v1 import SimulatorSession
from adk_agent_sim.persistence import SessionRepository
from adk_agent_sim.persistence.database import Database

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

    # Verify it was stored in the database
    rows = await db.fetch_all(f"SELECT * FROM sessions WHERE id = '{session_id}'")
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

    await repo.create(session, status="pending")

    rows = await db.fetch_all(
      f"SELECT id, created_at, status FROM sessions WHERE id = '{session_id}'"
    )
    assert len(rows) == 1

    row = rows[0]
    assert row["id"] == session_id
    assert row["created_at"] == int(created_time.timestamp())
    assert row["status"] == "pending"

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

    rows = await db.fetch_all(
      f"SELECT proto_blob FROM sessions WHERE id = '{session_id}'"
    )
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

    rows = await db.fetch_all(f"SELECT status FROM sessions WHERE id = '{session_id}'")
    assert len(rows) == 1
    assert rows[0]["status"] == "active"

    await db.disconnect()


class TestSessionRepositoryGetById:
  """Tests for SessionRepository.get_by_id()."""

  @pytest.mark.asyncio
  async def test_get_by_id_returns_existing_session(self) -> None:
    """get_by_id() returns the correct session when it exists."""
    db = Database(TEST_DB_URL)
    await db.connect()
    await db.create_tables()
    repo = SessionRepository(db)

    session_id = f"get-existing-{uuid.uuid4()}"
    created_time = datetime(2025, 3, 15, 14, 30, 0, tzinfo=UTC)
    original_session = SimulatorSession(
      id=session_id,
      created_at=created_time,
      description="Session for get_by_id test",
    )
    await repo.create(original_session)

    result = await repo.get_by_id(session_id)

    assert result is not None
    assert result.id == original_session.id
    assert result.created_at == original_session.created_at
    assert result.description == original_session.description

    await db.disconnect()

  @pytest.mark.asyncio
  async def test_get_by_id_returns_none_for_nonexistent(self) -> None:
    """get_by_id() returns None when session does not exist."""
    db = Database(TEST_DB_URL)
    await db.connect()
    await db.create_tables()
    repo = SessionRepository(db)

    result = await repo.get_by_id("nonexistent-session-id")

    assert result is None

    await db.disconnect()

  @pytest.mark.asyncio
  async def test_get_by_id_deserializes_proto_correctly(self) -> None:
    """get_by_id() correctly deserializes all proto fields."""
    db = Database(TEST_DB_URL)
    await db.connect()
    await db.create_tables()
    repo = SessionRepository(db)

    session_id = f"deserialize-test-{uuid.uuid4()}"
    original_session = SimulatorSession(
      id=session_id,
      created_at=datetime(2025, 12, 25, 8, 0, 0, tzinfo=UTC),
      description="Testing full deserialization",
    )
    await repo.create(original_session)

    result = await repo.get_by_id(session_id)

    # Verify the deserialized proto matches the original exactly
    assert result == original_session

    await db.disconnect()
