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

from grpclib.client import Channel

from adk_agent_sim.generated.adksim.v1 import (
  CreateSessionRequest,
  SimulatorServiceStub,
)

if TYPE_CHECKING:
  from adk_agent_sim.generated.adksim.v1 import SimulatorSession
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
