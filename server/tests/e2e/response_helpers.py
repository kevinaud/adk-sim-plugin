"""Helper functions for constructing gRPC Proto messages for E2E tests.

These utilities simplify creating complex nested proto structures like
GenerateContentResponse, Candidate, Content, Part, FunctionCall, etc.

Note: betterproto's Struct has been patched via adk_sim_protos_patch
to properly handle from_dict/to_dict serialization. The patch is auto-applied
when adk_sim_protos_patch is imported.
"""

from typing import Any

from adk_sim_protos.google.ai.generativelanguage.v1beta import (
  Candidate,
  Content,
  FunctionCall,
  GenerateContentResponse,
  Part,
)
from betterproto.lib.google.protobuf import Struct


def make_tool_call_response(
  tool_name: str, args: dict[str, Any]
) -> GenerateContentResponse:
  """Create a response that instructs ADK to call a tool.

  Args:
      tool_name: The name of the function to call (must match ADK tool name).
      args: Dictionary of arguments to pass to the function.

  Returns:
      A GenerateContentResponse proto containing the FunctionCall.
  """
  return GenerateContentResponse(
    candidates=[
      Candidate(
        content=Content(
          role="model",
          parts=[
            Part(
              function_call=FunctionCall(
                name=tool_name,
                args=Struct.from_dict(args),
              )
            )
          ],
        )
      )
    ]
  )


def make_text_response(text: str) -> GenerateContentResponse:
  """Create a response containing a final text answer.

  Args:
      text: The text content to return.

  Returns:
      A GenerateContentResponse proto containing the text Part.
  """
  return GenerateContentResponse(
    candidates=[
      Candidate(
        content=Content(
          role="model",
          parts=[Part(text=text)],
        )
      )
    ]
  )
