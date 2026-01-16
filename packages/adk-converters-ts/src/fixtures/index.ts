/**
 * Test Fixtures - Public Exports
 *
 * Reusable fixtures for testing converters in both the package and frontend.
 */

// Request fixtures
export {
  basicTextRequest,
  fullFeaturedRequest,
  emptyContentsRequest,
  multiPartRequest,
} from './requests.js';

// Response fixtures
export {
  basicTextResponse,
  toolInvocationResponse,
  emptyResponse,
  maxTokensResponse,
  safetyBlockedResponse,
  multiPartResponse,
} from './responses.js';

// Vertex AI debug adapter (for loading raw API request/response JSON)
export {
  extractVertexSteps,
  getVertexTraceMetadata,
  getUniqueTools,
  type VertexDebugTrace,
  type VertexDebugEntry,
  type VertexRequestJson,
  type VertexResponseJson,
  type VertexLlmStep,
  type VertexContent,
  type VertexPart,
  type VertexTool,
  type VertexFunctionDeclaration,
  type VertexSchema,
} from './vertex-adapter.js';

// Vertex JSON to Proto converter
export { vertexRequestToProto, vertexResponseToProto } from './vertex-to-proto.js';
