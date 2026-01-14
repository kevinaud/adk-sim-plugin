/**
 * Test Fixtures - Response protobuf messages
 *
 * Reusable response fixtures for testing converters and frontend integration.
 */

import type {
  GenerateContentResponse,
  Candidate,
  Content as ProtoContent,
  Part as ProtoPart,
  FunctionCall as ProtoFunctionCall,
  GenerateContentResponse_UsageMetadata,
} from '@adk-sim/protos';
import { Candidate_FinishReason } from '@adk-sim/protos';

// ============================================================================
// Helper Functions
// ============================================================================

function createTextPart(text: string): ProtoPart {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Part',
    data: { case: 'text', value: text },
    metadata: { case: undefined, value: undefined },
    thought: false,
    thoughtSignature: new Uint8Array(),
  } as ProtoPart;
}

function createFunctionCallPart(name: string, args: Record<string, unknown>): ProtoPart {
  const functionCall: ProtoFunctionCall = {
    $typeName: 'google.ai.generativelanguage.v1beta.FunctionCall',
    id: '',
    name,
    args,
  } as ProtoFunctionCall;

  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Part',
    data: { case: 'functionCall', value: functionCall },
    metadata: { case: undefined, value: undefined },
    thought: false,
    thoughtSignature: new Uint8Array(),
  } as ProtoPart;
}

function createContent(role: string, parts: ProtoPart[]): ProtoContent {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Content',
    role,
    parts,
  } as ProtoContent;
}

function createCandidate(
  content: ProtoContent,
  finishReason: Candidate_FinishReason = Candidate_FinishReason.STOP,
): Candidate {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Candidate',
    content,
    finishReason,
    safetyRatings: [],
    citationMetadata: undefined,
    tokenCount: 0,
    groundingAttributions: [],
    index: 0,
    avgLogprobs: 0,
  } as Candidate;
}

function createUsageMetadata(
  promptTokens: number,
  candidatesTokens: number,
): GenerateContentResponse_UsageMetadata {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.GenerateContentResponse.UsageMetadata',
    promptTokenCount: promptTokens,
    candidatesTokenCount: candidatesTokens,
    totalTokenCount: promptTokens + candidatesTokens,
    cachedContentTokenCount: 0,
    toolUsePromptTokenCount: 0,
    thoughtsTokenCount: 0,
    promptTokensDetails: [],
    cacheTokensDetails: [],
    candidatesTokensDetails: [],
    toolUsePromptTokensDetails: [],
  } as GenerateContentResponse_UsageMetadata;
}

// ============================================================================
// Basic Response Fixture
// ============================================================================

/**
 * Simple text response with minimal fields.
 */
export const basicTextResponse: GenerateContentResponse = {
  $typeName: 'google.ai.generativelanguage.v1beta.GenerateContentResponse',
  candidates: [
    createCandidate(createContent('model', [createTextPart('Hello! How can I help you?')])),
  ],
  promptFeedback: undefined,
  usageMetadata: createUsageMetadata(10, 15),
  modelVersion: '',
  responseId: '',
} as GenerateContentResponse;

// ============================================================================
// Tool Invocation Response Fixture
// ============================================================================

/**
 * Response with a function call (tool invocation).
 */
export const toolInvocationResponse: GenerateContentResponse = {
  $typeName: 'google.ai.generativelanguage.v1beta.GenerateContentResponse',
  candidates: [
    createCandidate(
      createContent('model', [
        createFunctionCallPart('get_weather', { location: 'San Francisco' }),
      ]),
    ),
  ],
  promptFeedback: undefined,
  usageMetadata: createUsageMetadata(25, 12),
  modelVersion: '',
  responseId: '',
} as GenerateContentResponse;

// ============================================================================
// Edge Case Fixtures
// ============================================================================

/**
 * Response with empty candidates array.
 */
export const emptyResponse: GenerateContentResponse = {
  $typeName: 'google.ai.generativelanguage.v1beta.GenerateContentResponse',
  candidates: [],
  promptFeedback: undefined,
  usageMetadata: undefined,
  modelVersion: '',
  responseId: '',
} as GenerateContentResponse;

/**
 * Response with MAX_TOKENS finish reason (truncated output).
 */
export const maxTokensResponse: GenerateContentResponse = {
  $typeName: 'google.ai.generativelanguage.v1beta.GenerateContentResponse',
  candidates: [
    createCandidate(
      createContent('model', [createTextPart('This is a truncated response that was cut off...')]),
      Candidate_FinishReason.MAX_TOKENS,
    ),
  ],
  promptFeedback: undefined,
  usageMetadata: createUsageMetadata(100, 500),
  modelVersion: '',
  responseId: '',
} as GenerateContentResponse;

/**
 * Response with SAFETY finish reason (blocked content).
 */
export const safetyBlockedResponse: GenerateContentResponse = {
  $typeName: 'google.ai.generativelanguage.v1beta.GenerateContentResponse',
  candidates: [
    createCandidate(createContent('model', [createTextPart('')]), Candidate_FinishReason.SAFETY),
  ],
  promptFeedback: undefined,
  usageMetadata: createUsageMetadata(50, 0),
  modelVersion: '',
  responseId: '',
} as GenerateContentResponse;

/**
 * Response with multiple text parts.
 */
export const multiPartResponse: GenerateContentResponse = {
  $typeName: 'google.ai.generativelanguage.v1beta.GenerateContentResponse',
  candidates: [
    createCandidate(
      createContent('model', [
        createTextPart('First part of the response.'),
        createTextPart('Second part with more detail.'),
      ]),
    ),
  ],
  promptFeedback: undefined,
  usageMetadata: createUsageMetadata(20, 30),
  modelVersion: '',
  responseId: '',
} as GenerateContentResponse;
