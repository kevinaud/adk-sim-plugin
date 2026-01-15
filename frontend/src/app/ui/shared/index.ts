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
export { EmptyStateComponent } from './empty-state';
export { ErrorBannerComponent } from './error-banner';
export { LoadingStateComponent } from './loading-state';

// Type for reference - components that will be added
export type SharedUiComponent =
  | 'connection-status'
  | 'empty-state'
  | 'error-banner'
  | 'loading-state'
  | 'split-pane';
