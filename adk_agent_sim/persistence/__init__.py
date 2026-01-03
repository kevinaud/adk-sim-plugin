"""Persistence layer for ADK Agent Simulator.

This module provides SQLAlchemy Core schema definitions and database access
for storing SimulatorSession and SessionEvent protos using the Promoted Field
pattern.
"""

from adk_agent_sim.persistence.schema import events, metadata, sessions

__all__ = ["events", "metadata", "sessions"]
