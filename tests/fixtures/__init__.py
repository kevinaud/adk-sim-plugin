"""Test fixtures package.

Provides fake implementations of repositories for unit testing.
These fakes are preferred over mocks per the project testing constitution.
"""

from tests.fixtures.fake_event_repo import FakeEventRepository
from tests.fixtures.fake_session_repo import FakeSessionRepository

__all__ = ["FakeEventRepository", "FakeSessionRepository"]
