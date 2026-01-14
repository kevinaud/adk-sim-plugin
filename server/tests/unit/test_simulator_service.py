"""Tests for SimulatorService."""

import asyncio
from dataclasses import dataclass

import pytest
from adk_sim_protos.adksim.v1 import (
  CreateSessionRequest,
  ListSessionsRequest,
  SessionEvent,
  SubmitDecisionRequest,
  SubmitDecisionResponse,
  SubmitRequestRequest,
  SubscribeRequest,
  SubscribeResponse,
)
from adk_sim_protos.google.ai.generativelanguage.v1beta import (
  GenerateContentRequest,
  GenerateContentResponse,
)
from adk_sim_server.broadcaster import EventBroadcaster
from adk_sim_server.persistence.event_repo import EventRepository
from adk_sim_server.queue import RequestQueue
from adk_sim_server.services.simulator_service import SimulatorService
from adk_sim_server.session_manager import SessionManager
from hamcrest import assert_that, has_properties, instance_of


async def _empty_history() -> list[SessionEvent]:
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

    assert_that(
      response.session,
      has_properties(id=instance_of(str), description="test session"),
    )

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
    assert_that(
      response.sessions[0],
      has_properties(id=instance_of(str), description="session 2"),
    )
    assert_that(
      response.sessions[1],
      has_properties(id=instance_of(str), description="session 1"),
    )
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

    assert_that(response, has_properties(event_id=instance_of(str)))

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
    assert_that(
      response.sessions[0],
      has_properties(id=instance_of(str), description="session 3"),
    )
    assert_that(
      response.sessions[1],
      has_properties(id=instance_of(str), description="session 2"),
    )
    assert_that(response, has_properties(next_page_token=instance_of(str)))

    # Request next page
    request = ListSessionsRequest(page_size=2, page_token=response.next_page_token)
    response = await simulator_service.service.list_sessions(request)

    assert len(response.sessions) == 1
    assert_that(
      response.sessions[0],
      has_properties(id=instance_of(str), description="session 1"),
    )
    assert response.next_page_token == ""

  @pytest.mark.asyncio
  async def test_submit_decision_success(
    self, simulator_service: SimulatorServiceFixture
  ) -> None:
    """Test that submit_decision stores event, dequeues request, and broadcasts."""
    # Create a session first
    session = await simulator_service.manager.create_session("test session")

    # Submit a request first to have something in the queue
    await simulator_service.service.submit_request(
      SubmitRequestRequest(
        session_id=session.id,
        turn_id="turn_1",
        agent_name="test_agent",
        request=GenerateContentRequest(),
      )
    )

    # Verify request is in queue
    assert simulator_service.request_queue.get_current(session.id) is not None

    # Subscribe to events to verify broadcast
    events: list[SessionEvent] = []

    async def subscriber() -> None:
      async for event in simulator_service.event_broadcaster.subscribe(
        session.id, _empty_history
      ):
        events.append(event)
        if len(events) >= 1:
          break

    subscriber_task = asyncio.create_task(subscriber())
    await asyncio.sleep(0.01)

    # Submit decision
    decision_request = SubmitDecisionRequest(
      session_id=session.id,
      turn_id="turn_1",
      response=GenerateContentResponse(),
    )

    response = await simulator_service.service.submit_decision(decision_request)

    # Verify response
    assert_that(response, instance_of(SubmitDecisionResponse))
    assert_that(response, has_properties(event_id=instance_of(str)))

    # Verify event stored in repo (should be 2 events: request + decision)
    stored_events = await simulator_service.event_repo.get_by_session(session.id)
    assert len(stored_events) == 2
    decision_event = stored_events[1]
    assert decision_event.event_id == response.event_id
    assert decision_event.llm_response == GenerateContentResponse()
    # Decision events don't have an agent_name (they come from UI, not an agent)
    assert decision_event.agent_name == ""

    # Verify queue was dequeued
    assert simulator_service.request_queue.get_current(session.id) is None

    # Verify broadcast
    await asyncio.wait_for(subscriber_task, timeout=1.0)
    assert len(events) == 1
    assert events[0].event_id == response.event_id

  @pytest.mark.asyncio
  async def test_submit_decision_links_by_turn_id(
    self, simulator_service: SimulatorServiceFixture
  ) -> None:
    """Test that the decision event links to request via turn_id."""
    session = await simulator_service.manager.create_session("test session")

    # Submit request with specific turn_id
    turn_id = "correlation_turn_123"
    await simulator_service.service.submit_request(
      SubmitRequestRequest(
        session_id=session.id,
        turn_id=turn_id,
        agent_name="test_agent",
        request=GenerateContentRequest(),
      )
    )

    # Submit decision with same turn_id
    response = await simulator_service.service.submit_decision(
      SubmitDecisionRequest(
        session_id=session.id,
        turn_id=turn_id,
        response=GenerateContentResponse(),
      )
    )

    # Verify both events share the same turn_id
    stored_events = await simulator_service.event_repo.get_by_session(session.id)
    assert len(stored_events) == 2

    request_event = stored_events[0]
    decision_event = stored_events[1]

    assert request_event.turn_id == turn_id
    assert decision_event.turn_id == turn_id
    assert decision_event.event_id == response.event_id

  @pytest.mark.asyncio
  async def test_subscribe_yields_historical_events(
    self, simulator_service: SimulatorServiceFixture
  ) -> None:
    """Test that subscribe yields historical events first."""
    session = await simulator_service.manager.create_session("test session")

    # Create some historical events by submitting requests
    await simulator_service.service.submit_request(
      SubmitRequestRequest(
        session_id=session.id,
        turn_id="turn_1",
        agent_name="agent1",
        request=GenerateContentRequest(),
      )
    )
    await simulator_service.service.submit_request(
      SubmitRequestRequest(
        session_id=session.id,
        turn_id="turn_2",
        agent_name="agent2",
        request=GenerateContentRequest(),
      )
    )

    # Subscribe and collect events
    events: list[SessionEvent] = []
    subscribe_request = SubscribeRequest(session_id=session.id)

    async def collect_events() -> None:
      async for response in simulator_service.service.subscribe(subscribe_request):
        assert_that(response, instance_of(SubscribeResponse))
        events.append(response.event)
        if len(events) >= 2:
          break

    await asyncio.wait_for(collect_events(), timeout=1.0)

    # Verify we got the historical events
    assert len(events) == 2
    assert events[0].turn_id == "turn_1"
    assert events[0].agent_name == "agent1"
    assert events[1].turn_id == "turn_2"
    assert events[1].agent_name == "agent2"

  @pytest.mark.asyncio
  async def test_subscribe_yields_live_events(
    self, simulator_service: SimulatorServiceFixture
  ) -> None:
    """Test that subscribe yields live events after history."""
    session = await simulator_service.manager.create_session("test session")

    # Create one historical event
    await simulator_service.service.submit_request(
      SubmitRequestRequest(
        session_id=session.id,
        turn_id="historical_turn",
        agent_name="historical_agent",
        request=GenerateContentRequest(),
      )
    )

    events: list[SessionEvent] = []
    subscribe_request = SubscribeRequest(session_id=session.id)

    async def collect_events() -> None:
      async for response in simulator_service.service.subscribe(subscribe_request):
        events.append(response.event)
        if len(events) >= 2:
          break

    # Start subscriber
    subscriber_task = asyncio.create_task(collect_events())
    await asyncio.sleep(0.01)

    # Broadcast a live event
    await simulator_service.service.submit_request(
      SubmitRequestRequest(
        session_id=session.id,
        turn_id="live_turn",
        agent_name="live_agent",
        request=GenerateContentRequest(),
      )
    )

    await asyncio.wait_for(subscriber_task, timeout=1.0)

    # Verify we got historical first, then live
    assert len(events) == 2
    assert events[0].turn_id == "historical_turn"
    assert events[1].turn_id == "live_turn"

  @pytest.mark.asyncio
  async def test_subscribe_streams_all_events_atomically(
    self, simulator_service: SimulatorServiceFixture
  ) -> None:
    """Test no events are missed between history and live subscription."""
    session = await simulator_service.manager.create_session("test session")

    # Create initial historical event
    await simulator_service.service.submit_request(
      SubmitRequestRequest(
        session_id=session.id,
        turn_id="event_1",
        agent_name="agent",
        request=GenerateContentRequest(),
      )
    )

    events: list[SessionEvent] = []
    subscribe_request = SubscribeRequest(session_id=session.id)

    async def collect_events() -> None:
      async for response in simulator_service.service.subscribe(subscribe_request):
        events.append(response.event)
        if len(events) >= 3:
          break

    # Start subscriber
    subscriber_task = asyncio.create_task(collect_events())
    await asyncio.sleep(0.01)

    # Broadcast two more events in quick succession
    await simulator_service.service.submit_request(
      SubmitRequestRequest(
        session_id=session.id,
        turn_id="event_2",
        agent_name="agent",
        request=GenerateContentRequest(),
      )
    )
    await simulator_service.service.submit_request(
      SubmitRequestRequest(
        session_id=session.id,
        turn_id="event_3",
        agent_name="agent",
        request=GenerateContentRequest(),
      )
    )

    await asyncio.wait_for(subscriber_task, timeout=1.0)

    # Verify all events received in order, none missed
    assert len(events) == 3
    assert events[0].turn_id == "event_1"
    assert events[1].turn_id == "event_2"
    assert events[2].turn_id == "event_3"
