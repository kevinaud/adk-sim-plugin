/**
 * Tool Conversion Utilities
 *
 * Converts between proto Tool/FunctionDeclaration types and @google/genai types.
 * Includes support for nested Schema objects used for function parameters.
 *
 * Note: We use the "Proto" prefix for proto types to distinguish them from SDK types.
 */

import type {
  Tool as ProtoTool,
  FunctionDeclaration as ProtoFunctionDeclaration,
  Schema as ProtoSchema,
} from '@adk-sim/protos';

import { Type as ProtoType } from '@adk-sim/protos';

import {
  Type as GenaiType,
} from '@google/genai';

import type {
  Tool,
  FunctionDeclaration,
  Schema,
} from '@google/genai';

// Re-export types for consumers
export type { Tool, FunctionDeclaration, Schema };

// ============================================================================
// Proto → @google/genai Conversion
// ============================================================================

/**
 * Convert a proto Tool message to @google/genai Tool.
 *
 * @param protoTool - The proto Tool message
 * @returns @google/genai Tool object
 *
 * @example
 * ```typescript
 * const tool = protoToolToGenaiTool(protoTool);
 * console.log(tool.functionDeclarations?.[0].name);
 * ```
 */
export function protoToolToGenaiTool(protoTool: ProtoTool): Tool {
  const result: Tool = {};

  // Function declarations
  if (protoTool.functionDeclarations && protoTool.functionDeclarations.length > 0) {
    result.functionDeclarations = protoTool.functionDeclarations.map(
      protoFunctionDeclarationToGenai
    );
  }

  // Code execution (optional)
  if (protoTool.codeExecution) {
    result.codeExecution = {};
  }

  // Google Search (optional) - simplified mapping
  if (protoTool.googleSearch) {
    result.googleSearch = {};
  }

  // Google Search Retrieval (optional)
  if (protoTool.googleSearchRetrieval) {
    result.googleSearchRetrieval = {};
  }

  return result;
}

/**
 * Convert a proto FunctionDeclaration to @google/genai FunctionDeclaration.
 *
 * @param protoFd - The proto FunctionDeclaration message
 * @returns @google/genai FunctionDeclaration object
 */
export function protoFunctionDeclarationToGenai(
  protoFd: ProtoFunctionDeclaration
): FunctionDeclaration {
  const result: FunctionDeclaration = {};

  // Name (required in proto, optional in SDK)
  if (protoFd.name) {
    result.name = protoFd.name;
  }

  // Description
  if (protoFd.description) {
    result.description = protoFd.description;
  }

  // Parameters (proto Schema format)
  if (protoFd.parameters) {
    result.parameters = protoSchemaToGenaiSchema(protoFd.parameters);
  }

  // Parameters JSON Schema (alternative format)
  if (protoFd.parametersJsonSchema) {
    result.parametersJsonSchema = protoFd.parametersJsonSchema;
  }

  // Response schema
  if (protoFd.response) {
    result.response = protoSchemaToGenaiSchema(protoFd.response);
  }

  // Response JSON schema
  if (protoFd.responseJsonSchema) {
    result.responseJsonSchema = protoFd.responseJsonSchema;
  }

  return result;
}

/**
 * Convert a proto Schema to @google/genai Schema.
 * This is a recursive function that handles nested schema objects.
 *
 * @param protoSchema - The proto Schema message
 * @returns @google/genai Schema object
 */
