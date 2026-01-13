/**
 * Request Converter - Converts GenerateContentRequest proto to ADK LlmRequest format.
 *
 * This is the inverse of the Python plugin's llm_request_to_proto().
 * The frontend receives GenerateContentRequest protos from the server and needs
 * to convert them to ADK LlmRequest format for display.
 */

import type { GenerateContentRequest } from '@adk-sim/protos';
import type { Content, Tool, SafetySetting, GenerateContentConfig } from '@google/genai';

import { protoContentToGenaiContent } from './content-converter.js';
import { protoToolToGenaiTool } from './tool-converter.js';
import { protoGenerationConfigToGenaiConfig, type GenerationConfigFields } from './config-converter.js';
import { protoSafetyToGenaiSafety } from './safety-converter.js';

/**
 * LlmRequest structure matching ADK's format.
 *
 * This mirrors the ADK LlmRequest interface from @google/adk:
 * - model: The model name
 * - contents: Conversation history
 * - config: GenerateContentConfig containing system instruction, tools, safety, and gen config
 * - liveConnectConfig: Live connection config (empty for simulator)
 * - toolsDict: Dictionary of tool instances (empty for simulator - no runtime tools)
 */
export interface LlmRequest {
  /** The model name (without "models/" prefix) */
  model: string;
  /** The conversation contents */
  contents: Content[];
  /** Generation configuration including system instruction, tools, safety settings */
  config: GenerateContentConfig;
  /** Live connection configuration (empty object for simulator) */
  liveConnectConfig: Record<string, unknown>;
  /** Tool instances dictionary (empty object for simulator - no runtime tools) */
  toolsDict: Record<string, unknown>;
}

/**
 * @deprecated Use LlmRequest instead. Kept for backwards compatibility.
 */
export type LlmRequestConversionResult = LlmRequest;

/**
 * Strip the "models/" prefix from a model name if present.
 *
 * Proto model names are in the format "models/gemini-1.5-flash".
 * ADK expects just "gemini-1.5-flash".
 *
 * @param model - The model name, possibly with "models/" prefix
 * @returns The model name without the "models/" prefix
 */
function stripModelPrefix(model: string | undefined): string {
  if (!model) {
    return '';
  }
  return model.replace(/^models\//, '');
}

/**
 * Convert a GenerateContentRequest proto to ADK LlmRequest format.
 *
 * This function composes all the helper converters (content, tool, config, safety)
 * into a complete LlmRequest structure that the frontend can display.
 *
 * @param proto - The proto message from the simulator server
 * @returns The converted LlmRequest structure
 *
 * @example
 * ```typescript
 * const request = protoToLlmRequest(protoMessage);
 * console.log(request.model); // "gemini-1.5-flash"
 * console.log(request.contents); // Converted Content[]
 * console.log(request.config.systemInstruction); // System instruction if present
 * ```
 */
export function protoToLlmRequest(proto: GenerateContentRequest): LlmRequest {
  // Build the config object with all configuration fields
  const config: GenerateContentConfig = {};

  // System instruction: convert proto Content to genai Content
  if (proto.systemInstruction) {
    config.systemInstruction = protoContentToGenaiContent(proto.systemInstruction);
  }

  // Tools: convert each proto Tool to genai Tool
  if (proto.tools && proto.tools.length > 0) {
    config.tools = proto.tools.map(protoToolToGenaiTool);
  }

  // Safety settings: convert each proto SafetySetting to genai SafetySetting
  if (proto.safetySettings && proto.safetySettings.length > 0) {
    config.safetySettings = proto.safetySettings.map(protoSafetyToGenaiSafety);
  }

  // Generation config: spread individual fields into config
  if (proto.generationConfig) {
    const genConfigFields = protoGenerationConfigToGenaiConfig(proto.generationConfig);
    spreadGenerationConfig(config, genConfigFields);
  }

  // Convert contents array
  const contents: Content[] = proto.contents
    ? proto.contents.map(protoContentToGenaiContent)
    : [];

  return {
    model: stripModelPrefix(proto.model),
    contents,
    config,
    liveConnectConfig: {},
    toolsDict: {},
  };
}

/**
 * Spread generation config fields into the target config object.
 *
 * This helper assigns each field individually to maintain proper typing
 * and avoid spreading unknown properties.
 *
 * @param target - The target GenerateContentConfig to populate
 * @param fields - The generation config fields to spread
 */
function spreadGenerationConfig(
  target: GenerateContentConfig,
  fields: GenerationConfigFields
): void {
  if (fields.temperature !== undefined) {
    target.temperature = fields.temperature;
  }
  if (fields.topP !== undefined) {
    target.topP = fields.topP;
  }
  if (fields.topK !== undefined) {
    target.topK = fields.topK;
  }
  if (fields.maxOutputTokens !== undefined) {
    target.maxOutputTokens = fields.maxOutputTokens;
  }
  if (fields.stopSequences !== undefined) {
    target.stopSequences = fields.stopSequences;
  }
  if (fields.seed !== undefined) {
    target.seed = fields.seed;
  }
  if (fields.presencePenalty !== undefined) {
    target.presencePenalty = fields.presencePenalty;
  }
  if (fields.frequencyPenalty !== undefined) {
    target.frequencyPenalty = fields.frequencyPenalty;
  }
  if (fields.responseMimeType !== undefined) {
    target.responseMimeType = fields.responseMimeType;
  }
  if (fields.responseSchema !== undefined) {
    target.responseSchema = fields.responseSchema;
  }
  if (fields.candidateCount !== undefined) {
    target.candidateCount = fields.candidateCount;
  }
  if (fields.responseLogprobs !== undefined) {
    target.responseLogprobs = fields.responseLogprobs;
  }
  if (fields.logprobs !== undefined) {
    target.logprobs = fields.logprobs;
  }
}
