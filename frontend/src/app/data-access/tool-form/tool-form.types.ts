/**
 * @fileoverview Types for ToolFormService and JSONForms integration.
 *
 * Defines the ToolFormConfig interface that bridges FunctionDeclaration
 * parameters to JSONForms configuration.
 *
 * @see mddocs/frontend/frontend-tdd.md#toolformservice-schema-conversion
 * @see mddocs/frontend/research/jsonforms-research.md#use-case-tool-invocation-forms
 */

import type { JsonSchema7, UISchemaElement } from '@jsonforms/core';

/**
 * Configuration object for rendering a tool invocation form with JSONForms.
 *
 * This interface bridges the gap between proto-based FunctionDeclaration
 * and the JSONForms library requirements.
 *
 * @example
 * ```typescript
 * const config: ToolFormConfig = {
 *   schema: { type: 'object', properties: { query: { type: 'string' } } },
 *   uischema: { type: 'VerticalLayout', elements: [...] },
 *   toolName: 'search',
 *   toolDescription: 'Search the web for information',
 * };
 * ```
 */
export interface ToolFormConfig {
  /**
   * JSON Schema 7 defining the form data structure and validation rules.
   * Used by JSONForms to generate form controls.
   */
  readonly schema: JsonSchema7;

  /**
   * UI Schema defining the form layout and presentation.
   * Generated automatically via `generateDefaultUISchema()`.
   */
  readonly uischema: UISchemaElement;

  /**
   * The name of the tool being invoked.
   * Displayed in the form header.
   */
  readonly toolName: string;

  /**
   * Description of the tool's purpose.
   * Displayed below the form header.
   */
  readonly toolDescription: string;
}
