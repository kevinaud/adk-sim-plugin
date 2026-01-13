/**
 * Generation Config Conversion Utilities
 *
 * Converts between proto GenerationConfig and @google/genai GenerateContentConfig fields.
 */

import type { GenerationConfig as ProtoGenerationConfig } from '@adk-sim/protos';
import type { GenerateContentConfig } from '@google/genai';

import { protoSchemaToGenaiSchema, genaiSchemaToProtoSchema } from './tool-converter.js';
import { copyDefinedFields, createProto } from './utils.js';

/** Numeric generation fields that map directly between proto and genai. */
const NUMERIC_FIELDS = [
  'temperature', 'topP', 'topK', 'maxOutputTokens', 'seed',
  'presencePenalty', 'frequencyPenalty', 'candidateCount',
  'responseLogprobs', 'logprobs',
] as const;

/**
 * Extract generation config fields from proto GenerationConfig.
 */
export function protoGenerationConfigToGenaiConfig(
  protoConfig: ProtoGenerationConfig | undefined,
  target: GenerateContentConfig = {}
): GenerateContentConfig {
  if (!protoConfig) return target;

  // Copy numeric fields that have the same name
  copyDefinedFields(protoConfig, target, [...NUMERIC_FIELDS]);

  // Handle string field (only copy if non-empty)
  if (protoConfig.responseMimeType) {
    target.responseMimeType = protoConfig.responseMimeType;
  }

  // Handle stopSequences (copy non-empty array)
  if (protoConfig.stopSequences?.length) {
    target.stopSequences = [...protoConfig.stopSequences];
  }

  // Handle responseSchema (needs conversion)
  if (protoConfig.responseSchema) {
    target.responseSchema = protoSchemaToGenaiSchema(protoConfig.responseSchema);
  }

  return target;
}

/**
 * Convert SDK GenerateContentConfig fields to proto GenerationConfig.
 */
export function genaiConfigToProtoGenerationConfig(
  genaiConfig: GenerateContentConfig | undefined
): ProtoGenerationConfig {
  const result = createProto<ProtoGenerationConfig>(
    'google.ai.generativelanguage.v1beta.GenerationConfig',
    { stopSequences: [], responseMimeType: '', responseModalities: [] }
  );

  if (!genaiConfig) return result;

  // Copy numeric fields
  copyDefinedFields(genaiConfig, result, [...NUMERIC_FIELDS]);

  // Handle string field
  if (genaiConfig.responseMimeType) {
    result.responseMimeType = genaiConfig.responseMimeType;
  }

  // Handle stopSequences
  if (genaiConfig.stopSequences?.length) {
    result.stopSequences = [...genaiConfig.stopSequences];
  }

  // Handle responseSchema
  if (genaiConfig.responseSchema) {
    result.responseSchema = genaiSchemaToProtoSchema(genaiConfig.responseSchema);
  }

  return result;
}

// For backwards compatibility with request-converter.ts
export type GenerationConfigFields = GenerateContentConfig;
