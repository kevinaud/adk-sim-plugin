"""Tests for ADKProtoConverter.

Tests cover:
- llm_request_to_proto: Converting ADK LlmRequest to GenerateContentRequest
- proto_to_llm_response: Converting GenerateContentResponse to LlmResponse
- Edge cases: empty fields, various system_instruction formats, enum mapping
"""

import adk_sim_protos.google.ai.generativelanguage.v1beta as glm
import pytest
from adk_agent_sim.plugin.converter import ADKProtoConverter
from google.adk.models import LlmRequest, LlmResponse
from google.genai import types as genai_types
from hamcrest import (
  assert_that,
  contains,
  equal_to,
  has_length,
  has_properties,
  instance_of,
  not_none,
)


class TestLlmRequestToProto:
  """Tests for ADKProtoConverter.llm_request_to_proto()."""

  def test_basic_request_with_model_and_contents(self) -> None:
    """Test converting a simple request with model and contents."""
    part = genai_types.Part(text="Hello")
    contents = [genai_types.Content(role="user", parts=[part])]
    adk_request = LlmRequest(
      model="gemini-2.0-flash",
      contents=contents,
      config=genai_types.GenerateContentConfig(),
    )

    proto_request = ADKProtoConverter.llm_request_to_proto(adk_request)

    assert_that(
      proto_request,
      has_properties(
        model="models/gemini-2.0-flash",
        contents=contains(
          has_properties(
            role="user",
            parts=contains(has_properties(text="Hello")),
          )
        ),
      ),
    )

  def test_model_name_already_prefixed(self) -> None:
    """Test that model names already prefixed with 'models/' are unchanged."""
    adk_request = LlmRequest(
      model="models/gemini-1.5-pro",
      contents=[],
      config=genai_types.GenerateContentConfig(),
    )

    proto_request = ADKProtoConverter.llm_request_to_proto(adk_request)

    assert_that(proto_request.model, equal_to("models/gemini-1.5-pro"))

  def test_empty_model_name(self) -> None:
    """Test handling of empty/None model name."""
    adk_request = LlmRequest(
      model=None,
      contents=[],
      config=genai_types.GenerateContentConfig(),
    )

    proto_request = ADKProtoConverter.llm_request_to_proto(adk_request)

    assert_that(proto_request.model, equal_to(""))

  def test_multiple_contents_and_parts(self) -> None:
    """Test converting multiple contents with multiple parts."""
    contents = [
      genai_types.Content(
        role="user",
        parts=[
          genai_types.Part(text="Part 1"),
          genai_types.Part(text="Part 2"),
        ],
      ),
      genai_types.Content(
        role="model",
        parts=[genai_types.Part(text="Response")],
      ),
    ]
    adk_request = LlmRequest(
      model="gemini-2.0-flash",
      contents=contents,
      config=genai_types.GenerateContentConfig(),
    )

    proto_request = ADKProtoConverter.llm_request_to_proto(adk_request)

    assert_that(
      proto_request.contents,
      contains(
        has_properties(role="user", parts=has_length(2)),
        has_properties(role="model"),
      ),
    )

  def test_system_instruction_as_string(self) -> None:
    """Test converting system instruction from string format."""
    adk_request = LlmRequest(
      model="gemini-2.0-flash",
      contents=[],
      config=genai_types.GenerateContentConfig(
        system_instruction="You are a helpful assistant."
      ),
    )

    proto_request = ADKProtoConverter.llm_request_to_proto(adk_request)

    assert_that(
      proto_request.system_instruction,
      has_properties(
        parts=contains(has_properties(text="You are a helpful assistant."))
      ),
    )

  def test_system_instruction_as_content(self) -> None:
    """Test converting system instruction from Content format."""
    system_content = genai_types.Content(
      parts=[
        genai_types.Part(text="System instruction line 1"),
        genai_types.Part(text="System instruction line 2"),
      ]
    )
    adk_request = LlmRequest(
      model="gemini-2.0-flash",
      contents=[],
      config=genai_types.GenerateContentConfig(system_instruction=system_content),
    )

    proto_request = ADKProtoConverter.llm_request_to_proto(adk_request)

    assert_that(
      proto_request.system_instruction,
      has_properties(
        parts=contains(
          has_properties(text="System instruction line 1"),
          has_properties(text="System instruction line 2"),
        )
      ),
    )

  def test_system_instruction_as_part(self) -> None:
    """Test converting system instruction from single Part format."""
    adk_request = LlmRequest(
      model="gemini-2.0-flash",
      contents=[],
      config=genai_types.GenerateContentConfig(
        system_instruction=genai_types.Part(text="System as Part")
      ),
    )

    proto_request = ADKProtoConverter.llm_request_to_proto(adk_request)

    assert_that(
      proto_request.system_instruction,
      has_properties(parts=contains(has_properties(text="System as Part"))),
    )

  def test_system_instruction_as_part_list(self) -> None:
    """Test converting system instruction from list[Part] format."""
    adk_request = LlmRequest(
      model="gemini-2.0-flash",
      contents=[],
      config=genai_types.GenerateContentConfig(
        system_instruction=[
          genai_types.Part(text="Part A"),
          genai_types.Part(text="Part B"),
        ]
      ),
    )

    proto_request = ADKProtoConverter.llm_request_to_proto(adk_request)

    assert_that(
      proto_request.system_instruction,
      has_properties(
        parts=contains(
          has_properties(text="Part A"),
          has_properties(text="Part B"),
        )
      ),
    )

  def test_tools_conversion(self) -> None:
    """Test converting tools with function declarations."""
    tool = genai_types.Tool(
      function_declarations=[
        genai_types.FunctionDeclaration(
          name="get_weather",
          description="Get the weather for a location",
        )
      ]
    )
    adk_request = LlmRequest(
      model="gemini-2.0-flash",
      contents=[],
      config=genai_types.GenerateContentConfig(tools=[tool]),
    )

    proto_request = ADKProtoConverter.llm_request_to_proto(adk_request)

    assert_that(
      proto_request.tools,
      contains(
        has_properties(
          function_declarations=contains(
            has_properties(
              name="get_weather",
              description="Get the weather for a location",
            )
          )
        )
      ),
    )

  def test_safety_settings_conversion(self) -> None:
    """Test converting safety settings with enum mapping."""
    safety_setting = genai_types.SafetySetting(
      category=genai_types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold=genai_types.HarmBlockThreshold.BLOCK_ONLY_HIGH,
    )
    adk_request = LlmRequest(
      model="gemini-2.0-flash",
      contents=[],
      config=genai_types.GenerateContentConfig(safety_settings=[safety_setting]),
    )

    proto_request = ADKProtoConverter.llm_request_to_proto(adk_request)

    assert_that(
      proto_request.safety_settings,
      contains(
        has_properties(
          category=glm.HarmCategory.DANGEROUS_CONTENT,
          threshold=glm.SafetySettingHarmBlockThreshold.BLOCK_ONLY_HIGH,
        )
      ),
    )

  def test_generation_config_conversion(self) -> None:
    """Test converting generation configuration parameters."""
    adk_request = LlmRequest(
      model="gemini-2.0-flash",
      contents=[],
      config=genai_types.GenerateContentConfig(
        temperature=0.7,
        top_p=0.9,
        top_k=40,
        max_output_tokens=1000,
        candidate_count=1,
        stop_sequences=["STOP", "END"],
        presence_penalty=0.5,
        frequency_penalty=0.5,
        seed=42,
        response_mime_type="application/json",
      ),
    )

    proto_request = ADKProtoConverter.llm_request_to_proto(adk_request)

    assert_that(proto_request.generation_config, not_none())
    gen_config = proto_request.generation_config
    assert_that(
      gen_config,
      has_properties(
        temperature=equal_to(pytest.approx(0.7)),
        top_p=equal_to(pytest.approx(0.9)),
        top_k=40,
        max_output_tokens=1000,
        candidate_count=1,
        stop_sequences=["STOP", "END"],
        presence_penalty=equal_to(pytest.approx(0.5)),
        frequency_penalty=equal_to(pytest.approx(0.5)),
        seed=42,
        response_mime_type="application/json",
      ),
    )

  def test_no_config(self) -> None:
    """Test handling request with no config."""
    adk_request = LlmRequest(
      model="gemini-2.0-flash",
      contents=[genai_types.Content(role="user", parts=[genai_types.Part(text="Hi")])],
      config=genai_types.GenerateContentConfig(),
    )

    proto_request = ADKProtoConverter.llm_request_to_proto(adk_request)

    # Should still work, just with empty/default fields
    assert_that(
      proto_request,
      has_properties(
        model="models/gemini-2.0-flash",
        contents=has_length(1),
      ),
    )

  def test_full_request_with_all_fields(self) -> None:
    """Integration test: full request with all supported fields."""
    contents = [
      genai_types.Content(role="user", parts=[genai_types.Part(text="Calculate 2+2")])
    ]
    tool = genai_types.Tool(
      function_declarations=[
        genai_types.FunctionDeclaration(name="calculate", description="Math calc")
      ]
    )
    safety_setting = genai_types.SafetySetting(
      category=genai_types.HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold=genai_types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    )

    adk_request = LlmRequest(
      model="gemini-2.0-flash",
      contents=contents,
      config=genai_types.GenerateContentConfig(
        system_instruction="You are a math assistant.",
        tools=[tool],
        safety_settings=[safety_setting],
        temperature=0.5,
        max_output_tokens=500,
      ),
    )

    proto_request = ADKProtoConverter.llm_request_to_proto(adk_request)

    # Verify all fields populated correctly
    assert_that(
      proto_request,
      has_properties(
        model="models/gemini-2.0-flash",
        contents=has_length(1),
        system_instruction=has_properties(
          parts=contains(has_properties(text="You are a math assistant."))
        ),
        tools=has_length(1),
        safety_settings=has_length(1),
        generation_config=has_properties(
          temperature=equal_to(pytest.approx(0.5)),
          max_output_tokens=500,
        ),
      ),
    )


