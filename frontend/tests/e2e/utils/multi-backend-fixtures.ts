/**
 * @fileoverview Multi-backend Playwright test fixtures.
 *
 * Extends the base fixtures to support named backend instances.
 * Tests can declare which backend they need using `test.use({ backend: 'name' })`.
 *
 * ## Backend Types
 *
 * - **no-sessions**: Always empty, never has sessions created
 * - **populated**: Pre-seeded with fixed sessions for stable visual tests
 * - **shared**: Allows session creation for session-specific tests (default)
 *
 * ## How Multi-Backend Works
 *
 * E2E tests run against full-stack Docker containers that serve both the
 * Angular frontend and gRPC API on the same port (mimicking production).
 *
 * Each backend runs on a different port (8091-8093) to avoid conflicts with
 * the main docker-compose (port 8080) used for local development.
 *
 * Tests navigate directly to the backend URL for their configured backend.
 * No route interception or proxying is needed.
 *
 * ## Usage Examples
 *
 * ```typescript
 * import { expect, test } from './utils/multi-backend-fixtures';
 *
 * // Test using the default 'shared' backend - use client directly
 * test('can create session', async ({ page, client, gotoAndWaitForAngular }) => {
 *   const { session } = await client.createSession({ description: 'Test' });
 *   await gotoAndWaitForAngular(`/session/${session!.id}`);
 * });
 *
 * // Test using 'no-sessions' backend for empty state
 * test.describe('Empty State Tests', () => {
 *   test.use({ backend: 'no-sessions' });
 *
 *   test('shows empty state', async ({ page, gotoAndWaitForAngular }) => {
 *     await gotoAndWaitForAngular('/');
 *     // Backend is guaranteed to be empty
 *   });
 * });
 *
 * // Test using 'populated' backend for stable screenshots
 * test.describe('Visual Regression', () => {
 *   test.use({ backend: 'populated' });
 *
 *   test('session list with sessions', async ({ page, gotoAndWaitForAngular }) => {
 *     await gotoAndWaitForAngular('/');
 *     // Backend has pre-seeded sessions for stable visual tests
 *   });
 * });
 * ```
 */

import { test as base } from '@playwright/test';

import { waitForAngularApp } from './angular-helpers';
import { type BackendName, getBackendUrl } from './backend-config';
import {
  assertNoBrowserErrors,
  type BrowserLogs,
  setupBrowserErrorCapture,
} from './browser-errors';
import { createTestClient, type SimulatorClient } from './grpc-client';

/**
 * Multi-backend test fixture options.
 */
interface MultiBackendOptions {
  /** Which backend instance to use for this test */
  backend: BackendName;
}

/**
 * Multi-backend test fixtures.
 */
interface MultiBackendFixtures {
  /** Browser logs captured during the test - checked automatically in afterEach */
  browserLogs: BrowserLogs;
  /** Navigate to a route and wait for Angular to bootstrap */
  gotoAndWaitForAngular: (path: string) => Promise<void>;
  /** The backend URL for direct API calls */
  backendUrl: string;
  /** gRPC client for the configured backend - use directly for test setup */
  client: SimulatorClient;
}

/**
 * Extended Playwright test with multi-backend support.
 *
 * Provides:
 * - `backend`: Configure which backend to use via `test.use({ backend: 'name' })`
 * - `browserLogs`: Automatically captures JS errors, checked in afterEach
 * - `gotoAndWaitForAngular`: Navigate and wait for Angular bootstrap
 * - `backendUrl`: The URL of the configured backend
 * - `client`: gRPC client for the backend - use directly for test setup
 */
export const test = base.extend<MultiBackendFixtures & MultiBackendOptions>({
  // Option: which backend to use (default: 'shared')
  backend: ['shared', { option: true }],

  // Fixture: backend URL based on selected backend
  backendUrl: async ({ backend }, use) => {
    const url = getBackendUrl(backend);
    await use(url);
  },

  // Fixture: gRPC client for test setup
  client: async ({ backendUrl }, use) => {
    const client = createTestClient(backendUrl);
    await use(client);
  },

  // Fixture: browser error capture (auto-checked after test)
  browserLogs: async ({ page }, use) => {
    const logs = setupBrowserErrorCapture(page);
    await use(logs);
    assertNoBrowserErrors(logs);
  },

  // Fixture: navigate and wait for Angular
  // Navigates to the correct backend URL based on the configured backend
  gotoAndWaitForAngular: async ({ page, backendUrl }, use) => {
    const navigate = async (path: string) => {
      // Build full URL to the correct backend
      const url = `${backendUrl}${path}`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await waitForAngularApp(page);
    };
    await use(navigate);
  },
});

// Re-export expect for convenience
export { expect } from '@playwright/test';

// Re-export types for test files
export type { SimulatorClient } from './grpc-client';
export type { BackendName } from './backend-config';
