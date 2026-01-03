"""Tests for the Database connection manager."""

import pytest
from sqlalchemy import Column, MetaData, Table, select

from adk_agent_sim.persistence import metadata
from adk_agent_sim.persistence.database import DEFAULT_DATABASE_URL, Database

# In-memory SQLite URL with shared cache for testing
# (shared cache is required for in-memory DBs with the databases library)
TEST_DB_URL = "sqlite+aiosqlite:///:memory:?cache=shared"

# Define sqlite_master table for querying table names
_sqlite_master = Table(
  "sqlite_master",
  MetaData(),
  Column("type"),
  Column("name"),
)


class TestDatabaseConnection:
  """Tests for database connection lifecycle."""

  @pytest.mark.asyncio
  async def test_connect_and_disconnect(self) -> None:
    """Database can connect and disconnect successfully."""
    db = Database(TEST_DB_URL)
    assert not db.is_connected

    await db.connect()
    assert db.is_connected

    await db.disconnect()
    assert not db.is_connected

  @pytest.mark.asyncio
  async def test_default_url(self) -> None:
    """Database uses default SQLite URL when none provided."""
    db = Database()
    assert db.url == DEFAULT_DATABASE_URL


class TestDatabaseTables:
  """Tests for table creation."""

  @pytest.mark.asyncio
  async def test_create_tables(self) -> None:
    """create_tables creates all schema tables."""
    db = Database(TEST_DB_URL)
    await db.connect()
    await db.create_tables()

    # Verify tables exist by querying sqlite_master using SQLAlchemy Core
    query = (
      select(_sqlite_master.c.name)
      .where(_sqlite_master.c.type == "table")
      .order_by(_sqlite_master.c.name)
    )
    rows = await db.fetch_all(query)
    table_names = [row["name"] for row in rows]

    # Should have our tables (events and sessions)
    assert "sessions" in table_names
    assert "events" in table_names

    await db.disconnect()

  @pytest.mark.asyncio
  async def test_tables_match_schema_metadata(self) -> None:
    """Created tables match the schema metadata definitions."""
    db = Database(TEST_DB_URL)
    await db.connect()
    await db.create_tables()

    # Verify all metadata tables were created
    expected_tables = set(metadata.tables.keys())
    query = select(_sqlite_master.c.name).where(_sqlite_master.c.type == "table")
    rows = await db.fetch_all(query)
    actual_tables = {row["name"] for row in rows}

    assert expected_tables.issubset(actual_tables)

    await db.disconnect()
