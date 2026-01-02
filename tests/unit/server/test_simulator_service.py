"""Tests for SimulatorService."""

import pytest

from adk_agent_sim.server.services.simulator_service import SimulatorService


class TestSimulatorService:
  """Test suite for SimulatorService."""

  def test_service_initialization(self) -> None:
    """Test that SimulatorService can be instantiated."""
    service = SimulatorService()
    assert service is not None

  @pytest.mark.asyncio
  async def test_create_session_not_implemented(self) -> None:
    """Test that create_session raises NotImplementedError."""
    service = SimulatorService()
    with pytest.raises(NotImplementedError):
      await service.create_session({})

  @pytest.mark.asyncio
  async def test_list_sessions_not_implemented(self) -> None:
    """Test that list_sessions raises NotImplementedError."""
    service = SimulatorService()
    with pytest.raises(NotImplementedError):
      await service.list_sessions({})
