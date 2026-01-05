"""Tests for SimulatorClient."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from hamcrest import assert_that, equal_to, instance_of, is_, none

from adk_agent_sim.generated.adksim.v1 import (
  CreateSessionRequest,  # noqa: TC001  # Used at runtime in FakeSimulatorServiceStub
  CreateSessionResponse,
  SimulatorServiceStub,
  SimulatorSession,
)
from adk_agent_sim.plugin.client import SimulatorClient
from adk_agent_sim.plugin.config import PluginConfig


class FakeSimulatorServiceStub:
  """Fake implementation of SimulatorServiceStub for unit testing.

  This fake provides predictable responses without requiring a real server.
  It tracks calls for verification and returns configurable responses.
  """

  def __init__(self) -> None:
    """Initialize the fake stub with default behavior."""
    self.create_session_calls: list[CreateSessionRequest] = []
    self._next_session_id: str = str(uuid4())

  def set_next_session_id(self, session_id: str) -> None:
    """Configure the session ID to return on the next create_session call."""
    self._next_session_id = session_id

  async def create_session(
    self,
    request: CreateSessionRequest,
    *,
    timeout: float | None = None,  # noqa: ASYNC109
    deadline: object | None = None,
    metadata: object | None = None,
  ) -> CreateSessionResponse:
    """Fake create_session RPC returning a configurable session."""
    self.create_session_calls.append(request)
    session = SimulatorSession(
      id=self._next_session_id,
      created_at=datetime.now(tz=UTC),
      description=request.description,
    )
    return CreateSessionResponse(session=session)


class TestSimulatorClientInit:
  """Tests for SimulatorClient initialization."""

  def test_init_stores_config(self) -> None:
    """__init__ stores the provided config."""
    config = PluginConfig(server_url="http://localhost:9000")

    client = SimulatorClient(config)

    assert_that(client.config, is_(config))

  def test_init_channel_is_none(self) -> None:
    """__init__ leaves channel as None (not connected)."""
    config = PluginConfig(server_url="http://localhost:9000")

    client = SimulatorClient(config)

    assert_that(client.channel, is_(none()))

  def test_init_stub_is_none(self) -> None:
    """__init__ leaves stub as None (not connected)."""
    config = PluginConfig(server_url="http://localhost:9000")

    client = SimulatorClient(config)

    assert_that(client.stub, is_(none()))

  def test_is_connected_false_initially(self) -> None:
    """is_connected returns False before connect() is called."""
    config = PluginConfig(server_url="http://localhost:9000")

    client = SimulatorClient(config)

    assert_that(client.is_connected, is_(False))

  def test_init_session_id_is_none(self) -> None:
    """__init__ leaves session_id as None (no session created)."""
    config = PluginConfig(server_url="http://localhost:9000")

    client = SimulatorClient(config)

    assert_that(client.session_id, is_(none()))


class TestSimulatorClientParseServerUrl:
  """Tests for SimulatorClient URL parsing."""

  def test_parse_http_url_with_port(self) -> None:
    """Parses http://host:port correctly."""
    config = PluginConfig(server_url="http://example.com:8080")
    client = SimulatorClient(config)

    host, port = client._parse_server_url()

    assert_that((host, port), equal_to(("example.com", 8080)))

  def test_parse_http_url_default_port(self) -> None:
    """Parses http://host with default port 50051."""
    config = PluginConfig(server_url="http://example.com")
    client = SimulatorClient(config)

    host, port = client._parse_server_url()

    assert_that((host, port), equal_to(("example.com", 50051)))

  def test_parse_https_url_default_port(self) -> None:
    """Parses https://host with default port 443."""
    config = PluginConfig(server_url="https://example.com")
    client = SimulatorClient(config)

    host, port = client._parse_server_url()

    assert_that((host, port), equal_to(("example.com", 443)))

  def test_parse_grpc_scheme(self) -> None:
    """Parses grpc://host:port correctly."""
    config = PluginConfig(server_url="grpc://server.local:9999")
    client = SimulatorClient(config)

    host, port = client._parse_server_url()

    assert_that((host, port), equal_to(("server.local", 9999)))

  def test_parse_bare_host_port(self) -> None:
    """Parses host:port format without scheme."""
    config = PluginConfig(server_url="myserver:12345")
    client = SimulatorClient(config)

    host, port = client._parse_server_url()

    assert_that((host, port), equal_to(("myserver", 12345)))

  def test_parse_localhost_default_port(self) -> None:
    """Parses bare localhost with default port."""
    config = PluginConfig(server_url="localhost")
    client = SimulatorClient(config)

    host, port = client._parse_server_url()

    assert_that((host, port), equal_to(("localhost", 50051)))

  def test_parse_invalid_port_raises_value_error(self) -> None:
    """Raises ValueError for invalid port."""
    config = PluginConfig(server_url="host:notaport")
    client = SimulatorClient(config)

    with pytest.raises(ValueError, match="Invalid port"):
      client._parse_server_url()


