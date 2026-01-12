/**
 * Converts GenerateContentRequest proto to ADK LlmRequest format.
 *
 * This is the inverse of the Python plugin's llm_request_to_proto().
 */

import type { GenerateContentRequest } from '@adk-sim/protos';

/**
 * Result of converting a proto request to LlmRequest format.
 */
export interface LlmRequestConversionResult {
  /** The model name (without "models/" prefix) */
  model: string;
  /** The conversation contents */
  contents: unknown[];
  /** System instruction if present */
  systemInstruction?: unknown;
  /** Tool definitions if present */
  tools?: unknown[];
  /** Generation config if present */
  generationConfig?: unknown;
}

/**
 * Convert a GenerateContentRequest proto to ADK LlmRequest format.
 *
 * @param proto - The proto message from the simulator server
 * @returns The converted LlmRequest structure
 *
 * @example
 * ```typescript
 * const request = protoToLlmRequest(protoMessage);
 * console.log(request.model); // "gemini-1.5-flash"
 * ```
 */
export function protoToLlmRequest(
  proto: GenerateContentRequest
): LlmRequestConversionResult {
  // TODO: Implement full conversion logic
  // For now, return a minimal structure
  return {
    model: proto.model?.replace(/^models\//, '') ?? '',
    contents: [],
  };
}
