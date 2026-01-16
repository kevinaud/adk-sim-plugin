/**
 * JSON Schema Conversion Utilities
 *
 * Converts between @google/genai Schema types and JSON Schema 7 format
 * for use with JSONForms.
 */

import { Type as GenaiType } from '@google/genai';
import type { Schema } from '@google/genai';

/**
 * JSON Schema 7 type definition.
 * Based on the JsonSchema7 interface from @jsonforms/core.
 */
export interface JsonSchema7 {
  $ref?: string;
  $id?: string;
  $schema?: string;
  title?: string;
  description?: string;
  default?: unknown;
  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: number;
  minimum?: number;
  exclusiveMinimum?: number;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  additionalItems?: boolean | JsonSchema7;
  items?: JsonSchema7 | JsonSchema7[];
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  maxProperties?: number;
  minProperties?: number;
  required?: string[];
  additionalProperties?: boolean | JsonSchema7;
  definitions?: Record<string, JsonSchema7>;
  properties?: Record<string, JsonSchema7>;
  patternProperties?: Record<string, JsonSchema7>;
  dependencies?: Record<string, JsonSchema7 | string[]>;
  enum?: unknown[];
  type?: string | string[];
  allOf?: JsonSchema7[];
  anyOf?: JsonSchema7[];
  oneOf?: JsonSchema7[];
  not?: JsonSchema7;
  format?: string;
  readOnly?: boolean;
  writeOnly?: boolean;
  examples?: unknown[];
  contains?: JsonSchema7;
  propertyNames?: JsonSchema7;
  const?: unknown;
  if?: JsonSchema7;
  then?: JsonSchema7;
  else?: JsonSchema7;
}

// JSON Schema type string values
type JsonSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';

/**
 * Maps genai Type enum values to JSON Schema type strings.
 */
const GENAI_TO_JSON_SCHEMA_TYPE: Record<string, JsonSchemaType | undefined> = {
  [GenaiType.STRING]: 'string',
  [GenaiType.NUMBER]: 'number',
  [GenaiType.INTEGER]: 'integer',
  [GenaiType.BOOLEAN]: 'boolean',
  [GenaiType.ARRAY]: 'array',
  [GenaiType.OBJECT]: 'object',
  TYPE_UNSPECIFIED: undefined,
};

/**
 * Converts a @google/genai Schema to JSON Schema 7 format.
 *
 * Key conversions:
 * - Type enum values to JSON Schema type strings
 * - String numeric fields (minItems, maxItems, etc.) to numbers
 * - nullable: true to oneOf with null type
 * - Recursive conversion of properties and items
 *
 * @param genaiSchema - The genai Schema to convert
 * @returns JSON Schema 7 compatible object
 */
export function genaiSchemaToJsonSchema(genaiSchema: Schema): JsonSchema7 {
  const result: JsonSchema7 = {};

  // Handle nullable schemas using oneOf pattern
  if (genaiSchema.nullable && genaiSchema.type) {
    const baseType = GENAI_TO_JSON_SCHEMA_TYPE[genaiSchema.type];
    if (baseType) {
      // Build the non-null schema recursively but without nullable
      const nonNullSchema = genaiSchemaToJsonSchema({ ...genaiSchema, nullable: undefined });
      // Remove oneOf if it was added (to avoid nesting)
      delete nonNullSchema.oneOf;
      // Ensure the base type is set
      nonNullSchema.type = baseType;

      result.oneOf = [nonNullSchema, { type: 'null' }];
      return result;
    }
  }

  // Type enum conversion
  if (genaiSchema.type) {
    const jsonType = GENAI_TO_JSON_SCHEMA_TYPE[genaiSchema.type];
    if (jsonType) {
      result.type = jsonType;
    }
  }

  // Simple string fields
  if (genaiSchema.title) {
    result.title = genaiSchema.title;
  }
  if (genaiSchema.description) {
    result.description = genaiSchema.description;
  }
  if (genaiSchema.format) {
    result.format = genaiSchema.format;
  }
  if (genaiSchema.pattern) {
    result.pattern = genaiSchema.pattern;
  }

  // Default value
  if (genaiSchema.default !== undefined) {
    result.default = genaiSchema.default;
  }

  // Example (JSON Schema uses 'examples' array, but we'll preserve as default for now)
  // Note: genai uses 'example' (singular), JSON Schema uses 'examples' (plural array)

  // Numeric constraints (copy directly)
  if (genaiSchema.minimum !== undefined) {
    result.minimum = genaiSchema.minimum;
  }
  if (genaiSchema.maximum !== undefined) {
    result.maximum = genaiSchema.maximum;
  }

  // BigInt string fields to numbers (genai uses string, JSON Schema uses number)
  if (genaiSchema.minItems) {
    result.minItems = parseInt(genaiSchema.minItems, 10);
  }
  if (genaiSchema.maxItems) {
    result.maxItems = parseInt(genaiSchema.maxItems, 10);
  }
  if (genaiSchema.minLength) {
    result.minLength = parseInt(genaiSchema.minLength, 10);
  }
  if (genaiSchema.maxLength) {
    result.maxLength = parseInt(genaiSchema.maxLength, 10);
  }
  if (genaiSchema.minProperties) {
    result.minProperties = parseInt(genaiSchema.minProperties, 10);
  }
  if (genaiSchema.maxProperties) {
    result.maxProperties = parseInt(genaiSchema.maxProperties, 10);
  }

  // Array fields
  if (genaiSchema.enum && genaiSchema.enum.length > 0) {
    result.enum = [...genaiSchema.enum];
  }
  if (genaiSchema.required && genaiSchema.required.length > 0) {
    result.required = [...genaiSchema.required];
  }

  // Recursive: items (for arrays)
  if (genaiSchema.items) {
    result.items = genaiSchemaToJsonSchema(genaiSchema.items);
  }

  // Recursive: properties (for objects)
  if (genaiSchema.properties && Object.keys(genaiSchema.properties).length > 0) {
    result.properties = {};
    for (const [key, value] of Object.entries(genaiSchema.properties)) {
      result.properties[key] = genaiSchemaToJsonSchema(value);
    }
  }

  // Recursive: anyOf
  if (genaiSchema.anyOf && genaiSchema.anyOf.length > 0) {
    result.anyOf = genaiSchema.anyOf.map(genaiSchemaToJsonSchema);
  }

  return result;
}