class TestProtoToLlmResponse:
  """Tests for ADKProtoConverter.proto_to_llm_response()."""

  def test_basic_text_response(self) -> None:
    """Test converting a simple text response."""
    proto_response = glm.GenerateContentResponse(
      candidates=[
        glm.Candidate(
          content=glm.Content(
            role="model",
            parts=[glm.Part(text="Hello! How can I help?")],
          ),
          finish_reason=glm.CandidateFinishReason.STOP,
          index=0,
        )
      ],
      model_version="gemini-2.0-flash",
    )

    llm_response = ADKProtoConverter.proto_to_llm_response(proto_response)

    assert_that(llm_response, instance_of(LlmResponse))
    assert_that(
      llm_response,
      has_properties(
        content=has_properties(
          role="model",
          parts=contains(has_properties(text="Hello! How can I help?")),
        ),
        model_version="gemini-2.0-flash",
        finish_reason=genai_types.FinishReason.STOP,
      ),
    )

  def test_response_with_multiple_parts(self) -> None:
    """Test converting response with multiple parts."""
    proto_response = glm.GenerateContentResponse(
      candidates=[
        glm.Candidate(
          content=glm.Content(
            role="model",
            parts=[
              glm.Part(text="Part 1"),
              glm.Part(text="Part 2"),
            ],
          ),
          finish_reason=glm.CandidateFinishReason.STOP,
        )
      ],
    )

    llm_response = ADKProtoConverter.proto_to_llm_response(proto_response)

    assert_that(
      llm_response.content,
      has_properties(
        parts=contains(
          has_properties(text="Part 1"),
          has_properties(text="Part 2"),
        )
      ),
    )

  def test_response_with_function_call(self) -> None:
    """Test converting response containing a function call.

    Note: betterproto's to_dict() has quirks with nested Struct fields.
    In real usage, the proto messages come from gRPC which handles this correctly.
    For unit tests, we verify the function call name is preserved.
    """
    proto_response = glm.GenerateContentResponse(
      candidates=[
        glm.Candidate(
          content=glm.Content(
            role="model",
            parts=[
              glm.Part(
                function_call=glm.FunctionCall(
                  name="get_weather",
                )
              )
            ],
          ),
          finish_reason=glm.CandidateFinishReason.STOP,
        )
      ],
    )

    llm_response = ADKProtoConverter.proto_to_llm_response(proto_response)

    assert_that(
      llm_response.content,
      has_properties(
        parts=contains(has_properties(function_call=has_properties(name="get_weather")))
      ),
    )

  def test_response_with_usage_metadata(self) -> None:
    """Test converting response with usage metadata."""
    proto_response = glm.GenerateContentResponse(
      candidates=[
        glm.Candidate(
          content=glm.Content(
            role="model",
            parts=[glm.Part(text="Response")],
          ),
          finish_reason=glm.CandidateFinishReason.STOP,
        )
      ],
      usage_metadata=glm.GenerateContentResponseUsageMetadata(
        prompt_token_count=10,
        candidates_token_count=20,
        total_token_count=30,
      ),
    )

    llm_response = ADKProtoConverter.proto_to_llm_response(proto_response)

    assert_that(
      llm_response.usage_metadata,
      has_properties(
        prompt_token_count=10,
        candidates_token_count=20,
        total_token_count=30,
      ),
    )

  def test_response_with_max_tokens_finish_reason(self) -> None:
    """Test converting response that hit max tokens limit."""
    proto_response = glm.GenerateContentResponse(
      candidates=[
        glm.Candidate(
          content=glm.Content(
            role="model",
            parts=[glm.Part(text="Truncated response...")],
          ),
          finish_reason=glm.CandidateFinishReason.MAX_TOKENS,
        )
      ],
    )

    llm_response = ADKProtoConverter.proto_to_llm_response(proto_response)

    assert_that(
      llm_response.finish_reason, equal_to(genai_types.FinishReason.MAX_TOKENS)
    )

  def test_empty_response(self) -> None:
    """Test converting empty response (no candidates)."""
    proto_response = glm.GenerateContentResponse(candidates=[])

    llm_response = ADKProtoConverter.proto_to_llm_response(proto_response)

    # Empty response should still be valid
    assert_that(llm_response, instance_of(LlmResponse))
    assert_that(llm_response.content, equal_to(None))


