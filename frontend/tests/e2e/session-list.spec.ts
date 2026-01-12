import { expect, test } from '@playwright/test';

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
 * Helper to wait for Angular app to bootstrap
 */
async function waitForAngularApp(page: import('@playwright/test').Page) {
  // Wait for app-root to have content
  await page.waitForFunction(
    () => {
      const appRoot = document.querySelector('app-root');
      return appRoot && appRoot.innerHTML.trim().length > 10;
    },
    { timeout: 45000 }
  );
  // Give Angular a moment to stabilize
  await page.waitForTimeout(500);
}

test.describe('Session List', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the home page before each test
    await page.goto('/');
    await waitForAngularApp(page);
  });

  test('loads the application', async ({ page }) => {
    // Collect console messages for debugging
    const consoleMessages: string[] = [];
    page.on('console', (msg) => consoleMessages.push(`${msg.type()}: ${msg.text()}`));

    // The page should have loaded successfully
    expect(page.url()).toContain('127.0.0.1');

    // Log console output for debugging
    if (consoleMessages.length > 0) {
      console.log('Browser console:', consoleMessages.slice(0, 5).join('\n'));
    }
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

    // At least one of these should be visible
    await expect(
      spinner.or(card).or(emptyState).or(errorState)
    ).toBeVisible({ timeout: 30000 });
  });

  test('has connection status indicator', async ({ page }) => {
    // The connection status component should be present
    const connectionStatus = page.locator('app-connection-status');
    await expect(connectionStatus).toBeVisible({ timeout: 30000 });
  });

  test('page structure is correct', async ({ page }) => {
    // Basic page structure checks
    await expect(page.locator('app-root')).toBeVisible();

    // Should have the session list feature
    const sessionListFeature = page.locator('app-session-list, [class*="session-list"]');
    await expect(sessionListFeature.first()).toBeVisible({ timeout: 30000 });
  });
});
