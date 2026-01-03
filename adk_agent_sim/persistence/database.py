"""Async database connection manager using the databases library.

Provides lifecycle management for database connections and table creation
using SQLAlchemy Core metadata definitions.
"""

from typing import Any

from databases import Database as DatabaseClient
from sqlalchemy import create_engine
from sqlalchemy.schema import CreateIndex, CreateTable

from adk_agent_sim.persistence.schema import metadata

DEFAULT_DATABASE_URL = "sqlite+aiosqlite:///./simulator.db"


class Database:
  """Async database connection manager.

  Manages connection lifecycle and provides table creation utilities.
  Uses the `databases` library for async database operations.
  """

  def __init__(self, url: str | None = None) -> None:
    """Initialize database connection manager.

    Args:
        url: Database URL. Defaults to SQLite file at ./simulator.db.
    """
    self.url = url or DEFAULT_DATABASE_URL
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

  async def fetch_all(self, query: str) -> list[dict[str, Any]]:
    """Execute a query and fetch all results.

    Args:
        query: SQL query string.

    Returns:
        List of row dictionaries.
    """
    rows = await self._client.fetch_all(query)  # pyright: ignore[reportUnknownMemberType]
    return [dict(row._mapping) for row in rows]  # pyright: ignore[reportUnknownMemberType]

  async def execute(self, query: str, values: dict[str, Any] | None = None) -> None:
    """Execute a query without returning results.

    Args:
        query: SQL query string.
        values: Optional dictionary of parameter values.
    """
    await self._client.execute(query, values)  # pyright: ignore[reportUnknownMemberType]
