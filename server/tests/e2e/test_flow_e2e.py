"""E2E tests for the request/decision/subscribe flow."""

import asyncio
from typing import TYPE_CHECKING

import pytest
from adk_sim_protos.adksim.v1 import (
  CreateSessionRequest,
  SessionEvent,
  SimulatorServiceStub,
  SubmitDecisionRequest,
  SubmitRequestRequest,
  SubscribeRequest,
)
from adk_sim_protos.google.ai.generativelanguage.v1beta import (
  GenerateContentRequest,
  GenerateContentResponse,
)
from hamcrest import (
  assert_that,
  greater_than,
  has_length,
  is_,
  is_not,
  none,
)

if TYPE_CHECKING:
  from grpclib.client import Channel


@pytest.mark.e2e
async def test_submit_request_e2e(grpc_channel: Channel) -> None:
  """Verify request submission returns an event ID.

  T047: Create session, submit request with turn_id,
  verify response contains event_id.
  """
  stub = SimulatorServiceStub(grpc_channel)

  # Create a session first
  session_response = await stub.create_session(
    CreateSessionRequest(description="E2E submit_request test")
  )
  session_id = session_response.session.id
  assert_that(session_id, has_length(greater_than(0)))

  # Submit a request with turn_id
  turn_id = "e2e_turn_001"
  request_response = await stub.submit_request(
    SubmitRequestRequest(
      session_id=session_id,
      turn_id=turn_id,
      agent_name="e2e_test_agent",
      request=GenerateContentRequest(),
    )
  )

  # Verify response contains event_id
  assert_that(request_response.event_id, is_not(none()))
  assert_that(request_response.event_id, has_length(greater_than(0)))


@pytest.mark.e2e
async def test_submit_decision_e2e(grpc_channel: Channel) -> None:
  """Verify decision resolves pending request.

  T048: Create session, submit request, submit decision,
  verify the decision is acknowledged with event_id.
  """
  stub = SimulatorServiceStub(grpc_channel)

  # Create a session
  session_response = await stub.create_session(
    CreateSessionRequest(description="E2E submit_decision test")
  )
  session_id = session_response.session.id

  # Submit a request first
  turn_id = "e2e_turn_decision_001"
  await stub.submit_request(
    SubmitRequestRequest(
      session_id=session_id,
      turn_id=turn_id,
      agent_name="e2e_decision_agent",
      request=GenerateContentRequest(),
    )
  )

  # Submit decision for that request
  decision_response = await stub.submit_decision(
    SubmitDecisionRequest(
      session_id=session_id,
      turn_id=turn_id,
      response=GenerateContentResponse(),
    )
  )

  # Verify decision is acknowledged with event_id
  assert_that(decision_response.event_id, is_not(none()))
  assert_that(decision_response.event_id, has_length(greater_than(0)))


@pytest.mark.e2e
async def test_subscribe_receives_events_e2e(grpc_channel: Channel) -> None:
  """Verify streaming events via Subscribe.

  T049: Create session, start subscribe stream, submit a request,
  verify the subscribe stream receives the request event.
  """
  stub = SimulatorServiceStub(grpc_channel)

  # Create a session
  session_response = await stub.create_session(
    CreateSessionRequest(description="E2E subscribe test")
  )
  session_id = session_response.session.id

  # Collect events from subscribe stream
  received_events: list[SessionEvent] = []
  turn_id = "e2e_turn_subscribe_001"

  async def subscribe_collector() -> None:
    """Collect events from the subscribe stream."""
    async for response in stub.subscribe(SubscribeRequest(session_id=session_id)):
      received_events.append(response.event)
      # Stop after receiving the expected event
      if response.event.turn_id == turn_id:
        break

  # Start subscriber in background
  subscriber_task = asyncio.create_task(subscribe_collector())

  # Give subscriber time to connect
  await asyncio.sleep(0.1)

  # Submit a request
  await stub.submit_request(
    SubmitRequestRequest(
      session_id=session_id,
      turn_id=turn_id,
      agent_name="e2e_subscribe_agent",
      request=GenerateContentRequest(),
    )
  )

  # Wait for subscriber to receive event
  await asyncio.wait_for(subscriber_task, timeout=5.0)

  # Verify we received the event
  assert_that(len(received_events), is_(greater_than(0)))
  event = received_events[-1]
  assert_that(event.turn_id, is_(turn_id))
  assert_that(event.agent_name, is_("e2e_subscribe_agent"))


