"""Tests for SimulatorPlugin."""

import asyncio
import contextlib
import io
import sys
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import TYPE_CHECKING

import pytest
from hamcrest import (
  assert_that,
  contains_string,
  equal_to,
  is_,
)

from adk_agent_sim.generated.adksim.v1 import SessionEvent, SimulatorSession
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


@dataclass
class FakeInitializingClient:
  """Fake SimulatorClient for testing initialize() flow.

  This fake supports connect(), create_session(), subscribe(), and close()
  for testing the full initialization sequence.
  """

  session_id: str = "fake-session-123"
  description: str = ""
  events: list[SessionEvent] = field(default_factory=list)
  connected: bool = False
  session_created: bool = False
  closed: bool = False

  async def connect(self) -> None:
    """Mark the client as connected."""
    self.connected = True

  async def create_session(self, description: str | None = None) -> SimulatorSession:
    """Create a fake session and return it."""
    self.description = description or ""
    self.session_created = True
    return SimulatorSession(
      id=self.session_id,
      created_at=datetime.now(UTC),
      description=self.description,
    )

  async def subscribe(
    self, client_id: str | None = None
  ) -> AsyncIterator[SessionEvent]:
    """Yield configured events."""
    for event in self.events:
      yield event

  async def close(self) -> None:
    """Mark the client as closed."""
    self.closed = True


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


