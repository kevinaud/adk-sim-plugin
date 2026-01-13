/**
 * @adk-sim/converters
 *
 * Provides conversion utilities between ADK SDK types and
 * Simulator proto types (from @adk-sim/protos).
 *
 * This package enables the frontend to:
 * - Display incoming LLM requests (Proto → ADK LlmRequest)
 * - Submit human responses (ADK LlmResponse → Proto)
 */

// Content conversion utilities
export {
  protoContentToGenaiContent,
  genaiContentToProtoContent,
  protoPartToGenaiPart,
  genaiPartToProtoPart,
  type GenaiContent,
  type GenaiPart,
  type GenaiFunctionCall,
  type GenaiFunctionResponse,
  type GenaiInlineData,
} from './content-converter.js';

// High-level request/response converters (stubs for now)
export { protoToLlmRequest, type LlmRequestConversionResult } from './request-converter.js';
export { llmResponseToProto, type LlmResponseConversionResult } from './response-converter.js';
