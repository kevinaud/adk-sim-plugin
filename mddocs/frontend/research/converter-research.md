---
title: Converter Architecture and Package Design Research
type: research
parent: ../frontend-spec.md
related:
  - ./adk-typescript-research.md
  - ./project-infrastructure.md
---

# Converter Architecture and Package Design Research

**Source**: Project codebase (`plugins/python/`, `docs/developers/publishing.md`)  
**Date**: January 11, 2026  
**Purpose**: Analyze the Python converter implementation and inform the design of `adk-converters-ts`.

## Related Documents

- [ADK TypeScript Research](./adk-typescript-research.md) - TypeScript ADK data model
- [Project Infrastructure](./project-infrastructure.md) - Existing project setup

---

## Table of Contents

- [Related Documents](#related-documents)
- [Overview](#overview)
- [Python Converter Analysis](#python-converter-analysis)
  - [File Locations](#file-locations)
  - [Class Structure](#class-structure)
- [Conversion Logic: `llm_request_to_proto()`](#conversion-logic-llmrequesttoproto)
  - [High-Level Flow](#high-level-flow)
  - [Model Name Conversion](#model-name-conversion)
  - [Contents Conversion](#contents-conversion)
  - [System Instruction Conversion](#system-instruction-conversion)
  - [Tools Conversion](#tools-conversion)
  - [Safety Settings Conversion](#safety-settings-conversion)
  - [Generation Config Conversion](#generation-config-conversion)
- [Conversion Logic: `proto_to_llm_response()`](#conversion-logic-prototollmresponse)
  - [Flow](#flow)
- [Test Coverage Analysis](#test-coverage-analysis)
  - [Test Categories](#test-categories)
  - [Key Test Patterns](#key-test-patterns)
- [Frontend Converter: Inverse Operations](#frontend-converter-inverse-operations)
  - [`protoToLlmRequest()` (New)](#prototollmrequest-new)
  - [`llmResponseToProto()` (New)](#llmresponsetoproto-new)
- [Package Publishing Infrastructure](#package-publishing-infrastructure)
  - [Current Packages](#current-packages)
  - [Adding `adk-converters-ts`](#adding-adk-converters-ts)
  - [Publishing Workflow Changes](#publishing-workflow-changes)
  - [Trusted Publisher Configuration](#trusted-publisher-configuration)
- [TypeScript-Specific Considerations](#typescript-specific-considerations)
  - [Structural Typing Advantage](#structural-typing-advantage)
  - [JSON Conversion Path](#json-conversion-path)
  - [Enum Handling](#enum-handling)
- [Test Strategy for `adk-converters-ts`](#test-strategy-for-adk-converters-ts)
  - [Test Categories (Mirroring Python)](#test-categories-mirroring-python)
  - [Test Fixtures](#test-fixtures)
- [Implementation Phases](#implementation-phases)
  - [Phase 1: Core Types (Week 1)](#phase-1-core-types-week-1)
  - [Phase 2: Full Conversion (Week 1-2)](#phase-2-full-conversion-week-1-2)
  - [Phase 3: Integration (Week 2)](#phase-3-integration-week-2)
- [Open Questions](#open-questions)


## Overview

This document analyzes our existing Python converter (`ADKProtoConverter`) to establish patterns for the TypeScript equivalent. It also covers the package publishing infrastructure to understand how to add a new shared package.

---

## Python Converter Analysis

### File Locations

```
plugins/python/
├── src/adk_agent_sim/plugin/
│   └── converter.py          # ADKProtoConverter class
└── tests/unit/
    └── test_converter.py     # Comprehensive tests
```

### Class Structure

```python
class ADKProtoConverter:
    """Handles conversion between ADK/Pydantic objects and betterproto messages."""

    @staticmethod
    def llm_request_to_proto(adk_request: LlmRequest) -> glm.GenerateContentRequest:
        """Convert ADK LlmRequest (Pydantic) → GenerateContentRequest (betterproto)."""

    @staticmethod
    def proto_to_llm_response(proto_response: glm.GenerateContentResponse) -> LlmResponse:
        """Convert GenerateContentResponse (betterproto) → ADK LlmResponse (Pydantic)."""
```

**Note**: The Python plugin only needs:
- `LlmRequest → Proto` (to send requests)
- `Proto → LlmResponse` (to receive responses)

The frontend needs the **inverse**:
- `Proto → LlmRequest` (to display incoming requests)
- `LlmResponse → Proto` (to submit human responses)

---

## Conversion Logic: `llm_request_to_proto()`

### High-Level Flow

```
LlmRequest
├── model              → proto.model (with "models/" prefix)
├── contents           → proto.contents (via dict serialization)
└── config (GenerateContentConfig)
    ├── system_instruction → proto.system_instruction
    ├── tools              → proto.tools
    ├── safety_settings    → proto.safety_settings
    └── (other params)     → proto.generation_config
```

### Model Name Conversion

```python
def _convert_model_name(model: str | None) -> str:
    if not model:
        return ""
    if model.startswith("models/"):
        return model
    return f"models/{model}"
```

**Pattern**: Normalize to `models/{name}` format.

### Contents Conversion

```python
def _convert_contents(contents: list[genai_types.Content] | None) -> list[glm.Content]:
    if not contents:
        return []

    result: list[glm.Content] = []
    for content in contents:
        # Pydantic → dict → betterproto
        content_dict = content.model_dump(mode="json", exclude_none=True)
        result.append(glm.Content().from_dict(content_dict))
    return result
```

**Pattern**: Use JSON serialization as intermediate format.

### System Instruction Conversion

The system instruction can be multiple types:

| Input Type | Conversion |
|------------|------------|
| `str` | Wrap in `Content(parts=[Part(text=...)])` |
| `Content` | Serialize via `model_dump()` → `from_dict()` |
| `Part` | Wrap in `Content(parts=[part])` |
| `list[Part]` | Wrap in `Content(parts=parts)` |
| `None` | Return `None` |

```python
def _convert_system_instruction(system_instruction: Any) -> glm.Content | None:
    if system_instruction is None:
        return None

    if isinstance(system_instruction, str):
        return glm.Content(parts=[glm.Part(text=system_instruction)])

    if isinstance(system_instruction, genai_types.Content):
        si_dict = system_instruction.model_dump(mode="json", exclude_none=True)
        return glm.Content().from_dict(si_dict)

    if isinstance(system_instruction, genai_types.Part):
        part_dict = system_instruction.model_dump(mode="json", exclude_none=True)
        return glm.Content(parts=[glm.Part().from_dict(part_dict)])

    if isinstance(system_instruction, list):
        parts: list[glm.Part] = []
        for item in system_instruction:
            if isinstance(item, str):
                parts.append(glm.Part(text=item))
            elif isinstance(item, genai_types.Part):
                part_dict = item.model_dump(mode="json", exclude_none=True)
                parts.append(glm.Part().from_dict(part_dict))
        return glm.Content(parts=parts) if parts else None

    return None
```

**Pattern**: Handle polymorphic input with explicit type checking.

### Tools Conversion

```python
def _convert_tools(tools: Any) -> list[glm.Tool]:
    if not tools:
        return []

    result: list[glm.Tool] = []
    for tool in tools:
        # Only handle google.genai.types.Tool objects
        if isinstance(tool, genai_types.Tool):
            tool_dict = tool.model_dump(mode="json", exclude_none=True)
            result.append(glm.Tool().from_dict(tool_dict))
        # Skip callables, MCP tools, ClientSessions
    return result
```

**Pattern**: Filter to only serializable `Tool` objects; skip runtime-only tools.

### Safety Settings Conversion

```python
def _convert_safety_settings(
    safety_settings: list[genai_types.SafetySetting] | None
) -> list[glm.SafetySetting]:
    if not safety_settings:
        return []

    result: list[glm.SafetySetting] = []
    for setting in safety_settings:
        setting_dict = setting.model_dump(mode="json", exclude_none=True)

        # Map category enum (remove HARM_CATEGORY_ prefix)
        category_str = setting_dict.get("category", "")
        if category_str.startswith("HARM_CATEGORY_"):
            category_str = category_str.replace("HARM_CATEGORY_", "")

        try:
            category = glm.HarmCategory[category_str]
            threshold = glm.SafetySettingHarmBlockThreshold[threshold_str]
            result.append(glm.SafetySetting(category=category, threshold=threshold))
        except KeyError:
            continue  # Skip unknown enums

    return result
```

**Pattern**: Enum name mapping between SDK and proto (prefix stripping).

### Generation Config Conversion

```python
def _convert_generation_config(
    config: genai_types.GenerateContentConfig
) -> glm.GenerationConfig | None:
    gen_config_dict: dict[str, object] = {}

    # Map each field explicitly
    if config.temperature is not None:
        gen_config_dict["temperature"] = config.temperature
    if config.top_p is not None:
        gen_config_dict["topP"] = config.top_p
    # ... etc.

    if not gen_config_dict:
        return None

    return glm.GenerationConfig().from_dict(gen_config_dict)
```

**Pattern**: Build dict of non-None fields, then use `from_dict()`.

---

## Conversion Logic: `proto_to_llm_response()`

### Flow

```python
@staticmethod
def proto_to_llm_response(proto_response: glm.GenerateContentResponse) -> LlmResponse:
    # 1. Convert betterproto → dict (camelCase)
    response_dict = proto_response.to_dict()

    # 2. Use SDK's factory method to parse dict
    genai_response = genai_types.GenerateContentResponse._from_response(
        response=response_dict,
        kwargs={},
    )

    # 3. Use ADK's factory to create LlmResponse
    return LlmResponse.create(genai_response)
```

**Pattern**: Leverage SDK's existing `_from_response()` factory—don't reinvent parsing.

**Caveat**: `_from_response()` is a private method. This works but is fragile.

---

## Test Coverage Analysis

### Test Categories

| Category | Tests | Description |
|----------|-------|-------------|
| Basic Request | 5 | Model name, contents, empty fields |
| System Instruction | 4 | String, Content, Part, list[Part] variants |
| Tools | 1 | Function declarations |
| Safety Settings | 1 | Enum mapping |
| Generation Config | 1 | All numeric/string params |
| Full Integration | 1 | Request with all fields |
| Response Basic | 3 | Text, multiple parts, function call |
| Response Metadata | 2 | Usage metadata, finish reasons |
| Response Edge | 1 | Empty response |
| Round Trip | 2 | Structure preservation |

### Key Test Patterns

**Using PyHamcrest for assertions**:
```python
from hamcrest import assert_that, has_properties, contains, equal_to

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
```

**Approximate float comparison**:
```python
assert_that(
    gen_config,
    has_properties(
        temperature=equal_to(pytest.approx(0.7)),
    ),
)
```

---

## Frontend Converter: Inverse Operations

For the frontend (`adk-converters-ts`), we need the **inverse** conversions:

### `protoToLlmRequest()` (New)

```
GenerateContentRequest (proto)
├── model              → LlmRequest.model
├── contents           → LlmRequest.contents
├── system_instruction → LlmRequest.config.systemInstruction
├── tools              → LlmRequest.config.tools
├── safety_settings    → LlmRequest.config.safetySettings
└── generation_config  → LlmRequest.config.{temperature, topP, ...}
```

**Implementation Sketch**:
```typescript
export function protoToLlmRequest(proto: GenerateContentRequest): LlmRequest {
  const config: GenerateContentConfig = {};

  // System instruction
  if (proto.systemInstruction) {
    config.systemInstruction = protoContentToGenaiContent(proto.systemInstruction);
  }

  // Tools
  if (proto.tools.length > 0) {
    config.tools = proto.tools.map(protoToolToGenaiTool);
  }

  // Safety settings
  if (proto.safetySettings.length > 0) {
    config.safetySettings = proto.safetySettings.map(protoSafetyToGenaiSafety);
  }

  // Generation config
  if (proto.generationConfig) {
    const gc = proto.generationConfig;
    if (gc.temperature !== undefined) config.temperature = gc.temperature;
    if (gc.topP !== undefined) config.topP = gc.topP;
    // ... etc.
  }

  return {
    model: proto.model,
    contents: proto.contents.map(protoContentToGenaiContent),
    config,
    liveConnectConfig: {},
    toolsDict: {},
  };
}
```

### `llmResponseToProto()` (New)

```
LlmResponse (ADK)
├── content            → GenerateContentResponse.candidates[0].content
├── finishReason       → GenerateContentResponse.candidates[0].finish_reason
├── usageMetadata      → GenerateContentResponse.usage_metadata
├── errorCode          → (Mapped to finish_reason or prompt_feedback)
└── ...
```

**Implementation Sketch**:
```typescript
export function llmResponseToProto(llmResponse: LlmResponse): GenerateContentResponse {
  const candidate: Candidate = {
    content: llmResponse.content
      ? genaiContentToProtoContent(llmResponse.content)
      : undefined,
    finishReason: mapFinishReasonToProto(llmResponse.finishReason),
    index: 0,
  };

  return create(GenerateContentResponseSchema, {
    candidates: [candidate],
    usageMetadata: llmResponse.usageMetadata
      ? mapUsageMetadataToProto(llmResponse.usageMetadata)
      : undefined,
  });
}
```

---

## Package Publishing Infrastructure

### Current Packages

| Package | Registry | Language | Purpose |
|---------|----------|----------|---------|
| `adk-sim-protos` | PyPI | Python | Betterproto-generated protos |
| `adk-sim-testing` | PyPI | Python | Test fixtures/utilities |
| `adk-sim-server` | PyPI | Python | Server application |
| `adk-agent-sim` | PyPI | Python | Plugin package |
| `@adk-sim/protos` | npm | TypeScript | Buf-generated protos |

### Adding `adk-converters-ts`

**Location**: `packages/adk-converters-ts/`

**Package Structure**:
```
packages/adk-converters-ts/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # Public exports
│   ├── proto-to-llm-request.ts     # Main conversion
│   ├── llm-response-to-proto.ts    # Main conversion
│   ├── content-converter.ts        # Content/Part helpers
│   ├── tool-converter.ts           # Tool helpers
│   └── enum-mappers.ts             # Enum conversions
└── tests/
    ├── proto-to-llm-request.test.ts
    ├── llm-response-to-proto.test.ts
    └── fixtures/                    # Test data
```

**package.json**:
```json
{
  "name": "@adk-sim/converters",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  },
  "dependencies": {
    "@google/adk": "^0.2.2",
    "@adk-sim/protos": "workspace:*"
  },
  "peerDependencies": {
    "@bufbuild/protobuf": "^2.0.0"
  }
}
```

### Publishing Workflow Changes

The `publish.yaml` workflow needs updates:

1. **Add to version sync** (`scripts/sync_versions.py`):
```python
NPM_PACKAGES = [
    "packages/adk-sim-protos-ts/package.json",
    "packages/adk-converters-ts/package.json",  # NEW
]
```

2. **Add to publish job**:
```yaml
- name: Publish @adk-sim/converters to npm
  working-directory: packages/adk-converters-ts
  run: |
    unset NODE_AUTH_TOKEN
    npm publish --access public --provenance
```

3. **Add to verify-build job**:
```yaml
- name: Build converters package
  working-directory: packages/adk-converters-ts
  run: npm run build
```

### Trusted Publisher Configuration

For npm publishing, configure on npmjs.com:
- **Package**: `@adk-sim/converters`
- **Repository**: `kevinaud/adk-sim-plugin`
- **Workflow**: `publish.yaml`
- **Environment**: (none)

---

## TypeScript-Specific Considerations

### Structural Typing Advantage

TypeScript's structural typing means we may not need explicit conversion for some types:

```typescript
// If ProtoContent and GenaiContent have the same shape...
const protoContent: ProtoContent = { role: 'user', parts: [...] };
const genaiContent: GenaiContent = protoContent;  // May just work!
```

**Testing Required**: Verify if Buf-generated types are assignment-compatible with `@google/genai` types.

### JSON Conversion Path

If direct assignment doesn't work, use JSON as intermediate:

```typescript
import { toJson, fromJson } from '@bufbuild/protobuf';

function protoContentToGenaiContent(proto: ProtoContent): GenaiContent {
  const json = toJson(ContentSchema, proto);
  // @google/genai types accept plain objects
  return json as GenaiContent;
}
```

### Enum Handling

Proto enums are numeric; SDK enums may be string unions:

```typescript
// Proto enum
enum HarmCategory {
  HARM_CATEGORY_UNSPECIFIED = 0,
  DANGEROUS_CONTENT = 1,
  // ...
}

// SDK may use string literals
type HarmCategory = 'HARM_CATEGORY_DANGEROUS_CONTENT' | ...;
```

**Mapping Required**:
```typescript
function mapHarmCategory(protoCategory: ProtoHarmCategory): GenaiHarmCategory {
  const mapping: Record<ProtoHarmCategory, GenaiHarmCategory> = {
    [ProtoHarmCategory.DANGEROUS_CONTENT]: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    // ...
  };
  return mapping[protoCategory] ?? 'HARM_CATEGORY_UNSPECIFIED';
}
```

---

## Test Strategy for `adk-converters-ts`

### Test Categories (Mirroring Python)

1. **Proto → LlmRequest**
   - Basic content mapping
   - System instruction variants (already Content in proto)
   - Tools with function declarations
   - Safety settings enum mapping
   - Generation config fields
   - Model name handling

2. **LlmResponse → Proto**
   - Text responses
   - Function call responses
   - Error responses
   - Usage metadata
   - Various finish reasons

3. **Helper Functions**
   - `protoContentToGenaiContent()`
   - `genaiContentToProtoContent()`
   - Enum mappers

4. **Edge Cases**
   - Empty/undefined fields
   - Unknown enum values
   - Deeply nested structures (thought parts, inline_data)

### Test Fixtures

Create shared fixtures that can be used by both:
- `adk-converters-ts` unit tests
- Frontend integration tests

```typescript
// packages/adk-converters-ts/tests/fixtures/requests.ts
export const basicTextRequest = create(GenerateContentRequestSchema, {
  model: 'models/gemini-2.0-flash',
  contents: [{
    role: 'user',
    parts: [{ text: 'Hello' }],
  }],
});

export const fullFeaturedRequest = create(GenerateContentRequestSchema, {
  model: 'models/gemini-2.0-flash',
  contents: [/* ... */],
  systemInstruction: { parts: [{ text: 'Be helpful.' }] },
  tools: [{
    functionDeclarations: [{
      name: 'get_weather',
      description: 'Get weather for a location',
    }],
  }],
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 1000,
  },
});
```

---

## Implementation Phases

### Phase 1: Core Types (Week 1)

1. Set up `packages/adk-converters-ts/` structure
2. Install dependencies (`@google/adk`, `@adk-sim/protos`)
3. Implement `protoContentToGenaiContent()` and inverse
4. Write tests for content conversion

### Phase 2: Full Conversion (Week 1-2)

1. Implement `protoToLlmRequest()`
2. Implement `llmResponseToProto()`
3. Handle all field mappings
4. Comprehensive tests

### Phase 3: Integration (Week 2)

1. Wire up to frontend
2. Integration tests with actual server
3. Update publishing workflow

---

## Open Questions

1. **Should the converter handle invalid protos gracefully?**
   - Return partial result with warnings?
   - Throw on first error?
   - Both (configurable)?

2. **How should we handle `toolsDict`?**
   - The frontend doesn't have actual `BaseTool` instances
   - Leave empty? Create stubs? Omit from interface?

3. **Version alignment strategy?**
   - Pin `@google/adk` to specific version?
   - Follow latest with CI checking for breaks?

4. **Should converters be sync or async?**
   - All operations are CPU-bound (serialization)
   - Probably sync, but consider web worker offload for large payloads?
