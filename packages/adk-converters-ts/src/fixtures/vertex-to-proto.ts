/**
 * Vertex JSON to Proto Converter
 *
 * Converts raw Vertex AI API JSON to bufbuild proto format.
 * This bridges the gap between wire format and typed proto objects.
 */

import type {
  GenerateContentRequest,
  GenerateContentResponse,
  Content as ProtoContent,
  Part as ProtoPart,
  Tool as ProtoTool,
  FunctionDeclaration as ProtoFunctionDeclaration,
  Schema as ProtoSchema,
  Candidate as ProtoCandidate,
  GenerateContentResponse_UsageMetadata,
} from '@adk-sim/protos';
import {
  Type as ProtoType,
  Candidate_FinishReason,
} from '@adk-sim/protos';

import type {
  VertexRequestJson,
  VertexResponseJson,
  VertexContent,
  VertexPart,
  VertexTool,
  VertexFunctionDeclaration,
  VertexSchema,
} from './vertex-adapter.js';

// ============================================================================
// Schema Type Mapping
// ============================================================================

const TYPE_MAP: Record<string, ProtoType> = {
  STRING: ProtoType.STRING,
  NUMBER: ProtoType.NUMBER,
  INTEGER: ProtoType.INTEGER,
  BOOLEAN: ProtoType.BOOLEAN,
  ARRAY: ProtoType.ARRAY,
  OBJECT: ProtoType.OBJECT,
};

const FINISH_REASON_MAP: Record<string, Candidate_FinishReason> = {
  STOP: Candidate_FinishReason.STOP,
  MAX_TOKENS: Candidate_FinishReason.MAX_TOKENS,
  SAFETY: Candidate_FinishReason.SAFETY,
  RECITATION: Candidate_FinishReason.RECITATION,
  OTHER: Candidate_FinishReason.OTHER,
};

// ============================================================================
// Part Conversion
// ============================================================================

function vertexPartToProto(part: VertexPart): ProtoPart {
  const proto: ProtoPart = {
    $typeName: 'google.ai.generativelanguage.v1beta.Part',
    thought: false,
    thoughtSignature: new Uint8Array(),
  } as ProtoPart;

  if (part.text !== undefined) {
    (proto as Record<string, unknown>).data = { case: 'text', value: part.text };
  } else {
    const fc = part.functionCall ?? part.function_call;
    if (fc) {
      (proto as Record<string, unknown>).data = {
        case: 'functionCall',
        value: {
          $typeName: 'google.ai.generativelanguage.v1beta.FunctionCall',
          name: fc.name,
          args: fc.args,
          id: '',
        },
      };
    } else {
      const fr = part.functionResponse ?? part.function_response;
      if (fr) {
        (proto as Record<string, unknown>).data = {
          case: 'functionResponse',
          value: {
            $typeName: 'google.ai.generativelanguage.v1beta.FunctionResponse',
            name: fr.name,
            response: fr.response,
            id: '',
          },
        };
      }
    }
  }

  (proto as Record<string, unknown>).metadata = { case: undefined, value: undefined };
  return proto;
}

// ============================================================================
// Content Conversion
// ============================================================================

function vertexContentToProto(content: VertexContent): ProtoContent {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Content',
    role: content.role,
    parts: content.parts.map(vertexPartToProto),
  } as ProtoContent;
}

// ============================================================================
// Schema Conversion
// ============================================================================

function vertexSchemaToProto(schema: VertexSchema): ProtoSchema {
  const proto: ProtoSchema = {
    $typeName: 'google.ai.generativelanguage.v1beta.Schema',
    type: TYPE_MAP[schema.type] ?? ProtoType.TYPE_UNSPECIFIED,
    description: schema.description ?? '',
    required: schema.required ?? [],
    enum: schema.enum ?? [],
    format: '',
    nullable: false,
    properties: {},
    anyOf: [],
    maxItems: undefined,
    minItems: undefined,
    items: undefined,
    minimum: undefined,
    maximum: undefined,
    example: undefined,
    title: '',
    default: undefined,
    pattern: undefined,
    minLength: undefined,
    maxLength: undefined,
    minProperties: undefined,
    maxProperties: undefined,
    propertyOrdering: [],
  } as unknown as ProtoSchema;

  if (schema.properties) {
    const props: Record<string, ProtoSchema> = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      props[key] = vertexSchemaToProto(value);
    }
    proto.properties = props;
  }

  if (schema.items) {
    proto.items = vertexSchemaToProto(schema.items);
  }

  return proto;
}

// ============================================================================
// Tool Conversion
// ============================================================================

function vertexFunctionToProto(fd: VertexFunctionDeclaration): ProtoFunctionDeclaration {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.FunctionDeclaration',
    name: fd.name,
    description: fd.description ?? '',
    parameters: fd.parameters ? vertexSchemaToProto(fd.parameters) : undefined,
  } as ProtoFunctionDeclaration;
}

function vertexToolToProto(tool: VertexTool): ProtoTool {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Tool',
    functionDeclarations: tool.functionDeclarations?.map(vertexFunctionToProto) ?? [],
    codeExecution: undefined,
    googleSearch: undefined,
    googleSearchRetrieval: undefined,
  } as ProtoTool;
}

// ============================================================================
// Request Conversion
// ============================================================================

export function vertexRequestToProto(json: VertexRequestJson, model: string): GenerateContentRequest {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.GenerateContentRequest',
    model,
    contents: json.contents.map(vertexContentToProto),
    systemInstruction: json.systemInstruction
      ? vertexContentToProto(json.systemInstruction)
      : undefined,
    tools: json.tools?.map(vertexToolToProto) ?? [],
    safetySettings: [],
    generationConfig: undefined,
    toolConfig: undefined,
    cachedContent: undefined,
  } as GenerateContentRequest;
}

// ============================================================================
// Response Conversion
// ============================================================================

export function vertexResponseToProto(json: VertexResponseJson): GenerateContentResponse {
  const candidates: ProtoCandidate[] = json.candidates.map((c) => ({
    $typeName: 'google.ai.generativelanguage.v1beta.Candidate',
    content: vertexContentToProto(c.content),
    finishReason: FINISH_REASON_MAP[c.finishReason] ?? Candidate_FinishReason.FINISH_REASON_UNSPECIFIED,
    safetyRatings: [],
    citationMetadata: undefined,
    tokenCount: 0,
    groundingAttributions: [],
    index: 0,
    avgLogprobs: 0,
  } as ProtoCandidate));

  let usageMetadata: GenerateContentResponse_UsageMetadata | undefined;
  if (json.usageMetadata) {
    usageMetadata = {
      $typeName: 'google.ai.generativelanguage.v1beta.GenerateContentResponse.UsageMetadata',
      promptTokenCount: json.usageMetadata.promptTokenCount,
      candidatesTokenCount: json.usageMetadata.candidatesTokenCount,
      totalTokenCount: json.usageMetadata.totalTokenCount,
      cachedContentTokenCount: 0,
      toolUsePromptTokenCount: 0,
      thoughtsTokenCount: json.usageMetadata.thoughtsTokenCount ?? 0,
      promptTokensDetails: [],
      cacheTokensDetails: [],
      candidatesTokensDetails: [],
      toolUsePromptTokensDetails: [],
    };
  }

  return {
    $typeName: 'google.ai.generativelanguage.v1beta.GenerateContentResponse',
    candidates,
    promptFeedback: undefined,
    usageMetadata,
    modelVersion: json.modelVersion ?? '',
    responseId: json.responseId ?? '',
  } as GenerateContentResponse;
}
