/**
 * Request Converter - Converts GenerateContentRequest proto to ADK LlmRequest format.
 */

import type { GenerateContentRequest } from '@adk-sim/protos';
import type { Content, GenerateContentConfig } from '@google/genai';

import { protoContentToGenaiContent } from './content-converter.js';
import { protoToolToGenaiTool } from './tool-converter.js';
import { protoGenerationConfigToGenaiConfig } from './config-converter.js';
import { protoSafetyToGenaiSafety } from './safety-converter.js';

/**
 * LlmRequest structure matching ADK's format.
 */
export interface LlmRequest {
  model: string;
  contents: Content[];
  config: GenerateContentConfig;
  liveConnectConfig: Record<string, unknown>;
  toolsDict: Record<string, unknown>;
}

/** @deprecated Use LlmRequest instead. */
export type LlmRequestConversionResult = LlmRequest;

/**
 * Strip the "models/" prefix from a model name if present.
 */
function stripModelPrefix(model: string | undefined): string {
  return model?.replace(/^models\//, '') ?? '';
}

/**
 * Convert a GenerateContentRequest proto to ADK LlmRequest format.
 */
export function protoToLlmRequest(proto: GenerateContentRequest): LlmRequest {
  const config: GenerateContentConfig = {};

  // System instruction
  if (proto.systemInstruction) {
    config.systemInstruction = protoContentToGenaiContent(proto.systemInstruction);
  }

  // Tools
  if (proto.tools?.length) {
    config.tools = proto.tools.map(protoToolToGenaiTool);
  }

  // Safety settings
  if (proto.safetySettings?.length) {
    config.safetySettings = proto.safetySettings.map(protoSafetyToGenaiSafety);
  }

  // Generation config (spread into config object directly)
  if (proto.generationConfig) {
    protoGenerationConfigToGenaiConfig(proto.generationConfig, config);
  }

  return {
    model: stripModelPrefix(proto.model),
    contents: proto.contents?.map(protoContentToGenaiContent) ?? [],
    config,
    liveConnectConfig: {},
    toolsDict: {},
  };
}
