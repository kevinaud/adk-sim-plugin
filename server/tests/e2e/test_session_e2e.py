"""E2E tests for session management RPCs."""

from typing import TYPE_CHECKING

import pytest
from adk_sim_protos.adksim.v1 import (
  CreateSessionRequest,
  ListSessionsRequest,
  SimulatorServiceStub,
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
async def test_create_session_e2e(grpc_channel: Channel) -> None:
  """Verify session creation via gRPC returns valid session."""
  stub = SimulatorServiceStub(grpc_channel)

  # Create a session with a description
  description = "E2E test session for create"
  response = await stub.create_session(CreateSessionRequest(description=description))

  # Verify response contains session_id
  assert_that(response.session, is_not(none()))
  assert_that(response.session.id, has_length(greater_than(0)))

  # Verify session.description matches input
  assert_that(response.session.description, is_(description))


@pytest.mark.e2e
async def test_list_sessions_e2e(grpc_channel: Channel) -> None:
  """Verify created sessions appear in list_sessions response."""
  stub = SimulatorServiceStub(grpc_channel)

  # Create 3 sessions with unique descriptions
  descriptions = [
    "E2E list test session 1",
    "E2E list test session 2",
    "E2E list test session 3",
  ]
  created_ids: list[str] = []

  for desc in descriptions:
    response = await stub.create_session(CreateSessionRequest(description=desc))
    created_ids.append(response.session.id)

  # Call list_sessions
  list_response = await stub.list_sessions(ListSessionsRequest(page_size=100))

  # Verify all created sessions appear in the list
  listed_ids = [s.id for s in list_response.sessions]
  for session_id in created_ids:
    assert_that(
      session_id in listed_ids,
      is_(True),
      f"Session {session_id} not found in list",
    )

  # Verify descriptions match
  listed_sessions = {s.id: s for s in list_response.sessions}
  for session_id, desc in zip(created_ids, descriptions, strict=True):
    assert_that(listed_sessions[session_id].description, is_(desc))
