from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from adk_sim_server.main import serve


@pytest.mark.asyncio
async def test_serve_initialization():
  with (
    patch("adk_sim_server.main.Server") as MockServer,
    patch("adk_sim_server.main.Database") as MockDatabase,
    patch("adk_sim_server.main.SessionRepository") as MockSessionRepo,
    patch("adk_sim_server.main.EventRepository") as MockEventRepo,
    patch("adk_sim_server.main.SessionManager") as MockSessionManager,
    patch("adk_sim_server.main.RequestQueue") as MockRequestQueue,
    patch("adk_sim_server.main.EventBroadcaster") as MockEventBroadcaster,
    patch("adk_sim_server.main.SimulatorService") as MockSimulatorService,
    patch("adk_sim_server.main.graceful_exit") as mock_graceful_exit,
  ):
    # Setup mocks
    mock_db_instance = MockDatabase.return_value
    mock_db_instance.connect = AsyncMock()
    mock_db_instance.create_tables = AsyncMock()
    mock_db_instance.disconnect = AsyncMock()

    mock_server_instance = MockServer.return_value
    mock_server_instance.start = AsyncMock()
    mock_server_instance.wait_closed = AsyncMock()

    # Mock SimulatorService instance to satisfy ServerReflection
    mock_simulator_service_instance = MockSimulatorService.return_value
    mock_simulator_service_instance.__mapping__ = MagicMock(
      return_value={"/test.Service/Method": MagicMock()}
    )

    # Mock graceful_exit context manager
    mock_graceful_exit.return_value.__enter__.return_value = None
    mock_graceful_exit.return_value.__exit__.return_value = None

    # Run the serve function
    await serve()

    # Verify Database initialization
    MockDatabase.assert_called_once()
    mock_db_instance.connect.assert_awaited_once()
    mock_db_instance.create_tables.assert_awaited_once()

    # Verify Repositories and Manager initialization
    MockSessionRepo.assert_called_once_with(mock_db_instance)
    MockEventRepo.assert_called_once_with(mock_db_instance)
    MockSessionManager.assert_called_once_with(
      MockSessionRepo.return_value, MockEventRepo.return_value
    )
    MockRequestQueue.assert_called_once()
    MockEventBroadcaster.assert_called_once()

    # Verify SimulatorService initialization
    MockSimulatorService.assert_called_once_with(
      MockSessionManager.return_value,
      MockEventRepo.return_value,
      MockRequestQueue.return_value,
      MockEventBroadcaster.return_value,
    )

    # Verify Server startup
    MockServer.assert_called_once()
    mock_server_instance.start.assert_awaited_once_with("0.0.0.0", 50051)
    mock_server_instance.wait_closed.assert_awaited_once()

    # Verify Database disconnection
    mock_db_instance.disconnect.assert_awaited_once()
