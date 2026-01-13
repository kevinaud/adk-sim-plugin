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
} from './content-converter.js';

// Tool conversion utilities
export {
  protoToolToGenaiTool,
  genaiToolToProtoTool,
  protoFunctionDeclarationToGenai,
  genaiFunctionDeclarationToProto,
  protoSchemaToGenaiSchema,
  genaiSchemaToProtoSchema,
} from './tool-converter.js';

// Config conversion utilities
export {
  protoGenerationConfigToGenaiConfig,
  genaiConfigToProtoGenerationConfig,
  type GenerationConfigFields,
} from './config-converter.js';

// Re-export @google/genai types for convenience
export type {
  Content,
  Part,
  FunctionCall,
  FunctionResponse,
  Blob,
  Tool,
  FunctionDeclaration,
  Schema,
} from '@google/genai';

// High-level request/response converters (stubs for now)
export { protoToLlmRequest, type LlmRequestConversionResult } from './request-converter.js';
export { llmResponseToProto, type LlmResponseConversionResult } from './response-converter.js';
