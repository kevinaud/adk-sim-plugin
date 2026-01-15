/**
 * @fileoverview E2E test utilities barrel export.
 *
 * Provides shared utilities for Playwright E2E tests including:
 * - Multi-backend test fixtures for named backend instances
 * - Custom test fixtures with automatic error capture
 * - Angular-specific helpers
 * - Browser error detection utilities
 *
 * ## Multi-Backend Testing
 *
 * Tests can target different backend instances:
 * - `no-sessions` (8081): Always empty, for empty state tests
 * - `populated` (8082): Pre-seeded with sessions, for stable visual tests
 * - `shared` (8080): Allows session creation, default for session-specific tests
 *
 * @example
 * ```typescript
 * // Default: uses 'shared' backend with client fixture
 * import { expect, test } from './utils';
 *
 * test('my test', async ({ page, client, gotoAndWaitForAngular }) => {
 *   const { session } = await client.createSession({ description: 'Test' });
 *   await gotoAndWaitForAngular('/');
 *   await expect(page.locator('app-root')).toBeVisible();
 * });
 *
 * // Use specific backend
 * test.describe('Empty State', () => {
 *   test.use({ backend: 'no-sessions' });
 *
 *   test('shows empty list', async ({ page }) => {
 *     // This backend is guaranteed empty
 *   });
 * });
 * ```
 */

// Multi-backend test fixtures - the primary test interface
export {
  expect,
  test,
  type BackendName,
  type SimulatorClient,
} from './multi-backend-fixtures';

// Angular-specific helpers
export { waitForAngularApp, waitForAngularStable } from './angular-helpers';

// Browser error utilities (for custom setups)
export {
  assertNoBrowserErrors,
  type BrowserLogs,
  setupBrowserErrorCapture,
} from './browser-errors';

// gRPC client factory for test setup
export { createTestClient } from './grpc-client';

// Backend configuration (for advanced use cases)
export {
  BACKENDS,
  type BackendConfig,
  DEFAULT_BACKEND,
  E2E_COMPOSE_FILE,
  getBackendUrl,
  getGrpcUrl,
  getServiceName,
} from './backend-config';
