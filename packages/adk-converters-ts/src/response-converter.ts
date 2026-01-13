/**
 * Converts ADK LlmResponse format to GenerateContentResponse proto.
 *
 * This is the inverse of the Python plugin's proto_to_llm_response().
 */

import {
  GenerateContentResponse,
  Candidate,
  Candidate_FinishReason,
  GenerateContentResponse_UsageMetadata,
} from '@adk-sim/protos';

import {
  Content,
  Part,
  genaiContentToProtoContent
} from './content-converter.js';

/**
 * Result of converting an LlmResponse to proto format.
 */
export interface LlmResponseConversionResult {
  /** The converted proto message */
  proto: GenerateContentResponse;
  /** Any warnings generated during conversion */
  warnings: string[];
}

/**
 * Usage metadata for the response.
 * Mirrors @google/genai UsageMetadata.
 */
export interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

/**
 * Input structure for LlmResponse conversion.
 * Mirrors the ADK LlmResponse type.
 */
export interface LlmResponse {
  /** The response content - can be Content object, array of Parts, or simple string */
  content?: Content | Part[] | string;
  /** The reason generation finished */
  finishReason?: string;
  /** Token usage statistics */
  usageMetadata?: UsageMetadata;
  /** Error code (if response represents an error) */
  errorCode?: number;
  /** Error message (if response represents an error) */
  errorMessage?: string;
}

/**
 * Convert an LlmResponse to GenerateContentResponse proto format.
 *
 * @param response - The LlmResponse to convert
 * @returns The converted proto message and any warnings
 */
export function llmResponseToProto(
  response: LlmResponse
): LlmResponseConversionResult {
  const warnings: string[] = [];
  
  // 1. Handle Candidate
  // The proto expects candidates[] array. We'll create one candidate.
  const candidate: Candidate = {
    $typeName: 'google.ai.generativelanguage.v1beta.Candidate',
    finishReason: Candidate_FinishReason.STOP, // Default
    safetyRatings: [],
    citationMetadata: undefined,
    tokenCount: 0,
    groundingAttributions: [],
    index: 0,
    avgLogprobs: 0,
  };

  // Convert Content
  if (response.content) {
    let contentObj: Content;
    
    if (typeof response.content === 'string') {
      contentObj = { role: 'model', parts: [{ text: response.content }] };
    } else if (Array.isArray(response.content)) {
      contentObj = { role: 'model', parts: response.content };
    } else {
      contentObj = response.content;
      if (!contentObj.role) {
        contentObj.role = 'model';
      }
    }

    try {
      candidate.content = genaiContentToProtoContent(contentObj);
    } catch (e) {
      warnings.push(`Failed to convert content: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Convert Finish Reason
  if (response.finishReason) {
    candidate.finishReason = mapFinishReason(response.finishReason);
    if (candidate.finishReason === Candidate_FinishReason.FINISH_REASON_UNSPECIFIED) {
      if (response.finishReason !== 'FINISH_REASON_UNSPECIFIED' && response.finishReason !== 'UNSPECIFIED') {
        warnings.push(`Unknown finishReason: ${response.finishReason}, defaulting to UNSPECIFIED`);
      }
    }
  }

  // 2. Handle UsageMetadata
  let usageMetadata: GenerateContentResponse_UsageMetadata | undefined;
  if (response.usageMetadata) {
    usageMetadata = {
      $typeName: 'google.ai.generativelanguage.v1beta.GenerateContentResponse.UsageMetadata',
      promptTokenCount: response.usageMetadata.promptTokenCount ?? 0,
      candidatesTokenCount: response.usageMetadata.candidatesTokenCount ?? 0,
      totalTokenCount: response.usageMetadata.totalTokenCount ?? 0,
      cachedContentTokenCount: 0,
      toolUsePromptTokenCount: 0,
      thoughtsTokenCount: 0,
      promptTokensDetails: [],
      cacheTokensDetails: [],
      candidatesTokensDetails: [],
      toolUsePromptTokensDetails: [],
    };
  }

  // 3. Construct GenerateContentResponse
  const proto: GenerateContentResponse = {
    $typeName: 'google.ai.generativelanguage.v1beta.GenerateContentResponse',
    candidates: [candidate],
    promptFeedback: undefined,
    usageMetadata: usageMetadata,
    modelVersion: '',
    responseId: '',
  };

  if (response.errorCode || response.errorMessage) {
     warnings.push(`Response contains error info (${response.errorCode}: ${response.errorMessage}) which cannot be fully represented in a successful GenerateContentResponse proto.`);
  }

  return { proto, warnings };
}

/**
 * Maps string finish reason to Proto enum.
 */
function mapFinishReason(reason: string): Candidate_FinishReason {
  const normalized = reason.toUpperCase();
  switch (normalized) {
    case 'STOP': return Candidate_FinishReason.STOP;
    case 'MAX_TOKENS': return Candidate_FinishReason.MAX_TOKENS;
    case 'SAFETY': return Candidate_FinishReason.SAFETY;
    case 'RECITATION': return Candidate_FinishReason.RECITATION;
    case 'LANGUAGE': return Candidate_FinishReason.LANGUAGE;
    case 'OTHER': return Candidate_FinishReason.OTHER;
    case 'BLOCKLIST': return Candidate_FinishReason.OTHER;
    case 'PROHIBITED_CONTENT': return Candidate_FinishReason.OTHER;
    case 'SPII': return Candidate_FinishReason.OTHER;
    case 'MALFORMED_FUNCTION_CALL': return Candidate_FinishReason.OTHER; 
    case 'IMAGE_SAFETY': return Candidate_FinishReason.OTHER;
    default: return Candidate_FinishReason.FINISH_REASON_UNSPECIFIED;
  }
}