class TestSimulatorClientConnect:
  """Tests for SimulatorClient.connect()."""

  @pytest.mark.asyncio
  async def test_connect_creates_channel(self) -> None:
    """connect() creates a grpclib Channel."""
    config = PluginConfig(server_url="http://localhost:50051")
    client = SimulatorClient(config)

    await client.connect()
    try:
      assert_that(client.channel, is_(instance_of(type(client.channel))))
      assert_that(client.is_connected, is_(True))
    finally:
      await client.close()

  @pytest.mark.asyncio
  async def test_connect_creates_stub(self) -> None:
    """connect() creates a SimulatorServiceStub."""
    config = PluginConfig(server_url="http://localhost:50051")
    client = SimulatorClient(config)

    await client.connect()
    try:
      assert_that(client.stub, is_(instance_of(SimulatorServiceStub)))
    finally:
      await client.close()

  @pytest.mark.asyncio
  async def test_connect_when_already_connected_raises_runtime_error(self) -> None:
    """connect() raises RuntimeError if already connected."""
    config = PluginConfig(server_url="http://localhost:50051")
    client = SimulatorClient(config)

    await client.connect()
    try:
      with pytest.raises(RuntimeError, match="already connected"):
        await client.connect()
    finally:
      await client.close()


class TestSimulatorClientClose:
  """Tests for SimulatorClient.close()."""

  @pytest.mark.asyncio
  async def test_close_clears_channel(self) -> None:
    """close() sets channel to None."""
    config = PluginConfig(server_url="http://localhost:50051")
    client = SimulatorClient(config)

    await client.connect()
    await client.close()

    assert_that(client.channel, is_(none()))

  @pytest.mark.asyncio
  async def test_close_clears_stub(self) -> None:
    """close() sets stub to None."""
    config = PluginConfig(server_url="http://localhost:50051")
    client = SimulatorClient(config)

    await client.connect()
    await client.close()

    assert_that(client.stub, is_(none()))

  @pytest.mark.asyncio
  async def test_close_sets_is_connected_false(self) -> None:
    """close() causes is_connected to return False."""
    config = PluginConfig(server_url="http://localhost:50051")
    client = SimulatorClient(config)

    await client.connect()
    await client.close()

    assert_that(client.is_connected, is_(False))

  @pytest.mark.asyncio
  async def test_close_is_idempotent(self) -> None:
    """close() can be called multiple times safely."""
    config = PluginConfig(server_url="http://localhost:50051")
    client = SimulatorClient(config)

    await client.connect()
    await client.close()
    await client.close()  # Should not raise

    assert_that(client.channel, is_(none()))

  @pytest.mark.asyncio
  async def test_close_without_connect_is_safe(self) -> None:
    """close() is safe to call without prior connect()."""
    config = PluginConfig(server_url="http://localhost:50051")
    client = SimulatorClient(config)

    # Should not raise
    await client.close()

    assert_that(client.channel, is_(none()))


