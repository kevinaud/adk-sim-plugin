/**
 * Tests for Tool Conversion Utilities
 *
 * Tests cover:
 * - Tool with function declarations
 * - FunctionDeclaration with parameters
 * - Nested Schema objects (properties, items)
 * - Round-trip conversion (proto → genai → proto)
 */

import { describe, it, expect } from 'vitest';
import { Type as ProtoType } from '@adk-sim/protos';
import type {
  Tool as ProtoTool,
  FunctionDeclaration as ProtoFunctionDeclaration,
  Schema as ProtoSchema,
} from '@adk-sim/protos';
import { Type as GenaiType } from '@google/genai';
import type { Tool, FunctionDeclaration, Schema } from '@google/genai';
import {
  protoToolToGenaiTool,
  genaiToolToProtoTool,
  protoFunctionDeclarationToGenai,
  genaiFunctionDeclarationToProto,
  protoSchemaToGenaiSchema,
  genaiSchemaToProtoSchema,
} from './tool-converter.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a proto Tool for testing
 */
function createProtoTool(functionDeclarations: ProtoFunctionDeclaration[]): ProtoTool {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Tool',
    functionDeclarations,
  } as ProtoTool;
}

/**
 * Create a proto FunctionDeclaration for testing
 */
function createProtoFunctionDeclaration(
  name: string,
  description: string,
  parameters?: ProtoSchema
): ProtoFunctionDeclaration {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.FunctionDeclaration',
    name,
    description,
    parameters,
    behavior: 0, // UNSPECIFIED
  } as ProtoFunctionDeclaration;
}

/**
 * Create a proto Schema for testing
 */
function createProtoSchema(
  type: ProtoType,
  options: Partial<Omit<ProtoSchema, 'type'>> = {}
): ProtoSchema {
  return {
    $typeName: 'google.ai.generativelanguage.v1beta.Schema',
    type,
    format: options.format ?? '',
    title: options.title ?? '',
    description: options.description ?? '',
    nullable: options.nullable ?? false,
    enum: options.enum ?? [],
    required: options.required ?? [],
    pattern: options.pattern ?? '',
    anyOf: options.anyOf ?? [],
    propertyOrdering: options.propertyOrdering ?? [],
    minItems: options.minItems ?? 0n,
    maxItems: options.maxItems ?? 0n,
    minProperties: options.minProperties ?? 0n,
    maxProperties: options.maxProperties ?? 0n,
    minLength: options.minLength ?? 0n,
    maxLength: options.maxLength ?? 0n,
    minimum: options.minimum,
    maximum: options.maximum,
    example: options.example,
    items: options.items,
    properties: options.properties ?? {},
  } as ProtoSchema;
}

// ============================================================================
// Proto → Genai: Tool Conversion
// ============================================================================

