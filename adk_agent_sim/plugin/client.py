"""SimulatorClient - gRPC client wrapper for server communication.

This module provides the SimulatorClient class that wraps grpclib's Channel
and provides a high-level interface for communicating with the Simulator Server.

Usage:
    from adk_agent_sim.plugin.client import SimulatorClient
    from adk_agent_sim.plugin.config import PluginConfig

    config = PluginConfig(server_url="http://localhost:50051")
    client = SimulatorClient(config)

    await client.connect()
    try:
        # Use the client...
        pass
    finally:
        await client.close()
"""

from typing import TYPE_CHECKING
from urllib.parse import urlparse
from uuid import uuid4

from grpclib.client import Channel

from adk_agent_sim.generated.adksim.v1 import (
  CreateSessionRequest,
  SimulatorServiceStub,
  SubmitRequestRequest,
  SubscribeRequest,
)

if TYPE_CHECKING:
  from collections.abc import AsyncIterator

  from adk_agent_sim.generated.adksim.v1 import SessionEvent, SimulatorSession
  from adk_agent_sim.generated.google.ai.generativelanguage.v1beta import (
    GenerateContentRequest,
  )
  from adk_agent_sim.plugin.config import PluginConfig


class SimulatorClient:
  """gRPC client wrapper for communicating with the Simulator Server.

  This class manages the gRPC channel lifecycle and provides access to the
  SimulatorService stub for making RPC calls.

  Attributes:
      config: The plugin configuration containing server connection details.
      channel: The grpclib Channel (set after connect()).
      stub: The SimulatorServiceStub (set after connect()).
      session_id: The ID of the current session (set after create_session()).
  """

  def __init__(self, config: PluginConfig) -> None:
    """Initialize the SimulatorClient.

    Args:
        config: Plugin configuration containing server_url and other settings.
    """
    self._config = config
    self._channel: Channel | None = None
    self._stub: SimulatorServiceStub | None = None
    self._session_id: str | None = None

  @property
  def config(self) -> PluginConfig:
    """Get the plugin configuration."""
    return self._config

  @property
  def channel(self) -> Channel | None:
    """Get the gRPC channel (None if not connected)."""
    return self._channel

  @property
  def stub(self) -> SimulatorServiceStub | None:
    """Get the service stub (None if not connected)."""
    return self._stub

  @property
  def session_id(self) -> str | None:
    """Get the current session ID (None if no session created)."""
    return self._session_id

  @property
  def is_connected(self) -> bool:
    """Check if the client is connected."""
    return self._channel is not None

  def _parse_server_url(self) -> tuple[str, int]:
    """Parse the server URL into host and port.

    Returns:
        A tuple of (host, port).

    Raises:
        ValueError: If the URL format is invalid or port cannot be determined.
    """
    url = self._config.server_url
    parsed = urlparse(url)

    # Handle URLs with scheme (http://host:port or grpc://host:port)
    if parsed.scheme in ("http", "https", "grpc"):
      host = parsed.hostname or "localhost"
      port = parsed.port
      if port is None:
        # Default ports: 443 for https, 50051 for grpc/http
        port = 443 if parsed.scheme == "https" else 50051
      return (host, port)

    # Handle bare host:port format
    if ":" in url:
      parts = url.split(":")
      if len(parts) == 2:
        host = parts[0] or "localhost"
        try:
          port = int(parts[1])
          return (host, port)
        except ValueError as e:
          raise ValueError(f"Invalid port in server URL: {url}") from e

    # Just a hostname, use default port
    return (url or "localhost", 50051)

  async def connect(self) -> None:
    """Establish a gRPC channel to the server.

    Creates a grpclib Channel and SimulatorServiceStub for making RPC calls.

    Raises:
        ValueError: If the server URL is invalid.
        RuntimeError: If already connected.
    """
    if self._channel is not None:
      raise RuntimeError("Client is already connected. Call close() first.")

    host, port = self._parse_server_url()
    self._channel = Channel(host=host, port=port)
    self._stub = SimulatorServiceStub(self._channel)

  async def close(self) -> None:
    """Close the gRPC channel cleanly.

    This should be called when the client is no longer needed to free resources.
    It is safe to call this method multiple times.
    """
    if self._channel is not None:
      self._channel.close()
      self._channel = None
      self._stub = None

  async def create_session(self, description: str | None = None) -> SimulatorSession:
    """Create a new simulation session.

    Calls the CreateSession RPC on the server and stores the returned session_id
    for use in subsequent calls.

    Args:
        description: Optional human-readable description for the session.

    Returns:
        The created SimulatorSession containing id, created_at, and description.

    Raises:
        RuntimeError: If the client is not connected (call connect() first).
    """
    if self._stub is None:
      raise RuntimeError("Client is not connected. Call connect() first.")

    request = CreateSessionRequest(description=description or "")
    response = await self._stub.create_session(request)
    self._session_id = response.session.id
    return response.session

  async def submit_request(
    self, turn_id: str, agent_name: str, request: GenerateContentRequest
  ) -> str:
    """Submit an intercepted LLM request to the server.

    Calls the SubmitRequest RPC on the server using the stored session_id.

    Args:
        turn_id: Correlation ID for this request/response pair.
        agent_name: Name of the agent making the request.
        request: The intercepted GenerateContentRequest from the agent.

    Returns:
        The event_id assigned to this request by the server.

    Raises:
        RuntimeError: If the client is not connected (call connect() first).
        RuntimeError: If no session has been created (call create_session() first).
    """
    if self._stub is None:
      raise RuntimeError("Client is not connected. Call connect() first.")

    if self._session_id is None:
      raise RuntimeError("No session created. Call create_session() first.")

    submit_request = SubmitRequestRequest(
      session_id=self._session_id,
      turn_id=turn_id,
      agent_name=agent_name,
      request=request,
    )
    response = await self._stub.submit_request(submit_request)
    return response.event_id

  async def subscribe(
    self, client_id: str | None = None
  ) -> AsyncIterator[SessionEvent]:
    """Subscribe to the event stream for the current session.

    Opens a server-side streaming RPC to receive session events in real-time.
    The server will first replay any historical events, then stream live events.

    Args:
        client_id: Optional client identifier for logging/debugging.
            If not provided, a UUID will be generated.

    Yields:
        SessionEvent objects as they are received from the server.

    Raises:
        RuntimeError: If the client is not connected (call connect() first).
        RuntimeError: If no session has been created (call create_session() first).

    Example:
        async for event in client.subscribe():
            print(f"Received event: {event.event_id}")
    """
    if self._stub is None:
      raise RuntimeError("Client is not connected. Call connect() first.")

    if self._session_id is None:
      raise RuntimeError("No session created. Call create_session() first.")

    request = SubscribeRequest(
      session_id=self._session_id,
      client_id=client_id or str(uuid4()),
    )

    async for response in self._stub.subscribe(request):
      yield response.event
