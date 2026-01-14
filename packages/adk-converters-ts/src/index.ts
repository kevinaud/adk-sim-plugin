/**
 * @adk-sim/converters
 *
 * Provides conversion utilities between ADK SDK types and Simulator proto types.
 */

// Content conversion
export {
  protoContentToGenaiContent,
  genaiContentToProtoContent,
  protoPartToGenaiPart,
  genaiPartToProtoPart,
} from './content-converter.js';

// Tool conversion
export {
  protoToolToGenaiTool,
  genaiToolToProtoTool,
  protoFunctionDeclarationToGenai,
  genaiFunctionDeclarationToProto,
  protoSchemaToGenaiSchema,
  genaiSchemaToProtoSchema,
} from './tool-converter.js';

// Config conversion
export {
  protoGenerationConfigToGenaiConfig,
  genaiConfigToProtoGenerationConfig,
} from './config-converter.js';

// Safety settings conversion
export {
  protoSafetyToGenaiSafety,
  genaiSafetyToProtoSafety,
  protoHarmCategoryToGenai,
  genaiHarmCategoryToProto,
  protoHarmBlockThresholdToGenai,
  genaiHarmBlockThresholdToProto,
} from './safety-converter.js';

// High-level converters
export {
  protoToLlmRequest,
  type LlmRequest,
  type LlmRequestConversionResult,
} from './request-converter.js';
export {
  llmResponseToProto,
  type LlmResponse,
  type LlmResponseConversionResult,
} from './response-converter.js';

// Response construction helpers
export {
  createTextResponse,
  createToolInvocationResponse,
  createFunctionResultResponse,
  createStructuredResponse,
} from './response-helpers.js';

// Test fixtures (for integration testing)
export {
  basicTextRequest,
  fullFeaturedRequest,
  emptyContentsRequest,
  multiPartRequest,
  basicTextResponse,
  toolInvocationResponse,
  emptyResponse,
  maxTokensResponse,
  safetyBlockedResponse,
  multiPartResponse,
} from './fixtures/index.js';

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
  SafetySetting,
} from '@google/genai';
