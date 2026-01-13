/**
 * Generation Config Conversion Utilities
 *
 * Converts between proto GenerationConfig and @google/genai GenerateContentConfig fields.
 * This handles the numeric parameters (temperature, topP, etc.) that control generation behavior.
 *
 * Note: The SDK's GenerateContentConfig bundles many fields together (system instruction,
 * tools, safety settings, AND generation config). This converter only handles the
 * generation-specific fields (temperature, topP, etc.), not the other config aspects.
 */

import type { GenerationConfig as ProtoGenerationConfig } from '@adk-sim/protos';

import type { GenerateContentConfig } from '@google/genai';

import { protoSchemaToGenaiSchema, genaiSchemaToProtoSchema } from './tool-converter.js';

/**
 * Fields from GenerationConfig that we extract and map to GenerateContentConfig.
 * These are the generation-specific parameters, excluding system instruction, tools, etc.
 */
export interface GenerationConfigFields {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  seed?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  responseMimeType?: string;
  responseSchema?: GenerateContentConfig['responseSchema'];
  candidateCount?: number;
  responseLogprobs?: boolean;
  logprobs?: number;
}

// ============================================================================
// Proto → @google/genai Conversion
// ============================================================================

/**
 * Extract generation config fields from proto GenerationConfig to SDK-compatible fields.
 *
 * This function maps the numeric/string parameters from the proto to the corresponding
 * fields that can be spread into a GenerateContentConfig object.
 *
 * @param protoConfig - The proto GenerationConfig message
 * @returns Object with SDK-compatible generation config fields
 *
 * @example
 * ```typescript
 * const genConfig = protoGenerationConfigToGenaiConfig(protoRequest.generationConfig);
 * const config: GenerateContentConfig = {
 *   systemInstruction: ...,
 *   tools: ...,
 *   ...genConfig, // Spread in generation fields
 * };
 * ```
 */
export function protoGenerationConfigToGenaiConfig(
  protoConfig: ProtoGenerationConfig | undefined
): GenerationConfigFields {
  const result: GenerationConfigFields = {};

  if (!protoConfig) {
    return result;
  }

  // Temperature (randomness control)
  if (protoConfig.temperature !== undefined) {
    result.temperature = protoConfig.temperature;
  }

  // Top-p (nucleus sampling)
  if (protoConfig.topP !== undefined) {
    result.topP = protoConfig.topP;
  }

  // Top-k (vocabulary sampling)
  if (protoConfig.topK !== undefined) {
    result.topK = protoConfig.topK;
  }

  // Max output tokens
  if (protoConfig.maxOutputTokens !== undefined) {
    result.maxOutputTokens = protoConfig.maxOutputTokens;
  }

  // Stop sequences
  if (protoConfig.stopSequences && protoConfig.stopSequences.length > 0) {
    result.stopSequences = [...protoConfig.stopSequences];
  }

  // Random seed
  if (protoConfig.seed !== undefined) {
    result.seed = protoConfig.seed;
  }

  // Presence penalty
  if (protoConfig.presencePenalty !== undefined) {
    result.presencePenalty = protoConfig.presencePenalty;
  }

  // Frequency penalty
  if (protoConfig.frequencyPenalty !== undefined) {
    result.frequencyPenalty = protoConfig.frequencyPenalty;
  }

  // Response MIME type
  if (protoConfig.responseMimeType) {
    result.responseMimeType = protoConfig.responseMimeType;
  }

  // Response schema (convert proto Schema to SDK Schema)
  if (protoConfig.responseSchema) {
    result.responseSchema = protoSchemaToGenaiSchema(protoConfig.responseSchema);
  }

  // Candidate count
  if (protoConfig.candidateCount !== undefined) {
    result.candidateCount = protoConfig.candidateCount;
  }

  // Response logprobs
  if (protoConfig.responseLogprobs !== undefined) {
    result.responseLogprobs = protoConfig.responseLogprobs;
  }

  // Logprobs count
  if (protoConfig.logprobs !== undefined) {
    result.logprobs = protoConfig.logprobs;
  }

  return result;
}

// ============================================================================
// @google/genai → Proto Conversion
// ============================================================================

/**
 * Convert SDK GenerateContentConfig fields to proto GenerationConfig.
 *
 * This is the inverse of protoGenerationConfigToGenaiConfig. It extracts
 * generation-specific fields from a GenerateContentConfig and returns a
 * proto-compatible object.
 *
 * @param genaiConfig - The SDK GenerateContentConfig (or partial config)
 * @returns Proto-compatible GenerationConfig object
 *
 * @example
 * ```typescript
 * const protoGenConfig = genaiConfigToProtoGenerationConfig(llmRequest.config);
 * ```
 */
export function genaiConfigToProtoGenerationConfig(
  genaiConfig: GenerateContentConfig | undefined
): ProtoGenerationConfig {
  const result: ProtoGenerationConfig = {
    $typeName: 'google.ai.generativelanguage.v1beta.GenerationConfig',
    stopSequences: [],
    responseMimeType: '',
    responseModalities: [],
  } as ProtoGenerationConfig;

  if (!genaiConfig) {
    return result;
  }

  // Temperature
  if (genaiConfig.temperature !== undefined) {
    result.temperature = genaiConfig.temperature;
  }

  // Top-p
  if (genaiConfig.topP !== undefined) {
    result.topP = genaiConfig.topP;
  }

  // Top-k
  if (genaiConfig.topK !== undefined) {
    result.topK = genaiConfig.topK;
  }

  // Max output tokens
  if (genaiConfig.maxOutputTokens !== undefined) {
    result.maxOutputTokens = genaiConfig.maxOutputTokens;
  }

  // Stop sequences
  if (genaiConfig.stopSequences && genaiConfig.stopSequences.length > 0) {
    result.stopSequences = [...genaiConfig.stopSequences];
  }

  // Random seed
  if (genaiConfig.seed !== undefined) {
    result.seed = genaiConfig.seed;
  }

  // Presence penalty
  if (genaiConfig.presencePenalty !== undefined) {
    result.presencePenalty = genaiConfig.presencePenalty;
  }

  // Frequency penalty
  if (genaiConfig.frequencyPenalty !== undefined) {
    result.frequencyPenalty = genaiConfig.frequencyPenalty;
  }

  // Response MIME type
  if (genaiConfig.responseMimeType) {
    result.responseMimeType = genaiConfig.responseMimeType;
  }

  // Response schema
  if (genaiConfig.responseSchema) {
    result.responseSchema = genaiSchemaToProtoSchema(genaiConfig.responseSchema);
  }

  // Candidate count
  if (genaiConfig.candidateCount !== undefined) {
    result.candidateCount = genaiConfig.candidateCount;
  }

  // Response logprobs
  if (genaiConfig.responseLogprobs !== undefined) {
    result.responseLogprobs = genaiConfig.responseLogprobs;
  }

  // Logprobs count
  if (genaiConfig.logprobs !== undefined) {
    result.logprobs = genaiConfig.logprobs;
  }

  return result;
}
