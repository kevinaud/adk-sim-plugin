/**
 * Tests for Content Conversion Utilities
 *
 * Note: Rather than using `create()` from @bufbuild/protobuf which requires
 * file descriptor initialization, we construct proto-like objects directly.
 * The types are structurally compatible with the proto types.
 */

import { describe, it, expect } from 'vitest';
import type { Content, Part, FunctionCall, FunctionResponse, Blob } from '@adk-sim/protos';
import {
  protoContentToGenaiContent,
  genaiContentToProtoContent,
  protoPartToGenaiPart,
  genaiPartToProtoPart,
  type GenaiContent,
  type GenaiPart,
} from './content-converter.js';

// Helper to create a Part-like object for testing
function createTestPart(data: Part['data'], thought = false): Part {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Part',
    data,
    metadata: { case: undefined, value: undefined },
    thought,
    thoughtSignature: new Uint8Array(),
  } as Part;
}

// Helper to create a Content-like object for testing
function createTestContent(role: string, parts: Part[]): Content {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Content',
    role,
    parts,
  } as Content;
}

// Helper to create a FunctionCall-like object
function createTestFunctionCall(name: string, id?: string, args?: Record<string, unknown>): FunctionCall {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.FunctionCall',
    id: id ?? '',
    name,
    args,
  } as FunctionCall;
}

// Helper to create a FunctionResponse-like object
function createTestFunctionResponse(
  name: string,
  response: Record<string, unknown>,
  id?: string
): FunctionResponse {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.FunctionResponse',
    id: id ?? '',
    name,
    response,
    parts: [],
    willContinue: false,
  } as FunctionResponse;
}

// Helper to create a Blob-like object
function createTestBlob(mimeType: string, data: Uint8Array): Blob {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Blob',
    mimeType,
    data,
  } as Blob;
}

