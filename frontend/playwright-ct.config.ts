/**
 * @fileoverview Playwright Component Testing configuration.
 *
 * Configures Playwright for Angular component tests with visual regression support.
 * Uses @sand4rt/experimental-ct-angular for Angular integration.
 *
 * Component tests live in tests/component/ and test isolated UI components
 * without requiring the full application to be running.
 *
 * Theme Support:
 * Tests automatically run in both light and dark modes via separate projects.
 * The theme fixture (tests/component/fixtures/theme.fixture.ts) applies the
 * appropriate theme class based on project metadata. Snapshots are organized
 * into separate directories: __snapshots__/light/ and __snapshots__/dark/.
 *
 * @see mddocs/frontend/research/playwright-testing-research.md
 */

import angular from '@analogjs/vite-plugin-angular';
import { defineConfig, devices } from '@sand4rt/experimental-ct-angular';
import { resolve } from 'path';

/**
 * Shared configuration for browser normalization.
 * These launch options ensure consistent rendering across environments.
 */
const browserNormalizationArgs = [
  '--disable-lcd-text', // Force grayscale antialiasing (no subpixel)
  '--disable-font-subpixel-positioning', // Align glyphs to pixel grid
  '--font-render-hinting=none', // Disable system font hinting
  '--disable-gpu', // Force software rasterization for consistency
];

export default defineConfig({
  testDir: 'tests/component',
  // Note: snapshotDir is set per-project to organize by theme

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
    // Light theme project (default)
    {
      name: 'chromium-light',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: browserNormalizationArgs,
        },
      },
      metadata: { theme: 'light' },
      snapshotDir: 'tests/component/__snapshots__/light',
    },
    // Dark theme project
    {
      name: 'chromium-dark',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: browserNormalizationArgs,
        },
      },
      metadata: { theme: 'dark' },
      snapshotDir: 'tests/component/__snapshots__/dark',
    },
    // Add more browser/theme combinations as needed:
    // { name: 'firefox-light', use: { ...devices['Desktop Firefox'] }, metadata: { theme: 'light' }, snapshotDir: '...' },
    // { name: 'firefox-dark', use: { ...devices['Desktop Firefox'] }, metadata: { theme: 'dark' }, snapshotDir: '...' },
  ],
});