@pytest.mark.e2e
async def test_full_round_trip_e2e(grpc_channel: Channel) -> None:
  """Verify complete request→decision→event flow.

  T050: Create session, start subscribe stream in background,
  submit request → wait for request event,
  submit decision → wait for decision event,
  verify full flow completes.
  """
  stub = SimulatorServiceStub(grpc_channel)

  # Create a session
  session_response = await stub.create_session(
    CreateSessionRequest(description="E2E full round trip test")
  )
  session_id = session_response.session.id

  turn_id = "e2e_turn_roundtrip_001"
  received_events: list[SessionEvent] = []

  async def subscribe_collector() -> None:
    """Collect events from the subscribe stream."""
    async for response in stub.subscribe(SubscribeRequest(session_id=session_id)):
      received_events.append(response.event)
      # Stop after receiving both request and decision events (2 events)
      if len(received_events) >= 2:
        break

  # Start subscriber in background
  subscriber_task = asyncio.create_task(subscribe_collector())

  # Give subscriber time to connect
  await asyncio.sleep(0.1)

  # Submit request
  request_response = await stub.submit_request(
    SubmitRequestRequest(
      session_id=session_id,
      turn_id=turn_id,
      agent_name="e2e_roundtrip_agent",
      request=GenerateContentRequest(),
    )
  )
  assert_that(request_response.event_id, has_length(greater_than(0)))

  # Wait briefly for request event to be received
  await asyncio.sleep(0.1)

  # Submit decision
  decision_response = await stub.submit_decision(
    SubmitDecisionRequest(
      session_id=session_id,
      turn_id=turn_id,
      response=GenerateContentResponse(),
    )
  )
  assert_that(decision_response.event_id, has_length(greater_than(0)))

  # Wait for subscriber to receive both events
  await asyncio.wait_for(subscriber_task, timeout=5.0)

  # Verify we received both events
  assert_that(len(received_events), is_(2))

  # First event should be the request
  request_event = received_events[0]
  assert_that(request_event.turn_id, is_(turn_id))
  assert_that(request_event.agent_name, is_("e2e_roundtrip_agent"))
  assert_that(request_event.event_id, is_(request_response.event_id))

  # Second event should be the decision
  decision_event = received_events[1]
  assert_that(decision_event.turn_id, is_(turn_id))
  # Decision events don't have an agent_name (they come from UI, not an agent)
  assert_that(decision_event.agent_name, is_(""))
  assert_that(decision_event.event_id, is_(decision_response.event_id))


@pytest.mark.e2e
async def test_fifo_ordering_e2e(grpc_channel: Channel) -> None:
  """Verify parallel requests are queued in FIFO order.

  T051: Create session, submit 3 requests rapidly,
  verify requests are processed in FIFO order.
  The first request that gets its decision processed
  should be the first one submitted.
  """
  stub = SimulatorServiceStub(grpc_channel)

  # Create a session
  session_response = await stub.create_session(
    CreateSessionRequest(description="E2E FIFO ordering test")
  )
  session_id = session_response.session.id

  # Submit 3 requests in quick succession
  turn_ids = ["e2e_fifo_turn_001", "e2e_fifo_turn_002", "e2e_fifo_turn_003"]
  request_event_ids: list[str] = []

  for i, turn_id in enumerate(turn_ids):
    response = await stub.submit_request(
      SubmitRequestRequest(
        session_id=session_id,
        turn_id=turn_id,
        agent_name=f"e2e_fifo_agent_{i + 1}",
        request=GenerateContentRequest(),
      )
    )
    request_event_ids.append(response.event_id)

  # Collect events via subscribe to verify ordering
  received_events: list[SessionEvent] = []

  async def subscribe_collector() -> None:
    """Collect events from the subscribe stream."""
    async for response in stub.subscribe(SubscribeRequest(session_id=session_id)):
      received_events.append(response.event)
      # Collect historical events (3 requests) + 3 decisions = 6 total
      if len(received_events) >= 6:
        break

  # Start subscriber in background
  subscriber_task = asyncio.create_task(subscribe_collector())

  # Give subscriber time to connect and receive historical events
  await asyncio.sleep(0.2)

  # Submit decisions in order (first request gets first decision)
  # The queue should process them in FIFO order
  decision_event_ids: list[str] = []
  for turn_id in turn_ids:
    response = await stub.submit_decision(
      SubmitDecisionRequest(
        session_id=session_id,
        turn_id=turn_id,
        response=GenerateContentResponse(),
      )
    )
    decision_event_ids.append(response.event_id)
    # Small delay to ensure ordering
    await asyncio.sleep(0.05)

  # Wait for subscriber to receive all events
  await asyncio.wait_for(subscriber_task, timeout=5.0)

  # Verify we received all 6 events (3 requests + 3 decisions)
  assert_that(len(received_events), is_(6))

  # First 3 should be requests in order
  for i in range(3):
    assert_that(received_events[i].turn_id, is_(turn_ids[i]))
    assert_that(received_events[i].event_id, is_(request_event_ids[i]))

  # Last 3 should be decisions in order
  for i in range(3):
    assert_that(received_events[i + 3].turn_id, is_(turn_ids[i]))
    assert_that(received_events[i + 3].event_id, is_(decision_event_ids[i]))
    # Decision events don't have an agent_name (they come from UI, not an agent)
    assert_that(received_events[i + 3].agent_name, is_(""))
