/**
 * Control Panel UI components module
 *
 * Components for the simulation control panel, including:
 * - Control panel container for orchestrating response construction
 * - Tool catalog for browsing available tools
 * - Tool forms for invoking tools with parameters
 * - Final response input for completing simulations
 *
 * @module ui/control-panel
 * @see mddocs/frontend/frontend-tdd.md#control-panel-components
 */

export {
  ControlPanelComponent,
  FORM_CONFIG_CREATOR,
  type FormConfigCreator,
  type SessionStatusType,
} from './control-panel';
export { FinalResponseComponent } from './final-response';
export { jsonFormsRenderers } from './jsonforms.config';
export { ToolCatalogComponent } from './tool-catalog';
export type { ToolFormConfig, ToolInvokeEvent } from './tool-form';
export { ToolFormComponent } from './tool-form';
