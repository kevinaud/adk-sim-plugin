/**
 * @fileoverview Type definitions for the ToolFormComponent.
 *
 * Defines the configuration interface for JSONForms-based tool invocation forms.
 * This is a "dumb" component pattern - the parent is responsible for converting
 * FunctionDeclaration to ToolFormConfig using ToolFormService.
 *
 * NOTE: ToolFormConfig is intentionally defined here separately from the
 * data-access layer version. This maintains Sheriff module boundary compliance
 * (type:ui cannot import from type:data-access). Both definitions are identical
 * and serve as the contract between layers.
 *
 * @see mddocs/frontend/research/jsonforms-research.md#use-case-tool-invocation-forms
 * @see mddocs/frontend/frontend-tdd.md#toolformcomponent-jsonforms
 */

import type { JsonSchema7, UISchemaElement } from '@jsonforms/core';

/**
 * Configuration for rendering a tool invocation form.
 *
 * This interface represents the data required to render a dynamic form
 * for invoking a tool. It decouples the component from the schema conversion
 * logic, following the "dumb component" pattern.
 *
 * @example
 * ```typescript
 * const config: ToolFormConfig = {
 *   schema: {
 *     type: 'object',
 *     properties: {
 *       query: { type: 'string', description: 'Search query' },
 *       maxResults: { type: 'integer', minimum: 1 }
 *     },
 *     required: ['query']
 *   },
 *   uischema: generateDefaultUISchema(schema),
 *   toolName: 'search_tool',
 *   toolDescription: 'Search for items in the catalog'
 * };
 * ```
 */
export interface ToolFormConfig {
  /**
   * JSON Schema defining the form structure and validation rules.
   * Converted from genai Schema via genaiSchemaToJsonSchema().
   */
  readonly schema: JsonSchema7;

  /**
   * UI Schema defining the layout and control options.
   * Typically generated via generateDefaultUISchema().
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

/**
 * Output event payload when a tool is invoked.
 *
 * Emitted by ToolFormComponent when the user submits the form.
 */
export interface ToolInvokeEvent {
  /**
   * The name of the tool being invoked.
   */
  readonly toolName: string;

  /**
   * The arguments for the tool invocation, as entered by the user.
   * Type is unknown because the structure depends on the tool's schema.
   */
  readonly args: unknown;
}
