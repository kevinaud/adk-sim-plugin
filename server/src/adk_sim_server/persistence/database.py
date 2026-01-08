"""Async database connection manager using the databases library.

Provides lifecycle management for database connections and table creation
using SQLAlchemy Core metadata definitions.
"""

from typing import Any

from databases import Database as DatabaseClient
from sqlalchemy import create_engine
from sqlalchemy.schema import CreateIndex, CreateTable
from sqlalchemy.sql import ClauseElement

from adk_sim_server.persistence.schema import metadata

# Type alias for SQLAlchemy query constructs (ClauseElement is the base for all)
QueryType = ClauseElement


class Database:
  """Async database connection manager.

  Manages connection lifecycle and provides table creation utilities.
  Uses the `databases` library for async database operations.

  Note: This class assumes the database directory already exists.
  Directory creation should be handled by the application bootstrap.
  """

  def __init__(self, url: str) -> None:
    """Initialize database connection manager.

    Args:
        url: Database URL (e.g., sqlite+aiosqlite:///path/to/db.db).
    """
    self.url = url
    self._client = DatabaseClient(self.url)

  @property
  def is_connected(self) -> bool:
    """Check if database is currently connected."""
    return self._client.is_connected

  async def connect(self) -> None:
    """Establish database connection."""
    await self._client.connect()

  async def disconnect(self) -> None:
    """Close database connection."""
    await self._client.disconnect()

  async def create_tables(self) -> None:
    """Create all tables defined in the schema metadata."""
    # Use sync engine only for DDL compilation (not execution)
    sync_url = self.url.replace("sqlite+aiosqlite", "sqlite").split("?")[0]
    engine = create_engine(sync_url)

    # Create tables (use IF NOT EXISTS for idempotency)
    for table in metadata.sorted_tables:
      ddl = str(CreateTable(table, if_not_exists=True).compile(engine))
      await self._client.execute(ddl)  # pyright: ignore[reportUnknownMemberType]

    # Create indexes (use IF NOT EXISTS for idempotency)
    for table in metadata.sorted_tables:
      for index in table.indexes:
        ddl = str(CreateIndex(index, if_not_exists=True).compile(engine))
        await self._client.execute(ddl)  # pyright: ignore[reportUnknownMemberType]

    engine.dispose()

  async def execute(
    self, query: QueryType, values: dict[str, Any] | None = None
  ) -> int:
    """Execute a query and return affected row count.

    Args:
        query: SQLAlchemy query construct (e.g., table.insert(), table.update()).
        values: Optional dict of values for parameterized queries.

    Returns:
        Number of affected rows.
    """
    result = await self._client.execute(query, values)  # pyright: ignore[reportUnknownMemberType]
    # For INSERT, returns last row id; for UPDATE/DELETE, returns rowcount
    # The databases library returns different things depending on the operation
    return result if isinstance(result, int) else 1

  async def fetch_all(
    self, query: QueryType, values: dict[str, Any] | None = None
  ) -> list[dict[str, Any]]:
    """Execute a query and fetch all results.

    Args:
        query: SQLAlchemy query construct (e.g., table.select()).
        values: Optional dict of values for parameterized queries.

    Returns:
        List of row dictionaries.
    """
    rows = await self._client.fetch_all(query, values)  # pyright: ignore[reportUnknownMemberType]
    return [dict(row._mapping) for row in rows]  # pyright: ignore[reportUnknownMemberType,reportPrivateUsage]

  async def fetch_one(
    self, query: QueryType, values: dict[str, Any] | None = None
  ) -> dict[str, Any] | None:
    """Execute a query and fetch one result.

    Args:
        query: SQLAlchemy query construct (e.g., table.select().where(...)).
        values: Optional dict of values for parameterized queries.

    Returns:
        Row dictionary or None if not found.
    """
    row = await self._client.fetch_one(query, values)  # pyright: ignore[reportUnknownMemberType]
    if row is None:
      return None
    return dict(row._mapping)  # pyright: ignore[reportUnknownMemberType,reportPrivateUsage]
