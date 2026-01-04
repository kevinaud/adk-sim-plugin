"""Tests for SimulatorService."""

import asyncio
from typing import TYPE_CHECKING

import pytest

from adk_agent_sim.generated.adksim.v1 import (
  CreateSessionRequest,
  ListSessionsRequest,
  SubmitRequestRequest,
)
from adk_agent_sim.generated.google.ai.generativelanguage.v1beta import (
  GenerateContentRequest,
)
from adk_agent_sim.server.broadcaster import EventBroadcaster
from adk_agent_sim.server.queue import RequestQueue
from adk_agent_sim.server.services.simulator_service import SimulatorService

if TYPE_CHECKING:
  from adk_agent_sim.persistence.event_repo import EventRepository
  from adk_agent_sim.server.session_manager import SessionManager


async def _empty_history() -> list:
  """Return an empty history list for testing."""
  return []


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
      async for event in event_broadcaster.subscribe(session.id, _empty_history):
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
    queued_event = request_queue.get_current(session.id)
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
    assert not response.next_page_token