describe('Tool Conversion', () => {
  describe('protoToolToGenaiTool', () => {
    it('should convert tool with single function declaration', () => {
      const protoTool = createProtoTool([
        createProtoFunctionDeclaration(
          'get_weather',
          'Gets the current weather for a location'
        ),
      ]);

      const result = protoToolToGenaiTool(protoTool);

      expect(result.functionDeclarations).toHaveLength(1);
      expect(result.functionDeclarations![0].name).toBe('get_weather');
      expect(result.functionDeclarations![0].description).toBe(
        'Gets the current weather for a location'
      );
    });

    it('should convert tool with multiple function declarations', () => {
      const protoTool = createProtoTool([
        createProtoFunctionDeclaration('func1', 'First function'),
        createProtoFunctionDeclaration('func2', 'Second function'),
        createProtoFunctionDeclaration('func3', 'Third function'),
      ]);

      const result = protoToolToGenaiTool(protoTool);

      expect(result.functionDeclarations).toHaveLength(3);
      expect(result.functionDeclarations![0].name).toBe('func1');
      expect(result.functionDeclarations![1].name).toBe('func2');
      expect(result.functionDeclarations![2].name).toBe('func3');
    });

    it('should convert tool with no function declarations', () => {
      const protoTool = createProtoTool([]);

      const result = protoToolToGenaiTool(protoTool);

      expect(result.functionDeclarations).toBeUndefined();
    });

    it('should convert tool with code execution', () => {
      const protoTool = {
        ...createProtoTool([]),
        codeExecution: {
          $typeName: 'google.ai.generativelanguage.v1beta.CodeExecution',
        },
      } as ProtoTool;

      const result = protoToolToGenaiTool(protoTool);

      expect(result.codeExecution).toBeDefined();
    });

    it('should convert tool with Google Search', () => {
      const protoTool = {
        ...createProtoTool([]),
        googleSearch: {
          $typeName: 'google.ai.generativelanguage.v1beta.Tool.GoogleSearch',
        },
      } as ProtoTool;

      const result = protoToolToGenaiTool(protoTool);

      expect(result.googleSearch).toBeDefined();
    });
  });

  // ==========================================================================
  // Proto → Genai: FunctionDeclaration Conversion
  // ==========================================================================

  describe('protoFunctionDeclarationToGenai', () => {
    it('should convert function with name and description only', () => {
      const protoFd = createProtoFunctionDeclaration(
        'simple_func',
        'A simple function'
      );

      const result = protoFunctionDeclarationToGenai(protoFd);

      expect(result.name).toBe('simple_func');
      expect(result.description).toBe('A simple function');
      expect(result.parameters).toBeUndefined();
    });

    it('should convert function with object parameters', () => {
      const parametersSchema = createProtoSchema(ProtoType.OBJECT, {
        properties: {
          location: createProtoSchema(ProtoType.STRING, {
            description: 'The city and state',
          }),
          units: createProtoSchema(ProtoType.STRING, {
            description: 'Temperature units',
            enum: ['celsius', 'fahrenheit'],
          }),
        },
        required: ['location'],
      });

      const protoFd = createProtoFunctionDeclaration(
        'get_weather',
        'Gets weather for a location',
        parametersSchema
      );

      const result = protoFunctionDeclarationToGenai(protoFd);

      expect(result.name).toBe('get_weather');
      expect(result.parameters).toBeDefined();
      expect(result.parameters!.type).toBe(GenaiType.OBJECT);
      expect(result.parameters!.properties).toBeDefined();
      expect(result.parameters!.properties!['location']).toBeDefined();
      expect(result.parameters!.properties!['location'].type).toBe(GenaiType.STRING);
      expect(result.parameters!.properties!['units'].enum).toEqual([
        'celsius',
        'fahrenheit',
      ]);
      expect(result.parameters!.required).toEqual(['location']);
    });

    it('should handle function with empty name', () => {
      const protoFd = createProtoFunctionDeclaration('', 'No name');

      const result = protoFunctionDeclarationToGenai(protoFd);

      expect(result.name).toBeUndefined();
      expect(result.description).toBe('No name');
    });
  });

  // ==========================================================================
  // Proto → Genai: Schema Conversion
  // ==========================================================================

  describe('protoSchemaToGenaiSchema', () => {
    it('should convert string schema', () => {
      const protoSchema = createProtoSchema(ProtoType.STRING, {
        description: 'A string field',
      });

      const result = protoSchemaToGenaiSchema(protoSchema);

      expect(result.type).toBe(GenaiType.STRING);
      expect(result.description).toBe('A string field');
    });

    it('should convert number schema with min/max', () => {
      const protoSchema = createProtoSchema(ProtoType.NUMBER, {
        minimum: 0,
        maximum: 100,
      });

      const result = protoSchemaToGenaiSchema(protoSchema);

      expect(result.type).toBe(GenaiType.NUMBER);
      expect(result.minimum).toBe(0);
      expect(result.maximum).toBe(100);
    });

    it('should convert integer schema', () => {
      const protoSchema = createProtoSchema(ProtoType.INTEGER);

      const result = protoSchemaToGenaiSchema(protoSchema);

      expect(result.type).toBe(GenaiType.INTEGER);
    });

    it('should convert boolean schema', () => {
      const protoSchema = createProtoSchema(ProtoType.BOOLEAN);

      const result = protoSchemaToGenaiSchema(protoSchema);

      expect(result.type).toBe(GenaiType.BOOLEAN);
    });

    it('should convert array schema with items', () => {
      const protoSchema = createProtoSchema(ProtoType.ARRAY, {
        items: createProtoSchema(ProtoType.STRING),
        minItems: 1n,
        maxItems: 10n,
      });

      const result = protoSchemaToGenaiSchema(protoSchema);

      expect(result.type).toBe(GenaiType.ARRAY);
      expect(result.items).toBeDefined();
      expect(result.items!.type).toBe(GenaiType.STRING);
      expect(result.minItems).toBe('1');
      expect(result.maxItems).toBe('10');
    });

    it('should convert object schema with nested properties', () => {
      const protoSchema = createProtoSchema(ProtoType.OBJECT, {
        properties: {
          name: createProtoSchema(ProtoType.STRING),
          age: createProtoSchema(ProtoType.INTEGER),
          address: createProtoSchema(ProtoType.OBJECT, {
            properties: {
              street: createProtoSchema(ProtoType.STRING),
              city: createProtoSchema(ProtoType.STRING),
            },
          }),
        },
        required: ['name', 'age'],
      });

      const result = protoSchemaToGenaiSchema(protoSchema);

      expect(result.type).toBe(GenaiType.OBJECT);
      expect(result.properties).toBeDefined();
      expect(result.properties!['name'].type).toBe(GenaiType.STRING);
      expect(result.properties!['age'].type).toBe(GenaiType.INTEGER);
      expect(result.properties!['address'].type).toBe(GenaiType.OBJECT);
      expect(result.properties!['address'].properties!['street'].type).toBe(
        GenaiType.STRING
      );
      expect(result.required).toEqual(['name', 'age']);
    });

    it('should convert schema with enum values', () => {
      const protoSchema = createProtoSchema(ProtoType.STRING, {
        enum: ['option1', 'option2', 'option3'],
      });

      const result = protoSchemaToGenaiSchema(protoSchema);

      expect(result.type).toBe(GenaiType.STRING);
      expect(result.enum).toEqual(['option1', 'option2', 'option3']);
    });

    it('should convert schema with anyOf', () => {
      const protoSchema = createProtoSchema(ProtoType.TYPE_UNSPECIFIED, {
        anyOf: [
          createProtoSchema(ProtoType.STRING),
          createProtoSchema(ProtoType.INTEGER),
        ],
      });

      const result = protoSchemaToGenaiSchema(protoSchema);

      expect(result.anyOf).toHaveLength(2);
      expect(result.anyOf![0].type).toBe(GenaiType.STRING);
      expect(result.anyOf![1].type).toBe(GenaiType.INTEGER);
    });

    it('should handle unspecified type', () => {
      const protoSchema = createProtoSchema(ProtoType.TYPE_UNSPECIFIED);

      const result = protoSchemaToGenaiSchema(protoSchema);

      expect(result.type).toBeUndefined();
    });

    it('should convert nullable schema', () => {
      const protoSchema = createProtoSchema(ProtoType.STRING, {
        nullable: true,
      });

      const result = protoSchemaToGenaiSchema(protoSchema);

      expect(result.nullable).toBe(true);
    });

    it('should convert string schema with pattern and length constraints', () => {
      const protoSchema = createProtoSchema(ProtoType.STRING, {
        pattern: '^[a-z]+$',
        minLength: 1n,
        maxLength: 100n,
      });

      const result = protoSchemaToGenaiSchema(protoSchema);

      expect(result.pattern).toBe('^[a-z]+$');
      expect(result.minLength).toBe('1');
      expect(result.maxLength).toBe('100');
    });
  });

  // ==========================================================================
  // Genai → Proto: Tool Conversion
  // ==========================================================================

  describe('genaiToolToProtoTool', () => {
    it('should convert tool with single function declaration', () => {
      const genaiTool: Tool = {
        functionDeclarations: [
          {
            name: 'search',
            description: 'Search for information',
          },
        ],
      };

      const result = genaiToolToProtoTool(genaiTool);

      expect(result.functionDeclarations).toHaveLength(1);
      expect(result.functionDeclarations[0].name).toBe('search');
      expect(result.functionDeclarations[0].description).toBe(
        'Search for information'
      );
    });

    it('should convert empty tool', () => {
      const genaiTool: Tool = {};

      const result = genaiToolToProtoTool(genaiTool);

      expect(result.functionDeclarations).toHaveLength(0);
    });

    it('should convert tool with code execution', () => {
      const genaiTool: Tool = {
        codeExecution: {},
      };

      const result = genaiToolToProtoTool(genaiTool);

      expect(result.codeExecution).toBeDefined();
    });
  });

  // ==========================================================================
  // Genai → Proto: FunctionDeclaration Conversion
  // ==========================================================================

  describe('genaiFunctionDeclarationToProto', () => {
    it('should convert function with parameters', () => {
      const genaiFd: FunctionDeclaration = {
        name: 'calculate',
        description: 'Performs calculations',
        parameters: {
          type: GenaiType.OBJECT,
          properties: {
            operation: { type: GenaiType.STRING, enum: ['add', 'subtract'] },
            a: { type: GenaiType.NUMBER },
            b: { type: GenaiType.NUMBER },
          },
          required: ['operation', 'a', 'b'],
        },
      };

      const result = genaiFunctionDeclarationToProto(genaiFd);

      expect(result.name).toBe('calculate');
      expect(result.description).toBe('Performs calculations');
      expect(result.parameters).toBeDefined();
      expect(result.parameters!.type).toBe(ProtoType.OBJECT);
    });

    it('should handle function with undefined name', () => {
      const genaiFd: FunctionDeclaration = {
        description: 'No name function',
      };

      const result = genaiFunctionDeclarationToProto(genaiFd);

      expect(result.name).toBe('');
      expect(result.description).toBe('No name function');
    });
  });

  // ==========================================================================
  // Genai → Proto: Schema Conversion
  // ==========================================================================

  describe('genaiSchemaToProtoSchema', () => {
    it('should convert string schema', () => {
      const genaiSchema: Schema = {
        type: GenaiType.STRING,
        description: 'A string value',
      };

      const result = genaiSchemaToProtoSchema(genaiSchema);

      expect(result.type).toBe(ProtoType.STRING);
      expect(result.description).toBe('A string value');
    });

    it('should convert object schema with properties', () => {
      const genaiSchema: Schema = {
        type: GenaiType.OBJECT,
        properties: {
          name: { type: GenaiType.STRING },
          count: { type: GenaiType.INTEGER },
        },
        required: ['name'],
      };

      const result = genaiSchemaToProtoSchema(genaiSchema);

      expect(result.type).toBe(ProtoType.OBJECT);
      expect(result.properties).toBeDefined();
      expect(result.properties!['name'].type).toBe(ProtoType.STRING);
      expect(result.properties!['count'].type).toBe(ProtoType.INTEGER);
      expect(result.required).toEqual(['name']);
    });

    it('should convert array schema', () => {
      const genaiSchema: Schema = {
        type: GenaiType.ARRAY,
        items: { type: GenaiType.STRING },
        minItems: '2',
        maxItems: '5',
      };

      const result = genaiSchemaToProtoSchema(genaiSchema);

      expect(result.type).toBe(ProtoType.ARRAY);
      expect(result.items).toBeDefined();
      expect(result.items!.type).toBe(ProtoType.STRING);
      expect(result.minItems).toBe(2n);
      expect(result.maxItems).toBe(5n);
    });

    it('should handle undefined type', () => {
      const genaiSchema: Schema = {
        description: 'No type specified',
      };

      const result = genaiSchemaToProtoSchema(genaiSchema);

      expect(result.type).toBe(ProtoType.TYPE_UNSPECIFIED);
    });
  });

  // ==========================================================================
  // Round-trip Conversion Tests
  // ==========================================================================

  describe('Round-trip conversion', () => {
    it('should preserve tool data through proto → genai → proto', () => {
      const originalTool = createProtoTool([
        createProtoFunctionDeclaration(
          'test_func',
          'Test function',
          createProtoSchema(ProtoType.OBJECT, {
            properties: {
              input: createProtoSchema(ProtoType.STRING),
            },
            required: ['input'],
          })
        ),
      ]);

      const genaiTool = protoToolToGenaiTool(originalTool);
      const roundTrippedTool = genaiToolToProtoTool(genaiTool);

      expect(roundTrippedTool.functionDeclarations).toHaveLength(1);
      expect(roundTrippedTool.functionDeclarations[0].name).toBe('test_func');
      expect(roundTrippedTool.functionDeclarations[0].description).toBe(
        'Test function'
      );
      expect(roundTrippedTool.functionDeclarations[0].parameters?.type).toBe(
        ProtoType.OBJECT
      );
      expect(
        roundTrippedTool.functionDeclarations[0].parameters?.properties?.[
          'input'
        ]?.type
      ).toBe(ProtoType.STRING);
    });

    it('should preserve schema data through genai → proto → genai', () => {
      const originalSchema: Schema = {
        type: GenaiType.OBJECT,
        properties: {
          id: { type: GenaiType.INTEGER, minimum: 1 },
          tags: {
            type: GenaiType.ARRAY,
            items: { type: GenaiType.STRING },
          },
        },
        required: ['id'],
      };

      const protoSchema = genaiSchemaToProtoSchema(originalSchema);
      const roundTrippedSchema = protoSchemaToGenaiSchema(protoSchema);

      expect(roundTrippedSchema.type).toBe(GenaiType.OBJECT);
      expect(roundTrippedSchema.properties!['id'].type).toBe(GenaiType.INTEGER);
      expect(roundTrippedSchema.properties!['id'].minimum).toBe(1);
      expect(roundTrippedSchema.properties!['tags'].type).toBe(GenaiType.ARRAY);
      expect(roundTrippedSchema.properties!['tags'].items!.type).toBe(GenaiType.STRING);
      expect(roundTrippedSchema.required).toEqual(['id']);
    });
  });
});
