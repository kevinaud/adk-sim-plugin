"""E2E test for human-directed tool execution.

This module tests the scenario where a human (acting as the LLM) directs
tool execution and sees the results:
1. User asks a question
2. Human overrides the response to call a specific tool
3. ADK executes the tool and returns the result
4. Human sees the result and provides the final answer
"""

import asyncio
import contextlib
import logging
from typing import TYPE_CHECKING

import pytest
from adk_agent_sim.plugin import SimulatorPlugin
from adk_sim_protos.adksim.v1 import SimulatorServiceStub
from adk_sim_testing.proto_helpers import make_text_response, make_tool_call_response
from adk_sim_testing.simulated_human import SimulatedHuman
from google.adk.agents import LlmAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from hamcrest import assert_that, contains_string

if TYPE_CHECKING:
  from grpclib.client import Channel

logger = logging.getLogger(__name__)


def add(a: int, b: int) -> int:
  """Add two numbers together.

  Args:
      a: First number.
      b: Second number.

  Returns:
      The sum of a and b.
  """
  return a + b


@pytest.mark.e2e
async def test_human_directed_tool_execution(
  grpc_channel: Channel,
  simulator_server: tuple[str, int],
) -> None:
  """Test #1: Verify Human can drive tool execution and see results.

  Scenario:
  1. User: "What is 2 + 2?"
  2. Human (acting as LLM): Overrides logic, says "Call add(50, 50)"
  3. ADK: Executes add(50, 50) -> Returns 100
  4. Human (acting as LLM): Sees result 100, says "The answer is 100"

  This test verifies that:
  - The human can direct the LLM to call a specific tool with specific args
  - The tool is executed correctly by ADK
  - The human receives the tool result and can provide the final response
  - The agent completes with the expected final text
  """
  host, port = simulator_server
  server_url = f"{host}:{port}"

  # Configure the responses that SimulatedHuman will send:
  # 1. First response: call the add tool with args 50, 50
  # 2. Second response: provide the final answer after seeing tool result
  expected_final_text = "The answer is 100"
  configured_responses = [
    make_tool_call_response("add", {"a": 50, "b": 50}),
    make_text_response(expected_final_text),
  ]

  # Step A: Setup Plugin - let plugin create its own session
  plugin = SimulatorPlugin(server_url=server_url)
  await plugin.initialize(description="E2E Tool Execution Test")
  session_id = plugin.session_id
  assert session_id is not None, "Plugin should have created a session"

  # Step B: Setup SimulatedHuman attached to plugin's session
  stub = SimulatorServiceStub(grpc_channel)
  human = SimulatedHuman(stub, session_id, responses=configured_responses)
  human_task = asyncio.create_task(human.run_background_loop())

  # Small delay to ensure subscription is active
  await asyncio.sleep(0.1)

  # Step C: Setup ADK Agent and Runner with Plugin and the add tool
  agent = LlmAgent(
    name="calculator_agent",
    model="gemini-2.0-flash",  # Won't actually be called - intercepted
    instruction="You are a calculator. Use the add tool to add numbers.",
    tools=[add],  # Register the add tool with the agent
  )

  session_service = InMemorySessionService()
  runner = Runner(
    app_name="e2e_tool_execution_test",
    agent=agent,
    session_service=session_service,
    plugins=[plugin],
  )

  # Step D: Create session and run agent with timeout
  adk_session = await session_service.create_session(
    app_name="e2e_tool_execution_test",
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
          parts=[types.Part.from_text(text="What is 2 + 2?")],
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
  # Verify SimulatedHuman sent all expected responses (2 responses)
  human.assert_all_responses_sent()

  # Verify we received at least 2 requests:
  # 1. Initial user question
  # 2. Tool result after executing add(50, 50)
  assert len(human.requests_received) >= 2, (
    f"Expected at least 2 requests, got {len(human.requests_received)}"
  )

  # The agent should have produced at least one response
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
  assert_that(final_text, contains_string("100"))
