"""Persistence layer for ADK Agent Simulator.

This module provides SQLAlchemy Core schema definitions and database access
for storing SimulatorSession and SessionEvent protos using the Promoted Field
pattern.
"""

from adk_agent_sim.persistence.database import Database
from adk_agent_sim.persistence.event_repo import EventRepository
from adk_agent_sim.persistence.schema import events, metadata, sessions
from adk_agent_sim.persistence.session_repo import PaginatedSessions, SessionRepository

__all__ = [
  "Database",
  "EventRepository",
  "PaginatedSessions",
  "SessionRepository",
  "events",
  "metadata",
  "sessions",
]