class TestRoundTrip:
  """Test round-trip conversions to ensure consistency."""

  def test_request_conversion_preserves_structure(self) -> None:
    """Test that request conversion preserves the essential structure."""
    original_text = "What is the meaning of life?"
    contents = [
      genai_types.Content(role="user", parts=[genai_types.Part(text=original_text)])
    ]
    adk_request = LlmRequest(
      model="gemini-2.0-flash",
      contents=contents,
      config=genai_types.GenerateContentConfig(
        temperature=0.8,
        system_instruction="Be philosophical.",
      ),
    )

    proto_request = ADKProtoConverter.llm_request_to_proto(adk_request)

    # Verify key data preserved
    assert_that(
      proto_request,
      has_properties(
        contents=contains(
          has_properties(parts=contains(has_properties(text=original_text)))
        ),
        system_instruction=has_properties(
          parts=contains(has_properties(text="Be philosophical."))
        ),
        generation_config=has_properties(temperature=equal_to(pytest.approx(0.8))),
      ),
    )

  def test_response_text_property_works(self) -> None:
    """Test that converted response supports ADK's .text property."""
    proto_response = glm.GenerateContentResponse(
      candidates=[
        glm.Candidate(
          content=glm.Content(
            role="model",
            parts=[
              glm.Part(text="Part A "),
              glm.Part(text="Part B"),
            ],
          ),
          finish_reason=glm.CandidateFinishReason.STOP,
        )
      ],
    )

    llm_response = ADKProtoConverter.proto_to_llm_response(proto_response)

    # LlmResponse.content is a Content object, which should have parts
    assert_that(llm_response.content, not_none())
    assert llm_response.content is not None  # type narrowing for pyright
    assert_that(llm_response.content.parts, not_none())
    assert llm_response.content.parts is not None  # type narrowing for pyright
    combined_text = "".join(p.text for p in llm_response.content.parts if p.text)
    assert_that(combined_text, equal_to("Part A Part B"))
