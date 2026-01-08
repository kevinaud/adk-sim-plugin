"""ADK Agent Simulator - Python Plugin.

This package provides tools for human-in-the-loop validation of ADK agent workflows.
"""

# Apply betterproto Struct patch early - MUST be before any Struct usage
# See adk_sim_protos_patch for details on why this is necessary
from adk_sim_protos_patch import apply_struct_patch

_ = apply_struct_patch  # Patch is auto-applied on import

from adk_agent_sim.plugin.core import SimulatorPlugin  # noqa: E402

__all__ = ["SimulatorPlugin"]
