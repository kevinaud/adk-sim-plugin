import { describe, it, expect } from 'vitest';
import {
  createTextResponse,
  createToolInvocationResponse,
  createFunctionResultResponse,
  createStructuredResponse,
} from './response-helpers.js';
import { Candidate_FinishReason } from '@adk-sim/protos';

describe('response-helpers', () => {
  describe('createTextResponse', () => {
    it('creates a valid GenerateContentResponse for text', () => {
      const response = createTextResponse('Hello, world!');

      expect(response.$typeName).toBe(
        'google.ai.generativelanguage.v1beta.GenerateContentResponse',
      );
      expect(response.candidates).toHaveLength(1);

      const candidate = response.candidates[0];
      expect(candidate.finishReason).toBe(Candidate_FinishReason.STOP);
      expect(candidate.content).toBeDefined();
      expect(candidate.content?.role).toBe('model');
      expect(candidate.content?.parts).toHaveLength(1);

      const part = candidate.content?.parts[0];
      expect(part?.data.case).toBe('text');
      expect(part?.data.value).toBe('Hello, world!');
    });

    it('handles empty text', () => {
      const response = createTextResponse('');

      const part = response.candidates[0].content?.parts[0];
      expect(part?.data.case).toBe('text');
      expect(part?.data.value).toBe('');
    });

    it('handles text with special characters', () => {
      const specialText = 'Line1\nLine2\tTabbed "quoted" and \'apostrophe\'';
      const response = createTextResponse(specialText);

      const part = response.candidates[0].content?.parts[0];
      expect(part?.data.value).toBe(specialText);
    });
  });

  describe('createToolInvocationResponse', () => {
    it('creates a valid GenerateContentResponse for function call', () => {
      const response = createToolInvocationResponse('get_weather', { location: 'Paris' });

      expect(response.$typeName).toBe(
        'google.ai.generativelanguage.v1beta.GenerateContentResponse',
      );
      expect(response.candidates).toHaveLength(1);

      const candidate = response.candidates[0];
      expect(candidate.finishReason).toBe(Candidate_FinishReason.STOP);
      expect(candidate.content?.role).toBe('model');

      const part = candidate.content?.parts[0];
      expect(part?.data.case).toBe('functionCall');

      if (part?.data.case === 'functionCall') {
        expect(part.data.value.name).toBe('get_weather');
        expect(part.data.value.args).toEqual({ location: 'Paris' });
      } else {
        throw new Error('Expected functionCall part');
      }
    });

    it('handles complex arguments', () => {
      const complexArgs = {
        name: 'test',
        count: 42,
        enabled: true,
        nested: { foo: 'bar', arr: [1, 2, 3] },
      };
      const response = createToolInvocationResponse('complex_tool', complexArgs);

      const part = response.candidates[0].content?.parts[0];
      if (part?.data.case === 'functionCall') {
        expect(part.data.value.args).toEqual(complexArgs);
      } else {
        throw new Error('Expected functionCall part');
      }
    });

    it('handles empty arguments', () => {
      const response = createToolInvocationResponse('no_args_tool', {});

      const part = response.candidates[0].content?.parts[0];
      if (part?.data.case === 'functionCall') {
        expect(part.data.value.name).toBe('no_args_tool');
        expect(part.data.value.args).toEqual({});
      } else {
        throw new Error('Expected functionCall part');
      }
    });
  });

  describe('createFunctionResultResponse', () => {
    it('creates a valid GenerateContentResponse for function response', () => {
      const result = { temperature: 22, unit: 'celsius', conditions: 'sunny' };
      const response = createFunctionResultResponse('get_weather', result);

      expect(response.$typeName).toBe(
        'google.ai.generativelanguage.v1beta.GenerateContentResponse',
      );
      expect(response.candidates).toHaveLength(1);

      const candidate = response.candidates[0];
      expect(candidate.finishReason).toBe(Candidate_FinishReason.STOP);
      expect(candidate.content?.role).toBe('model');

      const part = candidate.content?.parts[0];
      expect(part?.data.case).toBe('functionResponse');

      if (part?.data.case === 'functionResponse') {
        expect(part.data.value.name).toBe('get_weather');
        expect(part.data.value.response).toEqual(result);
      } else {
        throw new Error('Expected functionResponse part');
      }
    });

    it('handles string result', () => {
      const response = createFunctionResultResponse('string_tool', 'success');

      const part = response.candidates[0].content?.parts[0];
      if (part?.data.case === 'functionResponse') {
        expect(part.data.value.response).toBe('success');
      } else {
        throw new Error('Expected functionResponse part');
      }
    });

    it('handles null result', () => {
      const response = createFunctionResultResponse('void_tool', null);

      const part = response.candidates[0].content?.parts[0];
      if (part?.data.case === 'functionResponse') {
        expect(part.data.value.response).toBeNull();
      } else {
        throw new Error('Expected functionResponse part');
      }
    });

    it('handles array result', () => {
      const arrayResult = [1, 2, 3, { nested: true }];
      const response = createFunctionResultResponse('array_tool', arrayResult);

      const part = response.candidates[0].content?.parts[0];
      if (part?.data.case === 'functionResponse') {
        expect(part.data.value.response).toEqual(arrayResult);
      } else {
        throw new Error('Expected functionResponse part');
      }
    });
  });

  describe('createStructuredResponse', () => {
    it('creates a valid GenerateContentResponse for structured data', () => {
      const data = { name: 'John', age: 30, active: true };
      const response = createStructuredResponse(data);

      expect(response.$typeName).toBe(
        'google.ai.generativelanguage.v1beta.GenerateContentResponse',
      );
      expect(response.candidates).toHaveLength(1);

      const candidate = response.candidates[0];
      expect(candidate.finishReason).toBe(Candidate_FinishReason.STOP);
      expect(candidate.content?.role).toBe('model');

      const part = candidate.content?.parts[0];
      expect(part?.data.case).toBe('text');
      expect(part?.data.value).toBe(JSON.stringify(data));
    });

    it('handles arrays', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const response = createStructuredResponse(data);

      const part = response.candidates[0].content?.parts[0];
      expect(part?.data.value).toBe(JSON.stringify(data));
    });

    it('handles nested structures', () => {
      const data = {
        user: {
          profile: {
            settings: {
              theme: 'dark',
            },
          },
        },
      };
      const response = createStructuredResponse(data);

      const part = response.candidates[0].content?.parts[0];
      expect(part?.data.value).toBe(JSON.stringify(data));
    });

    it('handles primitive values', () => {
      const numberResponse = createStructuredResponse(42);
      expect(numberResponse.candidates[0].content?.parts[0].data.value).toBe('42');

      const stringResponse = createStructuredResponse('hello');
      expect(stringResponse.candidates[0].content?.parts[0].data.value).toBe('"hello"');

      const boolResponse = createStructuredResponse(true);
      expect(boolResponse.candidates[0].content?.parts[0].data.value).toBe('true');
    });

    it('handles null', () => {
      const response = createStructuredResponse(null);

      const part = response.candidates[0].content?.parts[0];
      expect(part?.data.value).toBe('null');
    });
  });

  describe('response structure validation', () => {
    it('all helpers return responses with required proto fields', () => {
      const helpers = [
        () => createTextResponse('test'),
        () => createToolInvocationResponse('tool', {}),
        () => createFunctionResultResponse('tool', {}),
        () => createStructuredResponse({}),
      ];

      helpers.forEach((createResponse) => {
        const response = createResponse();

        // Verify $typeName
        expect(response.$typeName).toBe(
          'google.ai.generativelanguage.v1beta.GenerateContentResponse',
        );

        // Verify candidate structure
        expect(response.candidates).toHaveLength(1);
        const candidate = response.candidates[0];
        expect(candidate.$typeName).toBe('google.ai.generativelanguage.v1beta.Candidate');
        expect(candidate.finishReason).toBeDefined();
        expect(candidate.safetyRatings).toEqual([]);

        // Verify content structure
        expect(candidate.content).toBeDefined();
        expect(candidate.content?.$typeName).toBe('google.ai.generativelanguage.v1beta.Content');
        expect(candidate.content?.role).toBe('model');
        expect(candidate.content?.parts).toHaveLength(1);

        // Verify part structure
        const part = candidate.content?.parts[0];
        expect(part?.$typeName).toBe('google.ai.generativelanguage.v1beta.Part');
        expect(part?.data.case).toBeDefined();
        expect(part?.thought).toBe(false);

        // Verify usage metadata
        expect(response.usageMetadata).toBeDefined();
        expect(response.usageMetadata?.$typeName).toBe(
          'google.ai.generativelanguage.v1beta.GenerateContentResponse.UsageMetadata',
        );
      });
    });
  });
});
