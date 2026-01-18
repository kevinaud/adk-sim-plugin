import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration
 *
 * E2E tests run against full-stack Docker containers that serve both the
 * Angular frontend and gRPC API (mimicking production deployment).
 *
 * ## Architecture
 *
 * Each E2E backend instance serves:
 * - Angular SPA at the root path (/)
 * - gRPC-Web API at /adksim.v1.SimulatorService/*
 *
 * This matches production where the Python server serves everything on one port.
 *
 * ## Backend Instances (docker-compose.e2e.yaml)
 *
 * - no-sessions (8091): Always empty, for empty state tests
 * - populated (8092): Pre-seeded with sessions, for stable visual tests
 * - shared (8093): Allows session creation, for session-specific tests (default)
 *
 * These ports (809x range) are intentionally different from the main docker-compose
 * (8080) to allow E2E tests to run alongside local development.
 *
 * ## Usage
 *
 * Tests specify which backend to use via fixtures:
 *   test.use({ backend: 'no-sessions' });
 *
 * The `ops test frontend e2e` command handles Docker lifecycle automatically.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  snapshotDir: 'tests/e2e/__snapshots__', // Version-controlled visual regression baselines
  outputDir: 'test-results', // Traces, screenshots, and other artifacts (gitignored)
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
    // Base URL for tests - points to 'shared' backend by default
    // Tests can override by using test.use({ backend: 'no-sessions' }) etc.
    // The multi-backend-fixtures handle navigation to the correct backend URL.
    baseURL: process.env['BASE_URL'] ?? 'http://127.0.0.1:8093',

    // Trace mode: 'retain-on-failure' keeps traces only for failed tests (default)
    // Override at runtime: npx playwright test --trace on
    // View traces with: npx playwright show-trace test-results/<test-name>/trace.zip
    trace: 'retain-on-failure',
    screenshot: 'on', // Capture screenshots for all tests to visualize UI state

    // Browser normalization for consistent rendering across environments
    // Fixes visual regression differences between Debian (devcontainer) and Ubuntu (CI)
    // See: mddocs/frontend/research/deep-research/visual-regression-ci-investigation-report.md
    launchOptions: {
      args: [
        '--disable-lcd-text', // Force grayscale antialiasing (no subpixel)
        '--disable-font-subpixel-positioning', // Align glyphs to pixel grid
        '--font-render-hinting=none', // Disable system font hinting
        '--disable-gpu', // Force software rasterization for consistency
      ],
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No webServer config - E2E tests run against Docker containers
  // that serve both frontend and API. Use `ops test frontend e2e` which
  // handles the Docker lifecycle automatically.
});
