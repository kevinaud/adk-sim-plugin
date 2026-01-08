"""SimulatedHuman helper for E2E tests.

Simulates a human user interacting with the simulator via gRPC,
auto-responding to LLM requests with pre-configured responses.
"""

import asyncio
import logging
from typing import TYPE_CHECKING

import betterproto
from adk_sim_protos.adksim.v1 import (
  SubmitDecisionRequest,
  SubscribeRequest,
)

if TYPE_CHECKING:
  from adk_sim_protos.adksim.v1 import (
    SimulatorServiceStub,
  )
  from adk_sim_protos.google.ai.generativelanguage.v1beta import (
    GenerateContentRequest,
    GenerateContentResponse,
  )

logger = logging.getLogger(__name__)


class SimulatedHuman:
  """Simulates a human user approving requests via the gRPC API.

  This class acts as the frontend UI logic, subscribing to session events
  and auto-responding to llm_requests with pre-configured responses.

  Attributes:
      requests_received: List of GenerateContentRequest objects received.
      responses_sent: List of GenerateContentResponse objects that were sent.
  """

  def __init__(
    self,
    stub: SimulatorServiceStub,
    session_id: str,
    responses: list[GenerateContentResponse],
  ) -> None:
    """Initialize with server stub, session, and responses to send.

    Args:
        stub: The gRPC service stub for simulator operations.
        session_id: The session ID to subscribe to.
        responses: List of responses to send in order. Must have at least
                   as many responses as requests that will be received.
    """
    self._stub = stub
    self._session_id = session_id
    self._responses = responses
    self._response_index = 0
    self._stop_flag = False

    # Tracking for assertions
    self.requests_received: list[GenerateContentRequest] = []
    self.responses_sent: list[GenerateContentResponse] = []

  def stop(self) -> None:
    """Signal the background loop to stop."""
    self._stop_flag = True

  async def run_background_loop(self) -> None:
    """Subscribe to events and auto-respond to llm_requests.

    This method:
    1. Subscribes to the session's event stream
    2. Waits for llm_request events
    3. Responds with the next configured response
    4. Submits the decision via submit_decision RPC

    Raises:
        RuntimeError: If more requests are received than responses configured.
    """
    try:
      async for response in self._stub.subscribe(
        SubscribeRequest(session_id=self._session_id)
      ):
        if self._stop_flag:
          break

        event = response.event
        field_name, payload = betterproto.which_one_of(event, "payload")

        if field_name == "llm_request" and payload is not None:
          # Check if we have a response available
          if self._response_index >= len(self._responses):
            raise RuntimeError(
              f"SimulatedHuman received more requests ({self._response_index + 1}) "
              f"than configured responses ({len(self._responses)})"
            )

          # Track the request
          self.requests_received.append(payload)

          logger.info(
            "SimulatedHuman: Received request %d for turn_id=%s",
            self._response_index + 1,
            event.turn_id,
          )

          # Get next response
          auto_response = self._responses[self._response_index]
          self._response_index += 1

          # Submit the decision
          await self._stub.submit_decision(
            SubmitDecisionRequest(
              session_id=self._session_id,
              turn_id=event.turn_id,
              response=auto_response,
            )
          )

          # Track the response
          self.responses_sent.append(auto_response)

          logger.info(
            "SimulatedHuman: Submitted response %d for turn_id=%s",
            len(self.responses_sent),
            event.turn_id,
          )

    except asyncio.CancelledError:
      logger.debug("SimulatedHuman background loop cancelled")
      raise

  def assert_all_responses_sent(self) -> None:
    """Assert that all configured responses were sent.

    Call this after test execution to verify the expected number of
    request/response exchanges occurred.

    Raises:
        AssertionError: If not all responses were sent.
    """
    if len(self.responses_sent) != len(self._responses):
      raise AssertionError(
        f"Expected {len(self._responses)} responses to be sent, "
        f"but only {len(self.responses_sent)} were sent. "
        f"Requests received: {len(self.requests_received)}"
      )
