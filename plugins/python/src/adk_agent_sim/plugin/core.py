"""SimulatorPlugin - ADK Plugin for the Remote Brain protocol.

This module provides the core SimulatorPlugin class that hooks into ADK's
`before_model_callback` to intercept LLM calls and route them through the
Simulator Server for human decision-making.

Usage:
    from adk_agent_sim.plugin import SimulatorPlugin

    plugin = SimulatorPlugin(
        server_url="localhost:50051",
        target_agents=["orchestrator", "router"],  # Optional: intercept specific agents
    )

    # Register with ADK agent
    agent.register_plugin(plugin)
"""

import asyncio
import contextlib
import logging
import os
import sys
from typing import TYPE_CHECKING
from urllib.parse import urlparse
from uuid import uuid4

import betterproto
from adk_sim_protos.adksim.v1 import (
  CreateSessionRequest,
  SubmitRequestRequest,
  SubscribeRequest,
)
from google.adk.plugins.base_plugin import BasePlugin
from grpclib.exceptions import GRPCError, StreamTerminatedError

from adk_agent_sim.plugin.client_factory import SimulatorClientFactory
from adk_agent_sim.plugin.config import PluginConfig
from adk_agent_sim.plugin.converter import ADKProtoConverter
from adk_agent_sim.plugin.futures import PendingFutureRegistry

if TYPE_CHECKING:
  from adk_sim_protos.adksim.v1 import SimulatorServiceStub
  from google.adk.agents.callback_context import CallbackContext
  from google.adk.models.llm_request import LlmRequest
  from google.adk.models.llm_response import LlmResponse

logger = logging.getLogger(__name__)