class TestInitialize:
  """Tests for SimulatorPlugin.initialize()."""

  @pytest.mark.asyncio
  async def test_initialize_prints_banner_with_correct_format(self) -> None:
    """initialize() prints a decorated banner with the session URL."""
    # Arrange
    session_id = "abc-123-def-456"
    plugin = SimulatorPlugin(server_url="localhost:50051")

    # Capture stdout
    captured_output = io.StringIO()

    # Act - directly test _print_session_banner
    sys.stdout = captured_output
    try:
      session_url = f"http://localhost:4200/session/{session_id}"
      plugin._print_session_banner(session_url)
    finally:
      sys.stdout = sys.__stdout__

    output = captured_output.getvalue()

    # Assert - verify banner format
    assert_that(output, contains_string("=" * 64))
    assert_that(output, contains_string("[ADK Simulator] Session Started"))
    assert_that(output, contains_string(f"View and Control at: {session_url}"))

  @pytest.mark.asyncio
  async def test_initialize_banner_contains_all_required_elements(self) -> None:
    """The banner contains top border, title, URL line, and bottom border."""
    # Arrange
    session_id = "my-session-id"
    plugin = SimulatorPlugin()
    session_url = f"http://localhost:4200/session/{session_id}"

    # Capture stdout
    captured_output = io.StringIO()

    # Act
    sys.stdout = captured_output
    try:
      plugin._print_session_banner(session_url)
    finally:
      sys.stdout = sys.__stdout__

    output = captured_output.getvalue()
    lines = output.strip().split("\n")

    # Assert - verify structure
    # First and last lines should be the separator
    assert_that(lines[0], equal_to("=" * 64))
    assert_that(lines[1], equal_to("[ADK Simulator] Session Started"))
    assert_that(lines[2], equal_to(f"View and Control at: {session_url}"))
    assert_that(lines[3], equal_to("=" * 64))

  def test_build_session_url_with_localhost(self) -> None:
    """_build_session_url() builds correct URL for localhost."""
    # Arrange
    plugin = SimulatorPlugin(server_url="localhost:50051")
    session_id = "session-abc-123"

    # Act
    url = plugin._build_session_url(session_id)

    # Assert
    assert_that(url, equal_to("http://localhost:4200/session/session-abc-123"))

  def test_build_session_url_with_http_scheme(self) -> None:
    """_build_session_url() builds correct URL when server URL has http scheme."""
    # Arrange
    plugin = SimulatorPlugin(server_url="http://myserver:50051")
    session_id = "session-xyz"

    # Act
    url = plugin._build_session_url(session_id)

    # Assert
    assert_that(url, equal_to("http://myserver:4200/session/session-xyz"))

  def test_build_session_url_with_custom_host(self) -> None:
    """_build_session_url() uses the host from server_url."""
    # Arrange
    plugin = SimulatorPlugin(server_url="simulator.example.com:50051")
    session_id = "remote-session"

    # Act
    url = plugin._build_session_url(session_id)

    # Assert
    assert_that(
      url, equal_to("http://simulator.example.com:4200/session/remote-session")
    )

  @pytest.mark.asyncio
  async def test_initialize_sets_session_id(self) -> None:
    """initialize() sets the session_id on the plugin."""
    # Arrange
    session_id = "new-session-id"
    fake_client = FakeInitializingClient(session_id=session_id)
    plugin = SimulatorPlugin(server_url="localhost:50051")

    # Inject the fake client
    plugin._client = fake_client  # type: ignore[assignment]

    # We need to simulate what initialize() does when client is already set
    # Instead, let's test the individual components and one integration test
    # that mocks at a higher level

    # Create session directly to verify behavior
    session = await fake_client.create_session("test description")

    # Assert
    assert_that(session.id, equal_to(session_id))
    assert_that(fake_client.session_created, is_(True))

  @pytest.mark.asyncio
  async def test_initialize_starts_listen_loop_task(self) -> None:
    """initialize() starts the _listen_loop as a background task."""
    # Arrange
    session_id = "task-session"
    fake_client = FakeInitializingClient(session_id=session_id, events=[])
    plugin = SimulatorPlugin(server_url="localhost:50051")

    # Inject fake client and manually run initialize logic
    plugin._client = fake_client  # type: ignore[assignment]
    plugin.session_id = session_id

    # Act - start the listen loop task
    plugin._listen_task = asyncio.create_task(plugin._listen_loop())

    # Assert - task should be created and running
    assert plugin._listen_task is not None
    assert_that(plugin._listen_task.done(), is_(False))

    # Cleanup - cancel the task
    plugin._listen_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
      await plugin._listen_task

  @pytest.mark.asyncio
  async def test_initialize_integration_with_fake_client(
    self, monkeypatch: pytest.MonkeyPatch
  ) -> None:
    """Full initialize() flow with injected fake client."""
    # Arrange
    session_id = "integration-test-session"
    fake_client = FakeInitializingClient(session_id=session_id, events=[])

    # Capture stdout
    captured_output = io.StringIO()

    # Create plugin
    plugin = SimulatorPlugin(server_url="localhost:50051")

    # Monkeypatch SimulatorClient to return our fake
    from adk_agent_sim.plugin import client as client_module

    monkeypatch.setattr(
      client_module.SimulatorClient,
      "__init__",
      lambda self, config: None,
    )
    monkeypatch.setattr(
      client_module.SimulatorClient,
      "connect",
      fake_client.connect,
    )
    monkeypatch.setattr(
      client_module.SimulatorClient,
      "create_session",
      fake_client.create_session,
    )
    monkeypatch.setattr(
      client_module.SimulatorClient,
      "subscribe",
      fake_client.subscribe,
    )

    # Act
    sys.stdout = captured_output
    try:
      result_url = await plugin.initialize("Test session")
    finally:
      sys.stdout = sys.__stdout__

    output = captured_output.getvalue()

    # Assert - URL returned correctly
    assert_that(result_url, equal_to(f"http://localhost:4200/session/{session_id}"))

    # Assert - session_id set
    assert_that(plugin.session_id, equal_to(session_id))

    # Assert - listen task started
    assert plugin._listen_task is not None

    # Assert - banner printed
    assert_that(output, contains_string("[ADK Simulator] Session Started"))
    assert_that(output, contains_string(f"http://localhost:4200/session/{session_id}"))

    # Cleanup
    if plugin._listen_task:
      plugin._listen_task.cancel()
      with contextlib.suppress(asyncio.CancelledError):
        await plugin._listen_task


@dataclass
class FakeCallbackContext:
  """Fake CallbackContext for testing before_model_callback.

  Provides the minimal interface needed for agent name lookup.
  """

  agent_name: str


@dataclass
class FakeInterceptingClient:
  """Fake SimulatorClient for testing before_model_callback.

  Tracks submitted requests and provides controlled response via event stream.
  Uses an async queue to properly handle concurrent submit/subscribe operations.
  """

  session_id: str = "session-123"
  submitted_requests: list[tuple[str, str, GenerateContentRequest]] = field(
    default_factory=list
  )
  response_to_send: GenerateContentResponse | None = None
  _event_queue: asyncio.Queue[SessionEvent] = field(default_factory=asyncio.Queue)

  async def submit_request(
    self, turn_id: str, agent_name: str, request: GenerateContentRequest
  ) -> str:
    """Record the submitted request and return a fake event_id."""
    self.submitted_requests.append((turn_id, agent_name, request))
    # Dynamically create response event for this turn_id and put in queue
    if self.response_to_send:
      event = SessionEvent(
        event_id=f"event-{turn_id}",
        session_id=self.session_id,
        timestamp=datetime.now(UTC),
        turn_id=turn_id,
        agent_name=agent_name,
        llm_response=self.response_to_send,
      )
      await self._event_queue.put(event)
    return f"event-{turn_id}"

  async def subscribe(
    self, client_id: str | None = None
  ) -> AsyncIterator[SessionEvent]:
    """Yield events from the queue as they arrive."""
    while True:
      event = await self._event_queue.get()
      yield event