export function protoSchemaToGenaiSchema(protoSchema: ProtoSchema): Schema {
  const result: Schema = {};

  // Type - convert from proto enum to SDK type enum
  if (protoSchema.type !== undefined && protoSchema.type !== ProtoType.TYPE_UNSPECIFIED) {
    result.type = protoTypeToGenaiType(protoSchema.type);
  }

  // Format
  if (protoSchema.format) {
    result.format = protoSchema.format;
  }

  // Title
  if (protoSchema.title) {
    result.title = protoSchema.title;
  }

  // Description
  if (protoSchema.description) {
    result.description = protoSchema.description;
  }

  // Nullable
  if (protoSchema.nullable) {
    result.nullable = protoSchema.nullable;
  }

  // Enum values
  if (protoSchema.enum && protoSchema.enum.length > 0) {
    result.enum = [...protoSchema.enum];
  }

  // Items (for arrays) - recursive
  if (protoSchema.items) {
    result.items = protoSchemaToGenaiSchema(protoSchema.items);
  }

  // Properties (for objects) - recursive
  if (protoSchema.properties && Object.keys(protoSchema.properties).length > 0) {
    result.properties = {};
    for (const [key, value] of Object.entries(protoSchema.properties)) {
      result.properties[key] = protoSchemaToGenaiSchema(value);
    }
  }

  // Required fields
  if (protoSchema.required && protoSchema.required.length > 0) {
    result.required = [...protoSchema.required];
  }

  // Min/max items (for arrays)
  if (protoSchema.minItems !== undefined && protoSchema.minItems !== 0n) {
    result.minItems = protoSchema.minItems.toString();
  }
  if (protoSchema.maxItems !== undefined && protoSchema.maxItems !== 0n) {
    result.maxItems = protoSchema.maxItems.toString();
  }

  // Min/max properties (for objects)
  if (protoSchema.minProperties !== undefined && protoSchema.minProperties !== 0n) {
    result.minProperties = protoSchema.minProperties.toString();
  }
  if (protoSchema.maxProperties !== undefined && protoSchema.maxProperties !== 0n) {
    result.maxProperties = protoSchema.maxProperties.toString();
  }

  // Min/max values (for numbers/integers)
  if (protoSchema.minimum !== undefined) {
    result.minimum = protoSchema.minimum;
  }
  if (protoSchema.maximum !== undefined) {
    result.maximum = protoSchema.maximum;
  }

  // Min/max length (for strings)
  if (protoSchema.minLength !== undefined && protoSchema.minLength !== 0n) {
    result.minLength = protoSchema.minLength.toString();
  }
  if (protoSchema.maxLength !== undefined && protoSchema.maxLength !== 0n) {
    result.maxLength = protoSchema.maxLength.toString();
  }

  // Pattern (for strings)
  if (protoSchema.pattern) {
    result.pattern = protoSchema.pattern;
  }

  // Example
  if (protoSchema.example) {
    result.example = protoSchema.example;
  }

  // anyOf (for union types) - recursive
  if (protoSchema.anyOf && protoSchema.anyOf.length > 0) {
    result.anyOf = protoSchema.anyOf.map(protoSchemaToGenaiSchema);
  }

  // Property ordering
  if (protoSchema.propertyOrdering && protoSchema.propertyOrdering.length > 0) {
    result.propertyOrdering = [...protoSchema.propertyOrdering];
  }

  return result;
}

/**
 * Convert proto Type enum to @google/genai Type enum.
 */
function protoTypeToGenaiType(protoType: ProtoType): Schema['type'] {
  switch (protoType) {
    case ProtoType.STRING:
      return GenaiType.STRING;
    case ProtoType.NUMBER:
      return GenaiType.NUMBER;
    case ProtoType.INTEGER:
      return GenaiType.INTEGER;
    case ProtoType.BOOLEAN:
      return GenaiType.BOOLEAN;
    case ProtoType.ARRAY:
      return GenaiType.ARRAY;
    case ProtoType.OBJECT:
      return GenaiType.OBJECT;
    case ProtoType.NULL:
      return undefined; // SDK doesn't have explicit NULL type
    case ProtoType.TYPE_UNSPECIFIED:
    default:
      return undefined;
  }
}

// ============================================================================
// @google/genai → Proto Conversion
// ============================================================================

/**
 * Convert @google/genai Tool to proto Tool message.
 *
 * @param genaiTool - The @google/genai Tool object
 * @returns Proto Tool message
 *
 * @example
 * ```typescript
 * const proto = genaiToolToProtoTool({
 *   functionDeclarations: [{ name: 'get_weather', description: 'Get weather' }]
 * });
 * ```
 */
export function genaiToolToProtoTool(genaiTool: Tool): ProtoTool {
  const result: ProtoTool = {
    $typeName: 'google.ai.generativelanguage.v1beta.Tool',
    functionDeclarations: [],
  } as ProtoTool;

  // Function declarations
  if (genaiTool.functionDeclarations && genaiTool.functionDeclarations.length > 0) {
    result.functionDeclarations = genaiTool.functionDeclarations.map(
      genaiFunctionDeclarationToProto
    );
  }

  // Code execution
  if (genaiTool.codeExecution) {
    result.codeExecution = {
      $typeName: 'google.ai.generativelanguage.v1beta.CodeExecution',
    } as ProtoTool['codeExecution'];
  }

  // Google Search
  if (genaiTool.googleSearch) {
    result.googleSearch = {
      $typeName: 'google.ai.generativelanguage.v1beta.Tool.GoogleSearch',
    } as ProtoTool['googleSearch'];
  }

  // Google Search Retrieval
  if (genaiTool.googleSearchRetrieval) {
    result.googleSearchRetrieval = {
      $typeName: 'google.ai.generativelanguage.v1beta.GoogleSearchRetrieval',
    } as ProtoTool['googleSearchRetrieval'];
  }

  return result;
}

