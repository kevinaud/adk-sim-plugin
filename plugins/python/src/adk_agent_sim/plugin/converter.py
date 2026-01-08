"""ADKProtoConverter - Conversion between ADK/Pydantic and betterproto objects.

This module provides the ADKProtoConverter class that bridges ADK runtime objects
(Pydantic models) with the betterproto-generated protocol buffer messages used
for gRPC communication with the Simulator Server.

The converter handles:
- LlmRequest (ADK/Pydantic) → GenerateContentRequest (betterproto)
- GenerateContentResponse (betterproto) → LlmResponse (ADK/Pydantic)

Usage:
    from adk_agent_sim.plugin.converter import ADKProtoConverter
    from google.adk.models import LlmRequest, LlmResponse

    # Convert request for gRPC transmission
    proto_request = ADKProtoConverter.llm_request_to_proto(adk_request)

    # Convert response from gRPC back to ADK format
    llm_response = ADKProtoConverter.proto_to_llm_response(proto_response)
"""

from typing import TYPE_CHECKING, Any

import adk_sim_protos.google.ai.generativelanguage.v1beta as glm
from google.genai import types as genai_types

if TYPE_CHECKING:
  from google.adk.models.llm_request import LlmRequest

from google.adk.models.llm_response import LlmResponse


class ADKProtoConverter:
  """Handles conversion between ADK/Pydantic objects and betterproto messages.

  This class serves as a bridge for the Simulator "Remote Brain" protocol,
  translating internal ADK runtime objects into betterproto-generated
  Google Generative AI protocol buffers for transmission over gRPC.

  The converter must handle the structural differences between:
  - ADK's bundled GenerateContentConfig (tools, safety, generation params)
  - Proto's separate fields (system_instruction, tools, safety_settings,
    generation_config)

  All methods are static since no state is required.
  """

  @staticmethod
  def llm_request_to_proto(adk_request: LlmRequest) -> glm.GenerateContentRequest:
    """Convert an ADK LlmRequest (Pydantic) to a GenerateContentRequest (betterproto).

    This method unpacks the bundled GenerateContentConfig into separate proto fields
    as expected by the Google Generative Language API schema.

    Args:
        adk_request: The ADK LlmRequest Pydantic object to convert.

    Returns:
        The corresponding betterproto GenerateContentRequest message.
    """
    # Build the proto request piece by piece
    model = _convert_model_name(adk_request.model) if adk_request.model else ""
    contents = _convert_contents(adk_request.contents)

    # Unpack config fields
    system_instruction = None
    tools: list[glm.Tool] = []
    safety_settings: list[glm.SafetySetting] = []
    generation_config = None

    if adk_request.config:
      config = adk_request.config

      # System instruction
      system_instruction = _convert_system_instruction(config.system_instruction)

      # Tools
      tools = _convert_tools(config.tools)

      # Safety settings
      safety_settings = _convert_safety_settings(config.safety_settings)

      # Generation config (remaining params)
      generation_config = _convert_generation_config(config)

    return glm.GenerateContentRequest(
      model=model,
      contents=contents,
      system_instruction=system_instruction,
      tools=tools,
      safety_settings=safety_settings,
      generation_config=generation_config,
    )

  @staticmethod
  def proto_to_llm_response(proto_response: glm.GenerateContentResponse) -> LlmResponse:
    """Convert a GenerateContentResponse (betterproto) to an ADK LlmResponse (Pydantic).

    This method uses betterproto's to_dict() to get a dictionary representation,
    then uses the SDK's _from_response() factory to create a GenerateContentResponse,
    and finally uses ADK's LlmResponse.create() factory.

    Args:
        proto_response: The betterproto GenerateContentResponse message to convert.

    Returns:
        The corresponding ADK LlmResponse Pydantic object.
    """
    # 1. Convert betterproto message to dict
    # betterproto's to_dict() produces camelCase keys matching the API schema
    response_dict = proto_response.to_dict()

    # 2. Create google.genai.types.GenerateContentResponse via _from_response factory
    # The SDK's factory method handles API response parsing
    # Note: _from_response is private but is the only way to create from dict
    genai_response = genai_types.GenerateContentResponse._from_response(  # pyright: ignore[reportPrivateUsage]
      response=response_dict,
      kwargs={},
    )

    # 3. Use ADK's factory to create LlmResponse
    # This handles mapping candidates, usage metadata, etc.
    return LlmResponse.create(genai_response)


def _convert_model_name(model: str | None) -> str:
  """Convert model name to the format expected by the API.

  The API expects model names in the format "models/{model_name}".
  If the input already has this format, return as-is.

  Args:
      model: The model name, possibly without the "models/" prefix.

  Returns:
      The model name with "models/" prefix.
  """
  if not model:
    return ""
  if model.startswith("models/"):
    return model
  return f"models/{model}"


def _convert_contents(
  contents: list[genai_types.Content] | None,
) -> list[glm.Content]:
  """Convert a list of Pydantic Content objects to betterproto Content messages.

  Args:
      contents: List of google.genai.types.Content Pydantic objects.

  Returns:
      List of betterproto Content messages.
  """
  if not contents:
    return []

  result: list[glm.Content] = []
  for content in contents:
    content_dict = content.model_dump(mode="json", exclude_none=True)
    result.append(glm.Content().from_dict(content_dict))
  return result


