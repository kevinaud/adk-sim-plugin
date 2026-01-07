"""ADK Agent Simulator - Remote Brain Protocol.

This package provides tools for human-in-the-loop validation of ADK agent workflows.
"""

# Apply betterproto Struct patch early - MUST be before any Struct usage
# See betterproto_patch.py for details on why this is necessary
from adk_sim_protos import betterproto_patch as _betterproto_patch

_ = _betterproto_patch  # Mark as used - import triggers patch application