/**
 * Convert @google/genai FunctionDeclaration to proto FunctionDeclaration.
 *
 * @param genaiFd - The @google/genai FunctionDeclaration object
 * @returns Proto FunctionDeclaration message
 */
export function genaiFunctionDeclarationToProto(
  genaiFd: FunctionDeclaration
): ProtoFunctionDeclaration {
  const result: Partial<ProtoFunctionDeclaration> = {
    $typeName: 'google.ai.generativelanguage.v1beta.FunctionDeclaration',
    name: genaiFd.name ?? '',
    description: genaiFd.description ?? '',
    behavior: 0, // UNSPECIFIED
  };

  // Parameters (Schema format)
  if (genaiFd.parameters) {
    result.parameters = genaiSchemaToProtoSchema(genaiFd.parameters);
  }

  // Parameters JSON schema
  if (genaiFd.parametersJsonSchema) {
    result.parametersJsonSchema = genaiFd.parametersJsonSchema as ProtoFunctionDeclaration['parametersJsonSchema'];
  }

  // Response schema
  if (genaiFd.response) {
    result.response = genaiSchemaToProtoSchema(genaiFd.response);
  }

  // Response JSON schema
  if (genaiFd.responseJsonSchema) {
    result.responseJsonSchema = genaiFd.responseJsonSchema as ProtoFunctionDeclaration['responseJsonSchema'];
  }

  return result as ProtoFunctionDeclaration;
}

/**
 * Convert @google/genai Schema to proto Schema.
 * This is a recursive function that handles nested schema objects.
 *
 * @param genaiSchema - The @google/genai Schema object
 * @returns Proto Schema message
 */
export function genaiSchemaToProtoSchema(genaiSchema: Schema): ProtoSchema {
  const result: Partial<ProtoSchema> = {
    $typeName: 'google.ai.generativelanguage.v1beta.Schema',
    type: genaiTypeToProtoType(genaiSchema.type),
    format: genaiSchema.format ?? '',
    title: genaiSchema.title ?? '',
    description: genaiSchema.description ?? '',
    nullable: genaiSchema.nullable ?? false,
    enum: genaiSchema.enum ?? [],
    required: genaiSchema.required ?? [],
    pattern: genaiSchema.pattern ?? '',
    anyOf: [],
    propertyOrdering: genaiSchema.propertyOrdering ?? [],
    // BigInt fields default to 0n
    minItems: genaiSchema.minItems ? BigInt(genaiSchema.minItems) : 0n,
    maxItems: genaiSchema.maxItems ? BigInt(genaiSchema.maxItems) : 0n,
    minProperties: genaiSchema.minProperties ? BigInt(genaiSchema.minProperties) : 0n,
    maxProperties: genaiSchema.maxProperties ? BigInt(genaiSchema.maxProperties) : 0n,
    minLength: genaiSchema.minLength ? BigInt(genaiSchema.minLength) : 0n,
    maxLength: genaiSchema.maxLength ? BigInt(genaiSchema.maxLength) : 0n,
    // Optional number fields
    minimum: genaiSchema.minimum,
    maximum: genaiSchema.maximum,
    // Example
    example: genaiSchema.example as ProtoSchema['example'],
    // Object properties
    properties: {},
  };

  // Items (for arrays) - recursive
  if (genaiSchema.items) {
    result.items = genaiSchemaToProtoSchema(genaiSchema.items);
  }

  // Properties (for objects) - recursive
  if (genaiSchema.properties) {
    result.properties = {};
    for (const [key, value] of Object.entries(genaiSchema.properties)) {
      result.properties[key] = genaiSchemaToProtoSchema(value);
    }
  }

  // anyOf (for union types) - recursive
  if (genaiSchema.anyOf && genaiSchema.anyOf.length > 0) {
    result.anyOf = genaiSchema.anyOf.map(genaiSchemaToProtoSchema);
  }

  return result as ProtoSchema;
}

/**
 * Convert @google/genai Type enum to proto Type enum.
 */
function genaiTypeToProtoType(genaiType: Schema['type']): ProtoType {
  switch (genaiType) {
    case GenaiType.STRING:
      return ProtoType.STRING;
    case GenaiType.NUMBER:
      return ProtoType.NUMBER;
    case GenaiType.INTEGER:
      return ProtoType.INTEGER;
    case GenaiType.BOOLEAN:
      return ProtoType.BOOLEAN;
    case GenaiType.ARRAY:
      return ProtoType.ARRAY;
    case GenaiType.OBJECT:
      return ProtoType.OBJECT;
    default:
      return ProtoType.TYPE_UNSPECIFIED;
  }
}
