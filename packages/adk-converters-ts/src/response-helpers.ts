/**
 * Response Construction Helpers
 *
 * Convenience factory functions for creating common response types
 * that the frontend needs to submit.
 */

import type {
  GenerateContentResponse,
  Candidate,
  Content as ProtoContent,
  Part as ProtoPart,
  FunctionCall as ProtoFunctionCall,
  FunctionResponse as ProtoFunctionResponse,
  GenerateContentResponse_UsageMetadata,
} from '@adk-sim/protos';
import { Candidate_FinishReason } from '@adk-sim/protos';

/**
 * Creates a GenerateContentResponse proto for a text-only response.
 * Used for final answers from the model.
 *
 * @param text - The text content of the response
 * @returns A GenerateContentResponse proto with the text wrapped in candidates[0].content
 */
export function createTextResponse(text: string): GenerateContentResponse {
  const textPart: ProtoPart = {
    $typeName: 'google.ai.generativelanguage.v1beta.Part',
    data: { case: 'text', value: text },
    thought: false,
    thoughtSignature: new Uint8Array(),
    metadata: { case: undefined, value: undefined },
  } as ProtoPart;

  return buildResponse([textPart], Candidate_FinishReason.STOP);
}

/**
 * Creates a GenerateContentResponse proto for a function call / tool invocation.
 * Used when the model wants to invoke a tool.
 *
 * @param toolName - The name of the tool/function to call
 * @param args - The arguments to pass to the function
 * @returns A GenerateContentResponse proto with a function call part
 */
export function createToolInvocationResponse(
  toolName: string,
  args: Record<string, unknown>,
): GenerateContentResponse {
  const functionCall: ProtoFunctionCall = {
    $typeName: 'google.ai.generativelanguage.v1beta.FunctionCall',
    id: '',
    name: toolName,
    args: args,
  } as ProtoFunctionCall;

  const functionCallPart: ProtoPart = {
    $typeName: 'google.ai.generativelanguage.v1beta.Part',
    data: { case: 'functionCall', value: functionCall },
    thought: false,
    thoughtSignature: new Uint8Array(),
    metadata: { case: undefined, value: undefined },
  } as ProtoPart;

  // Function calls typically don't have STOP as finish reason
  // Some implementations use UNSPECIFIED or a specific reason
  // We'll use STOP as it's a valid completed response
  return buildResponse([functionCallPart], Candidate_FinishReason.STOP);
}

/**
 * Creates a GenerateContentResponse proto for a function result.
 * Used to provide the return value from a simulated tool execution.
 *
 * @param toolName - The name of the tool/function that was called
 * @param result - The result from the function execution
 * @returns A GenerateContentResponse proto with a function response part
 */
export function createFunctionResultResponse(
  toolName: string,
  result: unknown,
): GenerateContentResponse {
  const functionResponse: ProtoFunctionResponse = {
    $typeName: 'google.ai.generativelanguage.v1beta.FunctionResponse',
    id: '',
    name: toolName,
    response: result as Record<string, unknown> | undefined,
    parts: [],
    willContinue: false,
  } as ProtoFunctionResponse;

  const functionResponsePart: ProtoPart = {
    $typeName: 'google.ai.generativelanguage.v1beta.Part',
    data: { case: 'functionResponse', value: functionResponse },
    thought: false,
    thoughtSignature: new Uint8Array(),
    metadata: { case: undefined, value: undefined },
  } as ProtoPart;

  return buildResponse([functionResponsePart], Candidate_FinishReason.STOP);
}

/**
 * Creates a GenerateContentResponse proto for a structured JSON response.
 * Used for JSON schema responses where the content is structured data.
 *
 * @param data - The structured data to include in the response
 * @returns A GenerateContentResponse proto with the JSON stringified in a text part
 */
export function createStructuredResponse(data: unknown): GenerateContentResponse {
  // Structured responses are typically returned as JSON text
  const jsonText = JSON.stringify(data);

  const textPart: ProtoPart = {
    $typeName: 'google.ai.generativelanguage.v1beta.Part',
    data: { case: 'text', value: jsonText },
    thought: false,
    thoughtSignature: new Uint8Array(),
    metadata: { case: undefined, value: undefined },
  } as ProtoPart;

  return buildResponse([textPart], Candidate_FinishReason.STOP);
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Builds a GenerateContentResponse with the given parts and finish reason.
 */
function buildResponse(
  parts: ProtoPart[],
  finishReason: Candidate_FinishReason,
): GenerateContentResponse {
  const content: ProtoContent = {
    $typeName: 'google.ai.generativelanguage.v1beta.Content',
    role: 'model',
    parts,
  } as ProtoContent;

  const candidate: Candidate = {
    $typeName: 'google.ai.generativelanguage.v1beta.Candidate',
    content,
    finishReason,
    safetyRatings: [],
    citationMetadata: undefined,
    tokenCount: 0,
    groundingAttributions: [],
    index: 0,
    avgLogprobs: 0,
  };

  const usageMetadata: GenerateContentResponse_UsageMetadata = {
    $typeName: 'google.ai.generativelanguage.v1beta.GenerateContentResponse.UsageMetadata',
    promptTokenCount: 0,
    candidatesTokenCount: 0,
    totalTokenCount: 0,
    cachedContentTokenCount: 0,
    toolUsePromptTokenCount: 0,
    thoughtsTokenCount: 0,
    promptTokensDetails: [],
    cacheTokensDetails: [],
    candidatesTokensDetails: [],
    toolUsePromptTokensDetails: [],
  };

  return {
    $typeName: 'google.ai.generativelanguage.v1beta.GenerateContentResponse',
    candidates: [candidate],
    promptFeedback: undefined,
    usageMetadata,
    modelVersion: '',
    responseId: '',
  };
}
