/**
 * @fileoverview E2E test utilities barrel export.
 *
 * Provides shared utilities for Playwright E2E tests including:
 * - Custom test fixtures with automatic error capture
 * - Angular-specific helpers
 * - Browser error detection utilities
 *
 * @example
 * ```typescript
 * // Use the extended test fixture (recommended)
 * import { expect, test } from './utils';
 *
 * test('my test', async ({ page, gotoAndWaitForAngular }) => {
 *   await gotoAndWaitForAngular('/');
 *   await expect(page.locator('app-root')).toBeVisible();
 * });
 * ```
 */

// Custom test fixtures - use these instead of @playwright/test
export { expect, test } from './fixtures';

// Angular-specific helpers
export { waitForAngularApp, waitForAngularStable } from './angular-helpers';

// Browser error utilities (for custom setups)
export {
  assertNoBrowserErrors,
  type BrowserLogs,
  setupBrowserErrorCapture,
} from './browser-errors';
