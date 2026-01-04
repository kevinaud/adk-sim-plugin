"""Tests for SimulatorService."""

import asyncio
from dataclasses import dataclass
from typing import TYPE_CHECKING

import pytest
from dirty_equals import IsDatetime, IsStr

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


@dataclass
class SimulatorServiceFixture:
  """Groups the SimulatorService with its dependencies for testing."""

  service: SimulatorService
  manager: SessionManager
  event_repo: EventRepository
  request_queue: RequestQueue
  event_broadcaster: EventBroadcaster


@pytest.fixture
def simulator_service(
  manager: SessionManager,
  event_repo: EventRepository,
) -> SimulatorServiceFixture:
  """Create a SimulatorService with test dependencies."""
  request_queue = RequestQueue()
  event_broadcaster = EventBroadcaster()
  service = SimulatorService(
    session_manager=manager,
    event_repo=event_repo,
    request_queue=request_queue,
    event_broadcaster=event_broadcaster,
  )
  return SimulatorServiceFixture(
    service=service,
    manager=manager,
    event_repo=event_repo,
    request_queue=request_queue,
    event_broadcaster=event_broadcaster,
  )


class TestSimulatorService:
  """Test suite for SimulatorService."""

  def test_service_initialization(
    self, simulator_service: SimulatorServiceFixture
  ) -> None:
    """Test that SimulatorService can be instantiated."""
    assert simulator_service.service is not None

  @pytest.mark.asyncio
  async def test_create_session_success(
    self, simulator_service: SimulatorServiceFixture
  ) -> None:
    """Test that create_session creates a session successfully."""
    request = CreateSessionRequest(description="test session")

    response = await simulator_service.service.create_session(request)

    assert response.session.id == IsStr()
    assert response.session.description == "test session"
    assert response.session.created_at == IsDatetime()

  @pytest.mark.asyncio
  async def test_list_sessions_success(
    self, simulator_service: SimulatorServiceFixture
  ) -> None:
    """Test that list_sessions returns sessions successfully."""
    # Create some sessions
    await simulator_service.manager.create_session("session 1")
    await simulator_service.manager.create_session("session 2")

    request = ListSessionsRequest(page_size=10)
    response = await simulator_service.service.list_sessions(request)

    assert len(response.sessions) == 2
    # Most recent first
    assert response.sessions[0].id == IsStr()
    assert response.sessions[0].description == "session 2"
    assert response.sessions[0].created_at == IsDatetime()
    assert response.sessions[1].id == IsStr()
    assert response.sessions[1].description == "session 1"
    assert response.sessions[1].created_at == IsDatetime()
    assert response.next_page_token == ""

  @pytest.mark.asyncio
  async def test_submit_request_success(
    self, simulator_service: SimulatorServiceFixture
  ) -> None:
    """Test that submit_request processes the request successfully."""
    # Create a session first
    session = await simulator_service.manager.create_session("test session")

    # Subscribe to events to verify broadcast
    events = []

    async def subscriber() -> None:
      async for event in simulator_service.event_broadcaster.subscribe(
        session.id, _empty_history
      ):
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

    response = await simulator_service.service.submit_request(request)

    assert response.event_id == IsStr()

    # Verify event in repo
    stored_events = await simulator_service.event_repo.get_by_session(session.id)
    assert len(stored_events) == 1
    assert stored_events[0].event_id == response.event_id
    assert stored_events[0].llm_request == GenerateContentRequest()

    # Verify event in queue
    queued_event = simulator_service.request_queue.get_current(session.id)
    assert queued_event is not None
    assert queued_event.event_id == response.event_id

    # Verify broadcast
    await asyncio.wait_for(subscriber_task, timeout=1.0)
    assert len(events) == 1
    assert events[0].event_id == response.event_id

  @pytest.mark.asyncio
  async def test_list_sessions_pagination(
    self, simulator_service: SimulatorServiceFixture
  ) -> None:
    """Test that list_sessions handles pagination correctly."""
    # Create 3 sessions
    await simulator_service.manager.create_session("session 1")
    await simulator_service.manager.create_session("session 2")
    await simulator_service.manager.create_session("session 3")

    # Request page size 2
    request = ListSessionsRequest(page_size=2)
    response = await simulator_service.service.list_sessions(request)

    assert len(response.sessions) == 2
    assert response.sessions[0].id == IsStr()
    assert response.sessions[0].description == "session 3"
    assert response.sessions[0].created_at == IsDatetime()
    assert response.sessions[1].id == IsStr()
    assert response.sessions[1].description == "session 2"
    assert response.sessions[1].created_at == IsDatetime()
    assert response.next_page_token == IsStr()

    # Request next page
    request = ListSessionsRequest(page_size=2, page_token=response.next_page_token)
    response = await simulator_service.service.list_sessions(request)

    assert len(response.sessions) == 1
    assert response.sessions[0].id == IsStr()
    assert response.sessions[0].description == "session 1"
    assert response.sessions[0].created_at == IsDatetime()
    assert response.next_page_token == ""
