"""Core protocol types for persistence.

This module defines repository protocols used by higher-level components
(e.g. SessionManager) so they can depend on stable interfaces rather than
concrete persistence implementations.
"""

from typing import TYPE_CHECKING, Protocol

from adk_agent_sim.generated.adksim.v1 import SessionStatus

if TYPE_CHECKING:
  from adk_agent_sim.generated.adksim.v1 import SessionEvent, SimulatorSession


class SessionRepositoryProtocol(Protocol):
  """Protocol for session repository operations."""

  async def create(
    self,
    session: SimulatorSession,
    status: SessionStatus = SessionStatus.ACTIVE,
  ) -> SimulatorSession: ...

  async def get_by_id(self, session_id: str) -> SimulatorSession | None: ...


class SessionEventRepository(Protocol):
  """Protocol for session event repository operations."""

  async def insert(self, event: SessionEvent) -> SessionEvent: ...

  async def get_by_session(self, session_id: str) -> list[SessionEvent]: ...
