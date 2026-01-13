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

import { expect, test } from './utils';

test.describe('Session List', () => {
  test.beforeEach(async ({ gotoAndWaitForAngular }) => {
    // Navigate to the home page and wait for Angular to bootstrap
    // Browser error capture is automatic via the custom fixture
    await gotoAndWaitForAngular('/');
  });

  test('loads the application without JavaScript errors', async ({ page }) => {
    // The page should have loaded successfully (accept either localhost or 127.0.0.1)
    const url = page.url();
    expect(url.includes('127.0.0.1') || url.includes('localhost')).toBe(true);

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
    await expect(spinner.or(card).or(emptyState).or(errorState).first()).toBeVisible({
      timeout: 30000,
    });
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

  test('visual regression - session list view', async ({ page }) => {
    // Wait for the session list to fully render
    const cardTitle = page.getByText(/available sessions/i);
    await expect(cardTitle).toBeVisible({ timeout: 30000 });

    // Give Angular Material animations time to complete
    await page.waitForTimeout(500);

    // Capture visual regression screenshot (stored in __snapshots__/)
    await expect(page).toHaveScreenshot('session-list-view.png', {
      fullPage: true,
    });
  });
});
