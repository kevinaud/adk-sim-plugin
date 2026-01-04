"""SimulatorService - gRPC service implementation for the ADK Agent Simulator.

This service implements the "Remote Brain" protocol, enabling human-in-the-loop
validation of agent workflows by intercepting LLM calls and routing them to
a web UI for manual decision-making.
"""

from typing import TYPE_CHECKING

from adk_agent_sim.generated.adksim.v1 import (
  CreateSessionResponse,
  ListSessionsResponse,
  SimulatorServiceBase,
)
from adk_agent_sim.server.logging import get_logger

if TYPE_CHECKING:
  from adk_agent_sim.generated.adksim.v1 import (
    CreateSessionRequest,
    ListSessionsRequest,
  )
  from adk_agent_sim.server.session_manager import SessionManager

logger = get_logger("simulator_service")


class SimulatorService(SimulatorServiceBase):
  """gRPC service for the ADK Agent Simulator.

  Implements the SimulatorService proto definition, providing:
  - Session management (create, list)
  - Event streaming (subscribe to session events)
  - Request/Decision submission (Plugin -> UI -> Plugin flow)
  """

  def __init__(self, session_manager: SessionManager) -> None:
    """Initialize the SimulatorService.

    Args:
        session_manager: SessionManager instance.
    """
    self._session_manager = session_manager
    logger.info("SimulatorService initialized")

  async def create_session(
    self, create_session_request: CreateSessionRequest
  ) -> CreateSessionResponse:
    """Create a new simulation session.

    Args:
        create_session_request: CreateSessionRequest with optional description.

    Returns:
        CreateSessionResponse containing the created Session.
    """
    session = await self._session_manager.create_session(
      description=create_session_request.description
    )
    return CreateSessionResponse(session=session)

  async def list_sessions(
    self,
    list_sessions_request: ListSessionsRequest,
  ) -> ListSessionsResponse:
    """List sessions with pagination.

    Args:
        list_sessions_request: ListSessionsRequest with page_size and page_token.

    Returns:
        ListSessionsResponse containing the list of sessions and next_page_token.
    """
    result = await self._session_manager.list_sessions(
      list_sessions_request.page_size, list_sessions_request.page_token
    )
    return ListSessionsResponse(
      sessions=result.sessions, next_page_token=result.next_page_token or ""
    )
