/**
 * @fileoverview Unit tests for LlmRequestConverterService.
 *
 * Tests verify that the service correctly delegates to the
 * underlying @adk-sim/converters package functions.
 *
 * @see mddocs/frontend/frontend-tdd.md#llmrequestconverter
 */

import { TestBed } from '@angular/core/testing';
import { basicTextRequest, fullFeaturedRequest } from '@adk-sim/converters';
import { LlmRequestConverterService } from './llm-request-converter.service';

describe('LlmRequestConverterService', () => {
  let service: LlmRequestConverterService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LlmRequestConverterService],
    });
    service = TestBed.inject(LlmRequestConverterService);
  });

  describe('protoToLlmRequest', () => {
    it('should convert proto to LlmRequest format', () => {
      const result = service.protoToLlmRequest(basicTextRequest);

      expect(result.model).toBe('gemini-2.0-flash');
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]?.role).toBe('user');
    });

    it('should handle requests with tools', () => {
      const result = service.protoToLlmRequest(fullFeaturedRequest);

      expect(result.config.tools).toBeDefined();
      expect(result.config.tools!.length).toBeGreaterThan(0);
    });
  });

  describe('createTextResponse', () => {
    it('should create a response proto with text content', () => {
      const response = service.createTextResponse('Hello, world!');

      expect(response.candidates).toBeDefined();
      expect(response.candidates.length).toBe(1);

      const candidate = response.candidates[0];
      expect(candidate?.content?.parts.length).toBe(1);

      const part = candidate?.content?.parts[0];
      expect(part?.data?.case).toBe('text');
      expect(part?.data?.value).toBe('Hello, world!');
    });

    it('should handle empty text', () => {
      const response = service.createTextResponse('');

      const part = response.candidates[0]?.content?.parts[0];
      expect(part?.data?.case).toBe('text');
      expect(part?.data?.value).toBe('');
    });
  });

  describe('createToolInvocationResponse', () => {
    it('should create a response proto with function call', () => {
      const response = service.createToolInvocationResponse('get_weather', {
        location: 'Seattle',
      });

      expect(response.candidates.length).toBe(1);
      const part = response.candidates[0]?.content?.parts[0];
      expect(part?.data?.case).toBe('functionCall');

      // Type narrowing for function call
      if (part?.data?.case === 'functionCall') {
        expect(part.data.value.name).toBe('get_weather');
        expect(part.data.value.args).toEqual({ location: 'Seattle' });
      }
    });

    it('should handle empty arguments', () => {
      const response = service.createToolInvocationResponse('simple_tool', {});

      const part = response.candidates[0]?.content?.parts[0];
      if (part?.data?.case === 'functionCall') {
        expect(part.data.value.name).toBe('simple_tool');
        expect(part.data.value.args).toEqual({});
      }
    });
  });

  describe('createFunctionResultResponse', () => {
    it('should create a response proto with function result', () => {
      const response = service.createFunctionResultResponse('get_weather', {
        temperature: 72,
        conditions: 'sunny',
      });

      expect(response.candidates.length).toBe(1);
      const part = response.candidates[0]?.content?.parts[0];
      expect(part?.data?.case).toBe('functionResponse');

      // Type narrowing for function response
      if (part?.data?.case === 'functionResponse') {
        expect(part.data.value.name).toBe('get_weather');
        expect(part.data.value.response).toEqual({
          temperature: 72,
          conditions: 'sunny',
        });
      }
    });

    it('should handle string results', () => {
      const response = service.createFunctionResultResponse('read_file', 'File contents here');

      const part = response.candidates[0]?.content?.parts[0];
      if (part?.data?.case === 'functionResponse') {
        expect(part.data.value.name).toBe('read_file');
      }
    });
  });

  describe('createStructuredResponse', () => {
    it('should create a response proto with JSON-stringified data', () => {
      const data = { name: 'John', age: 30 };
      const response = service.createStructuredResponse(data);

      expect(response.candidates.length).toBe(1);
      const part = response.candidates[0]?.content?.parts[0];
      expect(part?.data?.case).toBe('text');
      expect(part?.data?.value).toBe(JSON.stringify(data));
    });

    it('should handle arrays', () => {
      const data = [1, 2, 3];
      const response = service.createStructuredResponse(data);

      const part = response.candidates[0]?.content?.parts[0];
      expect(part?.data?.value).toBe('[1,2,3]');
    });

    it('should handle nested structures', () => {
      const data = {
        users: [
          { name: 'Alice', active: true },
          { name: 'Bob', active: false },
        ],
      };
      const response = service.createStructuredResponse(data);

      const part = response.candidates[0]?.content?.parts[0];
      expect(part?.data?.value).toBe(JSON.stringify(data));
    });
  });
});
