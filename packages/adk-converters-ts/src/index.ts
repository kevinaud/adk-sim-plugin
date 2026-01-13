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
