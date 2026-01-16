/**
 * JSONForms configuration for Angular Material renderers.
 *
 * This module provides a centralized configuration for JSONForms
 * with Angular Material renderers, ensuring consistent form rendering
 * across the control panel components.
 *
 * Usage:
 * ```typescript
 * import { jsonFormsRenderers } from '@app/ui/control-panel/jsonforms.config';
 *
 * @Component({
 *   template: `
 *     <jsonforms
 *       [schema]="schema"
 *       [renderers]="renderers"
 *       ...
 *     />
 *   `
 * })
 * export class MyFormComponent {
 *   readonly renderers = jsonFormsRenderers;
 * }
 * ```
 *
 * @see https://jsonforms.io/docs/integrations/angular
 * @see mddocs/frontend/research/jsonforms-research.md
 */

/**
 * Pre-configured Angular Material renderers for JSONForms.
 *
 * Includes built-in renderers for:
 * - Text inputs (string)
 * - Number inputs (integer, number)
 * - Checkboxes (boolean)
 * - Autocomplete dropdowns (enum)
 * - Nested object forms (object)
 * - Dynamic array lists (array)
 *
 * Can be extended with custom renderers by spreading:
 * ```typescript
 * import { jsonFormsRenderers } from '@app/ui/control-panel';
 *
 * const customRenderers = [
 *   ...jsonFormsRenderers,
 *   { tester: customTester, renderer: CustomRendererComponent },
 * ];
 * ```
 */
export { angularMaterialRenderers as jsonFormsRenderers } from '@jsonforms/angular-material';
