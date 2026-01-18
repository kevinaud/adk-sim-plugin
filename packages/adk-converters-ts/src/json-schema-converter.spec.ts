/**
 * Tests for JSON Schema Conversion Utilities
 *
 * Tests cover:
 * - All type mappings (STRING, NUMBER, INTEGER, BOOLEAN, ARRAY, OBJECT)
 * - Nested properties and items (recursive conversion)
 * - BigInt string fields converted to numbers (minItems, maxItems, etc.)
 * - Nullable handling with oneOf pattern
 * - Preservation of enum, required, minimum, maximum, pattern, format
 * - Edge cases and complex schemas
 */

import { describe, it, expect } from 'vitest';
import { Type as GenaiType } from '@google/genai';
import type { Schema } from '@google/genai';
import { Type as ProtoType, SchemaSchema } from '@adk-sim/protos';
import type { Schema as ProtoSchema } from '@adk-sim/protos';
import { create } from '@bufbuild/protobuf';
import { genaiSchemaToJsonSchema, type JsonSchema7 } from './json-schema-converter.js';
import { protoSchemaToGenaiSchema } from './tool-converter.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a genai Schema for testing
 */
function createGenaiSchema(type: Schema['type'], options: Partial<Schema> = {}): Schema {
  return {
    type,
    ...options,
  };
}

/**
 * Create a proto Schema for testing the full pipeline
 */
