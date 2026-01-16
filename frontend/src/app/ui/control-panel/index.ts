/**
 * Control Panel UI components module
 *
 * Components for the simulation control panel, including:
 * - Tool catalog for browsing available tools
 * - Tool forms for invoking tools with parameters
 * - Final response input for completing simulations
 *
 * @module ui/control-panel
 * @see mddocs/frontend/frontend-tdd.md#control-panel-components
 */

export { jsonFormsRenderers } from './jsonforms.config';
export type { ToolFormConfig, ToolInvokeEvent } from './tool-form';
export { ToolFormComponent } from './tool-form';
