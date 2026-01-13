/**
 * Tests for Request Converter - protoToLlmRequest()
 *
 * Test categories mirror the Python converter test structure:
 * - Basic Request: Model name, contents, empty fields
 * - System Instruction: Various formats
 * - Tools: Function declarations
 * - Safety Settings: Enum mapping
 * - Generation Config: All numeric/string params
 * - Full Integration: Request with all fields
 *
 * Note: We use numeric values for proto enums rather than importing enum types directly.
 * This is because the proto package (@adk-sim/protos) only exports adksim types,
 * not the google.ai.generativelanguage types that contain these enums.
 */

import { describe, it, expect } from 'vitest';
import type {
  GenerateContentRequest,
  Content as ProtoContent,
  Part as ProtoPart,
  Tool as ProtoTool,
  FunctionDeclaration as ProtoFunctionDeclaration,
  SafetySetting as ProtoSafetySetting,
  GenerationConfig as ProtoGenerationConfig,
  Schema as ProtoSchema,
} from '@adk-sim/protos';
import {
  HarmCategory as GenaiHarmCategory,
  HarmBlockThreshold as GenaiHarmBlockThreshold,
  Type as GenaiType,
  Content as GenaiContent,
  Tool as GenaiTool,
} from '@google/genai';

import { protoToLlmRequest, type LlmRequest } from './request-converter.js';

// ============================================================================
// Proto Enum Values (numeric, from the proto definitions)
// ============================================================================

// HarmCategory values from google.ai.generativelanguage.v1beta.HarmCategory
const ProtoHarmCategoryValues = {
  UNSPECIFIED: 0,
  DEROGATORY: 1,
  TOXICITY: 2,
  VIOLENCE: 3,
  SEXUAL: 4,
  MEDICAL: 5,
  DANGEROUS: 6,
  HARASSMENT: 7,
  HATE_SPEECH: 8,
  SEXUALLY_EXPLICIT: 9,
  DANGEROUS_CONTENT: 10,
  CIVIC_INTEGRITY: 11,
} as const;

// HarmBlockThreshold values from google.ai.generativelanguage.v1beta.SafetySetting
const ProtoHarmBlockThresholdValues = {
  HARM_BLOCK_THRESHOLD_UNSPECIFIED: 0,
  BLOCK_LOW_AND_ABOVE: 1,
  BLOCK_MEDIUM_AND_ABOVE: 2,
  BLOCK_ONLY_HIGH: 3,
  BLOCK_NONE: 4,
  OFF: 5,
} as const;

// Type values from google.ai.generativelanguage.v1beta.Type
const ProtoTypeValues = {
  TYPE_UNSPECIFIED: 0,
  STRING: 1,
  NUMBER: 2,
  INTEGER: 3,
  BOOLEAN: 4,
  ARRAY: 5,
  OBJECT: 6,
} as const;

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a minimal GenerateContentRequest proto for testing.
 */
function createProtoRequest(overrides: Partial<GenerateContentRequest> = {}): GenerateContentRequest {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.GenerateContentRequest',
    model: '',
    contents: [],
    tools: [],
    safetySettings: [],
    systemInstruction: undefined,
    generationConfig: undefined,
    toolConfig: undefined,
    cachedContent: undefined,
    ...overrides,
  } as GenerateContentRequest;
}

/**
 * Create a proto Content for testing.
 */
function createProtoContent(role: string, parts: ProtoPart[]): ProtoContent {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Content',
    role,
    parts,
  } as ProtoContent;
}

/**
 * Create a proto Part with text for testing.
 */
function createTextPart(text: string): ProtoPart {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Part',
    data: { case: 'text', value: text },
    metadata: { case: undefined, value: undefined },
    thought: false,
    thoughtSignature: new Uint8Array(),
  } as ProtoPart;
}

/**
 * Create a proto Part with function call for testing.
 */
function createFunctionCallPart(name: string, args?: Record<string, unknown>): ProtoPart {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Part',
    data: {
      case: 'functionCall',
      value: {
        $typeName: 'google.ai.generativelanguage.v1beta.FunctionCall',
        name,
        id: '',
        args,
      },
    },
    metadata: { case: undefined, value: undefined },
    thought: false,
    thoughtSignature: new Uint8Array(),
  } as ProtoPart;
}

