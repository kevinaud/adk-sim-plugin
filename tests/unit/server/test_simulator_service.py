"""Tests for SimulatorService."""

import asyncio
from datetime import UTC, datetime
from typing import TYPE_CHECKING

import pytest

from adk_agent_sim.generated.adksim.v1 import (
  CreateSessionRequest,
  ListSessionsRequest,
  SessionEvent,
  SubmitDecisionRequest,
  SubmitRequestRequest,
  SubscribeRequest,
)
from adk_agent_sim.generated.google.ai.generativelanguage.v1beta import (
  GenerateContentRequest,
  GenerateContentResponse,
)
from adk_agent_sim.server.broadcaster import EventBroadcaster
from adk_agent_sim.server.queue import RequestQueue
from adk_agent_sim.server.services.simulator_service import SimulatorService

if TYPE_CHECKING:
  from adk_agent_sim.persistence.event_repo import EventRepository
  from adk_agent_sim.server.session_manager import SessionManager


class TestSimulatorService:
  """Test suite for SimulatorService."""

  def test_service_initialization(
    self, manager: SessionManager, event_repo: EventRepository
  ) -> None:
    """Test that SimulatorService can be instantiated."""
    service = SimulatorService(
      session_manager=manager,
      event_repo=event_repo,
      request_queue=RequestQueue(),
      event_broadcaster=EventBroadcaster(),
    )
    assert service is not None

  @pytest.mark.asyncio
  async def test_create_session_success(
    self, manager: SessionManager, event_repo: EventRepository
  ) -> None:
    """Test that create_session creates a session successfully."""
    service = SimulatorService(
      session_manager=manager,
      event_repo=event_repo,
      request_queue=RequestQueue(),
      event_broadcaster=EventBroadcaster(),
    )
    request = CreateSessionRequest(description="test session")

    response = await service.create_session(request)

    assert response.session is not None
    assert response.session.description == "test session"
    assert response.session.id is not None

  @pytest.mark.asyncio
  async def test_list_sessions_success(
    self, manager: SessionManager, event_repo: EventRepository
  ) -> None:
    """Test that list_sessions returns sessions successfully."""
    service = SimulatorService(
      session_manager=manager,
      event_repo=event_repo,
      request_queue=RequestQueue(),
      event_broadcaster=EventBroadcaster(),
    )
    # Create some sessions
    await manager.create_session("session 1")
    await manager.create_session("session 2")

    request = ListSessionsRequest(page_size=10)
    response = await service.list_sessions(request)

    assert len(response.sessions) == 2
    assert response.sessions[0].description == "session 2"  # Most recent first
    assert response.sessions[1].description == "session 1"
    assert not response.next_page_token

  @pytest.mark.asyncio
  async def test_submit_request_success(
    self, manager: SessionManager, event_repo: EventRepository
  ) -> None:
    """Test that submit_request processes the request successfully."""
    request_queue = RequestQueue()
    event_broadcaster = EventBroadcaster()
    service = SimulatorService(
      session_manager=manager,
      event_repo=event_repo,
      request_queue=request_queue,
      event_broadcaster=event_broadcaster,
    )

    # Create a session first
    session = await manager.create_session("test session")

    # Subscribe to events to verify broadcast
    events = []

    async def subscriber() -> None:
      async for event in event_broadcaster.subscribe(session.id):
        events.append(event)
        break  # Stop after receiving one event

    # Start subscriber task
    subscriber_task = asyncio.create_task(subscriber())
    # Give the subscriber a moment to register
    await asyncio.sleep(0.01)

    request = SubmitRequestRequest(
      session_id=session.id,
      turn_id="turn_1",
      agent_name="test_agent",
      request=GenerateContentRequest(),
    )

    response = await service.submit_request(request)

    assert response.event_id is not None

    # Verify event in repo
    stored_events = await event_repo.get_by_session(session.id)
    assert len(stored_events) == 1
    assert stored_events[0].event_id == response.event_id
    assert stored_events[0].llm_request == GenerateContentRequest()

    # Verify event in queue
    queued_event = await request_queue.get_current(session.id)
    assert queued_event is not None
    assert queued_event.event_id == response.event_id

    # Verify broadcast
    await asyncio.wait_for(subscriber_task, timeout=1.0)
    assert len(events) == 1
    assert events[0].event_id == response.event_id

  @pytest.mark.asyncio
  async def test_list_sessions_pagination(
    self, manager: SessionManager, event_repo: EventRepository
  ) -> None:
    """Test that list_sessions handles pagination correctly."""
    service = SimulatorService(
      session_manager=manager,
      event_repo=event_repo,
      request_queue=RequestQueue(),
      event_broadcaster=EventBroadcaster(),
    )
    # Create 3 sessions
    await manager.create_session("session 1")
    await manager.create_session("session 2")
    await manager.create_session("session 3")

    # Request page size 2
    request = ListSessionsRequest(page_size=2)
    response = await service.list_sessions(request)

    assert len(response.sessions) == 2
    assert response.sessions[0].description == "session 3"
    assert response.sessions[1].description == "session 2"
    assert response.next_page_token

    # Request next page
    request = ListSessionsRequest(page_size=2, page_token=response.next_page_token)
    response = await service.list_sessions(request)

    assert len(response.sessions) == 1
    assert response.sessions[0].description == "session 1"

  @pytest.mark.asyncio
  async def test_submit_decision_success(
    self, manager: SessionManager, event_repo: EventRepository
  ) -> None:
    """Test that submit_decision processes the decision successfully."""
    request_queue = RequestQueue()
    event_broadcaster = EventBroadcaster()
    service = SimulatorService(
      session_manager=manager,
      event_repo=event_repo,
      request_queue=request_queue,
      event_broadcaster=event_broadcaster,
    )

    # Create a session
    session = await manager.create_session("test session")

    # 1. Submit a request to populate queue
    request_req = SubmitRequestRequest(
      session_id=session.id,
      turn_id="turn_1",
      agent_name="test_agent",
      request=GenerateContentRequest(),
    )
    await service.submit_request(request_req)

    # Verify queue has item
    assert not request_queue.is_empty(session.id)

    # 2. Submit decision
    decision_req = SubmitDecisionRequest(
      session_id=session.id,
      turn_id="turn_1",
      response=GenerateContentResponse(),
    )

    # Start subscriber to verify broadcast
    received_events = []

    async def subscriber() -> None:
      async for event in event_broadcaster.subscribe(session.id):
        received_events.append(event)
        break

    subscriber_task = asyncio.create_task(subscriber())
    await asyncio.sleep(0.01)

    response = await service.submit_decision(decision_req)

    assert response.event_id is not None

    # Verify event in repo
    stored_events = await event_repo.get_by_session(session.id)
    assert len(stored_events) == 2
    decision_event = stored_events[1]
    assert decision_event.event_id == response.event_id
    assert decision_event.llm_response == GenerateContentResponse()
    assert decision_event.agent_name == "User"

    # Verify queue is empty (dequeued)
    assert request_queue.is_empty(session.id)

    # Verify broadcast
    await asyncio.wait_for(subscriber_task, timeout=1.0)
    assert len(received_events) == 1
    assert received_events[0].event_id == response.event_id

  @pytest.mark.asyncio
  async def test_subscribe_replay_and_live(
    self, manager: SessionManager, event_repo: EventRepository
  ) -> None:
    """Test that subscribe replays history and streams live events."""
    service = SimulatorService(
      session_manager=manager,
      event_repo=event_repo,
      request_queue=RequestQueue(),
      event_broadcaster=EventBroadcaster(),
    )

    # 1. Create session
    session = await manager.create_session()

    # 2. Insert historical event
    history_event = SessionEvent(
      event_id="history_1",
      session_id=session.id,
      timestamp=datetime.now(UTC),
      turn_id="turn_0",
      agent_name="History",
    )
    await event_repo.insert(history_event)

    # 3. Start subscription
    iterator = service.subscribe(SubscribeRequest(session_id=session.id))

    # 4. Verify history replay
    response1 = await anext(iterator)
    assert response1.event.event_id == "history_1"

    # 5. Trigger live event
    req = SubmitRequestRequest(
      session_id=session.id,
      turn_id="turn_1",
      agent_name="Model",
      request=GenerateContentRequest(),
    )

    async def trigger_event() -> None:
      await asyncio.sleep(0.01)
      await service.submit_request(req)

    trigger_task = asyncio.create_task(trigger_event())

    # 6. Verify live event
    response2 = await asyncio.wait_for(anext(iterator), timeout=1.0)
    assert response2.event.turn_id == "turn_1"
    assert response2.event.agent_name == "Model"

    await trigger_task
