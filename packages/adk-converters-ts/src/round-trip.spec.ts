/**
 * Round-Trip Conversion Tests
 *
 * Tests that verify conversion fidelity by checking that data survives
 * the round-trip through our converters.
 */

import { describe, it, expect } from 'vitest';
import type { Tool, Content } from '@google/genai';

import { protoToLlmRequest } from './request-converter.js';
import { llmResponseToProto } from './response-converter.js';
import {
  createTextResponse,
  createToolInvocationResponse,
  createStructuredResponse,
} from './response-helpers.js';

import {
  basicTextRequest,
  fullFeaturedRequest,
  emptyContentsRequest,
  multiPartRequest,
} from './fixtures/index.js';

// ============================================================================
// Request Conversion Round-Trip Tests
// ============================================================================

describe('Round-trip: Proto Request → LlmRequest', () => {
  it('preserves model name (without prefix)', () => {
    const llmRequest = protoToLlmRequest(basicTextRequest);
    expect(llmRequest.model).toBe('gemini-2.0-flash');
  });

  it('preserves content text through conversion', () => {
    const llmRequest = protoToLlmRequest(basicTextRequest);

    expect(llmRequest.contents).toHaveLength(1);
    expect(llmRequest.contents[0].role).toBe('user');
    expect(llmRequest.contents[0].parts).toHaveLength(1);
    expect(llmRequest.contents[0].parts?.[0].text).toBe('Hello, world!');
  });

  it('preserves full-featured request fields', () => {
    const llmRequest = protoToLlmRequest(fullFeaturedRequest);

    // Model
    expect(llmRequest.model).toBe('gemini-2.0-flash');

    // Contents (3 messages)
    expect(llmRequest.contents).toHaveLength(3);
    expect(llmRequest.contents[0].role).toBe('user');
    expect(llmRequest.contents[1].role).toBe('model');
    expect(llmRequest.contents[2].role).toBe('user');

    // System instruction
    expect(llmRequest.config.systemInstruction).toBeDefined();
    const sysInstruction = llmRequest.config.systemInstruction as Content;
    expect(sysInstruction.parts?.[0].text).toBe('You are a helpful weather assistant.');

    // Tools
    expect(llmRequest.config.tools).toHaveLength(1);
    const tool = llmRequest.config.tools?.[0] as Tool;
    expect(tool.functionDeclarations).toHaveLength(1);
    expect(tool.functionDeclarations?.[0].name).toBe('get_weather');

    // Safety settings
    expect(llmRequest.config.safetySettings).toHaveLength(2);

    // Generation config fields
    expect(llmRequest.config.temperature).toBe(0.7);
    expect(llmRequest.config.topP).toBe(0.9);
    expect(llmRequest.config.topK).toBe(40);
    expect(llmRequest.config.maxOutputTokens).toBe(1024);
    expect(llmRequest.config.stopSequences).toEqual(['END']);
  });

  it('handles empty contents gracefully', () => {
    const llmRequest = protoToLlmRequest(emptyContentsRequest);

    expect(llmRequest.model).toBe('gemini-2.0-flash');
    expect(llmRequest.contents).toHaveLength(0);
  });

  it('preserves multi-part content', () => {
    const llmRequest = protoToLlmRequest(multiPartRequest);

    expect(llmRequest.contents).toHaveLength(1);
    expect(llmRequest.contents[0].parts).toHaveLength(3);
    expect(llmRequest.contents[0].parts?.[0].text).toBe('First part.');
    expect(llmRequest.contents[0].parts?.[1].text).toBe('Second part.');
    expect(llmRequest.contents[0].parts?.[2].text).toBe('Third part.');
  });
});

// ============================================================================
// Response Construction Round-Trip Tests
// ============================================================================

describe('Round-trip: LlmResponse → Proto Response', () => {
  it('creates valid text response proto', () => {
    const responseProto = createTextResponse('Response text');

    expect(responseProto.candidates).toHaveLength(1);
    expect(responseProto.candidates?.[0]?.content?.parts).toHaveLength(1);
    const part = responseProto.candidates?.[0]?.content?.parts?.[0];
    expect(part?.data.case).toBe('text');
    expect(part?.data.value).toBe('Response text');
  });

  it('creates valid tool invocation response proto', () => {
    const responseProto = createToolInvocationResponse('get_weather', { location: 'NYC' });

    expect(responseProto.candidates).toHaveLength(1);
    const part = responseProto.candidates?.[0]?.content?.parts?.[0];
    expect(part?.data.case).toBe('functionCall');
    if (part?.data.case === 'functionCall') {
      expect(part.data.value.name).toBe('get_weather');
      expect(part.data.value.args).toEqual({ location: 'NYC' });
    }
  });

  it('creates valid structured response proto', () => {
    const data = { temperature: 72, condition: 'sunny' };
    const responseProto = createStructuredResponse(data);

    expect(responseProto.candidates).toHaveLength(1);
    const part = responseProto.candidates?.[0]?.content?.parts?.[0];
    expect(part?.data.case).toBe('text');
    if (part?.data.case === 'text') {
      expect(JSON.parse(part.data.value as string)).toEqual(data);
    }
  });
});