/**
 * Create a proto Tool with function declarations.
 */
function createProtoTool(functionDeclarations: ProtoFunctionDeclaration[]): ProtoTool {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Tool',
    functionDeclarations,
    codeExecution: undefined,
    googleSearch: undefined,
    googleSearchRetrieval: undefined,
  } as ProtoTool;
}

/**
 * Create a proto FunctionDeclaration.
 */
function createProtoFunctionDeclaration(
  name: string,
  description?: string,
  parameters?: ProtoSchema
): ProtoFunctionDeclaration {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.FunctionDeclaration',
    name,
    description: description ?? '',
    parameters,
  } as ProtoFunctionDeclaration;
}

/**
 * Create a proto Schema for function parameters.
 */
function createProtoSchema(
  type: number,
  properties?: Record<string, ProtoSchema>,
  required?: string[]
): ProtoSchema {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Schema',
    type,
    properties: properties ?? {},
    required: required ?? [],
    description: '',
    format: '',
    nullable: false,
    enum: [],
    maxItems: undefined,
    minItems: undefined,
    items: undefined,
    minimum: undefined,
    maximum: undefined,
    anyOf: [],
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
}

/**
 * Create a proto SafetySetting.
 */
function createProtoSafetySetting(
  category: number,
  threshold: number
): ProtoSafetySetting {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.SafetySetting',
    category,
    threshold,
  } as ProtoSafetySetting;
}

/**
 * Create a proto GenerationConfig.
 */
function createProtoGenerationConfig(
  overrides: Partial<ProtoGenerationConfig> = {}
): ProtoGenerationConfig {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.GenerationConfig',
    stopSequences: [],
    ...overrides,
  } as ProtoGenerationConfig;
}

// ============================================================================
// Basic Request Tests
// ============================================================================

