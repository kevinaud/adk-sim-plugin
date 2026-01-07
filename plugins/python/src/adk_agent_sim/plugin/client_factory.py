"""SimulatorClientFactory - Factory for creating gRPC service stubs.

This module provides the SimulatorClientFactory class that manages gRPC channel
lifecycle and creates SimulatorServiceStub instances for server communication.

The factory pattern is used because betterproto's generated stub already provides
a clean API for RPC calls. The factory's role is to manage connection state and
provide properly configured stubs.

Usage:
    from adk_agent_sim.plugin.client_factory import SimulatorClientFactory
    from adk_agent_sim.plugin.config import PluginConfig

    config = PluginConfig(server_url="http://localhost:50051")
    factory = SimulatorClientFactory(config)

    try:
        stub = await factory.get_simulator_stub()
        # Use the stub for RPC calls...
        response = await stub.create_session(request)
    finally:
        await factory.close()
"""

from typing import TYPE_CHECKING
from urllib.parse import urlparse

from adk_sim_protos.adksim.v1 import SimulatorServiceStub
from grpclib.client import Channel

if TYPE_CHECKING:
  from adk_agent_sim.plugin.config import PluginConfig


class SimulatorClientFactory:
  """Factory for creating SimulatorServiceStub instances.

  This class manages the gRPC channel lifecycle and provides stubs for making
  RPC calls to the Simulator Server. The stub is created on-demand via
  get_simulator_stub() and uses betterproto's generated API directly.

  Attributes:
      config: The plugin configuration containing server connection details.
      channel: The grpclib Channel (set after connect()).
  """

  def __init__(self, config: PluginConfig) -> None:
    """Initialize the SimulatorClientFactory.

    Args:
        config: Plugin configuration containing server_url and other settings.
    """
    self._config = config
    self._channel: Channel | None = None

  @property
  def config(self) -> PluginConfig:
    """Get the plugin configuration."""
    return self._config

  @property
  def channel(self) -> Channel | None:
    """Get the gRPC channel (None if not connected)."""
    return self._channel

  @property
  def is_connected(self) -> bool:
    """Check if the client is connected."""
    return self._channel is not None

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

  async def close(self) -> None:
    """Close the gRPC channel cleanly.

    This should be called when the client is no longer needed to free resources.
    It is safe to call this method multiple times.
    """
    if self._channel is not None:
      self._channel.close()
      self._channel = None

  async def get_simulator_stub(self) -> SimulatorServiceStub:
    """Get the SimulatorServiceStub for making RPC calls.

    Returns:
        An instance of SimulatorServiceStub.
    """
    if not self.is_connected:
      await self.connect()

    assert self._channel is not None
    return SimulatorServiceStub(self._channel)

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
