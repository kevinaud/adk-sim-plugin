/**
 * Tool Conversion Utilities
 *
 * Converts between proto Tool/FunctionDeclaration/Schema types and @google/genai types.
 */

import type {
  Tool as ProtoTool,
  FunctionDeclaration as ProtoFunctionDeclaration,
  Schema as ProtoSchema,
} from '@adk-sim/protos';

import { Type as ProtoType } from '@adk-sim/protos';
import { Type as GenaiType } from '@google/genai';
import type { Tool, FunctionDeclaration, Schema } from '@google/genai';

import { copyDefinedFields, createProto } from './utils.js';

export type { Tool, FunctionDeclaration, Schema };

// Simple schema fields that copy directly (same name in proto and genai)
const SCHEMA_SIMPLE_FIELDS = [
  'format',
  'title',
  'description',
  'nullable',
  'pattern',
  'example',
  'minimum',
  'maximum',
] as const;

// Array fields that need shallow copy
const SCHEMA_ARRAY_FIELDS = ['enum', 'required', 'propertyOrdering'] as const;

// ============================================================================
// Proto Type <-> Genai Type Enum Conversion
// ============================================================================

const PROTO_TO_GENAI_TYPE: Record<ProtoType, Schema['type']> = {
  [ProtoType.TYPE_UNSPECIFIED]: undefined,
  [ProtoType.STRING]: GenaiType.STRING,
  [ProtoType.NUMBER]: GenaiType.NUMBER,
  [ProtoType.INTEGER]: GenaiType.INTEGER,
  [ProtoType.BOOLEAN]: GenaiType.BOOLEAN,
  [ProtoType.ARRAY]: GenaiType.ARRAY,
  [ProtoType.OBJECT]: GenaiType.OBJECT,
  [ProtoType.NULL]: undefined,
};

const GENAI_TO_PROTO_TYPE: Record<string, ProtoType> = {
  [GenaiType.STRING]: ProtoType.STRING,
  [GenaiType.NUMBER]: ProtoType.NUMBER,
  [GenaiType.INTEGER]: ProtoType.INTEGER,
  [GenaiType.BOOLEAN]: ProtoType.BOOLEAN,
  [GenaiType.ARRAY]: ProtoType.ARRAY,
  [GenaiType.OBJECT]: ProtoType.OBJECT,
};

// ============================================================================
// Proto -> Genai Conversion
// ============================================================================

export function protoToolToGenaiTool(protoTool: ProtoTool): Tool {
  const result: Tool = {};

  if (protoTool.functionDeclarations?.length) {
    result.functionDeclarations = protoTool.functionDeclarations.map(
      protoFunctionDeclarationToGenai,
    );
  }
  if (protoTool.codeExecution) result.codeExecution = {};
  if (protoTool.googleSearch) result.googleSearch = {};
  if (protoTool.googleSearchRetrieval) result.googleSearchRetrieval = {};

  return result;
}

export function protoFunctionDeclarationToGenai(
  protoFd: ProtoFunctionDeclaration,
): FunctionDeclaration {
  const result: FunctionDeclaration = {};

  if (protoFd.name) result.name = protoFd.name;
  if (protoFd.description) result.description = protoFd.description;
  if (protoFd.parameters) result.parameters = protoSchemaToGenaiSchema(protoFd.parameters);
  if (protoFd.parametersJsonSchema) result.parametersJsonSchema = protoFd.parametersJsonSchema;
  if (protoFd.response) result.response = protoSchemaToGenaiSchema(protoFd.response);
  if (protoFd.responseJsonSchema) result.responseJsonSchema = protoFd.responseJsonSchema;

  return result;
}

export function protoSchemaToGenaiSchema(proto: ProtoSchema): Schema {
  const result: Schema = {};

  // Type enum conversion
  if (proto.type !== undefined && proto.type !== ProtoType.TYPE_UNSPECIFIED) {
    result.type = PROTO_TO_GENAI_TYPE[proto.type];
  }

  // Simple fields
  copyDefinedFields(proto, result, [...SCHEMA_SIMPLE_FIELDS]);

  // Array fields (copy if non-empty)
  for (const field of SCHEMA_ARRAY_FIELDS) {
    const arr = proto[field];
    if (arr?.length) {
      (result as Record<string, unknown>)[field] = [...arr];
    }
  }

  // BigInt fields -> string (only if non-zero)
  if (proto.minItems && proto.minItems !== 0n) result.minItems = proto.minItems.toString();
  if (proto.maxItems && proto.maxItems !== 0n) result.maxItems = proto.maxItems.toString();
  if (proto.minProperties && proto.minProperties !== 0n)
    result.minProperties = proto.minProperties.toString();
  if (proto.maxProperties && proto.maxProperties !== 0n)
    result.maxProperties = proto.maxProperties.toString();
  if (proto.minLength && proto.minLength !== 0n) result.minLength = proto.minLength.toString();
  if (proto.maxLength && proto.maxLength !== 0n) result.maxLength = proto.maxLength.toString();

  // Recursive fields
  if (proto.items) result.items = protoSchemaToGenaiSchema(proto.items);
  if (proto.anyOf?.length) result.anyOf = proto.anyOf.map(protoSchemaToGenaiSchema);
  if (proto.properties && Object.keys(proto.properties).length) {
    result.properties = {};
    for (const [k, v] of Object.entries(proto.properties)) {
      result.properties[k] = protoSchemaToGenaiSchema(v);
    }
  }

  return result;
}