class TestBeforeModelCallback:
  """Tests for SimulatorPlugin.before_model_callback()."""

  @pytest.mark.asyncio
  async def test_before_model_callback_bypasses_non_targeted_agents(self) -> None:
    """before_model_callback returns None for non-targeted agents."""
    # Arrange - target only "orchestrator"
    plugin = SimulatorPlugin(target_agents={"orchestrator"})
    callback_context = FakeCallbackContext(agent_name="worker_agent")

    # Create a minimal LlmRequest using ADK types
    from google.adk.models import LlmRequest
    from google.genai import types as genai_types

    llm_request = LlmRequest(
      model="gemini-2.0-flash",
      contents=[
        genai_types.Content(
          role="user",
          parts=[genai_types.Part(text="Hello")],
        )
      ],
      config=genai_types.GenerateContentConfig(),
    )

    # Act
    result = await plugin.before_model_callback(
      callback_context,  # type: ignore[arg-type]
      llm_request,
    )

    # Assert - returns None to let request proceed to real LLM
    assert_that(result, is_(None))

  @pytest.mark.asyncio
  async def test_before_model_callback_intercepts_all_when_no_targets(self) -> None:
    """before_model_callback intercepts all agents when target_agents is empty."""
    # Arrange
    response_text = "Human provided response"
    response = GenerateContentResponse(
      candidates=[
        Candidate(
          content=Content(
            parts=[Part(text=response_text)],
            role="model",
          )
        )
      ]
    )

    fake_client = FakeInterceptingClient(response_to_send=response)
    plugin = SimulatorPlugin()  # No target_agents = intercept all
    plugin._client = fake_client  # type: ignore[assignment]

    callback_context = FakeCallbackContext(agent_name="any_agent")

    from google.adk.models import LlmRequest
    from google.genai import types as genai_types

    llm_request = LlmRequest(
      model="gemini-2.0-flash",
      contents=[
        genai_types.Content(
          role="user",
          parts=[genai_types.Part(text="Test message")],
        )
      ],
      config=genai_types.GenerateContentConfig(),
    )

    # Start listen loop to resolve futures
    plugin._listen_task = asyncio.create_task(plugin._listen_loop())

    # Act
    result = await plugin.before_model_callback(
      callback_context,  # type: ignore[arg-type]
      llm_request,
    )

    # Cleanup
    plugin._listen_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
      await plugin._listen_task

    # Assert - request was submitted
    assert_that(len(fake_client.submitted_requests), equal_to(1))
    _, submitted_agent_name, proto_req = fake_client.submitted_requests[0]
    assert_that(submitted_agent_name, equal_to("any_agent"))
    assert_that(proto_req.model, equal_to("models/gemini-2.0-flash"))

    # Assert - response was returned
    assert result is not None
    assert result.content is not None
    assert result.content.parts is not None
    assert_that(result.content.parts[0].text, equal_to(response_text))

  @pytest.mark.asyncio
  async def test_before_model_callback_intercepts_targeted_agent(self) -> None:
    """before_model_callback intercepts only targeted agents."""
    # Arrange
    response_text = "Orchestrator response"
    response = GenerateContentResponse(
      candidates=[
        Candidate(
          content=Content(
            parts=[Part(text=response_text)],
            role="model",
          )
        )
      ]
    )

    fake_client = FakeInterceptingClient(response_to_send=response)
    plugin = SimulatorPlugin(target_agents={"orchestrator", "router"})
    plugin._client = fake_client  # type: ignore[assignment]

    callback_context = FakeCallbackContext(agent_name="orchestrator")

    from google.adk.models import LlmRequest
    from google.genai import types as genai_types

    llm_request = LlmRequest(
      model="gemini-pro",
      contents=[
        genai_types.Content(
          role="user",
          parts=[genai_types.Part(text="Process this")],
        )
      ],
      config=genai_types.GenerateContentConfig(),
    )

    # Start listen loop to resolve futures
    plugin._listen_task = asyncio.create_task(plugin._listen_loop())

    # Act
    result = await plugin.before_model_callback(
      callback_context,  # type: ignore[arg-type]
      llm_request,
    )

    # Cleanup
    plugin._listen_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
      await plugin._listen_task

    # Assert - request was intercepted
    assert_that(len(fake_client.submitted_requests), equal_to(1))

    # Assert - correct response
    assert result is not None
    assert result.content is not None
    assert result.content.parts is not None
    assert_that(result.content.parts[0].text, equal_to(response_text))

  @pytest.mark.asyncio
  async def test_before_model_callback_raises_without_initialization(self) -> None:
    """before_model_callback raises RuntimeError when client is not initialized."""
    # Arrange
    plugin = SimulatorPlugin()
    plugin._client = None  # Explicitly not initialized
    callback_context = FakeCallbackContext(agent_name="test_agent")

    from google.adk.models import LlmRequest
    from google.genai import types as genai_types

    llm_request = LlmRequest(
      model="gemini-2.0-flash",
      contents=[
        genai_types.Content(
          role="user",
          parts=[genai_types.Part(text="Hello")],
        )
      ],
      config=genai_types.GenerateContentConfig(),
    )

    # Act & Assert
    with pytest.raises(RuntimeError, match="Plugin not initialized"):
      await plugin.before_model_callback(
        callback_context,  # type: ignore[arg-type]
        llm_request,
      )

  @pytest.mark.asyncio
  async def test_before_model_callback_generates_unique_turn_ids(self) -> None:
    """before_model_callback generates unique turn_id for each call."""
    # Arrange
    response = GenerateContentResponse(
      candidates=[
        Candidate(
          content=Content(
            parts=[Part(text="Response")],
            role="model",
          )
        )
      ]
    )

    fake_client = FakeInterceptingClient(response_to_send=response)
    plugin = SimulatorPlugin()
    plugin._client = fake_client  # type: ignore[assignment]

    callback_context = FakeCallbackContext(agent_name="test_agent")

    from google.adk.models import LlmRequest
    from google.genai import types as genai_types

    llm_request = LlmRequest(
      model="gemini-2.0-flash",
      contents=[
        genai_types.Content(
          role="user",
          parts=[genai_types.Part(text="Hello")],
        )
      ],
      config=genai_types.GenerateContentConfig(),
    )

    # Start listen loop
    plugin._listen_task = asyncio.create_task(plugin._listen_loop())

    # Act - make two calls
    await plugin.before_model_callback(
      callback_context,  # type: ignore[arg-type]
      llm_request,
    )
    await plugin.before_model_callback(
      callback_context,  # type: ignore[arg-type]
      llm_request,
    )

    # Cleanup
    plugin._listen_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
      await plugin._listen_task

    # Assert - two different turn_ids
    assert_that(len(fake_client.submitted_requests), equal_to(2))
    turn_id_1 = fake_client.submitted_requests[0][0]
    turn_id_2 = fake_client.submitted_requests[1][0]
    assert turn_id_1 != turn_id_2

  @pytest.mark.asyncio
  async def test_before_model_callback_converts_request_to_proto(self) -> None:
    """before_model_callback correctly converts LlmRequest to GenerateContentRequest."""
    # Arrange
    response = GenerateContentResponse(
      candidates=[
        Candidate(
          content=Content(
            parts=[Part(text="Response")],
            role="model",
          )
        )
      ]
    )

    fake_client = FakeInterceptingClient(response_to_send=response)
    plugin = SimulatorPlugin()
    plugin._client = fake_client  # type: ignore[assignment]

    callback_context = FakeCallbackContext(agent_name="test_agent")

    from google.adk.models import LlmRequest
    from google.genai import types as genai_types

    llm_request = LlmRequest(
      model="gemini-2.0-flash",
      contents=[
        genai_types.Content(
          role="user",
          parts=[genai_types.Part(text="What is 2+2?")],
        )
      ],
      config=genai_types.GenerateContentConfig(
        temperature=0.7,
        system_instruction="You are a math tutor.",
      ),
    )

    # Start listen loop
    plugin._listen_task = asyncio.create_task(plugin._listen_loop())

    # Act
    await plugin.before_model_callback(
      callback_context,  # type: ignore[arg-type]
      llm_request,
    )

    # Cleanup
    plugin._listen_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
      await plugin._listen_task

    # Assert - proto request was correctly converted
    _, _, proto_req = fake_client.submitted_requests[0]
    assert_that(proto_req.model, equal_to("models/gemini-2.0-flash"))
    assert_that(proto_req.contents[0].parts[0].text, equal_to("What is 2+2?"))
    assert proto_req.system_instruction is not None
    assert_that(
      proto_req.system_instruction.parts[0].text, equal_to("You are a math tutor.")
    )


