/**
 * Content Conversion Utilities
 *
 * Converts between proto Content/Part types and @google/genai Content/Part types.
 * These are the foundational converters used by the higher-level request/response converters.
 *
 * Note: We construct proto objects as plain TypeScript objects rather than using
 * `create()` from @bufbuild/protobuf. This is because:
 * 1. TypeScript's structural typing allows this
 * 2. The proto types are primarily used for serialization/deserialization
 * 3. It avoids file descriptor initialization issues in some environments
 */

import type {
  Content as ProtoContent,
  Part as ProtoPart,
  FunctionCall as ProtoFunctionCall,
  FunctionResponse as ProtoFunctionResponse,
  Blob as ProtoBlob,
} from '@adk-sim/protos';

import type {
  Content,
  Part,
  FunctionCall,
  FunctionResponse,
  Blob,
} from '@google/genai';

// Re-export the @google/genai types for consumers
export type { Content, Part, FunctionCall, FunctionResponse, Blob };

// ============================================================================
// Proto → @google/genai Conversion
// ============================================================================

/**
 * Convert a proto Content message to @google/genai Content.
 *
 * @param protoContent - The proto Content message
 * @returns @google/genai Content object
 *
 * @example
 * ```typescript
 * const content = protoContentToGenaiContent(protoContent);
 * console.log(content.role); // 'user' or 'model'
 * console.log(content.parts?.[0].text); // 'Hello!'
 * ```
 */
export function protoContentToGenaiContent(protoContent: ProtoContent): Content {
  const result: Content = {};

  // Role: proto uses empty string as default, we prefer undefined
  if (protoContent.role) {
    result.role = protoContent.role;
  }

  // Parts: convert each proto Part to @google/genai Part
  if (protoContent.parts && protoContent.parts.length > 0) {
    result.parts = protoContent.parts.map(protoPartToGenaiPart);
  }

  return result;
}

/**
 * Convert a proto Part message to @google/genai Part.
 *
 * @param protoPart - The proto Part message
 * @returns @google/genai Part object
 */
export function protoPartToGenaiPart(protoPart: ProtoPart): Part {
  const result: Part = {};

  // Handle the data oneof
  switch (protoPart.data.case) {
    case 'text':
      result.text = protoPart.data.value;
      break;

    case 'functionCall':
      result.functionCall = protoFunctionCallToGenai(protoPart.data.value);
      break;

    case 'functionResponse':
      result.functionResponse = protoFunctionResponseToGenai(protoPart.data.value);
      break;

    case 'inlineData':
      result.inlineData = protoBlobToGenaiInlineData(protoPart.data.value);
      break;

    // Note: fileData, executableCode, codeExecutionResult are not commonly used
    // in the simulator context, so we skip them for now
    default:
      // Unknown or unset case - leave result empty
      break;
  }

  // Handle thought marker
  if (protoPart.thought) {
    result.thought = true;
  }

  return result;
}

/**
 * Convert a proto FunctionCall to @google/genai FunctionCall.
 */
function protoFunctionCallToGenai(protoFc: ProtoFunctionCall): FunctionCall {
  const result: FunctionCall = {
    name: protoFc.name,
  };

  if (protoFc.id) {
    result.id = protoFc.id;
  }

  if (protoFc.args) {
    result.args = protoFc.args as Record<string, unknown>;
  }

  return result;
}

/**
 * Convert a proto FunctionResponse to @google/genai FunctionResponse.
 */
function protoFunctionResponseToGenai(protoFr: ProtoFunctionResponse): FunctionResponse {
  const result: FunctionResponse = {
    name: protoFr.name,
    response: (protoFr.response ?? {}) as Record<string, unknown>,
  };

  if (protoFr.id) {
    result.id = protoFr.id;
  }

  return result;
}

/**
 * Convert a proto Blob to @google/genai Blob (inlineData).
 * Converts Uint8Array to base64 string.
 */
function protoBlobToGenaiInlineData(protoBlob: ProtoBlob): Blob {
  return {
    mimeType: protoBlob.mimeType,
    data: uint8ArrayToBase64(protoBlob.data),
  };
}

// ============================================================================
// @google/genai → Proto Conversion
// ============================================================================

/**
 * Convert @google/genai Content to proto Content message.
 *
 * @param genaiContent - The @google/genai content object
 * @returns Proto Content message
 *
 * @example
 * ```typescript
 * const proto = genaiContentToProtoContent({
 *   role: 'user',
 *   parts: [{ text: 'Hello!' }]
 * });
 * ```
 */
export function genaiContentToProtoContent(genaiContent: Content): ProtoContent {
  const parts = genaiContent.parts?.map(genaiPartToProtoPart) ?? [];

  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Content',
    role: genaiContent.role ?? '',
    parts,
  } as ProtoContent;
}

/**
 * Convert @google/genai Part to proto Part message.
 *
 * @param genaiPart - The @google/genai part object
 * @returns Proto Part message
 */
export function genaiPartToProtoPart(genaiPart: Part): ProtoPart {
  // Determine which data case to use
  let data: ProtoPart['data'] = { case: undefined, value: undefined };

  if (genaiPart.text !== undefined) {
    data = { case: 'text', value: genaiPart.text };
  } else if (genaiPart.functionCall) {
    data = {
      case: 'functionCall',
      value: genaiFunctionCallToProto(genaiPart.functionCall),
    };
  } else if (genaiPart.functionResponse) {
    data = {
      case: 'functionResponse',
      value: genaiFunctionResponseToProto(genaiPart.functionResponse),
    };
  } else if (genaiPart.inlineData) {
    data = {
      case: 'inlineData',
      value: genaiInlineDataToProtoBlob(genaiPart.inlineData),
    };
  }

  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Part',
    data,
    thought: genaiPart.thought ?? false,
    thoughtSignature: new Uint8Array(),
    metadata: { case: undefined, value: undefined },
  } as ProtoPart;
}

/**
 * Convert @google/genai FunctionCall to proto FunctionCall.
 */
function genaiFunctionCallToProto(genaiFc: FunctionCall): ProtoFunctionCall {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.FunctionCall',
    id: genaiFc.id ?? '',
    name: genaiFc.name ?? '',
    args: genaiFc.args as Record<string, unknown> | undefined,
  } as ProtoFunctionCall;
}

/**
 * Convert @google/genai FunctionResponse to proto FunctionResponse.
 */
function genaiFunctionResponseToProto(genaiFr: FunctionResponse): ProtoFunctionResponse {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.FunctionResponse',
    id: genaiFr.id ?? '',
    name: genaiFr.name ?? '',
    response: genaiFr.response,
    parts: [],
    willContinue: false,
  } as ProtoFunctionResponse;
}

/**
 * Convert @google/genai Blob (inlineData) to proto Blob.
 * Converts base64 string to Uint8Array.
 */
function genaiInlineDataToProtoBlob(genaiData: Blob): ProtoBlob {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Blob',
    mimeType: genaiData.mimeType ?? '',
    data: base64ToUint8Array(genaiData.data ?? ''),
  } as ProtoBlob;
}

// ============================================================================
// Base64 Utilities
// ============================================================================

/**
 * Convert Uint8Array to base64 string.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  // Use Buffer in Node.js or btoa in browser
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  // Browser fallback
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  // Use Buffer in Node.js or atob in browser
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  // Browser fallback
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
