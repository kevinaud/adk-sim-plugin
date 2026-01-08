"""Core protocol types for persistence.

This module defines repository protocols used by higher-level components
(e.g. SessionManager) so they can depend on stable interfaces rather than
concrete persistence implementations.
"""

from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol

from adk_sim_protos.adksim.v1 import SessionStatus

if TYPE_CHECKING:
  from adk_sim_protos.adksim.v1 import SessionEvent, SimulatorSession


@dataclass
class PaginatedSessions:
  """Result of a paginated session query."""

  sessions: list[SimulatorSession]
  """List of sessions for the current page."""

  next_page_token: str | None
  """Token to fetch the next page, or None if this is the last page."""


class SessionRepositoryProtocol(Protocol):
  """Protocol for session repository operations."""

  async def create(
    self,
    session: SimulatorSession,
    status: SessionStatus = SessionStatus.ACTIVE,
  ) -> SimulatorSession: ...

  async def get_by_id(self, session_id: str) -> SimulatorSession | None: ...

  async def list_all(
    self, page_size: int, page_token: str | None
  ) -> PaginatedSessions: ...


class SessionEventRepository(Protocol):
  """Protocol for session event repository operations."""

  async def insert(self, event: SessionEvent) -> SessionEvent: ...

  async def get_by_session(self, session_id: str) -> list[SessionEvent]: ...