class TestSimulatorClientCreateSession:
  """Tests for SimulatorClient.create_session()."""

  @pytest.mark.asyncio
  async def test_create_session_raises_when_not_connected(self) -> None:
    """create_session() raises RuntimeError if not connected."""
    config = PluginConfig(server_url="http://localhost:50051")
    client = SimulatorClient(config)

    with pytest.raises(RuntimeError, match="not connected"):
      await client.create_session()

  @pytest.mark.asyncio
  async def test_create_session_returns_simulator_session(self) -> None:
    """create_session() returns a SimulatorSession from the server."""
    config = PluginConfig(server_url="http://localhost:50051")
    client = SimulatorClient(config)
    fake_stub = FakeSimulatorServiceStub()
    expected_id = "test-session-123"
    fake_stub.set_next_session_id(expected_id)

    # Manually inject the fake stub (simulating connected state)
    client._stub = fake_stub  # type: ignore[assignment]

    session = await client.create_session(description="Test session")

    assert_that(session, instance_of(SimulatorSession))
    assert_that(session.id, equal_to(expected_id))

  @pytest.mark.asyncio
  async def test_create_session_stores_session_id(self) -> None:
    """create_session() stores the returned session_id for subsequent calls."""
    config = PluginConfig(server_url="http://localhost:50051")
    client = SimulatorClient(config)
    fake_stub = FakeSimulatorServiceStub()
    expected_id = "stored-session-456"
    fake_stub.set_next_session_id(expected_id)

    # Manually inject the fake stub
    client._stub = fake_stub  # type: ignore[assignment]

    await client.create_session(description="Test session")

    assert_that(client.session_id, equal_to(expected_id))

  @pytest.mark.asyncio
  async def test_create_session_passes_description_to_server(self) -> None:
    """create_session() passes the description to the server RPC."""
    config = PluginConfig(server_url="http://localhost:50051")
    client = SimulatorClient(config)
    fake_stub = FakeSimulatorServiceStub()

    # Manually inject the fake stub
    client._stub = fake_stub  # type: ignore[assignment]

    await client.create_session(description="My test description")

    assert_that(len(fake_stub.create_session_calls), equal_to(1))
    assert_that(
      fake_stub.create_session_calls[0].description,
      equal_to("My test description"),
    )

  @pytest.mark.asyncio
  async def test_create_session_with_none_description_sends_empty_string(self) -> None:
    """create_session() sends empty string when description is None."""
    config = PluginConfig(server_url="http://localhost:50051")
    client = SimulatorClient(config)
    fake_stub = FakeSimulatorServiceStub()

    # Manually inject the fake stub
    client._stub = fake_stub  # type: ignore[assignment]

    await client.create_session(description=None)

    assert_that(fake_stub.create_session_calls[0].description, equal_to(""))

  @pytest.mark.asyncio
  async def test_create_session_default_description_is_none(self) -> None:
    """create_session() with no arguments sends empty description."""
    config = PluginConfig(server_url="http://localhost:50051")
    client = SimulatorClient(config)
    fake_stub = FakeSimulatorServiceStub()

    # Manually inject the fake stub
    client._stub = fake_stub  # type: ignore[assignment]

    await client.create_session()

    assert_that(fake_stub.create_session_calls[0].description, equal_to(""))

  @pytest.mark.asyncio
  async def test_create_session_returns_description_from_response(self) -> None:
    """create_session() returns the description set by the server."""
    config = PluginConfig(server_url="http://localhost:50051")
    client = SimulatorClient(config)
    fake_stub = FakeSimulatorServiceStub()

    # Manually inject the fake stub
    client._stub = fake_stub  # type: ignore[assignment]

    session = await client.create_session(description="Expected description")

    assert_that(session.description, equal_to("Expected description"))
