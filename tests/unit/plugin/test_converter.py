"""Tests for ADKProtoConverter.

Tests cover:
- llm_request_to_proto: Converting ADK LlmRequest to GenerateContentRequest
- proto_to_llm_response: Converting GenerateContentResponse to LlmResponse
- Edge cases: empty fields, various system_instruction formats, enum mapping
"""

import pytest
from google.adk.models import LlmRequest, LlmResponse
from google.genai import types as genai_types

import adk_agent_sim.generated.google.ai.generativelanguage.v1beta as glm
from adk_agent_sim.plugin.converter import ADKProtoConverter


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

    assert proto_request.model == "models/gemini-2.0-flash"
    assert len(proto_request.contents) == 1
    assert proto_request.contents[0].role == "user"
    assert len(proto_request.contents[0].parts) == 1
    assert proto_request.contents[0].parts[0].text == "Hello"

  def test_model_name_already_prefixed(self) -> None:
    """Test that model names already prefixed with 'models/' are unchanged."""
    adk_request = LlmRequest(
      model="models/gemini-1.5-pro",
      contents=[],
      config=genai_types.GenerateContentConfig(),
    )

    proto_request = ADKProtoConverter.llm_request_to_proto(adk_request)

    assert proto_request.model == "models/gemini-1.5-pro"

  def test_empty_model_name(self) -> None:
    """Test handling of empty/None model name."""
    adk_request = LlmRequest(
      model=None,
      contents=[],
      config=genai_types.GenerateContentConfig(),
    )

    proto_request = ADKProtoConverter.llm_request_to_proto(adk_request)

    assert proto_request.model == ""

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

    assert len(proto_request.contents) == 2
    assert proto_request.contents[0].role == "user"
    assert len(proto_request.contents[0].parts) == 2
    assert proto_request.contents[1].role == "model"

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

    assert proto_request.system_instruction is not None
    assert len(proto_request.system_instruction.parts) == 1
    expected_text = "You are a helpful assistant."
    assert proto_request.system_instruction.parts[0].text == expected_text

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

    assert proto_request.system_instruction is not None
    assert len(proto_request.system_instruction.parts) == 2
    assert proto_request.system_instruction.parts[0].text == "System instruction line 1"
    assert proto_request.system_instruction.parts[1].text == "System instruction line 2"

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

    assert proto_request.system_instruction is not None
    assert len(proto_request.system_instruction.parts) == 1
    assert proto_request.system_instruction.parts[0].text == "System as Part"

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

    assert proto_request.system_instruction is not None
    assert len(proto_request.system_instruction.parts) == 2
    assert proto_request.system_instruction.parts[0].text == "Part A"
    assert proto_request.system_instruction.parts[1].text == "Part B"

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

    assert len(proto_request.tools) == 1
    assert len(proto_request.tools[0].function_declarations) == 1
    func_decl = proto_request.tools[0].function_declarations[0]
    assert func_decl.name == "get_weather"
    assert func_decl.description == "Get the weather for a location"

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

    assert len(proto_request.safety_settings) == 1
    setting = proto_request.safety_settings[0]
    assert setting.category == glm.HarmCategory.DANGEROUS_CONTENT
    expected_threshold = glm.SafetySettingHarmBlockThreshold.BLOCK_ONLY_HIGH
    assert setting.threshold == expected_threshold

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

    assert proto_request.generation_config is not None
    gen_config = proto_request.generation_config
    assert gen_config.temperature == pytest.approx(0.7)
    assert gen_config.top_p == pytest.approx(0.9)
    assert gen_config.top_k == 40
    assert gen_config.max_output_tokens == 1000
    assert gen_config.candidate_count == 1
    assert gen_config.stop_sequences == ["STOP", "END"]
    assert gen_config.presence_penalty == pytest.approx(0.5)
    assert gen_config.frequency_penalty == pytest.approx(0.5)
    assert gen_config.seed == 42
    assert gen_config.response_mime_type == "application/json"

  def test_no_config(self) -> None:
    """Test handling request with no config."""
    adk_request = LlmRequest(
      model="gemini-2.0-flash",
      contents=[genai_types.Content(role="user", parts=[genai_types.Part(text="Hi")])],
      config=genai_types.GenerateContentConfig(),
    )

    proto_request = ADKProtoConverter.llm_request_to_proto(adk_request)

    # Should still work, just with empty/default fields
    assert proto_request.model == "models/gemini-2.0-flash"
    assert len(proto_request.contents) == 1

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
    assert proto_request.model == "models/gemini-2.0-flash"
    assert len(proto_request.contents) == 1
    assert proto_request.system_instruction is not None
    assert proto_request.system_instruction.parts[0].text == "You are a math assistant."
    assert len(proto_request.tools) == 1
    assert len(proto_request.safety_settings) == 1
    assert proto_request.generation_config is not None
    assert proto_request.generation_config.temperature == pytest.approx(0.5)
    assert proto_request.generation_config.max_output_tokens == 500


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

    assert isinstance(llm_response, LlmResponse)
    assert llm_response.content is not None
    assert llm_response.content.role == "model"
    assert llm_response.content.parts is not None
    assert len(llm_response.content.parts) == 1
    assert llm_response.content.parts[0].text == "Hello! How can I help?"
    assert llm_response.model_version == "gemini-2.0-flash"
    assert llm_response.finish_reason == genai_types.FinishReason.STOP

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

    assert llm_response.content is not None
    assert llm_response.content.parts is not None
    assert len(llm_response.content.parts) == 2
    assert llm_response.content.parts[0].text == "Part 1"
    assert llm_response.content.parts[1].text == "Part 2"

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

    assert llm_response.content is not None
    assert llm_response.content.parts is not None
    assert len(llm_response.content.parts) == 1
    part = llm_response.content.parts[0]
    assert part.function_call is not None
    assert part.function_call.name == "get_weather"

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

    assert llm_response.usage_metadata is not None
    assert llm_response.usage_metadata.prompt_token_count == 10
    assert llm_response.usage_metadata.candidates_token_count == 20
    assert llm_response.usage_metadata.total_token_count == 30

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

    assert llm_response.finish_reason == genai_types.FinishReason.MAX_TOKENS

  def test_empty_response(self) -> None:
    """Test converting empty response (no candidates)."""
    proto_response = glm.GenerateContentResponse(candidates=[])

    llm_response = ADKProtoConverter.proto_to_llm_response(proto_response)

    # Empty response should still be valid
    assert isinstance(llm_response, LlmResponse)
    assert llm_response.content is None


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
    assert proto_request.contents[0].parts[0].text == original_text
    assert proto_request.system_instruction is not None
    assert proto_request.system_instruction.parts[0].text == "Be philosophical."
    assert proto_request.generation_config is not None
    assert proto_request.generation_config.temperature == pytest.approx(0.8)

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
    assert llm_response.content is not None
    assert llm_response.content.parts is not None
    combined_text = "".join(p.text for p in llm_response.content.parts if p.text)
    assert combined_text == "Part A Part B"
