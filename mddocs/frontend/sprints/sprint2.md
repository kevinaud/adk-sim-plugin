# Sprint 2: ADK Converter Implementation & Testing


## Table of Contents

- [Sprint Goal](#sprint-goal)
- [Selected Scope](#selected-scope)
  - [Tasks from TDD](#tasks-from-tdd)
- [Research Summary](#research-summary)
  - [Relevant Findings](#relevant-findings)
    - [Proto to LlmRequest Conversion](#proto-to-llmrequest-conversion)
    - [LlmResponse to Proto Conversion](#llmresponse-to-proto-conversion)
    - [TypeScript-Specific Considerations](#typescript-specific-considerations)
    - [Test Strategy from Python Converter](#test-strategy-from-python-converter)
    - [ADK TypeScript Types](#adk-typescript-types)
  - [Key Decisions Already Made](#key-decisions-already-made)
  - [Open Questions for This Sprint](#open-questions-for-this-sprint)
- [Pull Request Plan](#pull-request-plan)
  - [S2PR1: Content Conversion Helpers](#s2pr1-content-conversion-helpers)
  - [S2PR2: Tool and FunctionDeclaration Conversion](#s2pr2-tool-and-functiondeclaration-conversion)
  - [S2PR3: Generation Config Conversion](#s2pr3-generation-config-conversion)
  - [S2PR4: Safety Settings Conversion](#s2pr4-safety-settings-conversion)
  - [S2PR5: Full protoToLlmRequest Implementation](#s2pr5-full-prototollmrequest-implementation)
  - [S2PR6: LlmResponse to Proto Conversion](#s2pr6-llmresponse-to-proto-conversion)
  - [S2PR7: Response Construction Helpers](#s2pr7-response-construction-helpers)
  - [S2PR8: Round-Trip and Integration Tests](#s2pr8-round-trip-and-integration-tests)
  - [S2PR9: Frontend LlmRequestConverter Service](#s2pr9-frontend-llmrequestconverter-service)
- [Implementation Notes](#implementation-notes)
  - [Patterns to Follow](#patterns-to-follow)
  - [Gotchas to Avoid](#gotchas-to-avoid)
- [Definition of Done](#definition-of-done)
- [Retrospective Notes](#retrospective-notes)

## Sprint Goal

Implement the complete `@adk-sim/converters` package functionality, enabling the frontend to:
1. Convert incoming `GenerateContentRequest` protos to ADK `LlmRequest` format for display
2. Convert user responses (`LlmResponse`) back to `GenerateContentResponse` protos for submission
3. Provide helper functions for constructing tool invocation and text responses

By the end of this sprint:
- The `@adk-sim/converters` package has fully functional `protoToLlmRequest()` and `llmResponseToProto()` implementations
- Comprehensive unit tests mirror the Python converter's test coverage
- The frontend `LlmRequestConverter` service wraps the package for Angular DI
- Round-trip tests verify conversion fidelity

---

## Selected Scope

### Tasks from TDD

| Task | FR | Phase | Notes |
|------|----|-------|-------|
| `@adk-sim/converters` package | - | Phase 2 | Full implementation (scaffold done in Sprint 1) |
| `LlmRequestConverter` | - | Phase 2 | Frontend service wrapping converters |

**Note**: Sprint 1 created the package scaffold with stub functions. This sprint implements the actual conversion logic and comprehensive tests.

---

## Research Summary

### Relevant Findings

#### Proto to LlmRequest Conversion

**Source**: [Frontend Converter: Inverse Operations](../research/converter-research.md#frontend-converter-inverse-operations)

The frontend receives `GenerateContentRequest` protos from the server and needs to convert them to ADK `LlmRequest` format for display. The mapping is:
- `proto.model` → `LlmRequest.model` (strip "models/" prefix for consistency)
- `proto.contents` → `LlmRequest.contents` (via content helper conversion)
- `proto.systemInstruction` → `LlmRequest.config.systemInstruction`
- `proto.tools` → `LlmRequest.config.tools`
- `proto.safetySettings` → `LlmRequest.config.safetySettings`
- `proto.generationConfig` → `LlmRequest.config.{temperature, topP, ...}`

The `toolsDict` and `liveConnectConfig` fields are not populated since the frontend doesn't have actual tool instances.

#### LlmResponse to Proto Conversion

**Source**: [Frontend Converter: llmResponseToProto](../research/converter-research.md#llmresponsetoproto-new)

For user responses, we convert `LlmResponse` back to `GenerateContentResponse` proto. The main use cases are:
- **Text response**: User types final answer → wrap in `Candidate.content`
- **Tool invocation**: User fills form → create `FunctionCall` part
- **Function response**: Return value from simulated tool → `FunctionResponse` part

The proto structure requires wrapping content in `candidates[0]` with appropriate `finishReason`.

#### TypeScript-Specific Considerations

**Source**: [TypeScript-Specific Considerations](../research/converter-research.md#typescript-specific-considerations)

Key considerations for TypeScript implementation:
1. **Structural typing advantage**: TypeScript's duck typing may allow direct assignment if shapes match
2. **JSON conversion path**: Use `toJson()`/`fromJson()` from `@bufbuild/protobuf` as fallback
3. **Enum handling**: Proto enums are numeric; SDK may use string unions—explicit mapping required

Proto enums like `HarmCategory` need prefix mapping (e.g., `DANGEROUS_CONTENT` → `HARM_CATEGORY_DANGEROUS_CONTENT`).

#### Test Strategy from Python Converter

**Source**: [Test Coverage Analysis](../research/converter-research.md#test-coverage-analysis)

The Python converter has comprehensive tests across these categories:
| Category | Count | Description |
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

We should mirror this coverage in TypeScript tests using Vitest.

#### ADK TypeScript Types

**Source**: [LlmRequest Interface](../research/adk-typescript-research.md#llmrequest-interface) and [LlmResponse Interface](../research/adk-typescript-research.md#llmresponse-interface)

Key types from `@google/adk`:
- **LlmRequest**: `{ model, contents, config, liveConnectConfig, toolsDict }`
- **LlmResponse**: `{ content, groundingMetadata, partial, turnComplete, errorCode, errorMessage, interrupted, customMetadata, usageMetadata, finishReason, ... }`
- **Content**: `{ parts?: Part[], role?: string }`
- **Part**: `{ text?, functionCall?, functionResponse?, inlineData?, thought?, ... }`

The `GenerateContentConfig` interface contains `systemInstruction`, `temperature`, `topP`, `tools`, `safetySettings`, etc.

### Key Decisions Already Made

| Decision | Choice | Source |
|----------|--------|--------|
| Converter package location | `packages/adk-converters-ts/` | [Sprint 1 S1PR13](./sprint1.md#s1pr13-adk-simconverters-package-scaffold) |
| Package dependencies | `@google/adk`, `@adk-sim/protos`, `@bufbuild/protobuf` | [Converter Research](../research/converter-research.md#adding-adk-converters-ts) |
| Conversion strategy | Explicit field mapping (not JSON cast) | [Conversion Strategy](../research/adk-typescript-research.md#conversion-strategy) |
| Error handling | Return partial result with warnings array | Package stub design |
| Test framework | Vitest (matches frontend) | Project standard |

### Open Questions for This Sprint

- [x] **Enum mapping completeness**: Do we need all `HarmCategory` and `HarmBlockThreshold` enum values, or just common ones?
  - **Decision**: Map all values; log warning for unknown values
- [x] **`toolsDict` handling**: Since frontend doesn't have `BaseTool` instances, should we populate it with stubs or leave empty?
  - **Decision**: Leave as empty object `{}`; it's only used for runtime tool lookup
- [x] **Should converters be sync or async?**
  - **Decision**: Sync—all operations are CPU-bound serialization
- [x] **Response construction helpers**: Should we provide convenience functions like `createTextResponse()` and `createToolInvocationResponse()`?
  - **Decision**: Yes, add helper factory functions for common response patterns

---

## Pull Request Plan

### S2PR1: Content Conversion Helpers

**Estimated Lines**: ~120 lines
**Depends On**: -

**Goal**: Implement the foundational `protoContentToGenaiContent()` and `genaiContentToProtoContent()` helper functions for converting between proto `Content` and SDK `Content` types.

**Files to Create/Modify**:
- `packages/adk-converters-ts/src/content-converter.ts` - Content conversion functions
- `packages/adk-converters-ts/src/content-converter.spec.ts` - Unit tests
- `packages/adk-converters-ts/src/index.ts` - Add exports

**Background Reading**:
- [Content Conversion in Python](../research/converter-research.md#contents-conversion) - Pattern for dict serialization
- [@google/genai Content type](../research/adk-typescript-research.md#content) - Target interface
- [JSON Conversion Path](../research/converter-research.md#json-conversion-path) - Using toJson/fromJson

**Acceptance Criteria**:
- [ ] `protoContentToGenaiContent()` converts proto Content to SDK Content
- [ ] `genaiContentToProtoContent()` converts SDK Content back to proto
- [ ] Handles all Part types: `text`, `functionCall`, `functionResponse`, `inlineData`, `thought`
- [ ] Tests cover user and model roles
- [ ] Tests cover multi-part content
- [ ] Presubmit passes

---

### S2PR2: Tool and FunctionDeclaration Conversion

**Estimated Lines**: ~100 lines
**Depends On**: S2PR1

**Goal**: Implement conversion for `Tool` and `FunctionDeclaration` types, including nested `Schema` objects for function parameters.

**Files to Create/Modify**:
- `packages/adk-converters-ts/src/tool-converter.ts` - Tool conversion functions
- `packages/adk-converters-ts/src/tool-converter.spec.ts` - Unit tests
- `packages/adk-converters-ts/src/index.ts` - Add exports

**Background Reading**:
- [Tools Conversion in Python](../research/converter-research.md#tools-conversion) - Filter pattern for serializable tools
- [TDD ToolCatalogComponent](../frontend-tdd.md#toolcatalogcomponent) - How tools are displayed
- [JSONForms Schema Conversion](../frontend-tdd.md#toolformservice-schema-conversion) - Schema handling

**Acceptance Criteria**:
- [x] `protoToolToGenaiTool()` converts proto Tool to SDK Tool
- [x] `genaiToolToProtoTool()` converts SDK Tool back to proto
- [x] FunctionDeclaration with name, description, parameters preserved
- [x] Nested Schema objects (type, properties, required) converted correctly
- [x] Tests cover tools with and without parameters
- [x] All tests pass (30 tests in tool-converter.spec.ts)
- [x] Build succeeds

---

### S2PR3: Generation Config Conversion

**Estimated Lines**: ~80 lines
**Depends On**: -

**Goal**: Implement conversion for `GenerationConfig` proto to SDK config fields (`temperature`, `topP`, `topK`, `maxOutputTokens`, etc.).

**Files to Create/Modify**:
- `packages/adk-converters-ts/src/config-converter.ts` - Config conversion functions
- `packages/adk-converters-ts/src/config-converter.spec.ts` - Unit tests
- `packages/adk-converters-ts/src/index.ts` - Add exports

**Background Reading**:
- [Generation Config in Python](../research/converter-research.md#generation-config-conversion) - Field mapping pattern
- [GenerateContentConfig](../research/adk-typescript-research.md#generatecontentconfig) - Target SDK type

**Acceptance Criteria**:
- [x] `protoGenerationConfigToGenaiConfig()` extracts generation config fields
- [x] Handles all fields: temperature, topP, topK, maxOutputTokens, stopSequences, seed
- [x] Also handles: presencePenalty, frequencyPenalty, responseMimeType, responseSchema
- [x] Undefined/missing fields in proto result in undefined in output (not defaults)
- [x] Tests cover partial configs (only some fields set)
- [x] Presubmit passes

---

### S2PR4: Safety Settings Conversion

**Estimated Lines**: ~90 lines
**Depends On**: -

**Goal**: Implement conversion for `SafetySetting` with enum mapping between proto and SDK representations.

**Files to Create/Modify**:
- `packages/adk-converters-ts/src/safety-converter.ts` - Safety settings conversion
- `packages/adk-converters-ts/src/safety-converter.spec.ts` - Unit tests
- `packages/adk-converters-ts/src/index.ts` - Add exports

**Background Reading**:
- [Safety Settings in Python](../research/converter-research.md#safety-settings-conversion) - Enum prefix mapping
- [Enum Handling](../research/converter-research.md#enum-handling) - Proto numeric vs SDK string

**Acceptance Criteria**:
- [x] `protoSafetyToGenaiSafety()` converts proto SafetySetting to SDK SafetySetting
- [x] `genaiSafetyToProtoSafety()` converts SDK SafetySetting back to proto
- [x] `HarmCategory` enum mapping handles all values (with prefix normalization)
- [x] `HarmBlockThreshold` enum mapping handles all values
- [x] Unknown enum values logged as warning, mapped to UNSPECIFIED
- [x] Tests cover all standard harm categories
- [x] Presubmit passes

---

### S2PR5: Full protoToLlmRequest Implementation

**Estimated Lines**: ~150 lines
**Depends On**: S2PR1, S2PR2, S2PR3, S2PR4

**Goal**: Implement the complete `protoToLlmRequest()` function that composes all helper converters into a full LlmRequest.

**Completes TDD Task**: `@adk-sim/converters` package (Phase 2) - partial

**Files to Create/Modify**:
- `packages/adk-converters-ts/src/request-converter.ts` - Replace stub with full implementation
- `packages/adk-converters-ts/src/request-converter.spec.ts` - Comprehensive tests
- `packages/adk-converters-ts/src/types.ts` - Shared type definitions

**Background Reading**:
- [protoToLlmRequest Implementation Sketch](../research/converter-research.md#prototollmrequest-new) - Full field mapping
- [LlmRequest Interface](../research/adk-typescript-research.md#llmrequest-interface) - Target type
- [System Instruction Conversion](../research/converter-research.md#system-instruction-conversion) - Polymorphic handling

**Acceptance Criteria**:
- [x] `protoToLlmRequest()` returns complete LlmRequest from proto
- [x] Model name has "models/" prefix stripped
- [x] Contents array properly converted
- [x] System instruction placed in `config.systemInstruction`
- [x] Tools placed in `config.tools`
- [x] Safety settings placed in `config.safetySettings`
- [x] Generation config fields spread into `config`
- [x] `liveConnectConfig` set to `{}`
- [x] `toolsDict` set to `{}`
- [x] Tests mirror Python converter test categories (5+ basic, system instruction variants, etc.)
- [x] Presubmit passes

---

### S2PR6: LlmResponse to Proto Conversion

**Estimated Lines**: ~120 lines
**Depends On**: S2PR1

**Goal**: Implement `llmResponseToProto()` to convert ADK LlmResponse back to GenerateContentResponse proto format.

**Files to Create/Modify**:
- `packages/adk-converters-ts/src/response-converter.ts` - Replace stub with full implementation
- `packages/adk-converters-ts/src/response-converter.spec.ts` - Comprehensive tests

**Background Reading**:
- [llmResponseToProto Implementation Sketch](../research/converter-research.md#llmresponsetoproto-new) - Field mapping
- [LlmResponse Interface](../research/adk-typescript-research.md#llmresponse-interface) - Source type
- [createLlmResponse Factory](../research/adk-typescript-research.md#factory-function) - Inverse operation reference

**Acceptance Criteria**:
- [x] `llmResponseToProto()` returns valid GenerateContentResponse proto
- [x] Content wrapped in `candidates[0].content`
- [x] FinishReason mapped to proto enum
- [x] UsageMetadata preserved if present
- [x] Error responses (errorCode/errorMessage) handled appropriately
- [x] Tests cover text responses, function calls, function responses
- [x] Tests cover error responses and finish reasons
- [x] Presubmit passes

---

### S2PR7: Response Construction Helpers

**Estimated Lines**: ~100 lines
**Depends On**: S2PR6

**Goal**: Add convenience factory functions for creating common response types that the frontend needs to submit.

**Files to Create/Modify**:
- `packages/adk-converters-ts/src/response-helpers.ts` - Factory functions
- `packages/adk-converters-ts/src/response-helpers.spec.ts` - Unit tests
- `packages/adk-converters-ts/src/index.ts` - Add exports

**Background Reading**:
- [TDD SessionFacade methods](../frontend-tdd.md#sessionfacade-orchestration) - `submitToolInvocation`, `submitFinalResponse`
- [FR Response Construction](../frontend-spec.md#fr-response-construction) - FR-017, FR-018, FR-019

**Acceptance Criteria**:
- [x] `createTextResponse(text: string)` creates proto for text-only response
- [x] `createToolInvocationResponse(toolName: string, args: unknown)` creates proto for function call
- [x] `createFunctionResultResponse(toolName: string, result: unknown)` creates proto for function response
- [x] `createStructuredResponse(data: unknown)` creates proto for JSON schema response
- [x] All helpers return valid `GenerateContentResponse` protos
- [x] Tests verify proto structure for each helper
- [x] Presubmit passes

---

### S2PR8: Round-Trip and Integration Tests

**Estimated Lines**: ~120 lines
**Depends On**: S2PR5, S2PR6, S2PR7

**Goal**: Add comprehensive round-trip tests and integration test fixtures that verify conversion fidelity.

**Completes TDD Task**: `@adk-sim/converters` package (Phase 2) - complete

**Files to Create/Modify**:
- `packages/adk-converters-ts/src/round-trip.spec.ts` - Round-trip tests
- `packages/adk-converters-ts/src/fixtures/requests.ts` - Reusable test fixtures
- `packages/adk-converters-ts/src/fixtures/responses.ts` - Response fixtures
- `packages/adk-converters-ts/src/fixtures/index.ts` - Export fixtures

**Background Reading**:
- [Test Fixtures](../research/converter-research.md#test-fixtures) - Fixture patterns
- [Round-trip Testing](../research/adk-typescript-research.md#testing-patterns) - Round-trip consistency checks

**Acceptance Criteria**:
- [x] Round-trip test: `proto → LlmRequest → (simulate edits) → proto` preserves structure
- [x] `basicTextRequest` fixture with minimal request
- [x] `fullFeaturedRequest` fixture with all fields populated
- [x] Fixtures exported for use in frontend integration tests
- [x] Edge case tests: empty contents, undefined fields, unknown enums
- [x] Presubmit passes

---

### S2PR9: Frontend LlmRequestConverter Service

**Estimated Lines**: ~80 lines
**Depends On**: S2PR5, S2PR7

**Goal**: Create the Angular service wrapper that provides the converter functions with proper DI integration.

**Completes TDD Task**: `LlmRequestConverter` (Phase 2)

**Files to Create/Modify**:
- `frontend/src/app/data-access/llm-request/llm-request-converter.service.ts` - Angular service
- `frontend/src/app/data-access/llm-request/llm-request-converter.service.spec.ts` - Unit tests
- `frontend/src/app/data-access/llm-request/index.ts` - Public exports
- `frontend/src/app/data-access/index.ts` - Add llm-request module export

**Background Reading**:
- [TDD LlmRequestConverter usage](../frontend-tdd.md#sessionfacade-orchestration) - How facade uses converter
- [Data Model Integration](../frontend-tdd.md#data-model-integration) - Flow diagram

**Acceptance Criteria**:
- [x] `LlmRequestConverterService` injectable via `providedIn: 'root'`
- [x] `protoToLlmRequest()` method delegates to package function
- [x] `createToolInvocationResponse()` method delegates to package helper
- [x] `createTextResponse()` method delegates to package helper
- [x] `createStructuredResponse()` method delegates to package helper
- [x] `createFunctionResultResponse()` method delegates to package helper
- [x] Sheriff allows import from `@adk-sim/converters` in data-access
- [x] Unit tests verify delegation works
- [x] Presubmit passes

---

## Implementation Notes

### Patterns to Follow

1. **Use `@bufbuild/protobuf` create() and toJson()**: When creating proto messages, use the schema's `create()` function. For debugging, `toJson()` is useful.

   ```typescript
   import { create, toJson } from '@bufbuild/protobuf';
   import { GenerateContentResponseSchema } from '@adk-sim/protos';

   const response = create(GenerateContentResponseSchema, {
     candidates: [{ content: { parts: [{ text: 'Hello' }] } }],
   });
   ```

2. **Explicit field mapping over JSON casting**: Even though structural typing might allow casts, use explicit mapping for safety and clarity. This makes type mismatches visible at compile time.

3. **Handle undefined consistently**: Proto fields that are unset should map to `undefined` in SDK types, not empty strings or zero values. Use optional chaining liberally.

4. **Mirror Python test structure**: Follow the same test categories as the Python converter for consistency and completeness.

5. **Export fixtures for frontend**: Test fixtures should be exported so frontend integration tests can reuse them.

### Gotchas to Avoid

1. **Don't forget "models/" prefix handling**: Proto model names include the prefix; ADK types typically don't. The `protoToLlmRequest` strips it; `llmResponseToProto` should not add it (responses don't include model).

2. **Enum prefix mismatches**: Proto `HarmCategory.DANGEROUS_CONTENT` maps to SDK `HARM_CATEGORY_DANGEROUS_CONTENT`. Create explicit mapping tables rather than string manipulation.

3. **`toolsDict` is not serializable**: The `LlmRequest.toolsDict` field contains `BaseTool` instances which the frontend can't construct. Always set to `{}`.

4. **`candidates` is an array**: The proto `GenerateContentResponse.candidates` is always an array, even for single responses. Use `candidates[0]` consistently.

5. **`Part` is a union type**: A `Part` can have only ONE of `text`, `functionCall`, `functionResponse`, etc. Don't set multiple fields.

6. **Empty strings vs undefined**: Proto defaults empty strings for unset string fields. Check for both empty string and undefined when determining if a field is "present."

---

## Definition of Done

- [ ] All PRs merged to feature branch
- [ ] `@adk-sim/converters` package fully functional with:
  - [ ] `protoToLlmRequest()` complete
  - [ ] `llmResponseToProto()` complete
  - [ ] Response construction helpers complete
  - [ ] Test fixtures exported
- [ ] Frontend `LlmRequestConverterService` available
- [ ] TDD tasks checked off:
  - [ ] `@adk-sim/converters` package (Phase 2)
  - [ ] `LlmRequestConverter` (Phase 2)
- [ ] Tests passing (unit + round-trip)
- [ ] No new lint warnings
- [ ] npm package builds successfully
- [ ] Sprint retrospective notes added

---

## Retrospective Notes

[To be completed after sprint]
