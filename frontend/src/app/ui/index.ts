/**
 * UI module - reusable presentational components
 *
 * UI components are stateless/presentational and should not depend on data-access.
 * They receive data via inputs and emit events via outputs.
 *
 * Import UI components from their domain barrel exports:
 * - `ui/event-stream` - Event stream components (EventStreamComponent)
 * - `ui/shared` - Shared UI components (ConnectionStatusComponent)
 *
 * Note: Due to Sheriff module boundaries, direct re-exports are not used here.
 * Consumers should import from specific domain modules.
 *
 * @module ui
 * @see mddocs/frontend/frontend-tdd.md#folder-layout
 */

// Domain type for reference
export type UiDomain = 'event-stream' | 'control-panel' | 'session' | 'shared';
