import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration
 *
 * This config is for end-to-end tests that run against the real backend.
 * For local development, the global setup/teardown scripts handle Docker.
 * In CI, Docker is managed separately by the workflow.
 *
 * The frontend runs via `ng serve` on port 4200, which proxies API calls
 * to the backend on port 8080 via proxy.conf.json.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  snapshotDir: 'tests/e2e/__snapshots__', // Version-controlled visual regression baselines
  fullyParallel: true, // Parallel tests get separate browser contexts (avoids HMR state issues)
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: 4, // Parallel workers for faster E2E tests
  reporter: process.env['CI'] ? [['html'], ['github']] : 'line',

  // Timeouts
  timeout: 60000,
  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01, // 1% pixel diff threshold for visual regression
    },
  },

  use: {
    // Base URL for tests - Use explicit IPv4 to avoid Node 20 IPv6 resolution issues
    baseURL: process.env['BASE_URL'] ?? 'http://127.0.0.1:4200',
    trace: 'on-first-retry',
    screenshot: 'on', // Capture screenshots for all tests to visualize UI state
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Global setup/teardown for Docker (only for local development)
  globalSetup: process.env['CI'] ? undefined : './tests/e2e/global-setup.ts',
  globalTeardown: process.env['CI'] ? undefined : './tests/e2e/global-teardown.ts',

  // Start Angular dev server for E2E tests
  // Key fixes for containerized environments:
  // 1. Use npx ng serve directly (better signal propagation than npm run)
  // 2. Bind to 127.0.0.1 explicitly (avoids Node 20 IPv6/IPv4 mismatch)
  // 3. --allowed-hosts=all allows container networking (Angular 21 Vite-based)
  // 4. NG_CLI_ANALYTICS=false prevents stdin blocking prompt
  // 5. stdout/stderr: 'pipe' makes errors visible
  // 6. --live-reload=false disables HMR WebSocket (prevents sequential test failures)
  webServer: {
    command: 'NG_CLI_ANALYTICS=false npx ng serve --host 127.0.0.1 --port 4200 --allowed-hosts=all --live-reload=false',
    url: 'http://127.0.0.1:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
