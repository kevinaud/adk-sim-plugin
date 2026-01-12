import { expect, test, type Page } from '@playwright/test';

/**
 * E2E tests for the Session List page.
 *
 * These tests run against the real backend via Docker Compose.
 * The frontend is served via `ng serve` on port 4200.
 *
 * Prerequisites:
 * 1. Docker backend running (via global-setup or manually)
 * 2. Angular dev server running (via webServer config or manually)
 */

/**
 * Collected console messages and page errors during test execution.
 * These are checked after each test to catch JavaScript runtime errors.
 */
interface BrowserLogs {
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: Error[];
}

/**
 * Set up page listeners to capture browser console errors and uncaught exceptions.
 * Should be called at the start of each test.
 */
function setupBrowserErrorCapture(page: Page): BrowserLogs {
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
 */
function assertNoBrowserErrors(logs: BrowserLogs) {
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
      .map((err, i) => `  ${i + 1}. ${err}`)
      .join('\n');

    const moreErrors = allErrors.length > 5 ? `\n  ... and ${allErrors.length - 5} more errors` : '';

    throw new Error(
      `JavaScript runtime errors detected in browser:\n${errorDetails}${moreErrors}\n\n` +
        `These errors indicate the Angular application failed to bootstrap correctly.\n` +
        `Check for missing providers, import errors, or initialization failures.`
    );
  }
}

/**
 * Helper to wait for Angular app to bootstrap.
 * Waits for app-root to have meaningful content (Angular has rendered).
 */
async function waitForAngularApp(page: Page) {
  // Wait for app-root to have content and be visible
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
    { timeout: 45000 }
  );
}

test.describe('Session List', () => {
  let browserLogs: BrowserLogs;

  test.beforeEach(async ({ page }) => {
    // Set up browser error capture BEFORE navigating
    browserLogs = setupBrowserErrorCapture(page);

    // Navigate to the home page with full page load (domcontentloaded ensures fresh state)
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForAngularApp(page);
  });

  test.afterEach(async () => {
    // Check for JavaScript errors after each test - this catches Angular bootstrap failures
    assertNoBrowserErrors(browserLogs);
  });

  test('loads the application without JavaScript errors', async ({ page }) => {
    // The page should have loaded successfully
    expect(page.url()).toContain('127.0.0.1');

    // Verify app-root is present
    await expect(page.locator('app-root')).toBeVisible();
  });

  test('displays the session list view', async ({ page }) => {
    // Wait for the mat-card to be present (session list container)
    await expect(page.locator('mat-card').first()).toBeVisible({ timeout: 30000 });

    // Check for key UI elements
    const pageContent = await page.content();
    expect(pageContent).toContain('mat-card');
  });

  test('shows loading or content state', async ({ page }) => {
    // Wait for Angular Material components to render
    await page.waitForTimeout(1000);

    // The page should show either:
    // 1. Loading spinner (mat-spinner)
    // 2. Session list content (mat-card with sessions)
    // 3. Empty state (No sessions available)
    // 4. Error state
    const spinner = page.locator('mat-spinner');
    const card = page.locator('mat-card');
    const emptyState = page.getByText(/no sessions/i);
    const errorState = page.getByText(/error/i);

    // At least one of these should be visible - use .first() to handle multiple matches
    await expect(
      spinner.or(card).or(emptyState).or(errorState).first()
    ).toBeVisible({ timeout: 30000 });
  });

  test('displays session list card with header', async ({ page }) => {
    // The session list card should have a header with title
    const cardTitle = page.getByText(/available sessions/i);
    await expect(cardTitle).toBeVisible({ timeout: 30000 });
  });

  test('page structure is correct', async ({ page }) => {
    // Basic page structure checks
    await expect(page.locator('app-root')).toBeVisible();

    // Should have the session list feature
    const sessionListFeature = page.locator('app-session-list, [class*="session-list"]');
    await expect(sessionListFeature.first()).toBeVisible({ timeout: 30000 });
  });
});