// ============================================================================
// LlmResponse → Proto Conversion Tests
// ============================================================================

describe('Round-trip: LlmResponse object → Proto via llmResponseToProto', () => {
  it('converts simple string content', () => {
    const { proto, warnings } = llmResponseToProto({
      content: 'Simple response',
      finishReason: 'STOP',
    });

    expect(warnings).toHaveLength(0);
    expect(proto.candidates).toHaveLength(1);
    expect(proto.candidates?.[0]?.content?.role).toBe('model');
    const part = proto.candidates?.[0]?.content?.parts?.[0];
    expect(part?.data.case).toBe('text');
    expect(part?.data.value).toBe('Simple response');
  });

  it('converts Content object with parts', () => {
    const { proto, warnings } = llmResponseToProto({
      content: {
        role: 'model',
        parts: [{ text: 'Part 1' }, { text: 'Part 2' }],
      },
      finishReason: 'STOP',
    });

    expect(warnings).toHaveLength(0);
    expect(proto.candidates?.[0]?.content?.parts).toHaveLength(2);
    expect(proto.candidates?.[0]?.content?.parts?.[0].data.value).toBe('Part 1');
    expect(proto.candidates?.[0]?.content?.parts?.[1].data.value).toBe('Part 2');
  });

  it('converts function call content', () => {
    const { proto, warnings } = llmResponseToProto({
      content: {
        role: 'model',
        parts: [{ functionCall: { name: 'search', args: { query: 'test' } } }],
      },
    });

    expect(warnings).toHaveLength(0);
    const part = proto.candidates?.[0]?.content?.parts?.[0];
    expect(part?.data.case).toBe('functionCall');
    if (part?.data.case === 'functionCall') {
      expect(part.data.value.name).toBe('search');
      expect(part.data.value.args).toEqual({ query: 'test' });
    }
  });

  it('converts usage metadata', () => {
    const { proto } = llmResponseToProto({
      content: 'Test',
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 20,
        totalTokenCount: 30,
      },
    });

    expect(proto.usageMetadata?.promptTokenCount).toBe(10);
    expect(proto.usageMetadata?.candidatesTokenCount).toBe(20);
    expect(proto.usageMetadata?.totalTokenCount).toBe(30);
  });

  it('maps finish reasons correctly', () => {
    const stopResult = llmResponseToProto({ content: 'Test', finishReason: 'STOP' });
    expect(stopResult.proto.candidates?.[0]?.finishReason).toBe(1); // STOP enum value

    const maxTokensResult = llmResponseToProto({ content: 'Test', finishReason: 'MAX_TOKENS' });
    expect(maxTokensResult.proto.candidates?.[0]?.finishReason).toBe(2); // MAX_TOKENS enum value

    const safetyResult = llmResponseToProto({ content: 'Test', finishReason: 'SAFETY' });
    expect(safetyResult.proto.candidates?.[0]?.finishReason).toBe(3); // SAFETY enum value
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Edge cases: Undefined and empty fields', () => {
  it('handles undefined system instruction', () => {
    const llmRequest = protoToLlmRequest(basicTextRequest);
    expect(llmRequest.config.systemInstruction).toBeUndefined();
  });

  it('handles undefined generation config', () => {
    const llmRequest = protoToLlmRequest(basicTextRequest);
    // These fields should be undefined, not 0 or empty
    expect(llmRequest.config.temperature).toBeUndefined();
    expect(llmRequest.config.maxOutputTokens).toBeUndefined();
  });

  it('handles empty tools array', () => {
    const llmRequest = protoToLlmRequest(basicTextRequest);
    expect(llmRequest.config.tools).toBeUndefined();
  });

  it('handles empty safety settings array', () => {
    const llmRequest = protoToLlmRequest(basicTextRequest);
    expect(llmRequest.config.safetySettings).toBeUndefined();
  });
});

describe('Edge cases: Unknown enum handling', () => {
  it('warns on unknown finish reason but does not fail', () => {
    const { proto, warnings } = llmResponseToProto({
      content: 'Test',
      finishReason: 'UNKNOWN_REASON',
    });

    expect(proto.candidates).toHaveLength(1);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('Unknown finishReason');
  });
});

describe('Edge cases: Array content input', () => {
  it('converts Part[] array input to Content', () => {
    const { proto } = llmResponseToProto({
      content: [{ text: 'From array' }],
    });

    expect(proto.candidates?.[0]?.content?.role).toBe('model');
    expect(proto.candidates?.[0]?.content?.parts?.[0].data.value).toBe('From array');
  });
});
