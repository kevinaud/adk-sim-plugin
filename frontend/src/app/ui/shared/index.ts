/**
 * Shared UI components module
 *
 * Cross-cutting UI components used across multiple features.
 * Includes: connection-status, split-pane, and other layout primitives.
 *
 * @module ui/shared
 * @see mddocs/frontend/frontend-tdd.md#folder-layout
 */

export { type ConnectionStatus, ConnectionStatusComponent } from './connection-status';

// Type for reference - components that will be added
export type SharedUiComponent = 'connection-status' | 'split-pane';
