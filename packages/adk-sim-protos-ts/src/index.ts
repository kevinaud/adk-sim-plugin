// ADK Simulator Protocol Buffers - TypeScript (auto-generated)
export * from './adksim/v1/simulator_service_pb.js';
export * from './adksim/v1/simulator_session_pb.js';

// Re-export commonly used Google AI types
export type {
  Content,
  Part,
  FunctionCall,
  FunctionResponse,
  Blob,
} from './google/ai/generativelanguage/v1beta/content_pb.js';

export type {
  GenerateContentRequest,
  GenerateContentResponse,
  GenerationConfig,
  Candidate,
} from './google/ai/generativelanguage/v1beta/generative_service_pb.js';

export {
  GenerateContentRequestSchema,
  GenerateContentResponseSchema,
  GenerationConfigSchema,
  CandidateSchema,
  Candidate_FinishReason,
} from './google/ai/generativelanguage/v1beta/generative_service_pb.js';

// Re-export Content types for converters
export type {
  Content,
  Part,
  FunctionCall,
  FunctionResponse,
  Blob,
  Tool,
  FunctionDeclaration,
  Schema,
  ToolConfig,
} from './google/ai/generativelanguage/v1beta/content_pb.js';

export {
  ContentSchema,
  PartSchema,
  FunctionCallSchema,
  FunctionResponseSchema,
  BlobSchema,
  ToolSchema,
  FunctionDeclarationSchema,
  SchemaSchema,
  ToolConfigSchema,
  Type,
} from './google/ai/generativelanguage/v1beta/content_pb.js';

// Re-export Safety types
export type {
  SafetySetting,
  SafetyRating,
} from './google/ai/generativelanguage/v1beta/safety_pb.js';

export {
  SafetySettingSchema,
  SafetyRatingSchema,
  HarmCategory,
  SafetySetting_HarmBlockThreshold,
} from './google/ai/generativelanguage/v1beta/safety_pb.js';
