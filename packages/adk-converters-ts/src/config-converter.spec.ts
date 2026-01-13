/**
 * Tests for Generation Config Conversion Utilities
 *
 * Tests cover:
 * - Full config with all fields set
 * - Partial configs (some fields undefined)
 * - Empty/undefined configs
 * - Round-trip conversion (proto → genai → proto)
 * - Response schema conversion
 */

import { describe, it, expect } from 'vitest';
import type {
  GenerationConfig as ProtoGenerationConfig,
  Schema as ProtoSchema,
} from '@adk-sim/protos';
import { Type as ProtoType } from '@adk-sim/protos';
import type { GenerateContentConfig, Schema } from '@google/genai';
import {
  protoGenerationConfigToGenaiConfig,
  genaiConfigToProtoGenerationConfig,
  type GenerationConfigFields,
} from './config-converter.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a proto GenerationConfig for testing with common defaults.
 */
function createProtoGenerationConfig(
  overrides: Partial<ProtoGenerationConfig> = {},
): ProtoGenerationConfig {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.GenerationConfig',
    stopSequences: [],
    responseMimeType: '',
    responseModalities: [],
    ...overrides,
  } as ProtoGenerationConfig;
}

/**
 * Create a proto Schema for testing.
 */
function createProtoSchema(type: ProtoType, options: Partial<ProtoSchema> = {}): ProtoSchema {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Schema',
    type,
    format: '',
    title: '',
    description: '',
    nullable: false,
    enum: [],
    required: [],
    pattern: '',
    anyOf: [],
    propertyOrdering: [],
    minItems: 0n,
    maxItems: 0n,
    minProperties: 0n,
    maxProperties: 0n,
    properties: {},
    ...options,
  } as ProtoSchema;
}

// ============================================================================
// Proto → Genai Conversion Tests
// ============================================================================

