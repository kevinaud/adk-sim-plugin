"""SimulatorService - gRPC service implementation for the ADK Agent Simulator.

This service implements the "Remote Brain" protocol, enabling human-in-the-loop
validation of agent workflows by intercepting LLM calls and routing them to
a web UI for manual decision-making.
"""

from adk_agent_sim.server.logging import get_logger

# Import generated protos once available
# from adk_agent_sim.generated.adksim.v1 import (
#     SimulatorServiceBase,
#     CreateSessionRequest,
#     CreateSessionResponse,
#     SubscribeRequest,
#     SessionEvent,
#     SubmitRequestRequest,
#     SubmitRequestResponse,
#     SubmitDecisionRequest,
#     SubmitDecisionResponse,
#     ListSessionsRequest,
#     ListSessionsResponse,
# )

logger = get_logger("simulator_service")


class SimulatorService:
  """gRPC service for the ADK Agent Simulator.

  Implements the SimulatorService proto definition, providing:
  - Session management (create, list)
  - Event streaming (subscribe to session events)
  - Request/Decision submission (Plugin -> UI -> Plugin flow)

  TODO: Inherit from SimulatorServiceBase once protos are generated.
  """

  def __init__(self) -> None:
    """Initialize the SimulatorService."""
    logger.info("SimulatorService initialized")

  async def create_session(self, request: object) -> object:
    """Create a new simulation session.

    Args:
        request: CreateSessionRequest with optional description.

    Returns:
        CreateSessionResponse containing the created Session.
    """
    # TODO: Implement session creation with persistence
    raise NotImplementedError("create_session not yet implemented")

  async def subscribe(self, request: object) -> object:
    """Subscribe to a session's event stream.

    Args:
        request: SubscribeRequest with session_id and client_id.

    Yields:
        SessionEvent objects as they occur.
    """
    # TODO: Implement event streaming with replay
    raise NotImplementedError("subscribe not yet implemented")

  async def submit_request(self, request: object) -> object:
    """Submit an intercepted LLM request.

    Args:
        request: SubmitRequestRequest with the intercepted LLM request.

    Returns:
        SubmitRequestResponse with the assigned event_id.
    """
    # TODO: Implement request submission with broadcasting
    raise NotImplementedError("submit_request not yet implemented")

  async def submit_decision(self, request: object) -> object:
    """Submit a human decision (response).

    Args:
        request: SubmitDecisionRequest with the human's response.

    Returns:
        SubmitDecisionResponse with the assigned event_id.
    """
    # TODO: Implement decision submission with broadcasting
    raise NotImplementedError("submit_decision not yet implemented")

  async def list_sessions(self, request: object) -> object:
    """List all historical sessions.

    Args:
        request: ListSessionsRequest with pagination parameters.

    Returns:
        ListSessionsResponse with sessions and pagination token.
    """
    # TODO: Implement session listing from persistence
    raise NotImplementedError("list_sessions not yet implemented")