def _convert_system_instruction(
  system_instruction: Any,
) -> glm.Content | None:
  """Convert system instruction to betterproto Content message.

  ADK allows system_instruction to be:
  - str: Plain text instruction
  - Content: Full content object
  - Part: Single part
  - list[Part]: Multiple parts
  - File: (not supported in this conversion)

  Args:
      system_instruction: The system instruction in various forms.

  Returns:
      betterproto Content message or None.
  """
  if system_instruction is None:
    return None

  if isinstance(system_instruction, str):
    # Plain text - wrap in Content with single text Part
    return glm.Content(parts=[glm.Part(text=system_instruction)])

  if isinstance(system_instruction, genai_types.Content):
    # Full Content object - convert via dict
    si_dict = system_instruction.model_dump(mode="json", exclude_none=True)
    return glm.Content().from_dict(si_dict)

  if isinstance(system_instruction, genai_types.Part):
    # Single Part - wrap in Content
    part_dict = system_instruction.model_dump(mode="json", exclude_none=True)
    return glm.Content(parts=[glm.Part().from_dict(part_dict)])

  if isinstance(system_instruction, list):
    # List of Parts (or strings) - wrap in Content
    parts: list[glm.Part] = []
    for item in system_instruction:
      if isinstance(item, str):
        parts.append(glm.Part(text=item))
      elif isinstance(item, genai_types.Part):
        part_dict = item.model_dump(mode="json", exclude_none=True)
        parts.append(glm.Part().from_dict(part_dict))
    return glm.Content(parts=parts) if parts else None

  return None


def _convert_tools(
  tools: Any,
) -> list[glm.Tool]:
  """Convert a list of Pydantic Tool objects to betterproto Tool messages.

  Note: This only handles google.genai.types.Tool objects. Other tool types
  (like callables, MCP tools, or ClientSessions) are skipped.

  Args:
      tools: List of tools from GenerateContentConfig. May include Tool objects,
             callables, MCP tools, or ClientSessions.

  Returns:
      List of betterproto Tool messages (only Tool objects are converted).
  """
  if not tools:
    return []

  result: list[glm.Tool] = []
  for tool in tools:
    # Only handle google.genai.types.Tool objects that have model_dump
    if isinstance(tool, genai_types.Tool):
      tool_dict = tool.model_dump(mode="json", exclude_none=True)
      result.append(glm.Tool().from_dict(tool_dict))
  return result


def _convert_safety_settings(
  safety_settings: list[genai_types.SafetySetting] | None,
) -> list[glm.SafetySetting]:
  """Convert a list of Pydantic SafetySetting objects to betterproto messages.

  Handles enum name mapping between google.genai.types and betterproto:
  - genai: HARM_CATEGORY_DANGEROUS_CONTENT -> betterproto: DANGEROUS_CONTENT
  - Threshold names are the same

  Args:
      safety_settings: List of google.genai.types.SafetySetting Pydantic objects.

  Returns:
      List of betterproto SafetySetting messages.
  """
  if not safety_settings:
    return []

  result: list[glm.SafetySetting] = []
  for setting in safety_settings:
    setting_dict = setting.model_dump(mode="json", exclude_none=True)

    # Map category enum name (remove HARM_CATEGORY_ prefix if present)
    category_str = setting_dict.get("category", "")
    if category_str.startswith("HARM_CATEGORY_"):
      category_str = category_str.replace("HARM_CATEGORY_", "")

    # Map threshold enum name
    threshold_str = setting_dict.get("threshold", "")

    try:
      if category_str:
        category = glm.HarmCategory[category_str]
      else:
        category = glm.HarmCategory.UNSPECIFIED

      if threshold_str:
        threshold = glm.SafetySettingHarmBlockThreshold[threshold_str]
      else:
        threshold = glm.SafetySettingHarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED

      result.append(glm.SafetySetting(category=category, threshold=threshold))
    except KeyError:
      # Skip settings with unknown enum values
      continue

  return result


def _convert_generation_config(
  config: genai_types.GenerateContentConfig,
) -> glm.GenerationConfig | None:
  """Convert GenerateContentConfig generation parameters to GenerationConfig.

  Extracts only the generation-related fields (not tools, safety,
  system_instruction).

  Args:
      config: The google.genai.types.GenerateContentConfig Pydantic object.

  Returns:
      betterproto GenerationConfig message or None if no generation params set.
  """
  # Build a dict of generation config fields, excluding None values
  gen_config_dict: dict[str, object] = {}

  # Numeric/basic fields
  if config.temperature is not None:
    gen_config_dict["temperature"] = config.temperature
  if config.top_p is not None:
    gen_config_dict["topP"] = config.top_p
  if config.top_k is not None:
    gen_config_dict["topK"] = int(config.top_k)
  if config.candidate_count is not None:
    gen_config_dict["candidateCount"] = config.candidate_count
  if config.max_output_tokens is not None:
    gen_config_dict["maxOutputTokens"] = config.max_output_tokens
  if config.stop_sequences:
    gen_config_dict["stopSequences"] = config.stop_sequences
  if config.presence_penalty is not None:
    gen_config_dict["presencePenalty"] = config.presence_penalty
  if config.frequency_penalty is not None:
    gen_config_dict["frequencyPenalty"] = config.frequency_penalty
  if config.seed is not None:
    gen_config_dict["seed"] = config.seed
  if config.response_mime_type:
    gen_config_dict["responseMimeType"] = config.response_mime_type

  # Response schema - can be dict, Schema object, or type
  if config.response_schema is not None:
    if isinstance(config.response_schema, dict):
      gen_config_dict["responseSchema"] = config.response_schema
    else:
      # Must be a Pydantic model with model_dump
      model_dump = getattr(config.response_schema, "model_dump", None)
      if callable(model_dump):
        schema = model_dump(mode="json", exclude_none=True)
        gen_config_dict["responseSchema"] = schema

  if not gen_config_dict:
    return None

  return glm.GenerationConfig().from_dict(gen_config_dict)
