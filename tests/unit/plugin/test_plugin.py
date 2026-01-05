"""Tests for SimulatorPlugin."""

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING

import pytest
from hamcrest import assert_that, equal_to, is_

from adk_agent_sim.generated.adksim.v1 import SessionEvent
from adk_agent_sim.generated.google.ai.generativelanguage.v1beta import (
  Candidate,
  Content,
  GenerateContentRequest,
  GenerateContentResponse,
  Part,
)
from adk_agent_sim.plugin import SimulatorPlugin

if TYPE_CHECKING:
  from collections.abc import AsyncIterator


class TestSimulatorPlugin:
  """Test suite for SimulatorPlugin."""

  def test_plugin_initialization_defaults(self) -> None:
    """Test that SimulatorPlugin uses default values."""
    plugin = SimulatorPlugin()
    assert plugin.server_url == "localhost:50051"
    assert plugin.target_agents == set()
    assert plugin.session_id is None

  def test_plugin_initialization_custom_url(self) -> None:
    """Test that SimulatorPlugin accepts custom server URL."""
    plugin = SimulatorPlugin(server_url="custom:9999")
    assert plugin.server_url == "custom:9999"

  def test_plugin_initialization_target_agents(self) -> None:
    """Test that SimulatorPlugin accepts target agents."""
    plugin = SimulatorPlugin(target_agents={"agent1", "agent2"})
    assert plugin.target_agents == {"agent1", "agent2"}

  def test_should_intercept_all_when_no_targets(self) -> None:
    """Test that all agents are intercepted when no targets specified."""
    plugin = SimulatorPlugin()
    assert plugin.should_intercept("any_agent") is True
    assert plugin.should_intercept("another_agent") is True

  def test_should_intercept_only_targets(self) -> None:
    """Test that only target agents are intercepted."""
    plugin = SimulatorPlugin(target_agents={"orchestrator", "router"})
    assert plugin.should_intercept("orchestrator") is True
    assert plugin.should_intercept("router") is True
    assert plugin.should_intercept("other_agent") is False

  @pytest.mark.asyncio
  async def test_initialize_not_implemented(self) -> None:
    """Test that initialize raises NotImplementedError."""
    plugin = SimulatorPlugin()
    with pytest.raises(NotImplementedError):
      await plugin.initialize()

  @pytest.mark.asyncio
  async def test_before_model_callback_not_implemented(self) -> None:
    """Test that before_model_callback raises NotImplementedError."""
    plugin = SimulatorPlugin()
    with pytest.raises(NotImplementedError):
      await plugin.before_model_callback({}, "test_agent")


@dataclass
class FakeSimulatorClient:
  """Fake SimulatorClient for testing _listen_loop without real gRPC.

  This fake allows tests to control the event stream by providing
  a list of events to yield, and optionally simulating errors.
  """

  events: list[SessionEvent]
  error_after: int | None = None

  async def subscribe(
    self, client_id: str | None = None
  ) -> AsyncIterator[SessionEvent]:
    """Yield configured events, optionally raising an error.

    Args:
        client_id: Ignored in fake implementation.

    Yields:
        SessionEvent objects from the configured events list.

    Raises:
        RuntimeError: If error_after is set and that many events have been yielded.
    """
    for i, event in enumerate(self.events):
      if self.error_after is not None and i >= self.error_after:
        raise RuntimeError("Simulated connection error")
      yield event


def _create_llm_request_event(
  turn_id: str,
  event_id: str = "event-001",
  session_id: str = "session-001",
) -> SessionEvent:
  """Create a SessionEvent with an llm_request payload."""
  return SessionEvent(
    event_id=event_id,
    session_id=session_id,
    timestamp=datetime.now(UTC),
    turn_id=turn_id,
    agent_name="test_agent",
    llm_request=GenerateContentRequest(
      model="gemini-pro",
      contents=[Content(parts=[Part(text="Hello")])],
    ),
  )


def _create_llm_response_event(
  turn_id: str,
  response_text: str = "Human response",
  event_id: str = "event-002",
  session_id: str = "session-001",
) -> SessionEvent:
  """Create a SessionEvent with an llm_response payload."""
  return SessionEvent(
    event_id=event_id,
    session_id=session_id,
    timestamp=datetime.now(UTC),
    turn_id=turn_id,
    agent_name="test_agent",
    llm_response=GenerateContentResponse(
      candidates=[
        Candidate(
          content=Content(
            parts=[Part(text=response_text)],
            role="model",
          )
        )
      ]
    ),
  )


