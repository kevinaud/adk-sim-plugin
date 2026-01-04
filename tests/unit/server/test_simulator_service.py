"""Tests for SimulatorService."""

from typing import TYPE_CHECKING

import pytest

from adk_agent_sim.generated.adksim.v1 import CreateSessionRequest, ListSessionsRequest
from adk_agent_sim.server.services.simulator_service import SimulatorService

if TYPE_CHECKING:
  from adk_agent_sim.server.session_manager import SessionManager


class TestSimulatorService:
  """Test suite for SimulatorService."""

  def test_service_initialization(self, manager: SessionManager) -> None:
    """Test that SimulatorService can be instantiated."""
    service = SimulatorService(session_manager=manager)
    assert service is not None

  @pytest.mark.asyncio
  async def test_create_session_success(self, manager: SessionManager) -> None:
    """Test that create_session creates a session successfully."""
    service = SimulatorService(session_manager=manager)
    request = CreateSessionRequest(description="test session")

    response = await service.create_session(request)

    assert response.session is not None
    assert response.session.description == "test session"
    assert response.session.id is not None

  @pytest.mark.asyncio
  async def test_list_sessions_success(self, manager: SessionManager) -> None:
    """Test that list_sessions returns sessions successfully."""
    service = SimulatorService(session_manager=manager)
    # Create some sessions
    await manager.create_session("session 1")
    await manager.create_session("session 2")

    request = ListSessionsRequest(page_size=10)
    response = await service.list_sessions(request)

    assert len(response.sessions) == 2
    assert response.sessions[0].description == "session 2"  # Most recent first
    assert response.sessions[1].description == "session 1"
    assert not response.next_page_token

  @pytest.mark.asyncio
  async def test_list_sessions_pagination(self, manager: SessionManager) -> None:
    """Test that list_sessions handles pagination correctly."""
    service = SimulatorService(session_manager=manager)
    # Create 3 sessions
    await manager.create_session("session 1")
    await manager.create_session("session 2")
    await manager.create_session("session 3")

    # Request page size 2
    request = ListSessionsRequest(page_size=2)
    response = await service.list_sessions(request)

    assert len(response.sessions) == 2
    assert response.sessions[0].description == "session 3"
    assert response.sessions[1].description == "session 2"
    assert response.next_page_token

    # Request next page
    request = ListSessionsRequest(page_size=2, page_token=response.next_page_token)
    response = await service.list_sessions(request)

    assert len(response.sessions) == 1
    assert response.sessions[0].description == "session 1"
    assert not response.next_page_token
