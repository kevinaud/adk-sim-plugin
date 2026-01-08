"""Tests for PendingFutureRegistry."""

import asyncio

import pytest
from adk_agent_sim.plugin.futures import PendingFutureRegistry
from adk_sim_protos.google.ai.generativelanguage.v1beta import (
  Candidate,
  Content,
  GenerateContentResponse,
  Part,
)
from hamcrest import assert_that, equal_to, instance_of, is_


@pytest.fixture
def registry() -> PendingFutureRegistry:
  """Create a PendingFutureRegistry for testing."""
  return PendingFutureRegistry()


@pytest.fixture
def sample_response() -> GenerateContentResponse:
  """Create a sample GenerateContentResponse for testing."""
  return GenerateContentResponse(
    candidates=[
      Candidate(
        content=Content(
          parts=[Part(text="Hello from human!")],
          role="model",
        )
      )
    ]
  )


class TestPendingFutureRegistryCreate:
  """Tests for PendingFutureRegistry.create()."""

  async def test_create_returns_future(self, registry: PendingFutureRegistry) -> None:
    """create() returns an asyncio.Future."""
    future = registry.create("turn-123")

    assert_that(future, instance_of(asyncio.Future))

  async def test_create_stores_future(self, registry: PendingFutureRegistry) -> None:
    """create() stores the future in the registry."""
    registry.create("turn-123")

    assert_that(len(registry), equal_to(1))
    assert_that(registry.has_pending("turn-123"), is_(True))

  async def test_create_multiple_futures(self, registry: PendingFutureRegistry) -> None:
    """create() can store multiple futures for different turn_ids."""
    registry.create("turn-1")
    registry.create("turn-2")
    registry.create("turn-3")

    assert_that(len(registry), equal_to(3))
    assert_that(registry.has_pending("turn-1"), is_(True))
    assert_that(registry.has_pending("turn-2"), is_(True))
    assert_that(registry.has_pending("turn-3"), is_(True))

  async def test_create_duplicate_raises_error(
    self, registry: PendingFutureRegistry
  ) -> None:
    """create() raises ValueError for duplicate turn_id."""
    registry.create("turn-123")

    with pytest.raises(ValueError, match="Future already exists for turn_id"):
      registry.create("turn-123")


class TestPendingFutureRegistryResolve:
  """Tests for PendingFutureRegistry.resolve()."""

  async def test_resolve_sets_future_result(
    self, registry: PendingFutureRegistry, sample_response: GenerateContentResponse
  ) -> None:
    """resolve() sets the result on the future."""
    future = registry.create("turn-123")

    registry.resolve("turn-123", sample_response)

    result = await future
    assert_that(result, equal_to(sample_response))

  async def test_resolve_removes_from_registry(
    self, registry: PendingFutureRegistry, sample_response: GenerateContentResponse
  ) -> None:
    """resolve() removes the future from the registry."""
    registry.create("turn-123")

    registry.resolve("turn-123", sample_response)

    assert_that(len(registry), equal_to(0))
    assert_that(registry.has_pending("turn-123"), is_(False))

  async def test_resolve_returns_true_on_success(
    self, registry: PendingFutureRegistry, sample_response: GenerateContentResponse
  ) -> None:
    """resolve() returns True when future is found and resolved."""
    registry.create("turn-123")

    result = registry.resolve("turn-123", sample_response)

    assert_that(result, is_(True))

  async def test_resolve_returns_false_for_unknown_turn_id(
    self, registry: PendingFutureRegistry, sample_response: GenerateContentResponse
  ) -> None:
    """resolve() returns False for unknown turn_id (idempotency)."""
    result = registry.resolve("unknown-turn", sample_response)

    assert_that(result, is_(False))

  async def test_resolve_idempotent_for_already_resolved(
    self, registry: PendingFutureRegistry, sample_response: GenerateContentResponse
  ) -> None:
    """resolve() is idempotent - second resolve for same turn_id returns False."""
    registry.create("turn-123")
    registry.resolve("turn-123", sample_response)

    # Second resolve for same turn_id
    result = registry.resolve("turn-123", sample_response)

    assert_that(result, is_(False))


