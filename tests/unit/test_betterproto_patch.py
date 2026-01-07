"""Tests for the betterproto Struct monkeypatch.

These tests verify that the patch in adk_agent_sim.betterproto_patch correctly
fixes betterproto's broken Struct.from_dict() and to_dict() behavior.
"""

import json
from typing import Any

from betterproto.lib.google.protobuf import Struct, Value

# Import the package to ensure the patch is applied
import adk_agent_sim

_ = adk_agent_sim  # Mark as used


class TestBetterprotoStructPatch:
  """Tests for patched Struct behavior."""

  def test_from_dict_creates_value_objects(self) -> None:
    """from_dict should create proper Value objects internally."""
    data: dict[str, Any] = {"a": 42, "b": "hello"}
    s = Struct.from_dict(data)

    # Values should be Value objects, not raw Python types
    assert isinstance(s.fields["a"], Value)
    assert isinstance(s.fields["b"], Value)

  def test_to_dict_returns_clean_dict(self) -> None:
    """to_dict should return clean dict without Value wrappers."""
    data: dict[str, Any] = {"a": 42, "b": "hello"}
    s = Struct.from_dict(data)
    result = s.to_dict()

    # Should be clean dict
    assert result == {"a": 42.0, "b": "hello"}
    # NOT wrapped like {'a': {'numberValue': 42.0}}

  def test_bytes_roundtrip_preserves_values(self) -> None:
    """Bytes serialization roundtrip should preserve values."""
    original: dict[str, Any] = {"a": 50, "b": 100}
    struct = Struct.from_dict(original)

    # Serialize to bytes and back
    proto_bytes = bytes(struct)
    parsed = Struct().parse(proto_bytes)
    result = parsed.to_dict()

    # Values should survive the roundtrip
    assert result == {"a": 50.0, "b": 100.0}

  def test_to_json_produces_valid_json(self) -> None:
    """to_json should produce valid JSON with clean values."""
    data: dict[str, Any] = {"a": 42, "b": "hello"}
    s = Struct.from_dict(data)
    json_str = s.to_json()
    parsed = json.loads(json_str)

    assert parsed == {"a": 42.0, "b": "hello"}

  def test_nested_dict_roundtrip(self) -> None:
    """Nested dicts should survive bytes roundtrip."""
    original: dict[str, Any] = {"outer": {"inner": 42}}
    struct = Struct.from_dict(original)

    proto_bytes = bytes(struct)
    parsed = Struct().parse(proto_bytes)
    result = parsed.to_dict()

    assert result == {"outer": {"inner": 42.0}}

  def test_list_in_struct_roundtrip(self) -> None:
    """Lists should survive bytes roundtrip."""
    original: dict[str, Any] = {"items": [1, 2, 3]}
    struct = Struct.from_dict(original)

    proto_bytes = bytes(struct)
    parsed = Struct().parse(proto_bytes)
    result = parsed.to_dict()

    assert result == {"items": [1.0, 2.0, 3.0]}

  def test_mixed_types(self) -> None:
    """Mixed types should all work correctly."""
    original: dict[str, Any] = {
      "num": 42,
      "str": "hello",
      "bool": True,
      "null": None,
      "nested": {"a": 1},
      "list": [1, "two", False],
    }
    struct = Struct.from_dict(original)

    proto_bytes = bytes(struct)
    parsed = Struct().parse(proto_bytes)
    result = parsed.to_dict()

    assert result["num"] == 42.0
    assert result["str"] == "hello"
    assert result["bool"] is True
    assert result["null"] is None
    assert result["nested"] == {"a": 1.0}
    assert result["list"] == [1.0, "two", False]
