"""Persistence layer for ADK Agent Simulator.

This module provides SQLAlchemy Core schema definitions and database access
for storing SimulatorSession and SessionEvent protos using the Promoted Field
pattern.
"""

from adk_sim_server.persistence.core import (
  PaginatedSessions,
  SessionEventRepository,
  SessionRepositoryProtocol,
)
from adk_sim_server.persistence.database import Database
from adk_sim_server.persistence.event_repo import EventRepository
from adk_sim_server.persistence.schema import events, metadata, sessions
from adk_sim_server.persistence.session_repo import SessionRepository

__all__ = [
  "Database",
  "EventRepository",
  "PaginatedSessions",
  "SessionEventRepository",
  "SessionRepository",
  "SessionRepositoryProtocol",
  "events",
  "metadata",
  "sessions",
]
