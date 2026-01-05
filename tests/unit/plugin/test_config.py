"""Tests for PluginConfig."""

import os
from unittest import mock

from adk_agent_sim.plugin.config import DEFAULT_SERVER_URL, PluginConfig


class TestPluginConfigFromEnv:
  """Tests for PluginConfig.from_env()."""

  def test_from_env_with_no_env_vars_returns_defaults(self) -> None:
    """from_env returns default values when no env vars are set."""
    with mock.patch.dict(os.environ, {}, clear=True):
      # Clear any existing ADK_SIM_* vars
      env = {k: v for k, v in os.environ.items() if not k.startswith("ADK_SIM_")}
      with mock.patch.dict(os.environ, env, clear=True):
        config = PluginConfig.from_env()

    assert config.server_url == DEFAULT_SERVER_URL
    assert config.target_agents is None
    assert config.session_description is None

  def test_from_env_reads_server_url(self) -> None:
    """from_env reads ADK_SIM_SERVER_URL."""
    with mock.patch.dict(
      os.environ, {"ADK_SIM_SERVER_URL": "http://custom:8080"}, clear=False
    ):
      config = PluginConfig.from_env()

    assert config.server_url == "http://custom:8080"

  def test_from_env_reads_session_description(self) -> None:
    """from_env reads ADK_SIM_SESSION_DESCRIPTION."""
    with mock.patch.dict(
      os.environ, {"ADK_SIM_SESSION_DESCRIPTION": "Test session"}, clear=False
    ):
      config = PluginConfig.from_env()

    assert config.session_description == "Test session"

  def test_from_env_reads_target_agents_single(self) -> None:
    """from_env reads a single agent from ADK_SIM_TARGET_AGENTS."""
    with mock.patch.dict(os.environ, {"ADK_SIM_TARGET_AGENTS": "agent1"}, clear=False):
      config = PluginConfig.from_env()

    assert config.target_agents == ["agent1"]

  def test_from_env_reads_target_agents_multiple(self) -> None:
    """from_env reads multiple agents from ADK_SIM_TARGET_AGENTS."""
    with mock.patch.dict(
      os.environ, {"ADK_SIM_TARGET_AGENTS": "agent1,agent2,agent3"}, clear=False
    ):
      config = PluginConfig.from_env()

    assert config.target_agents == ["agent1", "agent2", "agent3"]

  def test_from_env_strips_whitespace_from_target_agents(self) -> None:
    """from_env strips whitespace from agent names."""
    with mock.patch.dict(
      os.environ,
      {"ADK_SIM_TARGET_AGENTS": " agent1 , agent2 , agent3 "},
      clear=False,
    ):
      config = PluginConfig.from_env()

    assert config.target_agents == ["agent1", "agent2", "agent3"]

  def test_from_env_handles_empty_target_agents(self) -> None:
    """from_env returns None for empty ADK_SIM_TARGET_AGENTS."""
    with mock.patch.dict(os.environ, {"ADK_SIM_TARGET_AGENTS": ""}, clear=False):
      config = PluginConfig.from_env()

    assert config.target_agents is None

  def test_from_env_handles_whitespace_only_target_agents(self) -> None:
    """from_env returns None for whitespace-only ADK_SIM_TARGET_AGENTS."""
    with mock.patch.dict(os.environ, {"ADK_SIM_TARGET_AGENTS": " , , "}, clear=False):
      config = PluginConfig.from_env()

    assert config.target_agents is None

  def test_from_env_reads_all_variables(self) -> None:
    """from_env reads all environment variables together."""
    env_vars = {
      "ADK_SIM_SERVER_URL": "http://test:9090",
      "ADK_SIM_TARGET_AGENTS": "agentA,agentB",
      "ADK_SIM_SESSION_DESCRIPTION": "Integration test",
    }
    with mock.patch.dict(os.environ, env_vars, clear=False):
      config = PluginConfig.from_env()

    assert config.server_url == "http://test:9090"
    assert config.target_agents == ["agentA", "agentB"]
    assert config.session_description == "Integration test"


class TestPluginConfigMerge:
  """Tests for PluginConfig.merge()."""

  def test_merge_returns_env_config_when_constructor_args_is_none(self) -> None:
    """merge returns env_config when constructor_args is None."""
    env_config = PluginConfig(
      server_url="http://env:1234",
      target_agents=["env_agent"],
      session_description="env description",
    )

    result = PluginConfig.merge(None, env_config)

    assert result == env_config

  def test_merge_constructor_server_url_takes_precedence(self) -> None:
    """merge uses constructor server_url when non-default."""
    constructor_args = PluginConfig(server_url="http://constructor:5555")
    env_config = PluginConfig(server_url="http://env:6666")

    result = PluginConfig.merge(constructor_args, env_config)

    assert result.server_url == "http://constructor:5555"

  def test_merge_falls_back_to_env_server_url_when_constructor_is_default(
    self,
  ) -> None:
    """merge uses env server_url when constructor uses default."""
    constructor_args = PluginConfig()  # Uses default server_url
    env_config = PluginConfig(server_url="http://env:7777")

    result = PluginConfig.merge(constructor_args, env_config)

    assert result.server_url == "http://env:7777"

  def test_merge_constructor_target_agents_takes_precedence(self) -> None:
    """merge uses constructor target_agents when set."""
    constructor_args = PluginConfig(target_agents=["constructor_agent"])
    env_config = PluginConfig(target_agents=["env_agent"])

    result = PluginConfig.merge(constructor_args, env_config)

    assert result.target_agents == ["constructor_agent"]

  def test_merge_falls_back_to_env_target_agents_when_constructor_is_none(
    self,
  ) -> None:
    """merge uses env target_agents when constructor is None."""
    constructor_args = PluginConfig(target_agents=None)
    env_config = PluginConfig(target_agents=["env_agent"])

    result = PluginConfig.merge(constructor_args, env_config)

    assert result.target_agents == ["env_agent"]

  def test_merge_constructor_session_description_takes_precedence(self) -> None:
    """merge uses constructor session_description when set."""
    constructor_args = PluginConfig(session_description="constructor desc")
    env_config = PluginConfig(session_description="env desc")

    result = PluginConfig.merge(constructor_args, env_config)

    assert result.session_description == "constructor desc"

  def test_merge_falls_back_to_env_session_description_when_constructor_is_none(
    self,
  ) -> None:
    """merge uses env session_description when constructor is None."""
    constructor_args = PluginConfig(session_description=None)
    env_config = PluginConfig(session_description="env desc")

    result = PluginConfig.merge(constructor_args, env_config)

    assert result.session_description == "env desc"

  def test_merge_combines_values_from_both_configs(self) -> None:
    """merge correctly combines values from constructor and env."""
    constructor_args = PluginConfig(
      server_url="http://custom:8080",
      # target_agents is None (default)
      session_description="from constructor",
    )
    env_config = PluginConfig(
      server_url="http://env:9090",
      target_agents=["agent1", "agent2"],
      session_description="from env",
    )

    result = PluginConfig.merge(constructor_args, env_config)

    assert result.server_url == "http://custom:8080"
    assert result.target_agents == ["agent1", "agent2"]
    assert result.session_description == "from constructor"

  def test_merge_returns_new_instance(self) -> None:
    """merge returns a new PluginConfig instance."""
    constructor_args = PluginConfig(server_url="http://test:1111")
    env_config = PluginConfig(server_url="http://env:2222")

    result = PluginConfig.merge(constructor_args, env_config)

    assert result is not constructor_args
    assert result is not env_config