class TestListenLoop:
  """Tests for SimulatorPlugin._listen_loop()."""

  @pytest.mark.asyncio
  async def test_listen_loop_resolves_pending_future_on_llm_response(self) -> None:
    """_listen_loop() resolves pending future when llm_response event arrives."""
    # Arrange
    turn_id = "turn-123"
    response_text = "Hello from human!"
    response_event = _create_llm_response_event(turn_id, response_text)

    fake_client = FakeSimulatorClient(events=[response_event])
    plugin = SimulatorPlugin()
    plugin._client = fake_client  # type: ignore[assignment]

    # Create a pending future for this turn_id
    future = plugin._pending_futures.create(turn_id)

    # Act - run listen loop in background
    listen_task = asyncio.create_task(plugin._listen_loop())

    # Wait for the future to be resolved
    result = await asyncio.wait_for(future, timeout=1.0)

    # Wait for task to complete (stream ends after yielding all events)
    await listen_task

    # Assert
    assert_that(result.candidates[0].content.parts[0].text, equal_to(response_text))

  @pytest.mark.asyncio
  async def test_listen_loop_ignores_llm_request_events(self) -> None:
    """_listen_loop() ignores llm_request events (no error, no resolution)."""
    # Arrange
    turn_id = "turn-123"
    request_event = _create_llm_request_event(turn_id)
    response_event = _create_llm_response_event(turn_id)

    fake_client = FakeSimulatorClient(events=[request_event, response_event])
    plugin = SimulatorPlugin()
    plugin._client = fake_client  # type: ignore[assignment]

    # Create pending future
    future = plugin._pending_futures.create(turn_id)

    # Act
    listen_task = asyncio.create_task(plugin._listen_loop())
    result = await asyncio.wait_for(future, timeout=1.0)

    # Wait for task to complete
    await listen_task

    # Assert - future was resolved by the response, not affected by request
    assert_that(result.candidates[0].content.parts[0].text, equal_to("Human response"))

  @pytest.mark.asyncio
  async def test_listen_loop_handles_already_resolved_turn_id_idempotently(
    self,
  ) -> None:
    """_listen_loop() ignores llm_response for already-resolved turn_id."""
    # Arrange
    turn_id = "turn-123"
    response_event1 = _create_llm_response_event(
      turn_id, "First response", event_id="event-001"
    )
    response_event2 = _create_llm_response_event(
      turn_id, "Duplicate response", event_id="event-002"
    )

    fake_client = FakeSimulatorClient(events=[response_event1, response_event2])
    plugin = SimulatorPlugin()
    plugin._client = fake_client  # type: ignore[assignment]

    # Create pending future
    future = plugin._pending_futures.create(turn_id)

    # Act
    listen_task = asyncio.create_task(plugin._listen_loop())
    result = await asyncio.wait_for(future, timeout=1.0)

    # Wait for task to complete (processes both events, second is ignored)
    await listen_task

    # Assert - first response was used, duplicate ignored without error
    assert_that(result.candidates[0].content.parts[0].text, equal_to("First response"))

  @pytest.mark.asyncio
  async def test_listen_loop_handles_unknown_turn_id_idempotently(self) -> None:
    """_listen_loop() ignores llm_response for unknown turn_id."""
    # Arrange
    response_event = _create_llm_response_event("unknown-turn-id")

    fake_client = FakeSimulatorClient(events=[response_event])
    plugin = SimulatorPlugin()
    plugin._client = fake_client  # type: ignore[assignment]

    # No pending future created - turn_id is unknown

    # Act - should not raise, just log and continue
    await plugin._listen_loop()

    # Assert - no futures pending (none were ever created)
    assert_that(len(plugin._pending_futures), equal_to(0))

  @pytest.mark.asyncio
  async def test_listen_loop_exits_when_client_is_none(self) -> None:
    """_listen_loop() exits immediately if client is None."""
    # Arrange
    plugin = SimulatorPlugin()
    plugin._client = None

    # Act
    await plugin._listen_loop()

    # Assert - no error, just returns
    assert_that(plugin._client, is_(None))

  @pytest.mark.asyncio
  async def test_listen_loop_propagates_cancellation(self) -> None:
    """_listen_loop() propagates CancelledError when cancelled during iteration."""
    # Arrange - use an async generator that yields slowly to allow cancellation
    plugin = SimulatorPlugin()

    events_yielded: list[str] = []

    async def slow_subscribe(
      client_id: str | None = None,
    ) -> AsyncIterator[SessionEvent]:
      """Slow async generator that can be interrupted."""
      for i in range(100):
        events_yielded.append(f"turn-{i}")
        yield _create_llm_request_event(f"turn-{i}")
        # Small delay to allow cancellation between events
        await asyncio.sleep(0.01)

    @dataclass
    class SlowFakeClient:
      async def subscribe(
        self, client_id: str | None = None
      ) -> AsyncIterator[SessionEvent]:
        async for event in slow_subscribe(client_id):
          yield event

    plugin._client = SlowFakeClient()  # type: ignore[assignment]

    # Act
    listen_task = asyncio.create_task(plugin._listen_loop())
    await asyncio.sleep(0.05)  # Let it process a few events
    listen_task.cancel()

    # Assert
    with pytest.raises(asyncio.CancelledError):
      await listen_task

    # Verify at least some events were processed before cancellation
    assert_that(len(events_yielded) > 0, is_(True))
    assert_that(len(events_yielded) < 100, is_(True))  # Not all events processed

  @pytest.mark.asyncio
  async def test_listen_loop_propagates_errors(self) -> None:
    """_listen_loop() propagates errors from the event stream."""
    # Arrange - use error_after=0 to raise immediately on first iteration
    events = [_create_llm_request_event("turn-1")]
    fake_client = FakeSimulatorClient(events=events, error_after=0)
    plugin = SimulatorPlugin()
    plugin._client = fake_client  # type: ignore[assignment]

    # Act & Assert
    with pytest.raises(RuntimeError, match="Simulated connection error"):
      await plugin._listen_loop()