function createProtoSchema(
  type: ProtoType,
  options: Partial<Omit<ProtoSchema, 'type'>> = {},
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
// Type Mapping Tests
// ============================================================================

describe('genaiSchemaToJsonSchema', () => {
  describe('Type Mappings', () => {
    it('should convert STRING type to "string"', () => {
      const genaiSchema = createGenaiSchema(GenaiType.STRING);

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.type).toBe('string');
    });

    it('should convert NUMBER type to "number"', () => {
      const genaiSchema = createGenaiSchema(GenaiType.NUMBER);

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.type).toBe('number');
    });

    it('should convert INTEGER type to "integer"', () => {
      const genaiSchema = createGenaiSchema(GenaiType.INTEGER);

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.type).toBe('integer');
    });

    it('should convert BOOLEAN type to "boolean"', () => {
      const genaiSchema = createGenaiSchema(GenaiType.BOOLEAN);

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.type).toBe('boolean');
    });

    it('should convert ARRAY type to "array"', () => {
      const genaiSchema = createGenaiSchema(GenaiType.ARRAY);

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.type).toBe('array');
    });

    it('should convert OBJECT type to "object"', () => {
      const genaiSchema = createGenaiSchema(GenaiType.OBJECT);

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.type).toBe('object');
    });

    it('should handle undefined type', () => {
      const genaiSchema: Schema = {
        description: 'No type specified',
      };

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.type).toBeUndefined();
      expect(result.description).toBe('No type specified');
    });

    it('should handle TYPE_UNSPECIFIED', () => {
      const genaiSchema: Schema = {
        type: 'TYPE_UNSPECIFIED' as GenaiType,
        description: 'Unspecified type',
      };

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.type).toBeUndefined();
      expect(result.description).toBe('Unspecified type');
    });
  });

  // ==========================================================================
  // Simple Field Preservation Tests
  // ==========================================================================

  describe('Simple Field Preservation', () => {
    it('should preserve title', () => {
      const genaiSchema = createGenaiSchema(GenaiType.STRING, {
        title: 'User Name',
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.title).toBe('User Name');
    });

    it('should preserve description', () => {
      const genaiSchema = createGenaiSchema(GenaiType.STRING, {
        description: 'The name of the user',
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.description).toBe('The name of the user');
    });

    it('should preserve format', () => {
      const genaiSchema = createGenaiSchema(GenaiType.STRING, {
        format: 'email',
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.format).toBe('email');
    });

    it('should preserve pattern', () => {
      const genaiSchema = createGenaiSchema(GenaiType.STRING, {
        pattern: '^[a-z]+$',
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.pattern).toBe('^[a-z]+$');
    });

    it('should preserve minimum and maximum for numbers', () => {
      const genaiSchema = createGenaiSchema(GenaiType.NUMBER, {
        minimum: 0,
        maximum: 100,
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.minimum).toBe(0);
      expect(result.maximum).toBe(100);
    });

    it('should preserve default value', () => {
      const genaiSchema = createGenaiSchema(GenaiType.STRING, {
        default: 'default value',
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.default).toBe('default value');
    });
  });

  // ==========================================================================
  // Enum and Required Tests
  // ==========================================================================

  describe('Enum and Required Fields', () => {
    it('should preserve enum values', () => {
      const genaiSchema = createGenaiSchema(GenaiType.STRING, {
        enum: ['option1', 'option2', 'option3'],
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.enum).toEqual(['option1', 'option2', 'option3']);
    });

    it('should preserve required array', () => {
      const genaiSchema = createGenaiSchema(GenaiType.OBJECT, {
        required: ['name', 'email'],
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.required).toEqual(['name', 'email']);
    });

    it('should not include empty enum array', () => {
      const genaiSchema = createGenaiSchema(GenaiType.STRING, {
        enum: [],
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.enum).toBeUndefined();
    });

    it('should not include empty required array', () => {
      const genaiSchema = createGenaiSchema(GenaiType.OBJECT, {
        required: [],
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.required).toBeUndefined();
    });
  });

  // ==========================================================================
  // BigInt String Field Conversion Tests
  // ==========================================================================

  describe('BigInt String Field Conversion', () => {
    it('should convert minItems string to number', () => {
      const genaiSchema = createGenaiSchema(GenaiType.ARRAY, {
        minItems: '1',
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.minItems).toBe(1);
      expect(typeof result.minItems).toBe('number');
    });

    it('should convert maxItems string to number', () => {
      const genaiSchema = createGenaiSchema(GenaiType.ARRAY, {
        maxItems: '10',
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.maxItems).toBe(10);
      expect(typeof result.maxItems).toBe('number');
    });

    it('should convert minLength string to number', () => {
      const genaiSchema = createGenaiSchema(GenaiType.STRING, {
        minLength: '5',
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.minLength).toBe(5);
      expect(typeof result.minLength).toBe('number');
    });

    it('should convert maxLength string to number', () => {
      const genaiSchema = createGenaiSchema(GenaiType.STRING, {
        maxLength: '100',
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.maxLength).toBe(100);
      expect(typeof result.maxLength).toBe('number');
    });

    it('should convert minProperties string to number', () => {
      const genaiSchema = createGenaiSchema(GenaiType.OBJECT, {
        minProperties: '2',
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.minProperties).toBe(2);
      expect(typeof result.minProperties).toBe('number');
    });

    it('should convert maxProperties string to number', () => {
      const genaiSchema = createGenaiSchema(GenaiType.OBJECT, {
        maxProperties: '20',
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.maxProperties).toBe(20);
      expect(typeof result.maxProperties).toBe('number');
    });

    it('should handle all array constraints together', () => {
      const genaiSchema = createGenaiSchema(GenaiType.ARRAY, {
        minItems: '1',
        maxItems: '50',
        items: { type: GenaiType.STRING },
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.minItems).toBe(1);
      expect(result.maxItems).toBe(50);
    });
  });

  // ==========================================================================
  // Nullable Handling Tests
  // ==========================================================================

  describe('Nullable Handling', () => {
    it('should convert nullable: true to oneOf with null type', () => {
      const genaiSchema = createGenaiSchema(GenaiType.STRING, {
        nullable: true,
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.oneOf).toBeDefined();
      expect(result.oneOf).toHaveLength(2);
      expect(result.oneOf![0]).toEqual({ type: 'string' });
      expect(result.oneOf![1]).toEqual({ type: 'null' });
      expect(result.type).toBeUndefined();
    });

    it('should preserve other fields in nullable schema', () => {
      const genaiSchema = createGenaiSchema(GenaiType.STRING, {
        nullable: true,
        description: 'A nullable string',
        minLength: '1',
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.oneOf).toBeDefined();
      expect(result.oneOf![0]).toEqual({
        type: 'string',
        description: 'A nullable string',
        minLength: 1,
      });
      expect(result.oneOf![1]).toEqual({ type: 'null' });
    });

    it('should handle nullable integer', () => {
      const genaiSchema = createGenaiSchema(GenaiType.INTEGER, {
        nullable: true,
        minimum: 0,
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.oneOf).toBeDefined();
      expect(result.oneOf![0]).toEqual({
        type: 'integer',
        minimum: 0,
      });
      expect(result.oneOf![1]).toEqual({ type: 'null' });
    });

    it('should handle nullable array', () => {
      const genaiSchema = createGenaiSchema(GenaiType.ARRAY, {
        nullable: true,
        items: { type: GenaiType.STRING },
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.oneOf).toBeDefined();
      expect(result.oneOf![0]).toEqual({
        type: 'array',
        items: { type: 'string' },
      });
      expect(result.oneOf![1]).toEqual({ type: 'null' });
    });

    it('should handle nullable object with properties', () => {
      const genaiSchema = createGenaiSchema(GenaiType.OBJECT, {
        nullable: true,
        properties: {
          name: { type: GenaiType.STRING },
        },
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.oneOf).toBeDefined();
      expect(result.oneOf![0]).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      });
      expect(result.oneOf![1]).toEqual({ type: 'null' });
    });

    it('should not add oneOf when nullable is false', () => {
      const genaiSchema = createGenaiSchema(GenaiType.STRING, {
        nullable: false,
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.oneOf).toBeUndefined();
      expect(result.type).toBe('string');
    });
  });

  // ==========================================================================
  // Recursive Properties Tests
  // ==========================================================================

  describe('Recursive Properties Conversion', () => {
    it('should convert nested object properties', () => {
      const genaiSchema = createGenaiSchema(GenaiType.OBJECT, {
        properties: {
          name: { type: GenaiType.STRING },
          age: { type: GenaiType.INTEGER },
        },
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.properties).toBeDefined();
      expect(result.properties!['name']).toEqual({ type: 'string' });
      expect(result.properties!['age']).toEqual({ type: 'integer' });
    });

    it('should convert deeply nested object properties', () => {
      const genaiSchema = createGenaiSchema(GenaiType.OBJECT, {
        properties: {
          user: {
            type: GenaiType.OBJECT,
            properties: {
              name: { type: GenaiType.STRING },
              address: {
                type: GenaiType.OBJECT,
                properties: {
                  street: { type: GenaiType.STRING },
                  city: { type: GenaiType.STRING },
                  zip: { type: GenaiType.STRING, pattern: '^\\d{5}$' },
                },
                required: ['street', 'city'],
              },
            },
            required: ['name'],
          },
        },
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.type).toBe('object');
      expect(result.properties!['user'].type).toBe('object');
      expect(result.properties!['user'].properties!['name'].type).toBe('string');
      expect(result.properties!['user'].properties!['address'].type).toBe('object');
      expect(result.properties!['user'].properties!['address'].properties!['zip'].pattern).toBe(
        '^\\d{5}$',
      );
      expect(result.properties!['user'].properties!['address'].required).toEqual([
        'street',
        'city',
      ]);
    });

    it('should set additionalProperties: true for empty properties (open object)', () => {
      const genaiSchema = createGenaiSchema(GenaiType.OBJECT, {
        properties: {},
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.properties).toBeUndefined();
      expect(result.additionalProperties).toBe(true);
    });

    it('should set additionalProperties: true for OBJECT with no properties defined', () => {
      // This represents Dict[str, Any] or dict in Python
      const genaiSchema = createGenaiSchema(GenaiType.OBJECT);

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.type).toBe('object');
      expect(result.additionalProperties).toBe(true);
    });

    it('should NOT set additionalProperties for OBJECT with defined properties', () => {
      const genaiSchema = createGenaiSchema(GenaiType.OBJECT, {
        properties: {
          name: { type: GenaiType.STRING },
        },
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.type).toBe('object');
      expect(result.properties).toBeDefined();
      expect(result.additionalProperties).toBeUndefined();
    });
  });

  // ==========================================================================
  // Recursive Items Tests
  // ==========================================================================

  describe('Recursive Items Conversion', () => {
    it('should convert array items', () => {
      const genaiSchema = createGenaiSchema(GenaiType.ARRAY, {
        items: { type: GenaiType.STRING },
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.items).toEqual({ type: 'string' });
    });

    it('should convert array of objects', () => {
      const genaiSchema = createGenaiSchema(GenaiType.ARRAY, {
        items: {
          type: GenaiType.OBJECT,
          properties: {
            id: { type: GenaiType.INTEGER },
            name: { type: GenaiType.STRING },
          },
          required: ['id'],
        },
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.items).toBeDefined();
      expect((result.items as JsonSchema7).type).toBe('object');
      expect((result.items as JsonSchema7).properties!['id'].type).toBe('integer');
      expect((result.items as JsonSchema7).properties!['name'].type).toBe('string');
      expect((result.items as JsonSchema7).required).toEqual(['id']);
    });

    it('should convert nested arrays (array of arrays)', () => {
      const genaiSchema = createGenaiSchema(GenaiType.ARRAY, {
        items: {
          type: GenaiType.ARRAY,
          items: { type: GenaiType.NUMBER },
        },
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.items).toBeDefined();
      expect((result.items as JsonSchema7).type).toBe('array');
      expect(((result.items as JsonSchema7).items as JsonSchema7).type).toBe('number');
    });
  });

  // ==========================================================================
  // AnyOf Tests
  // ==========================================================================

  describe('AnyOf Conversion', () => {
    it('should convert anyOf schemas', () => {
      const genaiSchema: Schema = {
        anyOf: [{ type: GenaiType.STRING }, { type: GenaiType.INTEGER }],
      };

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.anyOf).toBeDefined();
      expect(result.anyOf).toHaveLength(2);
      expect(result.anyOf![0]).toEqual({ type: 'string' });
      expect(result.anyOf![1]).toEqual({ type: 'integer' });
    });

    it('should not include empty anyOf array', () => {
      const genaiSchema: Schema = {
        type: GenaiType.STRING,
        anyOf: [],
      };

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.anyOf).toBeUndefined();
    });
  });

  // ==========================================================================
  // Complex/Real-World Schema Tests
  // ==========================================================================

  describe('Complex Schemas', () => {
    it('should convert a tool parameter schema', () => {
      const genaiSchema = createGenaiSchema(GenaiType.OBJECT, {
        properties: {
          query: {
            type: GenaiType.STRING,
            description: 'The search query',
          },
          maxResults: {
            type: GenaiType.INTEGER,
            description: 'Maximum number of results',
            minimum: 1,
            maximum: 100,
          },
          filters: {
            type: GenaiType.OBJECT,
            properties: {
              category: {
                type: GenaiType.STRING,
                enum: ['books', 'movies', 'music'],
              },
              inStock: {
                type: GenaiType.BOOLEAN,
              },
            },
          },
        },
        required: ['query'],
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.type).toBe('object');
      expect(result.required).toEqual(['query']);
      expect(result.properties!['query'].type).toBe('string');
      expect(result.properties!['query'].description).toBe('The search query');
      expect(result.properties!['maxResults'].type).toBe('integer');
      expect(result.properties!['maxResults'].minimum).toBe(1);
      expect(result.properties!['maxResults'].maximum).toBe(100);
      expect(result.properties!['filters'].properties!['category'].enum).toEqual([
        'books',
        'movies',
        'music',
      ]);
      expect(result.properties!['filters'].properties!['inStock'].type).toBe('boolean');
    });

    it('should convert a schema with all string constraints', () => {
      const genaiSchema = createGenaiSchema(GenaiType.STRING, {
        title: 'Email Address',
        description: 'User email address',
        format: 'email',
        pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        minLength: '5',
        maxLength: '100',
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.type).toBe('string');
      expect(result.title).toBe('Email Address');
      expect(result.description).toBe('User email address');
      expect(result.format).toBe('email');
      expect(result.pattern).toBe('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$');
      expect(result.minLength).toBe(5);
      expect(result.maxLength).toBe(100);
    });

    it('should convert a schema with all array constraints', () => {
      const genaiSchema = createGenaiSchema(GenaiType.ARRAY, {
        title: 'Tags',
        description: 'List of tags',
        minItems: '1',
        maxItems: '10',
        items: {
          type: GenaiType.STRING,
          minLength: '1',
          maxLength: '50',
        },
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.type).toBe('array');
      expect(result.title).toBe('Tags');
      expect(result.minItems).toBe(1);
      expect(result.maxItems).toBe(10);
      expect((result.items as JsonSchema7).type).toBe('string');
      expect((result.items as JsonSchema7).minLength).toBe(1);
      expect((result.items as JsonSchema7).maxLength).toBe(50);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty schema', () => {
      const genaiSchema: Schema = {};

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result).toEqual({});
    });

    it('should handle schema with only description', () => {
      const genaiSchema: Schema = {
        description: 'A schema with only a description',
      };

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result).toEqual({
        description: 'A schema with only a description',
      });
    });

    it('should handle zero values for numeric string fields', () => {
      const genaiSchema = createGenaiSchema(GenaiType.ARRAY, {
        minItems: '0',
        maxItems: '0',
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.minItems).toBe(0);
      expect(result.maxItems).toBe(0);
    });

    it('should handle minimum: 0 explicitly', () => {
      const genaiSchema = createGenaiSchema(GenaiType.INTEGER, {
        minimum: 0,
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.minimum).toBe(0);
    });
  });

  // ==========================================================================
  // Full Pipeline Tests: Proto → Genai → JSON Schema
  // ==========================================================================

  describe('Full Pipeline: Proto → Genai → JSON Schema', () => {
    /**
     * Tests for the "open object" pattern (Dict[str, Any] in Python).
     * This is common in ADK tools where a parameter accepts arbitrary key-value pairs.
     */
    describe('Open Object Pattern (Dict[str, Any])', () => {
      it('should convert top-level open object (OBJECT with no properties)', () => {
        // Proto schema: type: OBJECT with no properties
        // This represents Dict[str, Any] in Python
        const protoSchema = createProtoSchema(ProtoType.OBJECT);

        const genaiSchema = protoSchemaToGenaiSchema(protoSchema);
        const jsonSchema = genaiSchemaToJsonSchema(genaiSchema);

        expect(jsonSchema.type).toBe('object');
        expect(jsonSchema.additionalProperties).toBe(true);
        expect(jsonSchema.properties).toBeUndefined();
      });

      it('should convert nested open object property (store_state_tool pattern)', () => {
        // This is the exact pattern from the FOMC store_state_tool:
        // {
        //   type: OBJECT,
        //   properties: { state: { type: OBJECT } },  // state is an open object
        //   required: ['state']
        // }
        const protoSchema = createProtoSchema(ProtoType.OBJECT, {
          properties: {
            state: createProtoSchema(ProtoType.OBJECT), // No properties = open object
          },
          required: ['state'],
        });

        const genaiSchema = protoSchemaToGenaiSchema(protoSchema);
        const jsonSchema = genaiSchemaToJsonSchema(genaiSchema);

        // Top level should have properties defined
        expect(jsonSchema.type).toBe('object');
        expect(jsonSchema.properties).toBeDefined();
        expect(jsonSchema.required).toEqual(['state']);
        expect(jsonSchema.additionalProperties).toBeUndefined(); // Has properties, so no additionalProperties

        // Nested 'state' property should be an open object
        const stateSchema = jsonSchema.properties!['state'];
        expect(stateSchema.type).toBe('object');
        expect(stateSchema.additionalProperties).toBe(true);
        expect(stateSchema.properties).toBeUndefined();
      });

      it('should convert deeply nested open object', () => {
        // Schema with: outer.inner.data where data is an open object
        const protoSchema = createProtoSchema(ProtoType.OBJECT, {
          properties: {
            outer: createProtoSchema(ProtoType.OBJECT, {
              properties: {
                inner: createProtoSchema(ProtoType.OBJECT, {
                  properties: {
                    data: createProtoSchema(ProtoType.OBJECT), // Open object at 3 levels deep
                  },
                }),
              },
            }),
          },
        });

        const genaiSchema = protoSchemaToGenaiSchema(protoSchema);
        const jsonSchema = genaiSchemaToJsonSchema(genaiSchema);

        // Navigate to the deeply nested 'data' property
        const dataSchema = jsonSchema.properties!['outer'].properties!['inner'].properties!['data'];

        expect(dataSchema.type).toBe('object');
        expect(dataSchema.additionalProperties).toBe(true);
        expect(dataSchema.properties).toBeUndefined();
      });

      it('should distinguish between open objects and closed objects with properties', () => {
        const protoSchema = createProtoSchema(ProtoType.OBJECT, {
          properties: {
            // Open object - no defined properties
            openData: createProtoSchema(ProtoType.OBJECT),
            // Closed object - has defined properties
            closedData: createProtoSchema(ProtoType.OBJECT, {
              properties: {
                name: createProtoSchema(ProtoType.STRING),
                value: createProtoSchema(ProtoType.NUMBER),
              },
            }),
          },
        });

        const genaiSchema = protoSchemaToGenaiSchema(protoSchema);
        const jsonSchema = genaiSchemaToJsonSchema(genaiSchema);

        // Open object should have additionalProperties: true
        const openDataSchema = jsonSchema.properties!['openData'];
        expect(openDataSchema.type).toBe('object');
        expect(openDataSchema.additionalProperties).toBe(true);
        expect(openDataSchema.properties).toBeUndefined();

        // Closed object should NOT have additionalProperties
        const closedDataSchema = jsonSchema.properties!['closedData'];
        expect(closedDataSchema.type).toBe('object');
        expect(closedDataSchema.additionalProperties).toBeUndefined();
        expect(closedDataSchema.properties).toBeDefined();
        expect(closedDataSchema.properties!['name'].type).toBe('string');
        expect(closedDataSchema.properties!['value'].type).toBe('number');
      });

      it('should handle open object in array items', () => {
        // Array of open objects: Array<Dict[str, Any]>
        const protoSchema = createProtoSchema(ProtoType.ARRAY, {
          items: createProtoSchema(ProtoType.OBJECT), // Open object
        });

        const genaiSchema = protoSchemaToGenaiSchema(protoSchema);
        const jsonSchema = genaiSchemaToJsonSchema(genaiSchema);

        expect(jsonSchema.type).toBe('array');
        expect(jsonSchema.items).toBeDefined();

        const itemsSchema = jsonSchema.items as JsonSchema7;
        expect(itemsSchema.type).toBe('object');
        expect(itemsSchema.additionalProperties).toBe(true);
        expect(itemsSchema.properties).toBeUndefined();
      });
    });

    describe('Real Tool Schemas', () => {
      it('should convert store_state_tool schema exactly as received from gRPC', () => {
        // Exact reproduction of the store_state_tool from SessionEvent
        // parameters: { type: 6, properties: { state: { type: 6 } }, required: ['state'] }
        // where type 6 = ProtoType.OBJECT
        const protoSchema = createProtoSchema(ProtoType.OBJECT, {
          properties: {
            state: createProtoSchema(ProtoType.OBJECT),
          },
          required: ['state'],
        });

        const genaiSchema = protoSchemaToGenaiSchema(protoSchema);
        const jsonSchema = genaiSchemaToJsonSchema(genaiSchema);

        // Verify the final JSON Schema structure
        expect(jsonSchema).toEqual({
          type: 'object',
          properties: {
            state: {
              type: 'object',
              additionalProperties: true,
            },
          },
          required: ['state'],
        });
      });

      it('should convert store_state_tool using bufbuild create() exactly as in Playwright test', () => {
        // Use the actual bufbuild create() function to match the Playwright test setup
        const stateSchema = create(SchemaSchema, { type: ProtoType.OBJECT });
        const protoSchema = create(SchemaSchema, {
          type: ProtoType.OBJECT,
          properties: {
            state: stateSchema,
          },
          required: ['state'],
        }) as ProtoSchema;

        const genaiSchema = protoSchemaToGenaiSchema(protoSchema);
        const jsonSchema = genaiSchemaToJsonSchema(genaiSchema);

        // Verify the final JSON Schema structure
        expect(jsonSchema.type).toBe('object');
        expect(jsonSchema.properties).toBeDefined();
        expect(jsonSchema.properties!['state'].type).toBe('object');
        expect(jsonSchema.properties!['state'].additionalProperties).toBe(true);
        expect(jsonSchema.properties!['state'].properties).toBeUndefined();
      });
    });
  });
});
