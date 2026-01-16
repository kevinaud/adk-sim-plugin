/**
 * Shared UI components module
 *
 * Cross-cutting UI components used across multiple features.
 * Includes: connection-status, error-banner, split-pane, and other layout primitives.
 *
 * @module ui/shared
 * @see mddocs/frontend/frontend-tdd.md#folder-layout
 */

export { type ConnectionStatus, ConnectionStatusComponent } from './connection-status';
export { DarkModeToggleComponent } from './dark-mode-toggle';
export { ErrorBannerComponent } from './error-banner';

// Type for reference - components that will be added
export type SharedUiComponent =
  | 'connection-status'
  | 'dark-mode-toggle'
  | 'error-banner'
  | 'split-pane';
