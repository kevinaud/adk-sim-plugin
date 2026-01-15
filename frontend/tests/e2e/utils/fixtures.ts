/**
 * @fileoverview Custom Playwright test fixtures for Angular E2E tests.
 *
 * Extends the base Playwright test with automatic browser error capture
 * and Angular-specific utilities. Use this instead of the base `test`
 * import for Angular E2E tests.
 *
 * ## Test Isolation
 *
 * Tests share a single Docker backend for performance. Isolation strategies:
 *
 * 1. **`test`** (default): Browser isolation only. Tests share backend state.
 *    Use unique identifiers (timestamps) to avoid collisions.
 *
 * 2. **`isolatedTest`**: Resets the database before each test. Use for tests
 *    that require a completely clean state (slower due to DB reset overhead).
 *
 * @example
 * ```typescript
 * // Standard test (uses unique identifiers for isolation)
 * import { expect, test } from './utils/fixtures';
 *
 * test('loads the app', async ({ page, browserLogs }) => {
 *   await page.goto('/');
 *   await expect(page.locator('app-root')).toBeVisible();
 * });
 *
 * // Isolated test (database reset before each test)
 * import { expect, isolatedTest } from './utils/fixtures';
 *
 * isolatedTest('starts with empty session list', async ({ page }) => {
 *   // Database was cleared before this test
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
import { resetDatabase } from './db-reset';

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

/**
 * Extended test fixture with database isolation.
 *
 * Resets the database before each test to ensure a clean state.
 * Use this for tests that require no pre-existing data.
 *
 * Note: This adds ~100-200ms overhead per test. For most tests,
 * using unique identifiers with the standard `test` fixture is faster.
 *
 * @example
 * ```typescript
 * import { expect, isolatedTest } from './utils/fixtures';
 *
 * isolatedTest('empty state shows no sessions', async ({ page, gotoAndWaitForAngular }) => {
 *   await gotoAndWaitForAngular('/');
 *   // Database was cleared - session list should be empty
 * });
 * ```
 */
export const isolatedTest = test.extend<Record<string, never>>({
  // Auto-fixture that runs before each test
  page: async ({ page }, use) => {
    // Reset database before the test (synchronous operation)
    resetDatabase();

    // Small delay to ensure backend sees the clean state
    await new Promise((resolve) => setTimeout(resolve, 100));

    await use(page);
  },
});

// Re-export expect for convenience
export { expect } from '@playwright/test';