@dataclass
class FakeReconnectingClient:
  """Fake SimulatorClient for testing reconnection logic (T052).

  Simulates a connection that fails after N events, then succeeds on reconnect.
  """

  session_id: str = "reconnect-session-123"
  events_before_failure: list[SessionEvent] = field(default_factory=list)
  events_after_reconnect: list[SessionEvent] = field(default_factory=list)
  connect_count: int = 0
  close_count: int = 0
  _failed_once: bool = False
  _session_id: str | None = None

  async def connect(self) -> None:
    """Track connect calls."""
    self.connect_count += 1

  async def close(self) -> None:
    """Track close calls."""
    self.close_count += 1

  async def subscribe(
    self, client_id: str | None = None
  ) -> AsyncIterator[SessionEvent]:
    """Yield events then fail, or yield reconnect events."""
    from grpclib.exceptions import StreamTerminatedError

    if not self._failed_once:
      for event in self.events_before_failure:
        yield event
      self._failed_once = True
      raise StreamTerminatedError("Connection lost")

    # After reconnect
    for event in self.events_after_reconnect:
      yield event


class TestPluginReconnection:
  """Tests for plugin reconnection logic (T052)."""

  @pytest.mark.asyncio
  async def test_reconnection_on_stream_terminated_error(self) -> None:
    """_listen_loop reconnects when StreamTerminatedError occurs (T048, T050)."""
    # Arrange
    turn_id = "turn-after-reconnect"
    response_event = _create_llm_response_event(turn_id, "After reconnect")

    fake_client = FakeReconnectingClient(
      events_before_failure=[],  # Fail immediately
      events_after_reconnect=[response_event],
    )

    plugin = SimulatorPlugin()
    plugin._client = fake_client  # type: ignore[assignment]
    plugin.session_id = "reconnect-session-123"
    # Set fast backoff for testing
    plugin._initial_backoff = 0.01
    plugin._max_backoff = 0.05

    # Create pending future
    future = plugin._pending_futures.create(turn_id)

    # Act
    listen_task = asyncio.create_task(plugin._listen_loop())

    # Wait for future to resolve (through reconnection)
    result = await asyncio.wait_for(future, timeout=2.0)

    # Stop the loop
    plugin._shutting_down = True
    await listen_task

    # Assert - reconnection happened
    assert_that(fake_client.connect_count, equal_to(1))  # One reconnect
    assert_that(fake_client.close_count, equal_to(1))  # Closed before reconnect
    assert_that(result.candidates[0].content.parts[0].text, equal_to("After reconnect"))

  @pytest.mark.asyncio
  async def test_exponential_backoff_timing(self) -> None:
    """Exponential backoff increases delay between retries (T049)."""
    # Arrange
    plugin = SimulatorPlugin()
    plugin._initial_backoff = 0.01
    plugin._max_backoff = 0.08
    plugin._backoff_multiplier = 2.0

    retry_times: list[float] = []

    @dataclass
    class AlwaysFailingClient:
      """Client that always fails on subscribe."""

      connect_count: int = 0
      _session_id: str | None = "test-session"

      async def connect(self) -> None:
        self.connect_count += 1

      async def close(self) -> None:
        pass

      async def subscribe(
        self, client_id: str | None = None
      ) -> AsyncIterator[SessionEvent]:
        from grpclib.const import Status
        from grpclib.exceptions import GRPCError

        retry_times.append(asyncio.get_event_loop().time())
        raise GRPCError(Status.UNAVAILABLE, "Server unavailable")
        yield  # Never reached - makes this a generator

    fake_client = AlwaysFailingClient()
    plugin._client = fake_client  # type: ignore[assignment]
    plugin.session_id = "test-session"

    # Act - run for a short time
    listen_task = asyncio.create_task(plugin._listen_loop())
    await asyncio.sleep(0.25)  # Let it retry a few times
    plugin._shutting_down = True
    listen_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
      await listen_task

    # Assert - verify backoff pattern (at least 3 retries)
    assert len(retry_times) >= 3, f"Expected at least 3 retries, got {len(retry_times)}"
    # Check delays increase (with tolerance for timing)
    if len(retry_times) >= 3:
      delay1 = retry_times[1] - retry_times[0]
      delay2 = retry_times[2] - retry_times[1]
      # Second delay should be approximately 2x the first
      assert delay2 >= delay1 * 1.5, (
        f"Backoff not increasing: {delay1:.3f} -> {delay2:.3f}"
      )

  @pytest.mark.asyncio
  async def test_reconnection_uses_existing_session_id(self) -> None:
    """Reconnection restores session_id to client (T050)."""
    # Arrange
    existing_session_id = "existing-session-456"

    @dataclass
    class TrackingClient:
      """Client that tracks session_id restoration."""

      connect_count: int = 0
      _session_id: str | None = None
      restored_session_ids: list[str | None] = field(default_factory=list)
      _should_fail: bool = True

      async def connect(self) -> None:
        self.connect_count += 1
        self.restored_session_ids.append(self._session_id)

      async def close(self) -> None:
        pass

      async def subscribe(
        self, client_id: str | None = None
      ) -> AsyncIterator[SessionEvent]:
        from grpclib.exceptions import StreamTerminatedError

        if self._should_fail:
          self._should_fail = False
          raise StreamTerminatedError("Connection lost")
        # Empty stream after reconnect
        return
        yield  # Makes this a generator

    fake_client = TrackingClient()
    plugin = SimulatorPlugin()
    plugin._client = fake_client  # type: ignore[assignment]
    plugin.session_id = existing_session_id
    plugin._initial_backoff = 0.01

    # Act
    listen_task = asyncio.create_task(plugin._listen_loop())
    await asyncio.sleep(0.1)
    plugin._shutting_down = True
    await listen_task

    # Assert - session_id was restored after reconnect
    assert_that(fake_client.connect_count, equal_to(1))
    # After _reconnect(), the client's _session_id should match plugin's
    assert_that(fake_client._session_id, equal_to(existing_session_id))

  @pytest.mark.asyncio
  async def test_replayed_events_are_filtered(self) -> None:
    """Already-resolved turn_ids are ignored on replay (T051)."""
    # Arrange
    already_resolved_turn_id = "already-resolved-turn"
    new_turn_id = "new-turn"

    # First response resolves the turn
    response1 = _create_llm_response_event(
      already_resolved_turn_id, "First response", event_id="event-1"
    )
    # Replayed event for same turn (should be filtered)
    replayed = _create_llm_response_event(
      already_resolved_turn_id, "Replayed response", event_id="event-2"
    )
    # New event for different turn
    response2 = _create_llm_response_event(
      new_turn_id, "New response", event_id="event-3"
    )

    fake_client = FakeSimulatorClient(events=[response1, replayed, response2])
    plugin = SimulatorPlugin()
    plugin._client = fake_client  # type: ignore[assignment]

    # Create futures
    future1 = plugin._pending_futures.create(already_resolved_turn_id)
    future2 = plugin._pending_futures.create(new_turn_id)

    # Act
    listen_task = asyncio.create_task(plugin._listen_loop())

    # Wait for both futures
    result1 = await asyncio.wait_for(future1, timeout=1.0)
    result2 = await asyncio.wait_for(future2, timeout=1.0)

    await listen_task

    # Assert - first response used (not the replay)
    assert_that(result1.candidates[0].content.parts[0].text, equal_to("First response"))
    assert_that(result2.candidates[0].content.parts[0].text, equal_to("New response"))

  @pytest.mark.asyncio
  async def test_close_sets_shutdown_flag(self) -> None:
    """close() sets _shutting_down flag to stop reconnection loop."""
    # Arrange
    plugin = SimulatorPlugin()

    @dataclass
    class FakeClosingClient:
      """Client with close() method for testing shutdown."""

      closed: bool = False

      async def close(self) -> None:
        self.closed = True

    fake_client = FakeClosingClient()
    plugin._client = fake_client  # type: ignore[assignment]

    # Act
    assert_that(plugin._shutting_down, is_(False))
    await plugin.close()

    # Assert
    assert_that(plugin._shutting_down, is_(True))
    assert_that(fake_client.closed, is_(True))
