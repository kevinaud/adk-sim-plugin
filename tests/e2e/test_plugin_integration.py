"""E2E test for Plugin integration with ADK Agent.

This module tests the full integration loop:
ADK Agent → Plugin → Real gRPC Server (Dockerized) → SimulatedHuman → Plugin → ADK Agent

T053-T059 [ph3f12]
"""

import asyncio
import contextlib
import logging
from typing import TYPE_CHECKING

import pytest
from google.adk.agents import LlmAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from hamcrest import assert_that, contains_string

from adk_agent_sim.generated.adksim.v1 import SimulatorServiceStub
from adk_agent_sim.generated.google.ai.generativelanguage.v1beta import (
  Candidate,
  Content,
  GenerateContentResponse,
  Part,
)
from adk_agent_sim.plugin import SimulatorPlugin
from tests.e2e.simulated_human import SimulatedHuman

if TYPE_CHECKING:
  from grpclib.client import Channel

logger = logging.getLogger(__name__)


@pytest.mark.e2e
async def test_agent_interception_flow(
  grpc_channel: Channel,
  simulator_server: tuple[str, int],
) -> None:
  """Test full ADK Agent → Plugin → Server → Human → Agent loop.

  This test verifies that:
  1. The Plugin intercepts the agent's LLM call
  2. The request reaches the server and is streamed to subscribers
  3. The SimulatedHuman responds with a configured response
  4. The agent receives the response and completes
  5. The final response text matches what SimulatedHuman sent

  Uses a 30-second timeout to detect hangs.

  T055: Create `test_agent_interception_flow()` async test function
  T056: Setup Plugin with `server_url` and call `initialize()`
  T057: Setup `LlmAgent` and runner with plugin injection
  T058: Execute agent concurrently with SimulatedHuman background loop
  T059: Assert agent's final response contains auto-response text
  """
  host, port = simulator_server
  server_url = f"{host}:{port}"

  # Configure the response that SimulatedHuman will send
  expected_response_text = "Approved by Auto-Responder"
  configured_responses = [
    GenerateContentResponse(
      candidates=[
        Candidate(
          content=Content(
            parts=[Part(text=expected_response_text)],
            role="model",
          ),
          index=0,
        )
      ]
    )
  ]

  # Step A: Setup Plugin - let plugin create its own session
  plugin = SimulatorPlugin(server_url=server_url)
  await plugin.initialize(description="E2E Plugin Integration Test")
  session_id = plugin.session_id
  assert session_id is not None, "Plugin should have created a session"

  # Step B: Setup SimulatedHuman attached to plugin's session
  stub = SimulatorServiceStub(grpc_channel)
  human = SimulatedHuman(stub, session_id, responses=configured_responses)
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
  runner.plugins.append(plugin)

  # Step D: Create session and run agent with timeout
  adk_session = await session_service.create_session(
    app_name="e2e_plugin_test",
    user_id="test_user",
  )

  responses: list = []
  try:
    async with asyncio.timeout(30):
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
    human.stop()
    human_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
      await human_task
    await plugin.close()

  # Step E: Assertions
  # Verify SimulatedHuman sent all expected responses
  human.assert_all_responses_sent()

  # The agent should have completed and produced at least one response
  assert len(responses) > 0, "Agent should have produced at least one event"

  # Find the final model response text
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
  assert_that(final_text, contains_string(expected_response_text))
