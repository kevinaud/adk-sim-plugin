/**
 * Converts ADK LlmResponse format to GenerateContentResponse proto.
 */

import {
  GenerateContentResponse,
  Candidate,
  Candidate_FinishReason,
  GenerateContentResponse_UsageMetadata,
} from '@adk-sim/protos';

import { Content, Part, genaiContentToProtoContent } from './content-converter.js';

export interface LlmResponseConversionResult {
  proto: GenerateContentResponse;
  warnings: string[];
}

export interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

export interface LlmResponse {
  content?: Content | Part[] | string;
  finishReason?: string;
  usageMetadata?: UsageMetadata;
  errorCode?: number;
  errorMessage?: string;
}

const FINISH_REASON_MAP: Record<string, Candidate_FinishReason> = {
  STOP: Candidate_FinishReason.STOP,
  MAX_TOKENS: Candidate_FinishReason.MAX_TOKENS,
  SAFETY: Candidate_FinishReason.SAFETY,
  RECITATION: Candidate_FinishReason.RECITATION,
  LANGUAGE: Candidate_FinishReason.LANGUAGE,
  OTHER: Candidate_FinishReason.OTHER,
  BLOCKLIST: Candidate_FinishReason.OTHER,
  PROHIBITED_CONTENT: Candidate_FinishReason.OTHER,
  SPII: Candidate_FinishReason.OTHER,
  MALFORMED_FUNCTION_CALL: Candidate_FinishReason.OTHER,
  IMAGE_SAFETY: Candidate_FinishReason.OTHER,
};

export function llmResponseToProto(response: LlmResponse): LlmResponseConversionResult {
  const warnings: string[] = [];

  // Build candidate
  const candidate: Candidate = {
    $typeName: 'google.ai.generativelanguage.v1beta.Candidate',
    finishReason: Candidate_FinishReason.STOP,
    safetyRatings: [],
    citationMetadata: undefined,
    tokenCount: 0,
    groundingAttributions: [],
    index: 0,
    avgLogprobs: 0,
  };

  // Convert content
  if (response.content) {
    const contentObj = normalizeContent(response.content);
    try {
      candidate.content = genaiContentToProtoContent(contentObj);
    } catch (e) {
      warnings.push(`Failed to convert content: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Convert finish reason
  if (response.finishReason) {
    const normalized = response.finishReason.toUpperCase();
    candidate.finishReason =
      FINISH_REASON_MAP[normalized] ?? Candidate_FinishReason.FINISH_REASON_UNSPECIFIED;
    if (
      candidate.finishReason === Candidate_FinishReason.FINISH_REASON_UNSPECIFIED &&
      normalized !== 'FINISH_REASON_UNSPECIFIED' &&
      normalized !== 'UNSPECIFIED'
    ) {
      warnings.push(`Unknown finishReason: ${response.finishReason}`);
    }
  }

  // Build usage metadata
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

  // Build response
  const proto: GenerateContentResponse = {
    $typeName: 'google.ai.generativelanguage.v1beta.GenerateContentResponse',
    candidates: [candidate],
    promptFeedback: undefined,
    usageMetadata,
    modelVersion: '',
    responseId: '',
  };

  if (response.errorCode || response.errorMessage) {
    warnings.push(`Response contains error info (${response.errorCode}: ${response.errorMessage})`);
  }

  return { proto, warnings };
}

function normalizeContent(content: Content | Part[] | string): Content {
  if (typeof content === 'string') {
    return { role: 'model', parts: [{ text: content }] };
  }
  if (Array.isArray(content)) {
    return { role: 'model', parts: content };
  }
  return { role: content.role || 'model', parts: content.parts };
}
