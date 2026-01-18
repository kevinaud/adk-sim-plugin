/**
 * JSONForms configuration for Angular Material renderers.
 *
 * This module provides a centralized configuration for JSONForms
 * with Angular Material renderers, ensuring consistent form rendering
 * across the control panel components.
 *
 * NOTE: This file re-exports base renderers for use by feature modules.
 * Child UI modules (tool-form, final-response) define their own renderers
 * inline to comply with Sheriff module boundary rules.
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
 * For components that need custom renderers (like AnyObjectRenderer),
 * they should define their own renderer array inline to comply with
 * Sheriff module boundaries.
 */
export { angularMaterialRenderers as jsonFormsRenderers } from '@jsonforms/angular-material';
