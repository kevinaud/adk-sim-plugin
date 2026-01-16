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

import { type FunctionDeclaration, genaiSchemaToJsonSchema } from '@adk-sim/converters';
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
   * @param tool - The FunctionDeclaration from the tool definition
   * @returns ToolFormConfig object ready for use with JSONForms
   */
  createFormConfig(tool: FunctionDeclaration): ToolFormConfig {
    const schema = this.extractJsonSchema(tool);

    return {
      schema,
      uischema: generateDefaultUISchema(schema),
      toolName: tool.name ?? '',
      toolDescription: tool.description ?? '',
    };
  }

  /**
   * Extracts JSON Schema from a FunctionDeclaration, handling the three
   * possible parameter field configurations.
   *
   * @param tool - The FunctionDeclaration to extract schema from
   * @returns JSON Schema 7 object for JSONForms
   */
  private extractJsonSchema(tool: FunctionDeclaration): JsonSchema7 {
    // Case 1: Tool provides JSON Schema directly via parametersJsonSchema
    if (tool.parametersJsonSchema) {
      return tool.parametersJsonSchema as JsonSchema7;
    }

    // Case 2: Tool uses genai Schema format - convert to JSON Schema
    if (tool.parameters) {
      return genaiSchemaToJsonSchema(tool.parameters);
    }

    // Case 3: No parameters defined - return empty object schema
    return {
      type: 'object',
      properties: {},
    };
  }
}
