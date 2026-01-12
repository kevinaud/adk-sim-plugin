/**
 * @fileoverview Browser error capture utilities for E2E tests.
 *
 * Captures JavaScript runtime errors (console.error, uncaught exceptions)
 * during test execution and provides assertions to fail tests when
 * critical errors are detected.
 *
 * @example
 * ```typescript
 * import { setupBrowserErrorCapture, assertNoBrowserErrors } from './utils/browser-errors';
 *
 * test('my test', async ({ page }) => {
 *   const logs = setupBrowserErrorCapture(page);
 *   await page.goto('/');
 *   // ... test logic ...
 *   assertNoBrowserErrors(logs);
 * });
 * ```
 */

import type { Page } from '@playwright/test';

/**
 * Collected console messages and page errors during test execution.
 */
export interface BrowserLogs {
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: Error[];
}

/**
 * Set up page listeners to capture browser console errors and uncaught exceptions.
 * Should be called at the start of each test, BEFORE navigation.
 *
 * @param page - Playwright page object
 * @returns BrowserLogs object that accumulates errors during the test
 */
export function setupBrowserErrorCapture(page: Page): BrowserLogs {
  const logs: BrowserLogs = {
    consoleErrors: [],
    consoleWarnings: [],
    pageErrors: [],
  };

  // Capture console.error() calls - these often indicate Angular bootstrap failures
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      logs.consoleErrors.push(msg.text());
    } else if (msg.type() === 'warning') {
      logs.consoleWarnings.push(msg.text());
    }
  });

  // Capture uncaught exceptions and unhandled promise rejections
  page.on('pageerror', (error) => {
    logs.pageErrors.push(error);
  });

  return logs;
}

/**
 * Assert that no critical JavaScript errors occurred during the test.
 * Throws an assertion error with helpful details if errors were found.
 *
 * Filters out known non-critical errors (like favicon 404s).
 *
 * @param logs - BrowserLogs object from setupBrowserErrorCapture
 * @throws Error if critical JavaScript errors were detected
 */
export function assertNoBrowserErrors(logs: BrowserLogs): void {
  // Filter out known non-critical errors
  const criticalErrors = logs.consoleErrors.filter((msg) => {
    // Ignore favicon errors - these are expected and non-critical
    if (msg.includes('favicon.ico')) return false;
    // Ignore zone.js warnings in dev mode
    if (msg.includes('Zone.js') && msg.includes('warning')) return false;
    return true;
  });

  // Also include page errors (uncaught exceptions)
  const allErrors = [
    ...criticalErrors,
    ...logs.pageErrors.map((e) => `Uncaught: ${e.message}`),
  ];

  if (allErrors.length > 0) {
    // Format error message with clear indication of what went wrong
    const errorDetails = allErrors
      .slice(0, 5) // Limit to first 5 errors to keep output readable
      .map((err, i) => `  ${String(i + 1)}. ${err}`)
      .join('\n');

    const moreErrors = allErrors.length > 5 ? `\n  ... and ${String(allErrors.length - 5)} more errors` : '';

    throw new Error(
      `JavaScript runtime errors detected in browser:\n${errorDetails}${moreErrors}\n\n` +
        `These errors indicate the Angular application failed to bootstrap correctly.\n` +
        `Check for missing providers, import errors, or initialization failures.`
    );
  }
}
