/**
 * @fileoverview Service for converting FunctionDeclaration to JSONForms configuration.
 *
 * The ToolFormService bridges the gap between tool definitions (FunctionDeclaration)
 * and the JSONForms library by converting parameters to JSON Schema format and
 * generating appropriate UI schemas.
 *
 * @see mddocs/frontend/frontend-tdd.md#toolformservice-schema-conversion
 * @see mddocs/frontend/research/jsonforms-research.md#implementation
 */

import {
  type FunctionDeclaration,
  genaiSchemaToJsonSchema,
  protoSchemaToGenaiSchema,
  type Schema as GenaiSchema,
} from '@adk-sim/converters';
import {
  type FunctionDeclaration as ProtoFunctionDeclaration,
  type Schema as ProtoSchema,
} from '@adk-sim/protos';
import { Injectable } from '@angular/core';
import { generateDefaultUISchema, type JsonSchema7 } from '@jsonforms/core';

import type { ToolFormConfig } from './tool-form.types';

/**
 * Service for converting FunctionDeclaration to JSONForms configuration.
 *
 * This service handles three parameter scenarios:
 * 1. `parametersJsonSchema` field is present - use directly as JSON Schema
 * 2. `parameters` field is present - convert via genaiSchemaToJsonSchema
 * 3. Neither is present - use empty object schema
 *
 * @example
 * ```typescript
 * const service = inject(ToolFormService);
 * const config = service.createFormConfig(functionDeclaration);
 *
 * // Use config with JSONForms
 * <jsonforms
 *   [schema]="config.schema"
 *   [uischema]="config.uischema"
 *   ...
 * />
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ToolFormService {
  /**
   * Creates a JSONForms configuration from a tool's FunctionDeclaration.
   *
   * Accepts either:
   * - Proto FunctionDeclaration (from @adk-sim/protos) - parameters are proto Schema
   * - Genai FunctionDeclaration (from @google/genai) - parameters are genai Schema
   *
   * @param tool - The FunctionDeclaration from the tool definition
   * @returns ToolFormConfig object ready for use with JSONForms
   */
  createFormConfig(tool: FunctionDeclaration | ProtoFunctionDeclaration): ToolFormConfig {
    const schema = this.extractJsonSchema(tool);

    return {
      schema,
      uischema: generateDefaultUISchema(schema),
      toolName: tool.name ?? '',
      toolDescription: tool.description ?? '',
    };
  }

  /**
   * Extracts JSON Schema from a FunctionDeclaration, handling both
   * proto and genai FunctionDeclaration types.
   *
   * @param tool - The FunctionDeclaration to extract schema from
   * @returns JSON Schema 7 object for JSONForms
   */
  private extractJsonSchema(tool: FunctionDeclaration | ProtoFunctionDeclaration): JsonSchema7 {
    // Case 1: Tool provides JSON Schema directly via parametersJsonSchema
    if (tool.parametersJsonSchema) {
      return tool.parametersJsonSchema as JsonSchema7;
    }

    // Case 2: Tool uses Schema format - need to determine if proto or genai Schema
    if (tool.parameters) {
      // Check if this is a proto Schema by looking for bufbuild markers:
      // 1. $typeName property (may be non-enumerable)
      // 2. type field is a number (proto enum) vs string (genai)
      const params = tool.parameters as Record<string, unknown>;
      const hasTypeName =
        '$typeName' in params || Object.prototype.hasOwnProperty.call(params, '$typeName');
      const typeIsNumber = typeof params['type'] === 'number';
      const isProtoSchema = hasTypeName || typeIsNumber;

      // Proto Schema needs conversion to genai first; genai Schema used directly
      const genaiSchema: GenaiSchema = isProtoSchema
        ? protoSchemaToGenaiSchema(tool.parameters as ProtoSchema)
        : (tool.parameters as GenaiSchema);

      return genaiSchemaToJsonSchema(genaiSchema);
    }

    // Case 3: No parameters defined - return empty object schema
    return {
      type: 'object',
      properties: {},
    };
  }
}
