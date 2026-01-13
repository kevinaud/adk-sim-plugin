---
title: ADK TypeScript LlmRequest/LlmResponse Research
type: research
parent: ../frontend-spec.md
related:
  - ./converter-research.md
  - ./project-infrastructure.md
---

# ADK TypeScript LlmRequest/LlmResponse Research

**Source**: `adk-js` repository (`/workspaces/adk-repos/adk-js`)
**Date**: January 11, 2026
**Purpose**: Understand the TypeScript ADK data model for `LlmRequest`/`LlmResponse` to inform the `adk-converters-ts` package design.

## Related Documents

- [Converter Research](./converter-research.md) - Python converter analysis
- [Project Infrastructure](./project-infrastructure.md) - Existing project setup

---

## Table of Contents

- [Related Documents](#related-documents)
- [Overview](#overview)
- [Package Structure](#package-structure)
  - [`@google/adk` (v0.2.2)](#googleadk-v022)
  - [ADK TypeScript Dependencies](#adk-typescript-dependencies)
- [LlmRequest Interface](#llmrequest-interface)
  - [Helper Functions](#helper-functions)
- [LlmResponse Interface](#llmresponse-interface)
  - [Factory Function](#factory-function)
- [`@google/genai` Core Types](#googlegenai-core-types)
  - [Content](#content)
  - [Part](#part)
  - [GenerateContentConfig](#generatecontentconfig)
- [How adk-js Calls the API](#how-adk-js-calls-the-api)
- [Comparison: TypeScript vs Python ADK](#comparison-typescript-vs-python-adk)
  - [Structural Alignment](#structural-alignment)
- [Implications for `adk-converters-ts`](#implications-for-adk-converters-ts)
  - [What We Actually Need](#what-we-actually-need)
  - [Type Mismatch Challenge](#type-mismatch-challenge)
  - [Conversion Strategy](#conversion-strategy)
  - [What the Frontend Actually Displays](#what-the-frontend-actually-displays)
- [Proto Structure Comparison](#proto-structure-comparison)
  - [Our Proto (`GenerateContentRequest`)](#our-proto-generatecontentrequest)
  - [`@google/genai` SDK Types](#googlegenai-sdk-types)
- [Testing Patterns](#testing-patterns)
- [Package Design Recommendations](#package-design-recommendations)
  - [Export Structure](#export-structure)
  - [Converter Package Dependencies](#converter-package-dependencies)
  - [Testing Approach](#testing-approach)
- [Open Questions](#open-questions)

## Overview

The ADK TypeScript implementation (`@google/adk` v0.2.2) uses the `@google/genai` package (v1.32.0) for its core types. Unlike Python's Pydantic models, TypeScript uses interfaces and re-exports types directly from `@google/genai`.

**Key Finding**: TypeScript ADK does NOT have a distinct "request proto" concept—it uses `@google/genai` types directly when calling the API. The conversion from LlmRequest to API call happens implicitly within the `Gemini.generateContentAsync()` method.

---

## Package Structure

### `@google/adk` (v0.2.2)

```
core/
├── src/
│   ├── common.ts              # Re-exports all public types
│   ├── models/
│   │   ├── llm_request.ts     # LlmRequest interface + helper functions
│   │   ├── llm_response.ts    # LlmResponse interface + createLlmResponse()
│   │   ├── google_llm.ts      # Gemini class - calls @google/genai API
│   │   └── base_llm.ts        # Abstract base class
│   └── ...
└── package.json
```

### ADK TypeScript Dependencies

```json
{
  "dependencies": {
    "@google/genai": "1.32.0"
  }
}
```

---

## LlmRequest Interface

**File**: `core/src/models/llm_request.ts`

```typescript
import {
  Content,
  FunctionDeclaration,
  GenerateContentConfig,
  LiveConnectConfig,
  SchemaUnion
} from '@google/genai';
import { BaseTool } from '../tools/base_tool.js';

export interface LlmRequest {
  /** The model name. */
  model?: string;

  /** The contents to send to the model. */
  contents: Content[];

  /** Additional config for the generate content request.
   * Tools in generateContentConfig should not be set directly; use appendTools.
   */
  config?: GenerateContentConfig;

  /** Live connect configuration (for bidirectional streaming). */
  liveConnectConfig: LiveConnectConfig;

  /** The tools dictionary. Excluded from JSON serialization.
   * Maps tool name -> BaseTool instance for runtime lookup.
   */
  toolsDict: { [key: string]: BaseTool };
}
```

### Helper Functions

```typescript
/** Appends instructions to the system instruction. */
export function appendInstructions(
  llmRequest: LlmRequest,
  instructions: string[]
): void;

/** Appends tools to the request (populates config.tools and toolsDict). */
export function appendTools(
  llmRequest: LlmRequest,
  tools: BaseTool[]
): void;

/** Sets the output schema for the request. */
export function setOutputSchema(
  llmRequest: LlmRequest,
  schema: SchemaUnion
): void;
```

---

## LlmResponse Interface

**File**: `core/src/models/llm_response.ts`

```typescript
import {
  Content,
  FinishReason,
  GenerateContentResponse,
  GenerateContentResponseUsageMetadata,
  GroundingMetadata,
  LiveServerSessionResumptionUpdate,
  Transcription
} from '@google/genai';

export interface LlmResponse {
  /** The content of the response. */
  content?: Content;

  /** The grounding metadata of the response. */
  groundingMetadata?: GroundingMetadata;

  /** Whether text content is part of an unfinished text stream. */
  partial?: boolean;

  /** Whether the response from the model is complete. */
  turnComplete?: boolean;

  /** Error code if the response is an error. */
  errorCode?: string;

  /** Error message if the response is an error. */
  errorMessage?: string;

  /** Flag indicating LLM was interrupted during generation. */
  interrupted?: boolean;

  /** Custom metadata for the LlmResponse (must be JSON serializable). */
  customMetadata?: { [key: string]: any };

  /** Usage metadata (token counts, etc.). */
  usageMetadata?: GenerateContentResponseUsageMetadata;

  /** Finish reason of the response. */
  finishReason?: FinishReason;

  /** Session resumption update (for Live API). */
  liveSessionResumptionUpdate?: LiveServerSessionResumptionUpdate;

  /** Audio transcription of user input. */
  inputTranscription?: Transcription;

  /** Audio transcription of model output. */
  outputTranscription?: Transcription;
}
```

### Factory Function

```typescript
export function createLlmResponse(
  response: GenerateContentResponse
): LlmResponse {
  const usageMetadata = response.usageMetadata;

  if (response.candidates && response.candidates.length > 0) {
    const candidate = response.candidates[0];
    if (candidate.content?.parts && candidate.content.parts.length > 0) {
      return {
        content: candidate.content,
        groundingMetadata: candidate.groundingMetadata,
        usageMetadata: usageMetadata,
        finishReason: candidate.finishReason,
      };
    }

    return {
      errorCode: candidate.finishReason,
      errorMessage: candidate.finishMessage,
      usageMetadata: usageMetadata,
      finishReason: candidate.finishReason,
    };
  }

  if (response.promptFeedback) {
    return {
      errorCode: response.promptFeedback.blockReason,
      errorMessage: response.promptFeedback.blockReasonMessage,
      usageMetadata: usageMetadata,
    };
  }

  return {
    errorCode: 'UNKNOWN_ERROR',
    errorMessage: 'Unknown error.',
    usageMetadata: usageMetadata,
  };
}
```

---

## `@google/genai` Core Types

The `@google/genai` package provides all the foundational types. Here are the key ones:

### Content

```typescript
interface Content {
  /** List of parts that constitute a single message. */
  parts?: Part[];
  /** The producer of the content ('user' or 'model'). */
  role?: string;
}
```

### Part

```typescript
interface Part {
  /** Optional. Result of executing the ExecutableCode. */
  codeExecutionResult?: CodeExecutionResult;
  /** Optional. Code generated by the model. */
  executableCode?: ExecutableCode;
  /** Optional. URI based data. */
  fileData?: FileData;
  /** Optional. A predicted FunctionCall. */
  functionCall?: FunctionCall;
  /** Optional. The result output of a FunctionCall. */
  functionResponse?: FunctionResponse;
  /** Optional. Inlined bytes data. */
  inlineData?: Blob;
  /** Optional. Text part (can be code). */
  text?: string;
  /** Optional. Indicates if the part is thought from the model. */
  thought?: boolean;
  /** Optional. Opaque signature for the thought. */
  thoughtSignature?: string;
  /** Optional. Video metadata. */
  videoMetadata?: VideoMetadata;
  /** Media resolution for the input media. */
  mediaResolution?: PartMediaResolution;
}
```

### GenerateContentConfig

```typescript
interface GenerateContentConfig {
  /** System instruction for the model. */
  systemInstruction?: ContentUnion;
  /** Temperature (randomness). */
  temperature?: number;
  /** Top-p (nucleus sampling). */
  topP?: number;
  /** Top-k (vocabulary sampling). */
  topK?: number;
  /** Number of candidates to return. */
  candidateCount?: number;
  /** Maximum output tokens. */
  maxOutputTokens?: number;
  /** Stop sequences. */
  stopSequences?: string[];
  /** Presence penalty. */
  presencePenalty?: number;
  /** Frequency penalty. */
  frequencyPenalty?: number;
  /** Random seed. */
  seed?: number;
  /** Response MIME type. */
  responseMimeType?: string;
  /** Response schema (JSON Schema). */
  responseSchema?: SchemaUnion;
  /** Safety settings. */
  safetySettings?: SafetySetting[];
  /** Tools (function declarations, etc.). */
  tools?: ToolListUnion;
  /** Tool configuration. */
  toolConfig?: ToolConfig;
  /** Labels for billing breakdown. */
  labels?: Record<string, string>;
  /** Cached content resource name. */
  cachedContent?: string;
  /** HTTP options override. */
  httpOptions?: HttpOptions;
  /** Abort signal for cancellation. */
  abortSignal?: AbortSignal;
  // ... additional fields
}
```

---

## How adk-js Calls the API

The `Gemini` class in `google_llm.ts` passes the `LlmRequest` fields directly to `@google/genai`:

```typescript
// Simplified from google_llm.ts
async *generateContentAsync(
  llmRequest: LlmRequest,
  stream = false
): AsyncGenerator<LlmResponse, void> {
  if (stream) {
    const streamResult = await this.apiClient.models.generateContentStream({
      model: llmRequest.model ?? this.model,
      contents: llmRequest.contents,
      config: llmRequest.config,  // Passed directly!
    });
    // ... yield LlmResponse for each chunk
  } else {
    const response = await this.apiClient.models.generateContent({
      model: llmRequest.model ?? this.model,
      contents: llmRequest.contents,
      config: llmRequest.config,  // Passed directly!
    });
    yield createLlmResponse(response);
  }
}
```

**Key Insight**: There is NO explicit conversion to `GenerateContentRequest` proto. The `@google/genai` SDK handles this internally. The SDK uses the same type names as the proto but they are **TypeScript interfaces**, not proto-generated classes.

---

## Comparison: TypeScript vs Python ADK

| Aspect | TypeScript (`@google/adk`) | Python (`google-adk`) |
|--------|---------------------------|----------------------|
| **Type System** | Interfaces (`interface LlmRequest`) | Pydantic models (`class LlmRequest(BaseModel)`) |
| **Underlying Types** | `@google/genai` (TypeScript) | `google.genai.types` (Pydantic) |
| **Proto Awareness** | None—uses SDK types directly | None—uses SDK types directly |
| **Serialization** | JSON (implicit) | `model_dump()` with camelCase aliasing |
| **tools_dict** | `toolsDict: { [key: string]: BaseTool }` | `tools_dict: dict[str, BaseTool]` |
| **Response Factory** | `createLlmResponse(response)` | `LlmResponse.create(response)` |
| **Error Handling** | Returns `errorCode`/`errorMessage` | Returns `error_code`/`error_message` |

### Structural Alignment

Both LlmRequest structures have:
- `model?: string`
- `contents: Content[]`
- `config: GenerateContentConfig`
- `toolsDict` / `tools_dict` (runtime tool lookup)

Both LlmResponse structures have:
- `content?: Content`
- `usageMetadata?: UsageMetadata`
- `finishReason?: FinishReason`
- `errorCode?` / `errorMessage?`

---

## Implications for `adk-converters-ts`

### What We Actually Need

Since the frontend receives `GenerateContentRequest` **protos** (from our betterproto-based server), and we want to work with ADK types, we need:

```
GenerateContentRequest (proto) → LlmRequest (ADK interface)
LlmResponse (ADK interface) → GenerateContentResponse (proto)
```

### Type Mismatch Challenge

| Source | Type System |
|--------|-------------|
| Our protos (`@adk-sim/protos`) | `@bufbuild/protobuf` (Buf-generated) |
| `@google/genai` types | Hand-crafted TypeScript interfaces |
| `@google/adk` types | Re-exports from `@google/genai` |

The `@google/genai` types are NOT proto-generated—they're TypeScript interfaces that happen to match the proto schema. This means:

1. **No direct proto compatibility**: Can't just cast between them
2. **Field name alignment**: Both use camelCase, but may have subtle differences
3. **Optional handling**: Proto uses `field?: T` with defaults; SDK uses `field?: T | undefined`

### Conversion Strategy

Since `@google/genai` types and our proto types are structurally compatible, we can:

1. **Use structural typing**: TypeScript's duck typing allows assignment if shapes match
2. **Explicit field mapping**: Copy fields one-by-one for safety
3. **Leverage `toJson()`/`fromJson()`**: Proto messages have JSON conversion

**Recommended Approach**:

```typescript
// Proto → LlmRequest
function protoToLlmRequest(proto: GenerateContentRequest): LlmRequest {
  // Proto has: model, contents, systemInstruction, tools, generationConfig, safetySettings
  // LlmRequest has: model, contents, config (which bundles system_instruction, tools, etc.)

  const config: GenerateContentConfig = {
    systemInstruction: proto.systemInstruction
      ? protoContentToGenaiContent(proto.systemInstruction)
      : undefined,
    tools: proto.tools?.map(protoToolToGenaiTool),
    safetySettings: proto.safetySettings?.map(protoSafetyToGenaiSafety),
    // ... generation config fields
    temperature: proto.generationConfig?.temperature,
    topP: proto.generationConfig?.topP,
    // etc.
  };

  return {
    model: proto.model,
    contents: proto.contents.map(protoContentToGenaiContent),
    config,
    liveConnectConfig: {},  // Not used for our case
    toolsDict: {},  // Populated separately if needed
  };
}
```

### What the Frontend Actually Displays

Per the spec, the frontend renders the **request** (what the human sees before responding). The key visual elements are:

| Proto Field | LlmRequest Equivalent | UI Component |
|-------------|----------------------|--------------|
| `contents[]` | `contents[]` | Event Stream blocks |
| `systemInstruction` | `config.systemInstruction` | Collapsible header |
| `tools[].functionDeclarations` | `config.tools[].functionDeclarations` | Tool Catalog |
| `generationConfig.*` | `config.temperature`, etc. | (Maybe debug panel) |

The frontend doesn't need the full bidirectional conversion—it primarily:
1. **Displays** `GenerateContentRequest` → convert to `LlmRequest` for rendering
2. **Submits** human response → `GenerateContentResponse` proto

---

## Proto Structure Comparison

### Our Proto (`GenerateContentRequest`)

```protobuf
message GenerateContentRequest {
  string model = 1;
  repeated Content contents = 2;
  optional Content system_instruction = 8;
  repeated Tool tools = 5;
  repeated SafetySetting safety_settings = 6;
  optional GenerationConfig generation_config = 4;
}
```

### `@google/genai` SDK Types

The SDK's `generateContent()` accepts:
```typescript
{
  model: string;
  contents: Content[];
  config?: GenerateContentConfig;  // BUNDLED!
}
```

Where `GenerateContentConfig` includes:
- `systemInstruction`
- `tools`
- `safetySettings`
- `temperature`, `topP`, etc.

**Mapping Required**:
- Proto separates `system_instruction`, `tools`, `safety_settings`, `generation_config`
- SDK bundles all into `config`

---

## Testing Patterns

From `base_llm_test.ts`:

```typescript
describe('BaseLlm', () => {
  it('should set tracking headers correctly', () => {
    const llm = new TestLlm();
    const headers = llm.getTrackingHeaders();
    expect(headers['x-goog-api-client']).toEqual(expectedValue);
  });
});
```

The tests don't cover proto conversion because there isn't any—the SDK handles it.

For our `adk-converters-ts` package, we should test:

1. **Proto → LlmRequest**
   - Basic content mapping
   - System instruction (string, Content, Part variants)
   - Tools with function declarations
   - Safety settings enum mapping
   - Generation config fields

2. **LlmResponse → Proto**
   - Text responses
   - Function call responses
   - Error responses
   - Usage metadata

3. **Round-trip consistency**
   - Convert proto → LlmRequest → proto and verify equality

---

## Package Design Recommendations

### Export Structure

```typescript
// packages/adk-converters-ts/src/index.ts
export { protoToLlmRequest } from './proto-to-llm-request.js';
export { llmResponseToProto } from './llm-response-to-proto.js';
export { protoContentToGenaiContent } from './content-converter.js';
// Re-export types for convenience
export type { LlmRequest, LlmResponse } from '@google/adk';
```

### Converter Package Dependencies

```json
{
  "dependencies": {
    "@google/adk": "^0.2.2",       // For LlmRequest/LlmResponse types
    "@adk-sim/protos": "workspace:*"  // Our proto types
  },
  "peerDependencies": {
    "@bufbuild/protobuf": "^2.0.0"  // Proto runtime
  }
}
```

### Testing Approach

```typescript
import { protoToLlmRequest } from '@adk-sim/converters';
import { GenerateContentRequestSchema } from '@adk-sim/protos';
import { create } from '@bufbuild/protobuf';

describe('protoToLlmRequest', () => {
  it('converts basic request with text content', () => {
    const proto = create(GenerateContentRequestSchema, {
      model: 'models/gemini-2.0-flash',
      contents: [{
        role: 'user',
        parts: [{ text: 'Hello' }],
      }],
    });

    const llmRequest = protoToLlmRequest(proto);

    expect(llmRequest.model).toBe('models/gemini-2.0-flash');
    expect(llmRequest.contents[0].parts?.[0].text).toBe('Hello');
  });
});
```

---

## Open Questions

1. **Proto Library Alignment**: Our protos use `@bufbuild/protobuf`, but `@google/genai` types are plain interfaces. Do we need a compatibility layer, or does structural typing handle it?

2. **toolsDict Population**: The frontend won't have actual `BaseTool` instances. Should `toolsDict` be empty, or should we create placeholder objects?

3. **Version Sync**: If `@google/adk` updates its types, our converters may break. Should we pin a specific version or track latest?

4. **Live Connect Config**: The `liveConnectConfig` field is required in `LlmRequest`. What default should we use for non-live scenarios?