describe('protoToLlmRequest', () => {
  describe('Basic Request', () => {
    it('should return empty model for empty string', () => {
      const proto = createProtoRequest({ model: '' });

      const result = protoToLlmRequest(proto);

      expect(result.model).toBe('');
    });

    it('should strip "models/" prefix from model name', () => {
      const proto = createProtoRequest({ model: 'models/gemini-1.5-flash' });

      const result = protoToLlmRequest(proto);

      expect(result.model).toBe('gemini-1.5-flash');
    });

    it('should preserve model name without prefix', () => {
      const proto = createProtoRequest({ model: 'gemini-2.0-flash' });

      const result = protoToLlmRequest(proto);

      expect(result.model).toBe('gemini-2.0-flash');
    });

    it('should handle model name with nested models path', () => {
      const proto = createProtoRequest({ model: 'models/models/nested' });

      const result = protoToLlmRequest(proto);

      expect(result.model).toBe('models/nested');
    });

    it('should return empty contents array for empty contents', () => {
      const proto = createProtoRequest({ contents: [] });

      const result = protoToLlmRequest(proto);

      expect(result.contents).toEqual([]);
    });

    it('should convert single content item', () => {
      const proto = createProtoRequest({
        model: 'models/gemini-1.5-flash',
        contents: [createProtoContent('user', [createTextPart('Hello')])],
      });

      const result = protoToLlmRequest(proto);

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].role).toBe('user');
      expect(result.contents[0].parts).toHaveLength(1);
      expect(result.contents[0].parts![0].text).toBe('Hello');
    });

    it('should convert multiple content items preserving order', () => {
      const proto = createProtoRequest({
        contents: [
          createProtoContent('user', [createTextPart('First message')]),
          createProtoContent('model', [createTextPart('First response')]),
          createProtoContent('user', [createTextPart('Second message')]),
        ],
      });

      const result = protoToLlmRequest(proto);

      expect(result.contents).toHaveLength(3);
      expect(result.contents[0].role).toBe('user');
      expect(result.contents[0].parts![0].text).toBe('First message');
      expect(result.contents[1].role).toBe('model');
      expect(result.contents[1].parts![0].text).toBe('First response');
      expect(result.contents[2].role).toBe('user');
      expect(result.contents[2].parts![0].text).toBe('Second message');
    });

    it('should always include liveConnectConfig as empty object', () => {
      const proto = createProtoRequest({});

      const result = protoToLlmRequest(proto);

      expect(result.liveConnectConfig).toEqual({});
    });

    it('should always include toolsDict as empty object', () => {
      const proto = createProtoRequest({});

      const result = protoToLlmRequest(proto);

      expect(result.toolsDict).toEqual({});
    });
  });

  // ==========================================================================
  // System Instruction Tests
  // ==========================================================================

  describe('System Instruction', () => {
    it('should not set systemInstruction when not present in proto', () => {
      const proto = createProtoRequest({ systemInstruction: undefined });

      const result = protoToLlmRequest(proto);

      expect(result.config.systemInstruction).toBeUndefined();
    });

    it('should convert systemInstruction with text part', () => {
      const proto = createProtoRequest({
        systemInstruction: createProtoContent('', [createTextPart('You are a helpful assistant.')]),
      });

      const result = protoToLlmRequest(proto);

      expect(result.config.systemInstruction).toBeDefined();
      expect((result.config.systemInstruction as GenaiContent).parts).toHaveLength(1);
      expect((result.config.systemInstruction as GenaiContent).parts![0].text).toBe('You are a helpful assistant.');
    });

    it('should convert systemInstruction with multiple parts', () => {
      const proto = createProtoRequest({
        systemInstruction: createProtoContent('', [
          createTextPart('You are a helpful assistant.'),
          createTextPart('Be concise.'),
        ]),
      });

      const result = protoToLlmRequest(proto);

      expect((result.config.systemInstruction as GenaiContent).parts).toHaveLength(2);
      expect((result.config.systemInstruction as GenaiContent).parts![0].text).toBe('You are a helpful assistant.');
      expect((result.config.systemInstruction as GenaiContent).parts![1].text).toBe('Be concise.');
    });

    it('should preserve systemInstruction role if set', () => {
      const proto = createProtoRequest({
        systemInstruction: createProtoContent('system', [createTextPart('System prompt')]),
      });

      const result = protoToLlmRequest(proto);

      expect((result.config.systemInstruction as GenaiContent).role).toBe('system');
    });
  });

  // ==========================================================================
  // Tools Tests
  // ==========================================================================

  describe('Tools', () => {
    it('should not set tools when tools array is empty', () => {
      const proto = createProtoRequest({ tools: [] });

      const result = protoToLlmRequest(proto);

      expect(result.config.tools).toBeUndefined();
    });

    it('should convert single tool with function declaration', () => {
      const proto = createProtoRequest({
        tools: [
          createProtoTool([
            createProtoFunctionDeclaration('get_weather', 'Get current weather'),
          ]),
        ],
      });

      const result = protoToLlmRequest(proto);

      expect(result.config.tools).toHaveLength(1);
      const tool = result.config.tools![0] as GenaiTool;
      expect(tool.functionDeclarations).toHaveLength(1);
      expect(tool.functionDeclarations![0].name).toBe('get_weather');
      expect(tool.functionDeclarations![0].description).toBe('Get current weather');
    });

    it('should convert tool with function parameters', () => {
      const parameters = createProtoSchema(
        ProtoTypeValues.OBJECT,
        {
          location: createProtoSchema(ProtoTypeValues.STRING),
          units: createProtoSchema(ProtoTypeValues.STRING),
        },
        ['location']
      );

      const proto = createProtoRequest({
        tools: [
          createProtoTool([
            createProtoFunctionDeclaration('get_weather', 'Get weather for a location', parameters),
          ]),
        ],
      });

      const result = protoToLlmRequest(proto);

      const tool = result.config.tools![0] as GenaiTool;
      const params = tool.functionDeclarations![0].parameters;
      expect(params).toBeDefined();
      expect(params!.type).toBe(GenaiType.OBJECT);
      expect(params!.properties).toHaveProperty('location');
      expect(params!.properties).toHaveProperty('units');
      expect(params!.required).toContain('location');
    });

    it('should convert multiple tools', () => {
      const proto = createProtoRequest({
        tools: [
          createProtoTool([createProtoFunctionDeclaration('tool_a', 'First tool')]),
          createProtoTool([createProtoFunctionDeclaration('tool_b', 'Second tool')]),
        ],
      });

      const result = protoToLlmRequest(proto);

      expect(result.config.tools).toHaveLength(2);
      expect((result.config.tools![0] as GenaiTool).functionDeclarations![0].name).toBe('tool_a');
      expect((result.config.tools![1] as GenaiTool).functionDeclarations![0].name).toBe('tool_b');
    });

    it('should convert tool with multiple function declarations', () => {
      const proto = createProtoRequest({
        tools: [
          createProtoTool([
            createProtoFunctionDeclaration('func_1', 'First function'),
            createProtoFunctionDeclaration('func_2', 'Second function'),
          ]),
        ],
      });

      const result = protoToLlmRequest(proto);

      const tool = result.config.tools![0] as GenaiTool;
      expect(tool.functionDeclarations).toHaveLength(2);
      expect(tool.functionDeclarations![0].name).toBe('func_1');
      expect(tool.functionDeclarations![1].name).toBe('func_2');
    });
  });

  // ==========================================================================
  // Safety Settings Tests
  // ==========================================================================

  describe('Safety Settings', () => {
    it('should not set safetySettings when array is empty', () => {
      const proto = createProtoRequest({ safetySettings: [] });

      const result = protoToLlmRequest(proto);

      expect(result.config.safetySettings).toBeUndefined();
    });

    it('should convert single safety setting', () => {
      const proto = createProtoRequest({
        safetySettings: [
          createProtoSafetySetting(
            ProtoHarmCategoryValues.HARASSMENT,
            ProtoHarmBlockThresholdValues.BLOCK_MEDIUM_AND_ABOVE
          ),
        ],
      });

      const result = protoToLlmRequest(proto);

      expect(result.config.safetySettings).toHaveLength(1);
      expect(result.config.safetySettings![0].category).toBe(GenaiHarmCategory.HARM_CATEGORY_HARASSMENT);
      expect(result.config.safetySettings![0].threshold).toBe(GenaiHarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE);
    });

    it('should convert multiple safety settings', () => {
      const proto = createProtoRequest({
        safetySettings: [
          createProtoSafetySetting(
            ProtoHarmCategoryValues.HARASSMENT,
            ProtoHarmBlockThresholdValues.BLOCK_MEDIUM_AND_ABOVE
          ),
          createProtoSafetySetting(
            ProtoHarmCategoryValues.DANGEROUS_CONTENT,
            ProtoHarmBlockThresholdValues.BLOCK_LOW_AND_ABOVE
          ),
          createProtoSafetySetting(
            ProtoHarmCategoryValues.HATE_SPEECH,
            ProtoHarmBlockThresholdValues.BLOCK_ONLY_HIGH
          ),
        ],
      });

      const result = protoToLlmRequest(proto);

      expect(result.config.safetySettings).toHaveLength(3);
      expect(result.config.safetySettings![0].category).toBe(GenaiHarmCategory.HARM_CATEGORY_HARASSMENT);
      expect(result.config.safetySettings![1].category).toBe(GenaiHarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT);
      expect(result.config.safetySettings![2].category).toBe(GenaiHarmCategory.HARM_CATEGORY_HATE_SPEECH);
    });
  });

  // ==========================================================================
  // Generation Config Tests
  // ==========================================================================

  describe('Generation Config', () => {
    it('should not spread fields when generationConfig is undefined', () => {
      const proto = createProtoRequest({ generationConfig: undefined });

      const result = protoToLlmRequest(proto);

      expect(result.config.temperature).toBeUndefined();
      expect(result.config.topP).toBeUndefined();
      expect(result.config.topK).toBeUndefined();
      expect(result.config.maxOutputTokens).toBeUndefined();
    });

    it('should spread temperature into config', () => {
      const proto = createProtoRequest({
        generationConfig: createProtoGenerationConfig({ temperature: 0.7 }),
      });

      const result = protoToLlmRequest(proto);

      expect(result.config.temperature).toBe(0.7);
    });

    it('should spread topP into config', () => {
      const proto = createProtoRequest({
        generationConfig: createProtoGenerationConfig({ topP: 0.9 }),
      });

      const result = protoToLlmRequest(proto);

      expect(result.config.topP).toBe(0.9);
    });

    it('should spread topK into config', () => {
      const proto = createProtoRequest({
        generationConfig: createProtoGenerationConfig({ topK: 40 }),
      });

      const result = protoToLlmRequest(proto);

      expect(result.config.topK).toBe(40);
    });

    it('should spread maxOutputTokens into config', () => {
      const proto = createProtoRequest({
        generationConfig: createProtoGenerationConfig({ maxOutputTokens: 1024 }),
      });

      const result = protoToLlmRequest(proto);

      expect(result.config.maxOutputTokens).toBe(1024);
    });

    it('should spread stopSequences into config', () => {
      const proto = createProtoRequest({
        generationConfig: createProtoGenerationConfig({ stopSequences: ['END', 'STOP'] }),
      });

      const result = protoToLlmRequest(proto);

      expect(result.config.stopSequences).toEqual(['END', 'STOP']);
    });

    it('should spread seed into config', () => {
      const proto = createProtoRequest({
        generationConfig: createProtoGenerationConfig({ seed: 42 }),
      });

      const result = protoToLlmRequest(proto);

      expect(result.config.seed).toBe(42);
    });

    it('should spread presencePenalty into config', () => {
      const proto = createProtoRequest({
        generationConfig: createProtoGenerationConfig({ presencePenalty: 0.5 }),
      });

      const result = protoToLlmRequest(proto);

      expect(result.config.presencePenalty).toBe(0.5);
    });

    it('should spread frequencyPenalty into config', () => {
      const proto = createProtoRequest({
        generationConfig: createProtoGenerationConfig({ frequencyPenalty: 0.3 }),
      });

      const result = protoToLlmRequest(proto);

      expect(result.config.frequencyPenalty).toBe(0.3);
    });

    it('should spread responseMimeType into config', () => {
      const proto = createProtoRequest({
        generationConfig: createProtoGenerationConfig({ responseMimeType: 'application/json' }),
      });

      const result = protoToLlmRequest(proto);

      expect(result.config.responseMimeType).toBe('application/json');
    });

    it('should spread multiple generation config fields', () => {
      const proto = createProtoRequest({
        generationConfig: createProtoGenerationConfig({
          temperature: 0.8,
          topP: 0.95,
          topK: 50,
          maxOutputTokens: 2048,
          seed: 123,
        }),
      });

      const result = protoToLlmRequest(proto);

      expect(result.config.temperature).toBe(0.8);
      expect(result.config.topP).toBe(0.95);
      expect(result.config.topK).toBe(50);
      expect(result.config.maxOutputTokens).toBe(2048);
      expect(result.config.seed).toBe(123);
    });

    it('should not set undefined fields from partial config', () => {
      const proto = createProtoRequest({
        generationConfig: createProtoGenerationConfig({ temperature: 0.5 }),
      });

      const result = protoToLlmRequest(proto);

      expect(result.config.temperature).toBe(0.5);
      expect(result.config.topP).toBeUndefined();
      expect(result.config.topK).toBeUndefined();
    });
  });

  // ==========================================================================
  // Full Integration Tests
  // ==========================================================================

  describe('Full Integration', () => {
    it('should convert complete request with all fields', () => {
      const proto = createProtoRequest({
        model: 'models/gemini-1.5-pro',
        contents: [
          createProtoContent('user', [createTextPart('What is the weather?')]),
          createProtoContent('model', [
            createFunctionCallPart('get_weather', { location: 'NYC' }),
          ]),
        ],
        systemInstruction: createProtoContent('', [createTextPart('You are a weather assistant.')]),
        tools: [
          createProtoTool([
            createProtoFunctionDeclaration(
              'get_weather',
              'Get current weather',
              createProtoSchema(
                ProtoTypeValues.OBJECT,
                { location: createProtoSchema(ProtoTypeValues.STRING) },
                ['location']
              )
            ),
          ]),
        ],
        safetySettings: [
          createProtoSafetySetting(
            ProtoHarmCategoryValues.HARASSMENT,
            ProtoHarmBlockThresholdValues.BLOCK_MEDIUM_AND_ABOVE
          ),
        ],
        generationConfig: createProtoGenerationConfig({
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 1024,
        }),
      });

      const result = protoToLlmRequest(proto);

      // Model
      expect(result.model).toBe('gemini-1.5-pro');

      // Contents
      expect(result.contents).toHaveLength(2);
      expect(result.contents[0].role).toBe('user');
      expect(result.contents[0].parts![0].text).toBe('What is the weather?');
      expect(result.contents[1].role).toBe('model');
      expect(result.contents[1].parts![0].functionCall!.name).toBe('get_weather');

      // System instruction
      expect(result.config.systemInstruction).toBeDefined();
      expect((result.config.systemInstruction as GenaiContent).parts![0].text).toBe('You are a weather assistant.');

      // Tools
      expect(result.config.tools).toHaveLength(1);
      expect((result.config.tools![0] as GenaiTool).functionDeclarations![0].name).toBe('get_weather');

      // Safety settings
      expect(result.config.safetySettings).toHaveLength(1);
      expect(result.config.safetySettings![0].category).toBe(GenaiHarmCategory.HARM_CATEGORY_HARASSMENT);

      // Generation config
      expect(result.config.temperature).toBe(0.7);
      expect(result.config.topP).toBe(0.9);
      expect(result.config.maxOutputTokens).toBe(1024);

      // Empty config fields
      expect(result.liveConnectConfig).toEqual({});
      expect(result.toolsDict).toEqual({});
    });

    it('should handle minimal request with only required fields', () => {
      const proto = createProtoRequest({
        model: 'models/gemini-1.5-flash',
        contents: [createProtoContent('user', [createTextPart('Hello')])],
      });

      const result = protoToLlmRequest(proto);

      expect(result.model).toBe('gemini-1.5-flash');
      expect(result.contents).toHaveLength(1);
      expect(result.config.systemInstruction).toBeUndefined();
      expect(result.config.tools).toBeUndefined();
      expect(result.config.safetySettings).toBeUndefined();
      expect(result.config.temperature).toBeUndefined();
      expect(result.liveConnectConfig).toEqual({});
      expect(result.toolsDict).toEqual({});
    });

    it('should return correct LlmRequest shape', () => {
      const proto = createProtoRequest({ model: 'models/test' });

      const result = protoToLlmRequest(proto);

      // Verify all required properties exist
      expect(result).toHaveProperty('model');
      expect(result).toHaveProperty('contents');
      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('liveConnectConfig');
      expect(result).toHaveProperty('toolsDict');

      // Verify types
      expect(typeof result.model).toBe('string');
      expect(Array.isArray(result.contents)).toBe(true);
      expect(typeof result.config).toBe('object');
      expect(typeof result.liveConnectConfig).toBe('object');
      expect(typeof result.toolsDict).toBe('object');
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty request', () => {
      const proto = createProtoRequest({});

      const result = protoToLlmRequest(proto);

      expect(result.model).toBe('');
      expect(result.contents).toEqual([]);
      expect(result.liveConnectConfig).toEqual({});
      expect(result.toolsDict).toEqual({});
    });

    it('should handle content with empty parts array', () => {
      const proto = createProtoRequest({
        contents: [createProtoContent('user', [])],
      });

      const result = protoToLlmRequest(proto);

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].role).toBe('user');
      expect(result.contents[0].parts).toBeUndefined();
    });

    it('should handle tool with empty function declarations', () => {
      const proto = createProtoRequest({
        tools: [createProtoTool([])],
      });

      const result = protoToLlmRequest(proto);

      // Tool with no function declarations should still be converted
      expect(result.config.tools).toHaveLength(1);
      expect((result.config.tools![0] as GenaiTool).functionDeclarations).toBeUndefined();
    });

    it('should handle generation config with zero values', () => {
      const proto = createProtoRequest({
        generationConfig: createProtoGenerationConfig({
          temperature: 0,
          topK: 0,
          maxOutputTokens: 0,
        }),
      });

      const result = protoToLlmRequest(proto);

      // Zero values should be preserved, not treated as undefined
      expect(result.config.temperature).toBe(0);
      expect(result.config.topK).toBe(0);
      expect(result.config.maxOutputTokens).toBe(0);
    });

    it('should preserve empty stop sequences array', () => {
      const proto = createProtoRequest({
        generationConfig: createProtoGenerationConfig({ stopSequences: [] }),
      });

      const result = protoToLlmRequest(proto);

      // Empty stop sequences array should not be set
      expect(result.config.stopSequences).toBeUndefined();
    });
  });
});
