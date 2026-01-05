"""Plugin configuration for ADK Agent Simulator."""

import os
from dataclasses import dataclass

DEFAULT_SERVER_URL = "http://localhost:50051"


@dataclass
class PluginConfig:
  """Configuration for the ADK Simulator plugin.

  Attributes:
      server_url: URL of the ADK Simulator server.
      target_agents: List of agent names to intercept. None means intercept all.
      session_description: Optional description for the simulation session.
  """

  server_url: str = DEFAULT_SERVER_URL
  target_agents: list[str] | None = None
  session_description: str | None = None

  @classmethod
  def from_env(cls) -> PluginConfig:
    """Create a PluginConfig from environment variables.

    Environment variables:
        ADK_SIM_SERVER_URL: Server URL (default: "http://localhost:50051")
        ADK_SIM_TARGET_AGENTS: Comma-separated list of agent names (default: None)
        ADK_SIM_SESSION_DESCRIPTION: Session description (default: None)

    Returns:
        A new PluginConfig instance populated from environment variables.
    """
    server_url = os.environ.get("ADK_SIM_SERVER_URL", DEFAULT_SERVER_URL)

    target_agents_str = os.environ.get("ADK_SIM_TARGET_AGENTS")
    target_agents: list[str] | None = None
    if target_agents_str:
      target_agents = [
        agent.strip() for agent in target_agents_str.split(",") if agent.strip()
      ]
      if not target_agents:
        target_agents = None

    session_description = os.environ.get("ADK_SIM_SESSION_DESCRIPTION")

    return cls(
      server_url=server_url,
      target_agents=target_agents,
      session_description=session_description,
    )

  @classmethod
  def merge(
    cls, constructor_args: PluginConfig | None, env_config: PluginConfig
  ) -> PluginConfig:
    """Merge constructor arguments with environment configuration.

    Constructor args take precedence over env config. For each field,
    use the constructor value if it differs from the default, otherwise
    use the env value.

    Args:
        constructor_args: Configuration from constructor (may be None).
        env_config: Configuration from environment variables.

    Returns:
        A new PluginConfig with merged values.
    """
    if constructor_args is None:
      return env_config

    # Determine which values to use - constructor takes precedence if non-default
    server_url = (
      constructor_args.server_url
      if constructor_args.server_url != DEFAULT_SERVER_URL
      else env_config.server_url
    )
    target_agents = (
      constructor_args.target_agents
      if constructor_args.target_agents is not None
      else env_config.target_agents
    )
    session_description = (
      constructor_args.session_description
      if constructor_args.session_description is not None
      else env_config.session_description
    )

    return cls(
      server_url=server_url,
      target_agents=target_agents,
      session_description=session_description,
    )
