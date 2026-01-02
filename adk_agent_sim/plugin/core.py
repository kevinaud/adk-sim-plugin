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
import os
from typing import Any


class SimulatorPlugin:
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
  ) -> None:
    """Initialize the SimulatorPlugin.

    Args:
        server_url: The Simulator Server address. Defaults to ADK_SIM_SERVER env var
                   or "localhost:50051".
        target_agents: Optional set of agent names to intercept. If None or empty,
                      all agents are intercepted. Can also be set via ADK_SIM_TARGETS
                      environment variable (comma-separated).
    """
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
    self._pending_futures: dict[str, asyncio.Future[Any]] = {}
    self._listen_task: asyncio.Task[None] | None = None

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

    Args:
        description: Optional description for the session.

    Returns:
        The session URL to display to the user.

    Raises:
        ConnectionError: If unable to connect to the server.
    """
    # TODO: Implement gRPC connection and CreateSession call
    # TODO: Start background _listen_loop task
    # TODO: Return clickable URL

    raise NotImplementedError("initialize not yet implemented")

  async def before_model_callback(self, request: object, agent_name: str) -> object:
    """Intercept an LLM call and route it through the Remote Brain protocol.

    This is the main hook point for ADK integration. When an agent makes an
    LLM call, this method:
    1. Checks if the agent should be intercepted
    2. Serializes the request to proto format
    3. Submits it to the server
    4. Awaits a human decision
    5. Returns the response to the agent

    Args:
        request: The LlmRequest from ADK (Pydantic model).
        agent_name: The name of the agent making the request.

    Returns:
        The LlmResponse from the human decision.
    """
    if not self.should_intercept(agent_name):
      # Let the request proceed to the real LLM
      return None

    # TODO: Implement the Future Map pattern
    # 1. Convert Pydantic -> Proto
    # 2. Generate turn_id
    # 3. Create and register Future
    # 4. Submit request to server
    # 5. Await Future
    # 6. Convert Proto -> Pydantic
    # 7. Return response

    raise NotImplementedError("before_model_callback not yet implemented")

  async def _listen_loop(self) -> None:
    """Background task that listens for responses from the server.

    This method subscribes to the session's event stream and resolves
    pending Futures when responses arrive.
    """
    # TODO: Implement Subscribe call and Future resolution
    raise NotImplementedError("_listen_loop not yet implemented")

  async def close(self) -> None:
    """Clean up resources and close connections."""
    if self._listen_task:
      self._listen_task.cancel()
      with contextlib.suppress(asyncio.CancelledError):
        await self._listen_task
    # TODO: Close gRPC channel