describe('Content Conversion', () => {
  // ==========================================================================
  // Proto → Genai: Basic Content
  // ==========================================================================

  describe('protoContentToGenaiContent', () => {
    it('should convert user role content with text part', () => {
      const protoContent = createTestContent('user', [
        createTestPart({ case: 'text', value: 'Hello, world!' }),
      ]);

      const result = protoContentToGenaiContent(protoContent);

      expect(result.role).toBe('user');
      expect(result.parts).toHaveLength(1);
      expect(result.parts![0].text).toBe('Hello, world!');
    });

    it('should convert model role content', () => {
      const protoContent = createTestContent('model', [
        createTestPart({ case: 'text', value: 'I can help with that.' }),
      ]);

      const result = protoContentToGenaiContent(protoContent);

      expect(result.role).toBe('model');
      expect(result.parts![0].text).toBe('I can help with that.');
    });

    it('should handle empty role as undefined', () => {
      const protoContent = createTestContent('', []);

      const result = protoContentToGenaiContent(protoContent);

      expect(result.role).toBeUndefined();
    });

    it('should handle content with no parts', () => {
      const protoContent = createTestContent('user', []);

      const result = protoContentToGenaiContent(protoContent);

      expect(result.role).toBe('user');
      expect(result.parts).toBeUndefined();
    });

    it('should convert multi-part content', () => {
      const protoContent = createTestContent('user', [
        createTestPart({ case: 'text', value: 'First part' }),
        createTestPart({ case: 'text', value: 'Second part' }),
      ]);

      const result = protoContentToGenaiContent(protoContent);

      expect(result.parts).toHaveLength(2);
      expect(result.parts![0].text).toBe('First part');
      expect(result.parts![1].text).toBe('Second part');
    });
  });

  // ==========================================================================
  // Proto → Genai: Part Types
  // ==========================================================================

  describe('protoPartToGenaiPart', () => {
    it('should convert text part', () => {
      const protoPart = createTestPart({ case: 'text', value: 'Hello!' });

      const result = protoPartToGenaiPart(protoPart);

      expect(result.text).toBe('Hello!');
      expect(result.functionCall).toBeUndefined();
      expect(result.functionResponse).toBeUndefined();
      expect(result.inlineData).toBeUndefined();
    });

    it('should convert functionCall part', () => {
      const protoPart = createTestPart({
        case: 'functionCall',
        value: createTestFunctionCall('get_weather', 'call-123', { location: 'NYC', units: 'celsius' }),
      });

      const result = protoPartToGenaiPart(protoPart);

      expect(result.functionCall).toBeDefined();
      expect(result.functionCall!.id).toBe('call-123');
      expect(result.functionCall!.name).toBe('get_weather');
      expect(result.functionCall!.args).toEqual({ location: 'NYC', units: 'celsius' });
    });

    it('should convert functionCall without id', () => {
      const protoPart = createTestPart({
        case: 'functionCall',
        value: createTestFunctionCall('simple_func'),
      });

      const result = protoPartToGenaiPart(protoPart);

      expect(result.functionCall!.id).toBeUndefined();
      expect(result.functionCall!.name).toBe('simple_func');
      expect(result.functionCall!.args).toBeUndefined();
    });

    it('should convert functionResponse part', () => {
      const protoPart = createTestPart({
        case: 'functionResponse',
        value: createTestFunctionResponse('get_weather', { temperature: 20, conditions: 'sunny' }, 'call-123'),
      });

      const result = protoPartToGenaiPart(protoPart);

      expect(result.functionResponse).toBeDefined();
      expect(result.functionResponse!.id).toBe('call-123');
      expect(result.functionResponse!.name).toBe('get_weather');
      expect(result.functionResponse!.response).toEqual({ temperature: 20, conditions: 'sunny' });
    });

    it('should convert inlineData part', () => {
      const testData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello" in bytes
      const protoPart = createTestPart({
        case: 'inlineData',
        value: createTestBlob('image/png', testData),
      });

      const result = protoPartToGenaiPart(protoPart);

      expect(result.inlineData).toBeDefined();
      expect(result.inlineData!.mimeType).toBe('image/png');
      // Base64 of "Hello"
      expect(result.inlineData!.data).toBe('SGVsbG8=');
    });

    it('should handle thought marker', () => {
      const protoPart = createTestPart({ case: 'text', value: 'Thinking...' }, true);

      const result = protoPartToGenaiPart(protoPart);

      expect(result.text).toBe('Thinking...');
      expect(result.thought).toBe(true);
    });

    it('should handle unknown data case', () => {
      const protoPart = createTestPart({ case: undefined, value: undefined });

      const result = protoPartToGenaiPart(protoPart);

      expect(result.text).toBeUndefined();
      expect(result.functionCall).toBeUndefined();
      expect(result.functionResponse).toBeUndefined();
      expect(result.inlineData).toBeUndefined();
    });
  });

  // ==========================================================================
  // Genai → Proto: Basic Content
  // ==========================================================================

  describe('genaiContentToProtoContent', () => {
    it('should convert user content with text', () => {
      const genaiContent: GenaiContent = {
        role: 'user',
        parts: [{ text: 'Hello!' }],
      };

      const result = genaiContentToProtoContent(genaiContent);

      expect(result.role).toBe('user');
      expect(result.parts).toHaveLength(1);
      expect(result.parts[0].data.case).toBe('text');
      expect(result.parts[0].data.value).toBe('Hello!');
    });

    it('should convert model content', () => {
      const genaiContent: GenaiContent = {
        role: 'model',
        parts: [{ text: 'Response text' }],
      };

      const result = genaiContentToProtoContent(genaiContent);

      expect(result.role).toBe('model');
    });

    it('should handle undefined role as empty string', () => {
      const genaiContent: GenaiContent = {
        parts: [{ text: 'No role' }],
      };

      const result = genaiContentToProtoContent(genaiContent);

      expect(result.role).toBe('');
    });

    it('should handle undefined parts as empty array', () => {
      const genaiContent: GenaiContent = {
        role: 'user',
      };

      const result = genaiContentToProtoContent(genaiContent);

      expect(result.parts).toHaveLength(0);
    });

    it('should convert multi-part content', () => {
      const genaiContent: GenaiContent = {
        role: 'user',
        parts: [{ text: 'Part 1' }, { text: 'Part 2' }],
      };

      const result = genaiContentToProtoContent(genaiContent);

      expect(result.parts).toHaveLength(2);
      expect(result.parts[0].data.value).toBe('Part 1');
      expect(result.parts[1].data.value).toBe('Part 2');
    });
  });

  // ==========================================================================
  // Genai → Proto: Part Types
  // ==========================================================================

  describe('genaiPartToProtoPart', () => {
    it('should convert text part', () => {
      const genaiPart: GenaiPart = { text: 'Hello!' };

      const result = genaiPartToProtoPart(genaiPart);

      expect(result.data.case).toBe('text');
      expect(result.data.value).toBe('Hello!');
    });

    it('should convert functionCall part', () => {
      const genaiPart: GenaiPart = {
        functionCall: {
          id: 'call-123',
          name: 'get_weather',
          args: { location: 'NYC' },
        },
      };

      const result = genaiPartToProtoPart(genaiPart);

      expect(result.data.case).toBe('functionCall');
      const fc = result.data.value as { id: string; name: string; args?: Record<string, unknown> };
      expect(fc.id).toBe('call-123');
      expect(fc.name).toBe('get_weather');
      expect(fc.args).toEqual({ location: 'NYC' });
    });

    it('should convert functionCall without id', () => {
      const genaiPart: GenaiPart = {
        functionCall: {
          name: 'simple_func',
        },
      };

      const result = genaiPartToProtoPart(genaiPart);

      expect(result.data.case).toBe('functionCall');
      const fc = result.data.value as { id: string; name: string };
      expect(fc.id).toBe('');
      expect(fc.name).toBe('simple_func');
    });

    it('should convert functionResponse part', () => {
      const genaiPart: GenaiPart = {
        functionResponse: {
          id: 'call-123',
          name: 'get_weather',
          response: { temperature: 20 },
        },
      };

      const result = genaiPartToProtoPart(genaiPart);

      expect(result.data.case).toBe('functionResponse');
      const fr = result.data.value as { id: string; name: string; response: Record<string, unknown> };
      expect(fr.id).toBe('call-123');
      expect(fr.name).toBe('get_weather');
      expect(fr.response).toEqual({ temperature: 20 });
    });

    it('should convert inlineData part', () => {
      const genaiPart: GenaiPart = {
        inlineData: {
          mimeType: 'image/png',
          data: 'SGVsbG8=', // "Hello" in base64
        },
      };

      const result = genaiPartToProtoPart(genaiPart);

      expect(result.data.case).toBe('inlineData');
      const blob = result.data.value as { mimeType: string; data: Uint8Array };
      expect(blob.mimeType).toBe('image/png');
      expect(Array.from(blob.data)).toEqual([72, 101, 108, 108, 111]); // "Hello" bytes
    });

    it('should convert thought part', () => {
      const genaiPart: GenaiPart = {
        text: 'Thinking...',
        thought: true,
      };

      const result = genaiPartToProtoPart(genaiPart);

      expect(result.data.case).toBe('text');
      expect(result.thought).toBe(true);
    });

    it('should handle empty part', () => {
      const genaiPart: GenaiPart = {};

      const result = genaiPartToProtoPart(genaiPart);

      expect(result.data.case).toBeUndefined();
    });
  });

  // ==========================================================================
  // Round-Trip Tests
  // ==========================================================================

  describe('Round-trip conversion', () => {
    it('should preserve text content through round-trip', () => {
      const original: GenaiContent = {
        role: 'user',
        parts: [{ text: 'Hello, world!' }],
      };

      const proto = genaiContentToProtoContent(original);
      const roundTrip = protoContentToGenaiContent(proto);

      expect(roundTrip.role).toBe(original.role);
      expect(roundTrip.parts![0].text).toBe(original.parts![0].text);
    });

    it('should preserve functionCall through round-trip', () => {
      const original: GenaiContent = {
        role: 'model',
        parts: [
          {
            functionCall: {
              id: 'fc-001',
              name: 'search',
              args: { query: 'weather', limit: 10 },
            },
          },
        ],
      };

      const proto = genaiContentToProtoContent(original);
      const roundTrip = protoContentToGenaiContent(proto);

      expect(roundTrip.parts![0].functionCall!.id).toBe('fc-001');
      expect(roundTrip.parts![0].functionCall!.name).toBe('search');
      expect(roundTrip.parts![0].functionCall!.args).toEqual({ query: 'weather', limit: 10 });
    });

    it('should preserve functionResponse through round-trip', () => {
      const original: GenaiContent = {
        role: 'user',
        parts: [
          {
            functionResponse: {
              id: 'fc-001',
              name: 'search',
              response: { results: ['a', 'b', 'c'] },
            },
          },
        ],
      };

      const proto = genaiContentToProtoContent(original);
      const roundTrip = protoContentToGenaiContent(proto);

      expect(roundTrip.parts![0].functionResponse!.id).toBe('fc-001');
      expect(roundTrip.parts![0].functionResponse!.name).toBe('search');
      expect(roundTrip.parts![0].functionResponse!.response).toEqual({ results: ['a', 'b', 'c'] });
    });

    it('should preserve inlineData through round-trip', () => {
      const original: GenaiContent = {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: 'dGVzdCBkYXRh', // "test data" in base64
            },
          },
        ],
      };

      const proto = genaiContentToProtoContent(original);
      const roundTrip = protoContentToGenaiContent(proto);

      expect(roundTrip.parts![0].inlineData!.mimeType).toBe('image/jpeg');
      expect(roundTrip.parts![0].inlineData!.data).toBe('dGVzdCBkYXRh');
    });

    it('should preserve multi-part mixed content through round-trip', () => {
      const original: GenaiContent = {
        role: 'model',
        parts: [
          { text: 'Here is the weather:' },
          {
            functionCall: {
              name: 'get_weather',
              args: { city: 'London' },
            },
          },
        ],
      };

      const proto = genaiContentToProtoContent(original);
      const roundTrip = protoContentToGenaiContent(proto);

      expect(roundTrip.parts).toHaveLength(2);
      expect(roundTrip.parts![0].text).toBe('Here is the weather:');
      expect(roundTrip.parts![1].functionCall!.name).toBe('get_weather');
    });

    it('should preserve thought marker through round-trip', () => {
      const original: GenaiContent = {
        role: 'model',
        parts: [{ text: 'Let me think...', thought: true }],
      };

      const proto = genaiContentToProtoContent(original);
      const roundTrip = protoContentToGenaiContent(proto);

      expect(roundTrip.parts![0].thought).toBe(true);
    });
  });
});
