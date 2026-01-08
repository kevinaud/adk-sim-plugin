"""SimulatorService - gRPC service implementation for the ADK Agent Simulator.

This service implements the "Remote Brain" protocol, enabling human-in-the-loop
validation of agent workflows by intercepting LLM calls and routing them to
a web UI for manual decision-making.
"""

import uuid
from collections.abc import AsyncIterator  # noqa: TC003
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from adk_sim_protos.adksim.v1 import (
  CreateSessionResponse,
  ListSessionsResponse,
  SessionEvent,
  SimulatorServiceBase,
  SubmitDecisionResponse,
  SubmitRequestResponse,
  SubscribeRequest,  # noqa: TC002 - Runtime import required for grpclib
  SubscribeResponse,
)

from adk_sim_server.logging import get_logger

if TYPE_CHECKING:
  from adk_sim_protos.adksim.v1 import (
    CreateSessionRequest,
    ListSessionsRequest,
    SubmitDecisionRequest,
    SubmitRequestRequest,
  )

  from adk_sim_server.broadcaster import EventBroadcaster
  from adk_sim_server.persistence.event_repo import EventRepository
  from adk_sim_server.queue import RequestQueue
  from adk_sim_server.session_manager import SessionManager

logger = get_logger("simulator_service")


class SimulatorService(SimulatorServiceBase):
  """gRPC service for the ADK Agent Simulator.

  Implements the SimulatorService proto definition, providing:
  - Session management (create, list)
  - Event streaming (subscribe to session events)
  - Request/Decision submission (Plugin -> UI -> Plugin flow)
  """

  def __init__(
    self,
    session_manager: SessionManager,
    event_repo: EventRepository,
    request_queue: RequestQueue,
    event_broadcaster: EventBroadcaster,
  ) -> None:
    """Initialize the SimulatorService.

    Args:
        session_manager: SessionManager instance.
        event_repo: EventRepository instance.
        request_queue: RequestQueue instance.
        event_broadcaster: EventBroadcaster instance.
    """
    self._session_manager = session_manager
    self._event_repo = event_repo
    self._request_queue = request_queue
    self._event_broadcaster = event_broadcaster
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

  async def submit_request(
    self, submit_request_request: SubmitRequestRequest
  ) -> SubmitRequestResponse:
    """Submit an LLM request from the plugin.

    Args:
        submit_request_request: The request containing LLM input.

    Returns:
        SubmitRequestResponse containing the generated event ID.
    """
    event_id = str(uuid.uuid4())
    event = SessionEvent(
      event_id=event_id,
      session_id=submit_request_request.session_id,
      timestamp=datetime.now(UTC),
      turn_id=submit_request_request.turn_id,
      agent_name=submit_request_request.agent_name,
      llm_request=submit_request_request.request,
    )

    await self._event_repo.insert(event)
    await self._request_queue.enqueue(event)
    await self._event_broadcaster.broadcast(event.session_id, event)

    return SubmitRequestResponse(event_id=event_id)

  async def submit_decision(
    self, submit_decision_request: SubmitDecisionRequest
  ) -> SubmitDecisionResponse:
    """Submit a decision from the UI.

    Args:
        submit_decision_request: The decision containing LLM response.

    Returns:
        SubmitDecisionResponse containing the generated event ID.
    """
    event_id = str(uuid.uuid4())
    event = SessionEvent(
      event_id=event_id,
      session_id=submit_decision_request.session_id,
      timestamp=datetime.now(UTC),
      turn_id=submit_decision_request.turn_id,
      # Decision events don't have an agent_name - they come from UI, not an agent
      agent_name="",
      llm_response=submit_decision_request.response,
    )

    await self._event_repo.insert(event)
    await self._request_queue.dequeue(submit_decision_request.session_id)
    await self._event_broadcaster.broadcast(event.session_id, event)

    return SubmitDecisionResponse(event_id=event_id)

  async def subscribe(
    self, subscribe_request: SubscribeRequest
  ) -> AsyncIterator[SubscribeResponse]:
    """Subscribe to session events.

    Streams historical events first, then listens for live events.
    Uses the EventBroadcaster's atomic history+subscribe mechanism
    to prevent race conditions where events could be missed.

    Args:
        subscribe_request: SubscribeRequest containing the session ID.

    Yields:
        SubscribeResponse containing session events.
    """
    session_id = subscribe_request.session_id

    async def _fetch_history() -> list[SessionEvent]:
      return await self._event_repo.get_by_session(session_id)

    async for event in self._event_broadcaster.subscribe(session_id, _fetch_history):
      yield SubscribeResponse(event=event)
