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
import { genaiSchemaToJsonSchema, type JsonSchema7 } from './json-schema-converter.js';

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
      expect(result.properties!['user'].properties!['address'].required).toEqual(['street', 'city']);
    });

    it('should not include empty properties object', () => {
      const genaiSchema = createGenaiSchema(GenaiType.OBJECT, {
        properties: {},
      });

      const result = genaiSchemaToJsonSchema(genaiSchema);

      expect(result.properties).toBeUndefined();
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
});
