/**
 * Content Conversion Utilities
 *
 * Converts between proto Content/Part types and @google/genai Content/Part types.
 */

import type {
  Content as ProtoContent,
  Part as ProtoPart,
  FunctionCall as ProtoFunctionCall,
  FunctionResponse as ProtoFunctionResponse,
  Blob as ProtoBlob,
} from '@adk-sim/protos';

import type { Content, Part, FunctionCall, FunctionResponse, Blob } from '@google/genai';

export type { Content, Part, FunctionCall, FunctionResponse, Blob };

// ============================================================================
// Proto -> Genai Conversion
// ============================================================================

export function protoContentToGenaiContent(proto: ProtoContent): Content {
  const result: Content = {};
  if (proto.role) result.role = proto.role;
  if (proto.parts?.length) result.parts = proto.parts.map(protoPartToGenaiPart);
  return result;
}

export function protoPartToGenaiPart(proto: ProtoPart): Part {
  const result: Part = {};

  switch (proto.data.case) {
    case 'text':
      result.text = proto.data.value;
      break;
    case 'functionCall':
      result.functionCall = protoFunctionCallToGenai(proto.data.value);
      break;
    case 'functionResponse':
      result.functionResponse = protoFunctionResponseToGenai(proto.data.value);
      break;
    case 'inlineData':
      result.inlineData = protoBlobToGenai(proto.data.value);
      break;
  }

  if (proto.thought) result.thought = true;
  return result;
}

function protoFunctionCallToGenai(proto: ProtoFunctionCall): FunctionCall {
  const result: FunctionCall = { name: proto.name };
  if (proto.id) result.id = proto.id;
  if (proto.args) result.args = proto.args as Record<string, unknown>;
  return result;
}

function protoFunctionResponseToGenai(proto: ProtoFunctionResponse): FunctionResponse {
  const result: FunctionResponse = {
    name: proto.name,
    response: (proto.response ?? {}) as Record<string, unknown>,
  };
  if (proto.id) result.id = proto.id;
  return result;
}

function protoBlobToGenai(proto: ProtoBlob): Blob {
  return {
    mimeType: proto.mimeType,
    data: uint8ArrayToBase64(proto.data),
  };
}

// ============================================================================
// Genai -> Proto Conversion
// ============================================================================

export function genaiContentToProtoContent(genai: Content): ProtoContent {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Content',
    role: genai.role ?? '',
    parts: genai.parts?.map(genaiPartToProtoPart) ?? [],
  } as ProtoContent;
}

export function genaiPartToProtoPart(genai: Part): ProtoPart {
  let data: ProtoPart['data'] = { case: undefined, value: undefined };

  if (genai.text !== undefined) {
    data = { case: 'text', value: genai.text };
  } else if (genai.functionCall) {
    data = { case: 'functionCall', value: genaiFunctionCallToProto(genai.functionCall) };
  } else if (genai.functionResponse) {
    data = { case: 'functionResponse', value: genaiFunctionResponseToProto(genai.functionResponse) };
  } else if (genai.inlineData) {
    data = { case: 'inlineData', value: genaiInlineDataToProto(genai.inlineData) };
  }

  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Part',
    data,
    thought: genai.thought ?? false,
    thoughtSignature: new Uint8Array(),
    metadata: { case: undefined, value: undefined },
  } as ProtoPart;
}

function genaiFunctionCallToProto(genai: FunctionCall): ProtoFunctionCall {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.FunctionCall',
    id: genai.id ?? '',
    name: genai.name ?? '',
    args: genai.args as Record<string, unknown> | undefined,
  } as ProtoFunctionCall;
}

function genaiFunctionResponseToProto(genai: FunctionResponse): ProtoFunctionResponse {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.FunctionResponse',
    id: genai.id ?? '',
    name: genai.name ?? '',
    response: genai.response,
    parts: [],
    willContinue: false,
  } as ProtoFunctionResponse;
}

function genaiInlineDataToProto(genai: Blob): ProtoBlob {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Blob',
    mimeType: genai.mimeType ?? '',
    data: base64ToUint8Array(genai.data ?? ''),
  } as ProtoBlob;
}

// ============================================================================
// Base64 Utilities
// ============================================================================

function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
