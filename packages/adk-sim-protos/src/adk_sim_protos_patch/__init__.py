"""Monkeypatch betterproto to fix Struct serialization.

betterproto's Struct.from_dict() and to_dict() methods do not work as expected:
- from_dict() stores raw Python values instead of Value objects
- to_dict() returns wrapped values like {'a': {'numberValue': 50}}
- Bytes serialization loses data entirely!

This module patches Struct to behave like Google's official protobuf library,
where values are properly inlined in the JSON representation.

This patch MUST be applied before any betterproto Struct operations.
Import this module early in your application's initialization.

Example:
    >>> from adk_sim_protos_patch import apply_struct_patch
    >>> apply_struct_patch()  # Or just import the module - it auto-applies
    >>>
    >>> from betterproto.lib.google.protobuf import Struct
    >>> s = Struct.from_dict({"a": 42, "b": "hello"})
    >>> s.to_dict()
    {'a': 42.0, 'b': 'hello'}

References:
    https://github.com/danielgtaylor/python-betterproto/issues/459
"""

from typing import TYPE_CHECKING, Any

import betterproto.lib.google.protobuf
from betterproto import Casing
from betterproto.utils import hybridmethod
from google.protobuf.json_format import MessageToDict as pb_MessageToDict
from google.protobuf.struct_pb2 import Struct as pb_Struct

if TYPE_CHECKING:
  from collections.abc import Mapping

  from betterproto.lib.google.protobuf import Struct

_patch_applied = False


def apply_struct_patch() -> None:
  """Apply the Struct monkeypatch to betterproto.

  Safe to call multiple times - will only apply once.
  """
  global _patch_applied
  if _patch_applied:
    return

  # Patch to_dict and to_pydict
  def struct_to_dict_method(
    self: Struct,
    casing: Casing = Casing.CAMEL,  # type: ignore[assignment]
    include_default_values: bool = False,
  ) -> dict[str, Any]:
    """Convert Struct to dict with properly inlined values.

    Uses Google's protobuf library for correct Struct → dict conversion.
    """
    s = pb_Struct()
    s.ParseFromString(self.SerializeToString())
    return pb_MessageToDict(s, preserving_proto_field_name=True)

  betterproto.lib.google.protobuf.Struct.to_dict = struct_to_dict_method
  betterproto.lib.google.protobuf.Struct.to_pydict = struct_to_dict_method

  # Patch from_dict (handles both class method and instance method usage)
  def struct_from_dict_method(self: Struct, value: Mapping[str, Any]) -> Struct:
    """Create Struct from dict with properly wrapped Value objects.

    Uses Google's protobuf library for correct dict → Struct conversion.
    """
    s = pb_Struct()
    s.update(value)
    return self.FromString(s.SerializeToString())

  def struct_from_dict_classmethod(
    cls: type[Struct], value: Mapping[str, Any]
  ) -> Struct:
    return struct_from_dict_method(cls(), value)

  from_dict = hybridmethod(struct_from_dict_classmethod)
  from_dict.instance_func = struct_from_dict_method

  betterproto.lib.google.protobuf.Struct.from_dict = from_dict

  _patch_applied = True


# Auto-apply the patch when this module is imported
apply_struct_patch()
