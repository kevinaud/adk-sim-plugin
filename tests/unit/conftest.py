"""Unit test configuration with default timeout."""

import pytest


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
  """Apply default timeout of 10 seconds to all unit tests."""
  for item in items:
    if not item.get_closest_marker("timeout"):
      item.add_marker(pytest.mark.timeout(10))