// ============================================================================
// Genai -> Proto Conversion
// ============================================================================

export function genaiToolToProtoTool(genaiTool: Tool): ProtoTool {
  const result = createProto<ProtoTool>('google.ai.generativelanguage.v1beta.Tool', {
    functionDeclarations: [],
  });

  if (genaiTool.functionDeclarations?.length) {
    result.functionDeclarations = genaiTool.functionDeclarations.map(
      genaiFunctionDeclarationToProto,
    );
  }
  if (genaiTool.codeExecution) {
    result.codeExecution = {
      $typeName: 'google.ai.generativelanguage.v1beta.CodeExecution',
    } as ProtoTool['codeExecution'];
  }
  if (genaiTool.googleSearch) {
    result.googleSearch = {
      $typeName: 'google.ai.generativelanguage.v1beta.Tool.GoogleSearch',
    } as ProtoTool['googleSearch'];
  }
  if (genaiTool.googleSearchRetrieval) {
    result.googleSearchRetrieval = {
      $typeName: 'google.ai.generativelanguage.v1beta.GoogleSearchRetrieval',
    } as ProtoTool['googleSearchRetrieval'];
  }

  return result;
}

export function genaiFunctionDeclarationToProto(fd: FunctionDeclaration): ProtoFunctionDeclaration {
  const result: Partial<ProtoFunctionDeclaration> = {
    $typeName: 'google.ai.generativelanguage.v1beta.FunctionDeclaration',
    name: fd.name ?? '',
    description: fd.description ?? '',
    behavior: 0,
  };

  if (fd.parameters) result.parameters = genaiSchemaToProtoSchema(fd.parameters);
  if (fd.parametersJsonSchema)
    result.parametersJsonSchema =
      fd.parametersJsonSchema as ProtoFunctionDeclaration['parametersJsonSchema'];
  if (fd.response) result.response = genaiSchemaToProtoSchema(fd.response);
  if (fd.responseJsonSchema)
    result.responseJsonSchema =
      fd.responseJsonSchema as ProtoFunctionDeclaration['responseJsonSchema'];

  return result as ProtoFunctionDeclaration;
}

export function genaiSchemaToProtoSchema(genai: Schema): ProtoSchema {
  const result: Partial<ProtoSchema> = {
    $typeName: 'google.ai.generativelanguage.v1beta.Schema',
    type: genai.type
      ? (GENAI_TO_PROTO_TYPE[genai.type] ?? ProtoType.TYPE_UNSPECIFIED)
      : ProtoType.TYPE_UNSPECIFIED,
    format: genai.format ?? '',
    title: genai.title ?? '',
    description: genai.description ?? '',
    nullable: genai.nullable ?? false,
    enum: genai.enum ?? [],
    required: genai.required ?? [],
    pattern: genai.pattern ?? '',
    anyOf: [],
    propertyOrdering: genai.propertyOrdering ?? [],
    // BigInt fields
    minItems: genai.minItems ? BigInt(genai.minItems) : 0n,
    maxItems: genai.maxItems ? BigInt(genai.maxItems) : 0n,
    minProperties: genai.minProperties ? BigInt(genai.minProperties) : 0n,
    maxProperties: genai.maxProperties ? BigInt(genai.maxProperties) : 0n,
    minLength: genai.minLength ? BigInt(genai.minLength) : 0n,
    maxLength: genai.maxLength ? BigInt(genai.maxLength) : 0n,
    minimum: genai.minimum,
    maximum: genai.maximum,
    example: genai.example as ProtoSchema['example'],
    properties: {},
  };

  // Recursive fields
  if (genai.items) result.items = genaiSchemaToProtoSchema(genai.items);
  if (genai.anyOf?.length) result.anyOf = genai.anyOf.map(genaiSchemaToProtoSchema);
  if (genai.properties) {
    result.properties = {};
    for (const [k, v] of Object.entries(genai.properties)) {
      result.properties[k] = genaiSchemaToProtoSchema(v);
    }
  }

  return result as ProtoSchema;
}
