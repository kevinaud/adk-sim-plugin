"""Tests for SimulatorPlugin."""

import pytest

from adk_agent_sim.plugin import SimulatorPlugin


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
