/**
 * @fileoverview Angular-specific E2E test utilities.
 *
 * Provides helpers for waiting on Angular app bootstrap and other
 * Angular-specific behaviors in Playwright tests.
 */

import type { Page } from '@playwright/test';

/**
 * Wait for Angular app to bootstrap and render content.
 *
 * Waits for app-root to have meaningful content (not just loading text)
 * and be visible. This ensures Angular has completed initial rendering.
 *
 * @param page - Playwright page object
 * @param timeout - Maximum time to wait in milliseconds (default: 45000)
 */
export async function waitForAngularApp(page: Page, timeout = 45000): Promise<void> {
  await page.waitForFunction(
    () => {
      const appRoot = document.querySelector('app-root');
      if (!appRoot) return false;
      // Check that app-root has rendered content (not just loading text)
      const hasContent = appRoot.innerHTML.trim().length > 10;
      // Check that app-root is visible (not hidden by CSS)
      const style = window.getComputedStyle(appRoot);
      const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
      return hasContent && isVisible;
    },
    { timeout }
  );
}

/**
 * Wait for Angular app to be fully stable (no pending HTTP requests, timers, etc.)
 *
 * Note: This requires the app to expose stability state. For most tests,
 * waitForAngularApp is sufficient.
 *
 * @param page - Playwright page object
 * @param timeout - Maximum time to wait in milliseconds (default: 30000)
 */
export async function waitForAngularStable(page: Page, timeout = 30000): Promise<void> {
  // Wait for network to be idle (no pending requests)
  await page.waitForLoadState('networkidle', { timeout });
}
