"""ADK Agent Simulator Plugin.

This package provides the SimulatorPlugin class that integrates with the ADK
framework to intercept LLM calls and route them through the Remote Brain protocol.
"""

from adk_agent_sim.plugin.core import SimulatorPlugin

__all__ = ["SimulatorPlugin"]
