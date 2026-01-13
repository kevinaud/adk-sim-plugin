/**
 * Content Conversion Utilities
 *
 * Converts between proto Content/Part types and SDK-style GenaiContent/GenaiPart types.
 * These are the foundational converters used by the higher-level request/response converters.
 *
 * Note: We construct proto objects as plain TypeScript objects rather than using
 * `create()` from @bufbuild/protobuf. This is because:
 * 1. TypeScript's structural typing allows this
 * 2. The proto types are primarily used for serialization/deserialization
 * 3. It avoids file descriptor initialization issues in some environments
 */

import type {
  Content,
  Part,
  FunctionCall,
  FunctionResponse,
  Blob,
} from '@adk-sim/protos';

// ============================================================================
// SDK-style Types (Genai)
// ============================================================================

/**
 * SDK-style Content type matching @google/genai Content interface.
 * Used for display and manipulation in the frontend.
 */
export interface GenaiContent {
  role?: string;
  parts?: GenaiPart[];
}

/**
 * SDK-style Part type matching @google/genai Part interface.
 * Supports text, function calls, function responses, inline data, and thought markers.
 */
export interface GenaiPart {
  text?: string;
  functionCall?: GenaiFunctionCall;
  functionResponse?: GenaiFunctionResponse;
  inlineData?: GenaiInlineData;
  thought?: boolean;
}

/**
 * SDK-style FunctionCall type.
 */
export interface GenaiFunctionCall {
  id?: string;
  name: string;
  args?: Record<string, unknown>;
}

/**
 * SDK-style FunctionResponse type.
 */
export interface GenaiFunctionResponse {
  id?: string;
  name: string;
  response: Record<string, unknown>;
}

/**
 * SDK-style InlineData type for binary content.
 */
export interface GenaiInlineData {
  mimeType: string;
  data: string; // base64 encoded
}

// ============================================================================
// Proto → Genai Conversion
// ============================================================================

/**
 * Convert a proto Content message to SDK-style GenaiContent.
 *
 * @param protoContent - The proto Content message
 * @returns SDK-style GenaiContent object
 *
 * @example
 * ```typescript
 * const genai = protoContentToGenaiContent(protoContent);
 * console.log(genai.role); // 'user' or 'model'
 * console.log(genai.parts?.[0].text); // 'Hello!'
 * ```
 */
export function protoContentToGenaiContent(protoContent: Content): GenaiContent {
  const result: GenaiContent = {};

  // Role: proto uses empty string as default, we prefer undefined
  if (protoContent.role) {
    result.role = protoContent.role;
  }

  // Parts: convert each proto Part to GenaiPart
  if (protoContent.parts && protoContent.parts.length > 0) {
    result.parts = protoContent.parts.map(protoPartToGenaiPart);
  }

  return result;
}

/**
 * Convert a proto Part message to SDK-style GenaiPart.
 *
 * @param protoPart - The proto Part message
 * @returns SDK-style GenaiPart object
 */
export function protoPartToGenaiPart(protoPart: Part): GenaiPart {
  const result: GenaiPart = {};

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
 * Convert a proto FunctionCall to SDK-style GenaiFunctionCall.
 */
function protoFunctionCallToGenai(protoFc: FunctionCall): GenaiFunctionCall {
  const result: GenaiFunctionCall = {
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
 * Convert a proto FunctionResponse to SDK-style GenaiFunctionResponse.
 */
function protoFunctionResponseToGenai(protoFr: FunctionResponse): GenaiFunctionResponse {
  const result: GenaiFunctionResponse = {
    name: protoFr.name,
    response: (protoFr.response ?? {}) as Record<string, unknown>,
  };

  if (protoFr.id) {
    result.id = protoFr.id;
  }

  return result;
}

/**
 * Convert a proto Blob to SDK-style GenaiInlineData.
 * Converts Uint8Array to base64 string.
 */
function protoBlobToGenaiInlineData(protoBlob: Blob): GenaiInlineData {
  return {
    mimeType: protoBlob.mimeType,
    data: uint8ArrayToBase64(protoBlob.data),
  };
}

// ============================================================================
// Genai → Proto Conversion
// ============================================================================

/**
 * Convert SDK-style GenaiContent to proto Content message.
 *
 * @param genaiContent - The SDK-style content object
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
export function genaiContentToProtoContent(genaiContent: GenaiContent): Content {
  const parts = genaiContent.parts?.map(genaiPartToProtoPart) ?? [];

  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Content',
    role: genaiContent.role ?? '',
    parts,
  } as Content;
}

/**
 * Convert SDK-style GenaiPart to proto Part message.
 *
 * @param genaiPart - The SDK-style part object
 * @returns Proto Part message
 */
export function genaiPartToProtoPart(genaiPart: GenaiPart): Part {
  // Determine which data case to use
  let data: Part['data'] = { case: undefined, value: undefined };

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
  } as Part;
}

/**
 * Convert SDK-style GenaiFunctionCall to proto FunctionCall.
 */
function genaiFunctionCallToProto(genaiFc: GenaiFunctionCall): FunctionCall {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.FunctionCall',
    id: genaiFc.id ?? '',
    name: genaiFc.name,
    args: genaiFc.args as Record<string, unknown> | undefined,
  } as FunctionCall;
}

/**
 * Convert SDK-style GenaiFunctionResponse to proto FunctionResponse.
 */
function genaiFunctionResponseToProto(genaiFr: GenaiFunctionResponse): FunctionResponse {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.FunctionResponse',
    id: genaiFr.id ?? '',
    name: genaiFr.name,
    response: genaiFr.response,
    parts: [],
    willContinue: false,
  } as FunctionResponse;
}

/**
 * Convert SDK-style GenaiInlineData to proto Blob.
 * Converts base64 string to Uint8Array.
 */
function genaiInlineDataToProtoBlob(genaiData: GenaiInlineData): Blob {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Blob',
    mimeType: genaiData.mimeType,
    data: base64ToUint8Array(genaiData.data),
  } as Blob;
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
