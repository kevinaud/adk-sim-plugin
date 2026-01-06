"""E2E test for Plugin integration with ADK Agent.

This module tests the full integration loop:
ADK Agent → Plugin → Real gRPC Server (Dockerized) → SimulatedHuman → Plugin → ADK Agent

T053-T059 [ph3f12]
"""

import asyncio
import contextlib
import logging
from typing import TYPE_CHECKING

import betterproto
import pytest
from hamcrest import assert_that, contains_string

from adk_agent_sim.generated.adksim.v1 import (
  SimulatorServiceStub,
  SubmitDecisionRequest,
  SubscribeRequest,
)
from adk_agent_sim.generated.google.ai.generativelanguage.v1beta import (
  Candidate,
  Content,
  GenerateContentResponse,
  Part,
)
from adk_agent_sim.plugin import SimulatorPlugin

if TYPE_CHECKING:
  from grpclib.client import Channel

logger = logging.getLogger(__name__)


class SimulatedHuman:
  """Simulates a human user approving requests via the gRPC API.

  This class acts as the frontend UI logic, subscribing to session events
  and auto-responding to any llm_request with a predefined response.

  T053: Create `SimulatedHuman` helper class with `__init__(stub, session_id)`
  T054: Implement `run_background_loop()` that subscribes and auto-responds
  """

  AUTO_RESPONSE_TEXT = "Approved by Auto-Responder"

  def __init__(self, stub: SimulatorServiceStub, session_id: str) -> None:
    """Initialize with server stub and session to monitor.

    Args:
        stub: The gRPC service stub for simulator operations.
        session_id: The session ID to subscribe to.
    """
    self._stub = stub
    self._session_id = session_id
    self._logger = logging.getLogger(__name__)
    self._stop_flag = False

  def stop(self) -> None:
    """Signal the background loop to stop."""
    self._stop_flag = True

  async def run_background_loop(self) -> None:
    """Subscribe to events and auto-respond to llm_requests.

    This method:
    1. Subscribes to the session's event stream
    2. Waits for llm_request events
    3. Constructs a GenerateContentResponse with self.AUTO_RESPONSE_TEXT
    4. Submits the decision via submit_decision RPC

    The loop exits when stop() is called or the task is cancelled.
    """
    try:
      async for response in self._stub.subscribe(
        SubscribeRequest(session_id=self._session_id)
      ):
        if self._stop_flag:
          break

        event = response.event

        # Check for llm_request payload using betterproto's which_one_of
        field_name, _ = betterproto.which_one_of(event, "payload")

        if field_name == "llm_request":
          self._logger.info(
            "SimulatedHuman: Received request for turn_id=%s",
            event.turn_id,
          )

          # Construct dummy GenerateContentResponse
          auto_response = GenerateContentResponse(
            candidates=[
              Candidate(
                content=Content(
                  parts=[Part(text=self.AUTO_RESPONSE_TEXT)],
                  role="model",
                ),
                index=0,
              )
            ]
          )

          # Submit the decision
          await self._stub.submit_decision(
            SubmitDecisionRequest(
              session_id=self._session_id,
              turn_id=event.turn_id,
              response=auto_response,
            )
          )

          self._logger.info(
            "SimulatedHuman: Submitted decision for turn_id=%s",
            event.turn_id,
          )

    except asyncio.CancelledError:
      self._logger.debug("SimulatedHuman background loop cancelled")
      raise


@pytest.mark.e2e
async def test_agent_interception_flow(
  grpc_channel: Channel,
  simulator_server: tuple[str, int],
) -> None:
  """Test full ADK Agent → Plugin → Server → Human → Agent loop.

  This test verifies that:
  1. The Plugin intercepts the agent's LLM call
  2. The request reaches the server and is streamed to subscribers
  3. The SimulatedHuman responds with an auto-generated response
  4. The agent receives the response and completes
  5. The final response text matches what SimulatedHuman sent

  Uses a 30-second timeout to detect hangs.

  T055: Create `test_agent_interception_flow()` async test function
  T056: Setup Plugin with `server_url` and call `initialize()`
  T057: Setup `LlmAgent` and runner with plugin injection
  T058: Execute agent concurrently with SimulatedHuman background loop
  T059: Assert agent's final response contains auto-response text
  """
  # Lazy imports to avoid import errors if ADK not installed
  from google.adk.agents import LlmAgent
  from google.adk.runners import Runner
  from google.adk.sessions import InMemorySessionService
  from google.genai import types

  host, port = simulator_server
  server_url = f"{host}:{port}"

  # Step A: Setup Plugin - let plugin create its own session
  plugin = SimulatorPlugin(server_url=server_url)
  await plugin.initialize(description="E2E Plugin Integration Test")
  session_id = plugin.session_id
  assert session_id is not None, "Plugin should have created a session"

  # Step B: Setup SimulatedHuman attached to plugin's session
  stub = SimulatorServiceStub(grpc_channel)
  human = SimulatedHuman(stub, session_id)
  human_task = asyncio.create_task(human.run_background_loop())

  # Small delay to ensure subscription is active
  await asyncio.sleep(0.1)

  # Step C: Setup ADK Agent and Runner with Plugin
  agent = LlmAgent(
    name="test_subject",
    model="gemini-2.0-flash",  # Won't actually be called - intercepted
    instruction="Say hello",
  )

  session_service = InMemorySessionService()
  runner = Runner(
    app_name="e2e_plugin_test",
    agent=agent,
    session_service=session_service,
  )
  # Register the plugin
  runner.plugins.append(plugin)

  # Step D: Create session and run agent with timeout
  adk_session = await session_service.create_session(
    app_name="e2e_plugin_test",
    user_id="test_user",
  )

  responses: list = []
  try:
    async with asyncio.timeout(30):  # 30 second safety timeout
      async for event in runner.run_async(
        user_id="test_user",
        session_id=adk_session.id,
        new_message=types.Content(
          role="user",
          parts=[types.Part.from_text(text="Start the test")],
        ),
      ):
        responses.append(event)
        logger.info("Agent yielded event: %s", type(event).__name__)
  finally:
    # Cleanup
    human.stop()
    human_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
      await human_task
    await plugin.close()

  # Step E: Assertions
  # The agent should have completed and produced at least one response
  assert len(responses) > 0, "Agent should have produced at least one event"

  # Find the final model response text
  # ADK events vary by version; look for content with text
  final_text = None
  for resp in reversed(responses):
    if hasattr(resp, "content") and resp.content:
      for part in resp.content.parts:
        if hasattr(part, "text") and part.text:
          final_text = part.text
          break
    if final_text:
      break

  assert final_text is not None, "Agent should have produced a text response"
  assert_that(final_text, contains_string(SimulatedHuman.AUTO_RESPONSE_TEXT))
