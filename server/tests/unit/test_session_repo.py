"""Tests for SessionRepository."""

import uuid
from datetime import UTC, datetime

import pytest
from adk_sim_protos.adksim.v1 import SessionStatus, SimulatorSession
from adk_sim_server.persistence import SessionRepository
from adk_sim_server.persistence.database import Database
from adk_sim_server.persistence.schema import sessions as sessions_table
from sqlalchemy import select

# In-memory SQLite URL with shared cache for testing.
# See note in test_database.py re: `uri=true` to avoid creating a CWD file.
TEST_DB_URL = "sqlite+aiosqlite:///file::memory:?cache=shared&uri=true"


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
    query = select(sessions_table).where(sessions_table.c.id == session_id)
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
      sessions_table.c.id,
      sessions_table.c.created_at,
      sessions_table.c.status,
    ).where(sessions_table.c.id == session_id)
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

    query = select(sessions_table.c.proto_blob).where(sessions_table.c.id == session_id)
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

    query = select(sessions_table.c.status).where(sessions_table.c.id == session_id)
    rows = await db.fetch_all(query)
    assert len(rows) == 1
    assert rows[0]["status"] == "ACTIVE"

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


class TestSessionRepositoryListAll:
  """Tests for SessionRepository.list_all()."""

  @pytest.mark.asyncio
  async def test_list_all_returns_sessions_in_descending_order(self) -> None:
    """list_all() returns sessions ordered by created_at DESC."""
    db = Database(TEST_DB_URL)
    await db.connect()
    await db.create_tables()
    await db.execute(sessions_table.delete())  # Clear any existing data
    repo = SessionRepository(db)

    # Create sessions with different timestamps
    sessions: list[SimulatorSession] = []
    for i in range(3):
      session = SimulatorSession(
        id=f"list-order-{uuid.uuid4()}",
        created_at=datetime(2025, 1, i + 1, 12, 0, 0, tzinfo=UTC),
      )
      await repo.create(session)
      sessions.append(session)

    result = await repo.list_all()

    assert len(result.sessions) == 3
    # Newest first (Jan 3, Jan 2, Jan 1)
    assert result.sessions[0].id == sessions[2].id
    assert result.sessions[1].id == sessions[1].id
    assert result.sessions[2].id == sessions[0].id
    assert result.next_page_token is None

    await db.disconnect()

  @pytest.mark.asyncio
  async def test_list_all_pagination_with_page_token(self) -> None:
    """list_all() paginates correctly using page_token."""
    db = Database(TEST_DB_URL)
    await db.connect()
    await db.create_tables()
    await db.execute(sessions_table.delete())  # Clear any existing data
    repo = SessionRepository(db)

    # Create 5 sessions
    sessions: list[SimulatorSession] = []
    for i in range(5):
      session = SimulatorSession(
        id=f"paginate-{uuid.uuid4()}",
        created_at=datetime(2025, 1, i + 1, 12, 0, 0, tzinfo=UTC),
      )
      await repo.create(session)
      sessions.append(session)

    # First page: get 2 sessions
    page1 = await repo.list_all(page_size=2)
    assert len(page1.sessions) == 2
    assert page1.sessions[0].id == sessions[4].id  # Jan 5
    assert page1.sessions[1].id == sessions[3].id  # Jan 4
    assert page1.next_page_token is not None

    # Second page: use token
    page2 = await repo.list_all(page_size=2, page_token=page1.next_page_token)
    assert len(page2.sessions) == 2
    assert page2.sessions[0].id == sessions[2].id  # Jan 3
    assert page2.sessions[1].id == sessions[1].id  # Jan 2
    assert page2.next_page_token is not None

    # Third page: last session
    page3 = await repo.list_all(page_size=2, page_token=page2.next_page_token)
    assert len(page3.sessions) == 1
    assert page3.sessions[0].id == sessions[0].id  # Jan 1
    assert page3.next_page_token is None  # No more pages

    await db.disconnect()


class TestSessionRepositoryUpdateStatus:
  """Tests for SessionRepository.update_status()."""

  @pytest.mark.asyncio
  async def test_update_status_changes_status_correctly(self) -> None:
    """update_status() successfully updates the session status."""
    db = Database(TEST_DB_URL)
    await db.connect()
    await db.create_tables()
    repo = SessionRepository(db)

    session_id = f"status-update-{uuid.uuid4()}"
    session = SimulatorSession(id=session_id, created_at=datetime.now(UTC))
    await repo.create(session, status=SessionStatus.ACTIVE)

    result = await repo.update_status(session_id, SessionStatus.COMPLETED)

    assert result is True
    query = select(sessions_table.c.status).where(sessions_table.c.id == session_id)
    rows = await db.fetch_all(query)
    assert rows[0]["status"] == "COMPLETED"

    await db.disconnect()

  @pytest.mark.asyncio
  async def test_update_status_returns_false_for_nonexistent(self) -> None:
    """update_status() returns False when session does not exist."""
    db = Database(TEST_DB_URL)
    await db.connect()
    await db.create_tables()
    repo = SessionRepository(db)

    result = await repo.update_status("nonexistent-session", SessionStatus.COMPLETED)

    assert result is False

    await db.disconnect()
