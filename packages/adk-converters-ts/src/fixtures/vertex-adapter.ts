/**
 * Vertex AI Debug Adapter
 *
 * Loads raw Vertex AI API request/response JSON captured from the wire.
 * This is the most direct representation of the GenerateContentRequest/Response
 * protos - just JSON serialization of the actual API calls.
 */

// ============================================================================
// Vertex Debug Types (raw API JSON format)
// ============================================================================

/** A part in the Vertex AI JSON format */
export interface VertexPart {
  text?: string;
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  function_call?: {
    name: string;
    args: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: unknown;
  };
  function_response?: {
    name: string;
    response: unknown;
  };
  thoughtSignature?: string;
  thought_signature?: string;
}

/** Content in the Vertex AI JSON format */
export interface VertexContent {
  role: string;
  parts: VertexPart[];
}

/** Schema in the Vertex AI JSON format */
export interface VertexSchema {
  type: string;
  properties?: Record<string, VertexSchema>;
  required?: string[];
  enum?: string[];
  description?: string;
  items?: VertexSchema;
}

/** Function declaration in the Vertex AI JSON format */
export interface VertexFunctionDeclaration {
  name: string;
  description?: string;
  parameters?: VertexSchema;
  response?: VertexSchema;
}

/** Tool in the Vertex AI JSON format */
export interface VertexTool {
  functionDeclarations?: VertexFunctionDeclaration[];
}

/** Generation config in the Vertex AI JSON format */
export interface VertexGenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  responseMimeType?: string;
}

/** The raw request JSON sent to Vertex AI */
export interface VertexRequestJson {
  contents: VertexContent[];
  systemInstruction?: VertexContent;
  tools?: VertexTool[];
  generationConfig?: VertexGenerationConfig;
  labels?: Record<string, string>;
}

/** Candidate in the Vertex AI JSON format */
export interface VertexCandidate {
  content: VertexContent;
  finishReason: string;
}

/** Usage metadata in the Vertex AI JSON format */
export interface VertexUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  thoughtsTokenCount?: number;
  trafficType?: string;
  promptTokensDetails?: Array<{ modality: string; tokenCount: number }>;
  candidatesTokensDetails?: Array<{ modality: string; tokenCount: number }>;
}

/** The raw response JSON from Vertex AI */
export interface VertexResponseJson {
  candidates: VertexCandidate[];
  usageMetadata?: VertexUsageMetadata;
  modelVersion?: string;
  createTime?: string;
  responseId?: string;
}

/** A single API call entry from the debug log */
export interface VertexDebugEntry {
  url: string;
  method: string;
  headers: Record<string, string>;
  request_json: VertexRequestJson;
  response_json: VertexResponseJson;
  status_code: number;
}

/** The full debug trace (array of API calls) */
export type VertexDebugTrace = VertexDebugEntry[];

// ============================================================================
// Extracted Step Type
// ============================================================================

/** A complete LLM step with request and response */
export interface VertexLlmStep {
  stepNumber: number;
  url: string;
  model: string;
  agentName: string;
  request: VertexRequestJson;
  response: VertexResponseJson;
  statusCode: number;
}

// ============================================================================
// Extraction Functions
// ============================================================================

/**
 * Extract the model name from the URL.
 */
function extractModelFromUrl(url: string): string {
  const match = url.match(/models\/([^:]+)/);
  return match ? match[1] : 'unknown';
}

/**
 * Extract the agent name from request labels.
 */
function extractAgentName(request: VertexRequestJson): string {
  return request.labels?.adk_agent_name ?? 'unknown';
}

/**
 * Extract LLM steps from a Vertex debug trace.
 */
export function extractVertexSteps(trace: VertexDebugTrace): VertexLlmStep[] {
  return trace.map((entry, index) => ({
    stepNumber: index + 1,
    url: entry.url,
    model: extractModelFromUrl(entry.url),
    agentName: extractAgentName(entry.request_json),
    request: entry.request_json,
    response: entry.response_json,
    statusCode: entry.status_code,
  }));
}

/**
 * Get trace metadata.
 */
export function getVertexTraceMetadata(trace: VertexDebugTrace): {
  totalCalls: number;
  uniqueModels: string[];
  uniqueAgents: string[];
  totalPromptTokens: number;
  totalCompletionTokens: number;
} {
  const steps = extractVertexSteps(trace);

  const uniqueModels = [...new Set(steps.map((s) => s.model))];
  const uniqueAgents = [...new Set(steps.map((s) => s.agentName))];

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  for (const step of steps) {
    totalPromptTokens += step.response.usageMetadata?.promptTokenCount ?? 0;
    totalCompletionTokens += step.response.usageMetadata?.candidatesTokenCount ?? 0;
  }

  return {
    totalCalls: trace.length,
    uniqueModels,
    uniqueAgents,
    totalPromptTokens,
    totalCompletionTokens,
  };
}

/**
 * Get all unique tool names from the trace.
 */
export function getUniqueTools(trace: VertexDebugTrace): string[] {
  const toolNames = new Set<string>();

  for (const entry of trace) {
    for (const tool of entry.request_json.tools ?? []) {
      for (const fd of tool.functionDeclarations ?? []) {
        toolNames.add(fd.name);
      }
    }
  }

  return [...toolNames].sort();
}