class SimulatorPlugin(BasePlugin):
  """ADK Plugin that implements the Remote Brain protocol.

  This plugin intercepts LLM calls from ADK agents and routes them through
  the Simulator Server, enabling human-in-the-loop validation of agent workflows.

  The plugin maintains a "Future Map" pattern:
  1. When an LLM call is intercepted, a Future is created and stored by turn_id
  2. The request is sent to the server
  3. The plugin awaits the Future (blocking the agent)
  4. When a human responds via the UI, the background listener resolves the Future
  5. The response is returned to the agent

  Attributes:
      server_url: The gRPC server address (host:port).
      target_agents: Set of agent names to intercept. If empty, intercepts all.
      session_id: The current session ID (set after initialization).
  """

  def __init__(
    self,
    server_url: str | None = None,
    target_agents: set[str] | None = None,
    name: str = "adk_simulator",
  ) -> None:
    """Initialize the SimulatorPlugin.

    Args:
        server_url: The Simulator Server address. Defaults to ADK_SIM_SERVER env var
                   or "localhost:50051".
        target_agents: Optional set of agent names to intercept. If None or empty,
                      all agents are intercepted. Can also be set via ADK_SIM_TARGETS
                      environment variable (comma-separated).
        name: The unique name for this plugin instance. Defaults to "adk_simulator".
    """
    super().__init__(name=name)
    self.server_url = server_url or os.environ.get("ADK_SIM_SERVER", "localhost:50051")

    # Parse target agents from env var if not provided
    if target_agents is None:
      targets_env = os.environ.get("ADK_SIM_TARGETS", "")
      if targets_env:
        self.target_agents: set[str] = {
          name.strip() for name in targets_env.split(",") if name.strip()
        }
      else:
        self.target_agents = set()
    else:
      self.target_agents = target_agents

    self.session_id: str | None = None
    self._pending_futures = PendingFutureRegistry()
    self._listen_task: asyncio.Task[None] | None = None
    self._factory: SimulatorClientFactory | None = None
    self._stub: SimulatorServiceStub | None = None
    self._shutting_down = False

    # Reconnection settings
    self._initial_backoff = 1.0  # seconds
    self._max_backoff = 30.0  # seconds
    self._backoff_multiplier = 2.0

  def should_intercept(self, agent_name: str) -> bool:
    """Check if a given agent should be intercepted.

    Args:
        agent_name: The name of the agent making the LLM call.

    Returns:
        True if the agent should be intercepted, False otherwise.
    """
    # If no targets specified, intercept all
    if not self.target_agents:
      return True
    return agent_name in self.target_agents

  async def initialize(self, description: str = "") -> str:
    """Initialize the plugin by creating a session with the server.

    This method:
    1. Creates a SimulatorClient and connects to the server
    2. Creates a new session with the server
    3. Starts the background _listen_loop task
    4. Prints a decorated banner with the session URL to stdout

    Args:
        description: Optional description for the session.

    Returns:
        The session URL to display to the user.

    Raises:
        ConnectionError: If unable to connect to the server.
    """
    # Create config and factory
    config = PluginConfig(server_url=self.server_url)
    self._factory = SimulatorClientFactory(config)

    # Get stub (connects automatically if needed)
    self._stub = await self._factory.get_simulator_stub()

    # Create session
    response = await self._stub.create_session(
      CreateSessionRequest(description=description or "")
    )
    self.session_id = response.session.id

    # Start background listener task
    self._listen_task = asyncio.create_task(self._listen_loop())

    # Build the session URL
    session_url = self._build_session_url(self.session_id)

    # Print the decorated banner
    self._print_session_banner(session_url)

    return session_url

  def _build_session_url(self, session_id: str) -> str:
    """Build the frontend URL for the session.

    Derives the frontend URL from the server URL:
    - If server is localhost:50051 (gRPC), assume frontend at localhost:4200
    - Otherwise, parse the server URL and adjust port/scheme as needed

    Args:
        session_id: The session UUID.

    Returns:
        The full URL to view/control the session.
    """
    parsed = urlparse(self.server_url)

    # Determine host
    if parsed.hostname:
      host = parsed.hostname
    elif ":" in self.server_url:
      host = self.server_url.split(":")[0] or "localhost"
    else:
      host = self.server_url or "localhost"

    # Default frontend port is 4200
    frontend_port = 4200

    return f"http://{host}:{frontend_port}/session/{session_id}"

  def _print_session_banner(self, session_url: str) -> None:
    """Print a decorated banner with the session URL.

    Args:
        session_url: The URL to display in the banner.
    """
    banner = (
      "\n"
      "================================================================\n"
      "[ADK Simulator] Session Started\n"
      f"View and Control at: {session_url}\n"
      "================================================================\n"
    )
    print(banner, file=sys.stdout, flush=True)

  async def before_model_callback(
    self, *, callback_context: CallbackContext, llm_request: LlmRequest
  ) -> LlmResponse | None:
    """Intercept an LLM call and route it through the Remote Brain protocol.

    This is the main hook point for ADK integration. When an agent makes an
    LLM call, this method:
    1. Checks if the agent should be intercepted
    2. Serializes the request to proto format
    3. Submits it to the server
    4. Awaits a human decision
    5. Returns the response to the agent

    Args:
        callback_context: The ADK CallbackContext containing agent information.
        llm_request: The LlmRequest from ADK (Pydantic model).

    Returns:
        The LlmResponse from the human decision, or None if not intercepting.
    """
    # Get the agent name from the callback context
    agent_name = callback_context.agent_name

    # T040: Check target_agents filter - return None to proceed to real LLM
    # if agent is not targeted
    if not self.should_intercept(agent_name):
      return None

    if self._stub is None:
      logger.error("before_model_callback called without initialized stub")
      raise RuntimeError("Plugin not initialized. Call initialize() first.")

    # T041: Generate turn_id UUID and create Future via PendingFutureRegistry
    turn_id = str(uuid4())
    future = self._pending_futures.create(turn_id)

    # T042: Use ADKProtoConverter.llm_request_to_proto() to transform
    # LlmRequest → GenerateContentRequest
    proto_request = ADKProtoConverter.llm_request_to_proto(llm_request)

    # T043: Submit request via stub.submit_request()
    await self._stub.submit_request(
      SubmitRequestRequest(
        session_id=self.session_id or "",
        turn_id=turn_id,
        agent_name=agent_name,
        request=proto_request,
      )
    )

    # T044: Log waiting state
    logger.info(
      "[ADK Simulator] Waiting for human input for agent: '%s'...", agent_name
    )

    # T045: Await Future (blocks indefinitely until response)
    proto_response = await future

    # T046: Use ADKProtoConverter.proto_to_llm_response() to transform
    # GenerateContentResponse → LlmResponse
    return ADKProtoConverter.proto_to_llm_response(proto_response)

  async def _listen_loop(self) -> None:
    """Background task that listens for responses from the server.

    This method subscribes to the session's event stream and resolves
    pending Futures when llm_response events arrive. The subscription
    includes historical replay followed by live events.

    The loop handles:
    - llm_request events: Logged and ignored (originated from this plugin)
    - llm_response events: Resolved via PendingFutureRegistry if pending
    - Unknown events: Logged and ignored

    On connection loss (gRPC exceptions), implements exponential backoff
    reconnection using the stored session_id.

    Idempotency is handled by PendingFutureRegistry.resolve() which
    returns False for already-resolved or unknown turn_ids (T051).
    """
    if self._stub is None:
      logger.error("_listen_loop called without stub - exiting")
      return

    backoff = self._initial_backoff

    while not self._shutting_down:
      try:
        async for response in self._stub.subscribe(
          SubscribeRequest(
            session_id=self.session_id or "",
            client_id=str(uuid4()),
          )
        ):
          event = response.event
          # Reset backoff on successful message
          backoff = self._initial_backoff

          # Determine the payload type using betterproto's oneof helper
          field_name, payload = betterproto.which_one_of(event, "payload")

          if field_name == "llm_response" and payload is not None:
            # This is a human decision - resolve the pending future
            # T051: resolve() returns False for already-resolved turn_ids
            resolved = self._pending_futures.resolve(event.turn_id, payload)
            if resolved:
              logger.debug(
                "Resolved future for turn_id=%s, event_id=%s",
                event.turn_id,
                event.event_id,
              )
            else:
              # Already resolved or unknown turn_id - idempotent handling
              logger.debug(
                "Ignored llm_response for turn_id=%s (not pending)",
                event.turn_id,
              )
          elif field_name == "llm_request":
            # Request events are our own submissions - just log and skip
            logger.debug(
              "Received llm_request event turn_id=%s (ignoring)",
              event.turn_id,
            )
          else:
            # Unknown payload type
            logger.warning(
              "Unknown event payload type: %s for event_id=%s",
              field_name,
              event.event_id,
            )
        # Stream ended normally - exit loop
        break

      except asyncio.CancelledError:
        logger.debug("_listen_loop cancelled")
        raise

      except (GRPCError, StreamTerminatedError, OSError) as e:
        # T048: Detect connection loss via gRPC exceptions
        if self._shutting_down:
          logger.debug("_listen_loop stopping due to shutdown")
          break

        logger.warning(
          "Connection lost: %s. Reconnecting in %.1fs...",
          type(e).__name__,
          backoff,
        )

        # T049: Exponential backoff
        await asyncio.sleep(backoff)
        backoff = min(backoff * self._backoff_multiplier, self._max_backoff)

        # T050: Reconnect using stored session_id
        try:
          await self._reconnect()
          logger.info("Reconnected to session %s", self.session_id)
        except Exception:
          logger.warning("Reconnection failed, will retry...")
          continue

  async def _reconnect(self) -> None:
    """Reconnect to the server using the stored session_id.

    T050: Reconnect using stored session_id instead of creating new session.
    The server will replay historical events on resubscription.

    Raises:
        RuntimeError: If session_id is not set.
        Various: If connection fails.
    """
    if self.session_id is None:
      raise RuntimeError("Cannot reconnect: no session_id stored")

    if self._factory is None:
      raise RuntimeError("Cannot reconnect: factory not initialized")

    # Close existing channel
    await self._factory.close()

    # Get a fresh stub (reconnects automatically)
    self._stub = await self._factory.get_simulator_stub()

  async def close(self) -> None:
    """Clean up resources and close connections."""
    self._shutting_down = True
    if self._listen_task:
      self._listen_task.cancel()
      with contextlib.suppress(asyncio.CancelledError):
        await self._listen_task
    if self._factory:
      await self._factory.close()
