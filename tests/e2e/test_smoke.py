"""Smoke test to verify the server is reachable."""

from typing import TYPE_CHECKING

import pytest

from adk_agent_sim.generated.adksim.v1 import (
  CreateSessionRequest,
  SimulatorServiceStub,
)

if TYPE_CHECKING:
  from grpclib.client import Channel


@pytest.mark.e2e
async def test_server_is_reachable(grpc_channel: Channel) -> None:
  """Verify the server accepts gRPC connections and responds to requests."""
  stub = SimulatorServiceStub(grpc_channel)

  # Create a session to verify full round-trip communication
  response = await stub.create_session(
    CreateSessionRequest(description="E2E smoke test session")
  )

  # Verify we got a valid response with a session
  assert response.session is not None
  assert response.session.id != ""
  assert response.session.description == "E2E smoke test session"
