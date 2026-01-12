/**
 * @fileoverview Playwright Component Testing configuration.
 *
 * Configures Playwright for Angular component tests with visual regression support.
 * Uses @sand4rt/experimental-ct-angular for Angular integration.
 *
 * Component tests live in tests/component/ and test isolated UI components
 * without requiring the full application to be running.
 *
 * @see mddocs/frontend/research/playwright-testing-research.md
 */

import angular from '@analogjs/vite-plugin-angular';
import { defineConfig, devices } from '@sand4rt/experimental-ct-angular';
import { resolve } from 'path';

export default defineConfig({
  testDir: 'tests/component',
  snapshotDir: 'tests/component/__snapshots__',

  // CI-specific settings
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? [['html'], ['github']] : 'line',

  // Screenshot settings for visual regression
  expect: {
    toHaveScreenshot: {
      // Pixel difference threshold (0-1, lower = stricter)
      maxDiffPixelRatio: 0.01,
      // Disable animations for deterministic screenshots
      animations: 'disabled',
    },
  },

  use: {
    trace: 'on-first-retry',
    ctViteConfig: {
      plugins: [
        angular({
          tsconfig: resolve('./tsconfig.spec.json'),
        }),
      ],
      // Disable sourcemaps to suppress analogjs plugin warnings
      build: {
        sourcemap: false,
      },
      resolve: {
        alias: {
          '@': resolve('./src'),
          '@app': resolve('./src/app'),
        },
      },
      // Optimize Angular dependencies for Vite (zoneless Angular 21+)
      optimizeDeps: {
        include: [
          '@angular/core',
          '@angular/common',
          '@angular/compiler',
          '@angular/platform-browser',
          '@angular/platform-browser-dynamic',
          '@angular/platform-browser-dynamic/testing',
          '@angular/core/testing',
          '@angular/animations',
          '@angular/platform-browser/animations',
          '@angular/platform-browser/animations/async',
          '@angular/material/icon',
          '@angular/material/tooltip',
        ],
      },
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Add more browsers as needed for cross-browser testing:
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