describe('Config Conversion', () => {
  describe('protoGenerationConfigToGenaiConfig', () => {
    it('should convert temperature field', () => {
      const protoConfig = createProtoGenerationConfig({
        temperature: 0.7,
      });

      const result = protoGenerationConfigToGenaiConfig(protoConfig);

      expect(result.temperature).toBe(0.7);
    });

    it('should convert topP field', () => {
      const protoConfig = createProtoGenerationConfig({
        topP: 0.9,
      });

      const result = protoGenerationConfigToGenaiConfig(protoConfig);

      expect(result.topP).toBe(0.9);
    });

    it('should convert topK field', () => {
      const protoConfig = createProtoGenerationConfig({
        topK: 40,
      });

      const result = protoGenerationConfigToGenaiConfig(protoConfig);

      expect(result.topK).toBe(40);
    });

    it('should convert maxOutputTokens field', () => {
      const protoConfig = createProtoGenerationConfig({
        maxOutputTokens: 2048,
      });

      const result = protoGenerationConfigToGenaiConfig(protoConfig);

      expect(result.maxOutputTokens).toBe(2048);
    });

    it('should convert stopSequences field', () => {
      const protoConfig = createProtoGenerationConfig({
        stopSequences: ['STOP', 'END', '###'],
      });

      const result = protoGenerationConfigToGenaiConfig(protoConfig);

      expect(result.stopSequences).toEqual(['STOP', 'END', '###']);
    });

    it('should convert seed field', () => {
      const protoConfig = createProtoGenerationConfig({
        seed: 42,
      });

      const result = protoGenerationConfigToGenaiConfig(protoConfig);

      expect(result.seed).toBe(42);
    });

    it('should convert presencePenalty field', () => {
      const protoConfig = createProtoGenerationConfig({
        presencePenalty: 0.5,
      });

      const result = protoGenerationConfigToGenaiConfig(protoConfig);

      expect(result.presencePenalty).toBe(0.5);
    });

    it('should convert frequencyPenalty field', () => {
      const protoConfig = createProtoGenerationConfig({
        frequencyPenalty: 0.3,
      });

      const result = protoGenerationConfigToGenaiConfig(protoConfig);

      expect(result.frequencyPenalty).toBe(0.3);
    });

    it('should convert responseMimeType field', () => {
      const protoConfig = createProtoGenerationConfig({
        responseMimeType: 'application/json',
      });

      const result = protoGenerationConfigToGenaiConfig(protoConfig);

      expect(result.responseMimeType).toBe('application/json');
    });

    it('should convert responseSchema field', () => {
      const protoConfig = createProtoGenerationConfig({
        responseSchema: createProtoSchema(ProtoType.OBJECT, {
          description: 'A test object',
          properties: {
            name: createProtoSchema(ProtoType.STRING, { description: 'Name field' }),
            age: createProtoSchema(ProtoType.INTEGER, { description: 'Age field' }),
          },
          required: ['name'],
        }),
      });

      const result = protoGenerationConfigToGenaiConfig(protoConfig);
      const schema = result.responseSchema as Schema;

      expect(schema).toBeDefined();
      expect(schema.type).toBe('OBJECT');
      expect(schema.description).toBe('A test object');
      expect(schema.properties).toBeDefined();
      expect(schema.properties!['name'].type).toBe('STRING');
      expect(schema.required).toEqual(['name']);
    });

    it('should convert candidateCount field', () => {
      const protoConfig = createProtoGenerationConfig({
        candidateCount: 3,
      });

      const result = protoGenerationConfigToGenaiConfig(protoConfig);

      expect(result.candidateCount).toBe(3);
    });

    it('should convert responseLogprobs field', () => {
      const protoConfig = createProtoGenerationConfig({
        responseLogprobs: true,
      });

      const result = protoGenerationConfigToGenaiConfig(protoConfig);

      expect(result.responseLogprobs).toBe(true);
    });

    it('should convert logprobs field', () => {
      const protoConfig = createProtoGenerationConfig({
        logprobs: 5,
      });

      const result = protoGenerationConfigToGenaiConfig(protoConfig);

      expect(result.logprobs).toBe(5);
    });

    it('should convert full config with all fields', () => {
      const protoConfig = createProtoGenerationConfig({
        temperature: 0.8,
        topP: 0.95,
        topK: 50,
        maxOutputTokens: 4096,
        stopSequences: ['END'],
        seed: 123,
        presencePenalty: 0.2,
        frequencyPenalty: 0.1,
        responseMimeType: 'text/plain',
        candidateCount: 1,
        responseLogprobs: false,
        logprobs: 10,
      });

      const result = protoGenerationConfigToGenaiConfig(protoConfig);

      expect(result.temperature).toBe(0.8);
      expect(result.topP).toBe(0.95);
      expect(result.topK).toBe(50);
      expect(result.maxOutputTokens).toBe(4096);
      expect(result.stopSequences).toEqual(['END']);
      expect(result.seed).toBe(123);
      expect(result.presencePenalty).toBe(0.2);
      expect(result.frequencyPenalty).toBe(0.1);
      expect(result.responseMimeType).toBe('text/plain');
      expect(result.candidateCount).toBe(1);
      expect(result.responseLogprobs).toBe(false);
      expect(result.logprobs).toBe(10);
    });

    it('should handle partial config with only temperature set', () => {
      const protoConfig = createProtoGenerationConfig({
        temperature: 0.5,
      });

      const result = protoGenerationConfigToGenaiConfig(protoConfig);

      expect(result.temperature).toBe(0.5);
      expect(result.topP).toBeUndefined();
      expect(result.topK).toBeUndefined();
      expect(result.maxOutputTokens).toBeUndefined();
      expect(result.stopSequences).toBeUndefined();
      expect(result.seed).toBeUndefined();
    });

    it('should handle partial config with only penalties set', () => {
      const protoConfig = createProtoGenerationConfig({
        presencePenalty: 0.4,
        frequencyPenalty: 0.6,
      });

      const result = protoGenerationConfigToGenaiConfig(protoConfig);

      expect(result.presencePenalty).toBe(0.4);
      expect(result.frequencyPenalty).toBe(0.6);
      expect(result.temperature).toBeUndefined();
      expect(result.topP).toBeUndefined();
    });

    it('should return empty object for undefined config', () => {
      const result = protoGenerationConfigToGenaiConfig(undefined);

      expect(result).toEqual({});
    });

    it('should return empty object for config with no fields set', () => {
      const protoConfig = createProtoGenerationConfig({});

      const result = protoGenerationConfigToGenaiConfig(protoConfig);

      // Only stopSequences is not included (empty array)
      expect(result.temperature).toBeUndefined();
      expect(result.topP).toBeUndefined();
      expect(result.topK).toBeUndefined();
      expect(result.maxOutputTokens).toBeUndefined();
      expect(result.seed).toBeUndefined();
    });

    it('should not include empty stopSequences array', () => {
      const protoConfig = createProtoGenerationConfig({
        stopSequences: [],
      });

      const result = protoGenerationConfigToGenaiConfig(protoConfig);

      expect(result.stopSequences).toBeUndefined();
    });

    it('should not include empty responseMimeType', () => {
      const protoConfig = createProtoGenerationConfig({
        responseMimeType: '',
      });

      const result = protoGenerationConfigToGenaiConfig(protoConfig);

      expect(result.responseMimeType).toBeUndefined();
    });

    it('should handle temperature of 0', () => {
      const protoConfig = createProtoGenerationConfig({
        temperature: 0,
      });

      const result = protoGenerationConfigToGenaiConfig(protoConfig);

      expect(result.temperature).toBe(0);
    });

    it('should handle seed of 0', () => {
      const protoConfig = createProtoGenerationConfig({
        seed: 0,
      });

      const result = protoGenerationConfigToGenaiConfig(protoConfig);

      expect(result.seed).toBe(0);
    });
  });

  // ==========================================================================
  // Genai → Proto Conversion Tests
  // ==========================================================================

  describe('genaiConfigToProtoGenerationConfig', () => {
    it('should convert temperature field', () => {
      const genaiConfig: GenerateContentConfig = {
        temperature: 0.7,
      };

      const result = genaiConfigToProtoGenerationConfig(genaiConfig);

      expect(result.temperature).toBe(0.7);
    });

    it('should convert topP field', () => {
      const genaiConfig: GenerateContentConfig = {
        topP: 0.9,
      };

      const result = genaiConfigToProtoGenerationConfig(genaiConfig);

      expect(result.topP).toBe(0.9);
    });

    it('should convert topK field', () => {
      const genaiConfig: GenerateContentConfig = {
        topK: 40,
      };

      const result = genaiConfigToProtoGenerationConfig(genaiConfig);

      expect(result.topK).toBe(40);
    });

    it('should convert maxOutputTokens field', () => {
      const genaiConfig: GenerateContentConfig = {
        maxOutputTokens: 2048,
      };

      const result = genaiConfigToProtoGenerationConfig(genaiConfig);

      expect(result.maxOutputTokens).toBe(2048);
    });

    it('should convert stopSequences field', () => {
      const genaiConfig: GenerateContentConfig = {
        stopSequences: ['STOP', 'END'],
      };

      const result = genaiConfigToProtoGenerationConfig(genaiConfig);

      expect(result.stopSequences).toEqual(['STOP', 'END']);
    });

    it('should convert seed field', () => {
      const genaiConfig: GenerateContentConfig = {
        seed: 42,
      };

      const result = genaiConfigToProtoGenerationConfig(genaiConfig);

      expect(result.seed).toBe(42);
    });

    it('should convert presencePenalty field', () => {
      const genaiConfig: GenerateContentConfig = {
        presencePenalty: 0.5,
      };

      const result = genaiConfigToProtoGenerationConfig(genaiConfig);

      expect(result.presencePenalty).toBe(0.5);
    });

    it('should convert frequencyPenalty field', () => {
      const genaiConfig: GenerateContentConfig = {
        frequencyPenalty: 0.3,
      };

      const result = genaiConfigToProtoGenerationConfig(genaiConfig);

      expect(result.frequencyPenalty).toBe(0.3);
    });

    it('should convert responseMimeType field', () => {
      const genaiConfig: GenerateContentConfig = {
        responseMimeType: 'application/json',
      };

      const result = genaiConfigToProtoGenerationConfig(genaiConfig);

      expect(result.responseMimeType).toBe('application/json');
    });

    it('should convert responseSchema field', () => {
      const genaiConfig: GenerateContentConfig = {
        responseSchema: {
          type: 'OBJECT',
          description: 'A test schema',
          properties: {
            name: { type: 'STRING' },
          },
          required: ['name'],
        },
      };

      const result = genaiConfigToProtoGenerationConfig(genaiConfig);

      expect(result.responseSchema).toBeDefined();
      expect(result.responseSchema!.type).toBe(ProtoType.OBJECT);
      expect(result.responseSchema!.description).toBe('A test schema');
    });

    it('should convert candidateCount field', () => {
      const genaiConfig: GenerateContentConfig = {
        candidateCount: 3,
      };

      const result = genaiConfigToProtoGenerationConfig(genaiConfig);

      expect(result.candidateCount).toBe(3);
    });

    it('should convert full config with all fields', () => {
      const genaiConfig: GenerateContentConfig = {
        temperature: 0.8,
        topP: 0.95,
        topK: 50,
        maxOutputTokens: 4096,
        stopSequences: ['END'],
        seed: 123,
        presencePenalty: 0.2,
        frequencyPenalty: 0.1,
        responseMimeType: 'text/plain',
        candidateCount: 1,
        responseLogprobs: false,
        logprobs: 10,
      };

      const result = genaiConfigToProtoGenerationConfig(genaiConfig);

      expect(result.temperature).toBe(0.8);
      expect(result.topP).toBe(0.95);
      expect(result.topK).toBe(50);
      expect(result.maxOutputTokens).toBe(4096);
      expect(result.stopSequences).toEqual(['END']);
      expect(result.seed).toBe(123);
      expect(result.presencePenalty).toBe(0.2);
      expect(result.frequencyPenalty).toBe(0.1);
      expect(result.responseMimeType).toBe('text/plain');
      expect(result.candidateCount).toBe(1);
      expect(result.responseLogprobs).toBe(false);
      expect(result.logprobs).toBe(10);
    });

    it('should return default proto object for undefined config', () => {
      const result = genaiConfigToProtoGenerationConfig(undefined);

      expect(result.$typeName).toBe('google.ai.generativelanguage.v1beta.GenerationConfig');
      expect(result.stopSequences).toEqual([]);
      expect(result.responseMimeType).toBe('');
    });

    it('should handle partial config', () => {
      const genaiConfig: GenerateContentConfig = {
        temperature: 0.5,
        maxOutputTokens: 1024,
      };

      const result = genaiConfigToProtoGenerationConfig(genaiConfig);

      expect(result.temperature).toBe(0.5);
      expect(result.maxOutputTokens).toBe(1024);
      expect(result.topP).toBeUndefined();
      expect(result.topK).toBeUndefined();
    });
  });

  // ==========================================================================
  // Round-Trip Tests
  // ==========================================================================

  describe('round-trip conversion', () => {
    it('should preserve all fields through proto → genai → proto', () => {
      const originalProto = createProtoGenerationConfig({
        temperature: 0.75,
        topP: 0.92,
        topK: 45,
        maxOutputTokens: 3000,
        stopSequences: ['STOP', '###'],
        seed: 999,
        presencePenalty: 0.35,
        frequencyPenalty: 0.25,
        responseMimeType: 'application/json',
        candidateCount: 2,
        responseLogprobs: true,
        logprobs: 8,
      });

      const genaiConfig = protoGenerationConfigToGenaiConfig(originalProto);
      const roundTripped = genaiConfigToProtoGenerationConfig(genaiConfig);

      expect(roundTripped.temperature).toBe(originalProto.temperature);
      expect(roundTripped.topP).toBe(originalProto.topP);
      expect(roundTripped.topK).toBe(originalProto.topK);
      expect(roundTripped.maxOutputTokens).toBe(originalProto.maxOutputTokens);
      expect(roundTripped.stopSequences).toEqual(originalProto.stopSequences);
      expect(roundTripped.seed).toBe(originalProto.seed);
      expect(roundTripped.presencePenalty).toBe(originalProto.presencePenalty);
      expect(roundTripped.frequencyPenalty).toBe(originalProto.frequencyPenalty);
      expect(roundTripped.responseMimeType).toBe(originalProto.responseMimeType);
      expect(roundTripped.candidateCount).toBe(originalProto.candidateCount);
      expect(roundTripped.responseLogprobs).toBe(originalProto.responseLogprobs);
      expect(roundTripped.logprobs).toBe(originalProto.logprobs);
    });

    it('should preserve responseSchema through round-trip', () => {
      const originalProto = createProtoGenerationConfig({
        responseSchema: createProtoSchema(ProtoType.OBJECT, {
          description: 'Test schema',
          properties: {
            field1: createProtoSchema(ProtoType.STRING, { description: 'String field' }),
            field2: createProtoSchema(ProtoType.NUMBER, { description: 'Number field' }),
          },
          required: ['field1'],
        }),
      });

      const genaiConfig = protoGenerationConfigToGenaiConfig(originalProto);
      const roundTripped = genaiConfigToProtoGenerationConfig(genaiConfig);

      expect(roundTripped.responseSchema).toBeDefined();
      expect(roundTripped.responseSchema!.type).toBe(ProtoType.OBJECT);
      expect(roundTripped.responseSchema!.description).toBe('Test schema');
      expect(roundTripped.responseSchema!.required).toEqual(['field1']);
    });

    it('should preserve partial config through round-trip', () => {
      const originalProto = createProtoGenerationConfig({
        temperature: 0.6,
        maxOutputTokens: 512,
      });

      const genaiConfig = protoGenerationConfigToGenaiConfig(originalProto);
      const roundTripped = genaiConfigToProtoGenerationConfig(genaiConfig);

      expect(roundTripped.temperature).toBe(0.6);
      expect(roundTripped.maxOutputTokens).toBe(512);
      // Other fields should remain undefined
      expect(roundTripped.topP).toBeUndefined();
      expect(roundTripped.seed).toBeUndefined();
    });
  });
});
