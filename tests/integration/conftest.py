"""Integration test configuration with default timeout."""

import pytest


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
  """Apply default timeout of 30 seconds to all integration tests."""
  for item in items:
    if not item.get_closest_marker("timeout"):
      item.add_marker(pytest.mark.timeout(30))
