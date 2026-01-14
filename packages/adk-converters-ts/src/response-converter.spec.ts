import { describe, it, expect } from 'vitest';
import { llmResponseToProto, LlmResponse } from './response-converter.js';
import { Candidate_FinishReason } from '@adk-sim/protos';

describe('llmResponseToProto', () => {
  it('converts simple text response', () => {
    const input: LlmResponse = {
      content: 'Hello world',
    };
    const { proto, warnings } = llmResponseToProto(input);

    expect(warnings).toHaveLength(0);
    expect(proto.candidates).toHaveLength(1);
    const candidate = proto.candidates[0];

    expect(candidate.finishReason).toBe(Candidate_FinishReason.STOP); // Default
    expect(candidate.content).toBeDefined();
    expect(candidate.content?.role).toBe('model');
    expect(candidate.content?.parts).toHaveLength(1);
    expect(candidate.content?.parts[0].data.case).toBe('text');
    expect(candidate.content?.parts[0].data.value).toBe('Hello world');
  });

  it('converts text response with explicit finish reason', () => {
    const input: LlmResponse = {
      content: 'Hello',
      finishReason: 'MAX_TOKENS',
    };
    const { proto } = llmResponseToProto(input);
    expect(proto.candidates[0].finishReason).toBe(Candidate_FinishReason.MAX_TOKENS);
  });

  it('handles function call in content', () => {
    const input: LlmResponse = {
      content: {
        role: 'model',
        parts: [
          {
            functionCall: {
              name: 'get_weather',
              args: { location: 'Paris' },
            },
          },
        ],
      },
    };
    const { proto } = llmResponseToProto(input);
    const part = proto.candidates[0].content?.parts[0];
    if (part?.data.case === 'functionCall') {
      expect(part.data.value.name).toBe('get_weather');
    } else {
      throw new Error('Expected functionCall part data, got: ' + part?.data.case);
    }
  });

  it('handles usage metadata', () => {
    const input: LlmResponse = {
      content: 'Test',
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 5,
        totalTokenCount: 15,
      },
    };
    const { proto } = llmResponseToProto(input);
    expect(proto.usageMetadata).toBeDefined();
    expect(proto.usageMetadata?.promptTokenCount).toBe(10);
    expect(proto.usageMetadata?.candidatesTokenCount).toBe(5);
    expect(proto.usageMetadata?.totalTokenCount).toBe(15);
  });

  it('maps various finish reasons', () => {
    const cases: [string, Candidate_FinishReason][] = [
      ['STOP', Candidate_FinishReason.STOP],
      ['stop', Candidate_FinishReason.STOP],
      ['SAFETY', Candidate_FinishReason.SAFETY],
      ['OTHER', Candidate_FinishReason.OTHER],
      ['BLOCKLIST', Candidate_FinishReason.OTHER], // Mapped to OTHER
    ];

    cases.forEach(([reason, expected]) => {
      const { proto } = llmResponseToProto({ content: 'x', finishReason: reason });
      expect(proto.candidates[0].finishReason).toBe(expected);
    });
  });

  it('warns on unknown finish reason and defaults to UNSPECIFIED', () => {
    const { proto, warnings } = llmResponseToProto({
      content: 'x',
      finishReason: 'UNKNOWN_REASON_XY',
    });
    expect(proto.candidates[0].finishReason).toBe(Candidate_FinishReason.FINISH_REASON_UNSPECIFIED);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('Unknown finishReason');
  });

  it('warns when error info is present', () => {
    const input: LlmResponse = {
      content: 'Error occurred',
      errorCode: 400,
      errorMessage: 'Bad Request',
    };
    const { warnings } = llmResponseToProto(input);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('error info');
  });

  it('handles empty content (undefined)', () => {
    const { proto } = llmResponseToProto({});
    expect(proto.candidates).toHaveLength(1);
    // Content might be undefined or empty
    expect(proto.candidates[0].content).toBeUndefined();
  });
});
