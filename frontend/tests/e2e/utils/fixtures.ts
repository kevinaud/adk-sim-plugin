/**
 * @fileoverview Custom Playwright test fixtures for Angular E2E tests.
 *
 * Extends the base Playwright test with automatic browser error capture
 * and Angular-specific utilities. Use this instead of the base `test`
 * import for Angular E2E tests.
 *
 * @example
 * ```typescript
 * import { expect, test } from './utils/fixtures';
 *
 * test('loads the app', async ({ page, browserLogs }) => {
 *   await page.goto('/');
 *   // browserLogs is automatically set up and checked in afterEach
 *   await expect(page.locator('app-root')).toBeVisible();
 * });
 * ```
 */

import { test as base } from '@playwright/test';

import { waitForAngularApp } from './angular-helpers';
import {
  assertNoBrowserErrors,
  type BrowserLogs,
  setupBrowserErrorCapture,
} from './browser-errors';

/**
 * Extended test fixtures for Angular E2E tests.
 */
interface AngularTestFixtures {
  /** Browser logs captured during the test - checked automatically in afterEach */
  browserLogs: BrowserLogs;
  /** Navigate to a route and wait for Angular to bootstrap */
  gotoAndWaitForAngular: (path: string) => Promise<void>;
}

/**
 * Extended Playwright test with Angular-specific fixtures.
 *
 * Provides:
 * - `browserLogs`: Automatically captures JS errors, checked in afterEach
 * - `gotoAndWaitForAngular`: Navigate and wait for Angular bootstrap
 *
 * @example
 * ```typescript
 * import { expect, test } from './utils/fixtures';
 *
 * test.describe('My Feature', () => {
 *   test('loads correctly', async ({ page, gotoAndWaitForAngular }) => {
 *     await gotoAndWaitForAngular('/my-route');
 *     await expect(page.locator('app-my-component')).toBeVisible();
 *   });
 * });
 * ```
 */
export const test = base.extend<AngularTestFixtures>({
  // Automatically set up browser error capture for each test
  browserLogs: async ({ page }, use) => {
    const logs = setupBrowserErrorCapture(page);

    // Run the test
    await use(logs);

    // After the test, assert no browser errors occurred
    assertNoBrowserErrors(logs);
  },

  // Helper to navigate and wait for Angular
  gotoAndWaitForAngular: async ({ page }, use) => {
    const navigate = async (path: string) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await waitForAngularApp(page);
    };

    await use(navigate);
  },
});

// Re-export expect for convenience
export { expect } from '@playwright/test';
