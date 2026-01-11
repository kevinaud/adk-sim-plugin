/**
 * @fileoverview Playwright component test configuration.
 *
 * Configures @sand4rt/experimental-ct-angular for component testing
 * with visual regression support.
 *
 * @see mddocs/frontend/research/playwright-testing-research.md
 */

import path from 'node:path';

import angular from '@analogjs/vite-plugin-angular';
import { defineConfig, devices } from '@sand4rt/experimental-ct-angular';

export default defineConfig({
  testDir: 'tests/component',
  snapshotDir: 'tests/component/__snapshots__',

  // CI-specific settings
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? [['html'], ['github']] : 'line',

  // Screenshot settings
  expect: {
    toHaveScreenshot: {
      // Pixel difference threshold (0-1, lower = stricter)
      maxDiffPixelRatio: 0.01,
      // Animation must be disabled for deterministic screenshots
      animations: 'disabled',
    },
  },

  use: {
    trace: 'on-first-retry',
    ctViteConfig: {
      plugins: [
        angular({
          tsconfig: path.resolve(__dirname, 'tsconfig.ct.json'),
        }) as unknown,
      ],
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