class TestPendingFutureRegistryCancelAll:
  """Tests for PendingFutureRegistry.cancel_all()."""

  async def test_cancel_all_cancels_pending_futures(
    self, registry: PendingFutureRegistry
  ) -> None:
    """cancel_all() cancels all pending futures."""
    future1 = registry.create("turn-1")
    future2 = registry.create("turn-2")

    registry.cancel_all()

    assert_that(future1.cancelled(), is_(True))
    assert_that(future2.cancelled(), is_(True))

  async def test_cancel_all_clears_registry(
    self, registry: PendingFutureRegistry
  ) -> None:
    """cancel_all() clears the registry."""
    registry.create("turn-1")
    registry.create("turn-2")

    registry.cancel_all()

    assert_that(len(registry), equal_to(0))

  async def test_cancel_all_returns_count(
    self, registry: PendingFutureRegistry
  ) -> None:
    """cancel_all() returns the number of cancelled futures."""
    registry.create("turn-1")
    registry.create("turn-2")
    registry.create("turn-3")

    count = registry.cancel_all()

    assert_that(count, equal_to(3))

  async def test_cancel_all_returns_zero_for_empty_registry(
    self, registry: PendingFutureRegistry
  ) -> None:
    """cancel_all() returns 0 for empty registry."""
    count = registry.cancel_all()

    assert_that(count, equal_to(0))

  async def test_cancel_all_does_not_cancel_already_done_futures(
    self, registry: PendingFutureRegistry, sample_response: GenerateContentResponse
  ) -> None:
    """cancel_all() does not cancel already-done futures."""
    future1 = registry.create("turn-1")
    registry.create("turn-2")

    # Manually resolve one future before cancel_all
    future1.set_result(sample_response)

    count = registry.cancel_all()

    # Only 1 future was actually cancelled (turn-2)
    assert_that(count, equal_to(1))
    assert_that(future1.cancelled(), is_(False))
    assert_that(future1.done(), is_(True))


class TestPendingFutureRegistryIntegration:
  """Integration tests for PendingFutureRegistry."""

  async def test_full_request_response_flow(
    self, registry: PendingFutureRegistry, sample_response: GenerateContentResponse
  ) -> None:
    """Test the complete flow: create, resolve, await."""
    # Simulate the request path creating a future
    future = registry.create("turn-abc")

    # Simulate the listen loop resolving the future
    async def resolve_after_delay() -> None:
      await asyncio.sleep(0.01)
      registry.resolve("turn-abc", sample_response)

    # Start the resolver task
    resolver_task = asyncio.create_task(resolve_after_delay())

    # Await the future (this would block in real code)
    result = await future

    await resolver_task

    assert_that(result, equal_to(sample_response))
    assert_that(len(registry), equal_to(0))

  async def test_concurrent_requests(self, registry: PendingFutureRegistry) -> None:
    """Test handling multiple concurrent requests."""
    # Create multiple pending requests
    future1 = registry.create("turn-1")
    future2 = registry.create("turn-2")
    future3 = registry.create("turn-3")

    response1 = GenerateContentResponse(
      candidates=[Candidate(content=Content(parts=[Part(text="Response 1")]))]
    )
    response2 = GenerateContentResponse(
      candidates=[Candidate(content=Content(parts=[Part(text="Response 2")]))]
    )
    response3 = GenerateContentResponse(
      candidates=[Candidate(content=Content(parts=[Part(text="Response 3")]))]
    )

    # Resolve out of order
    registry.resolve("turn-2", response2)
    registry.resolve("turn-1", response1)
    registry.resolve("turn-3", response3)

    # All futures should have correct results
    result1 = await future1
    result2 = await future2
    result3 = await future3

    assert_that(result1, equal_to(response1))
    assert_that(result2, equal_to(response2))
    assert_that(result3, equal_to(response3))
