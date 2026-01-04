"""Tests for SimulatorService."""

from typing import TYPE_CHECKING

import pytest

from adk_agent_sim.generated.adksim.v1 import CreateSessionRequest
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
