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

// Re-export converters (stubs for now)
export { protoToLlmRequest, type LlmRequestConversionResult } from './request-converter.js';
export { llmResponseToProto, type LlmResponseConversionResult } from './response-converter.js';
