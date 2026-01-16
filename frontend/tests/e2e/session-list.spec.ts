/**
 * E2E tests for the Session List page.
 *
 * These tests run against multiple backend instances via Docker Compose.
 * The frontend is served via `ng serve` on port 4200.
 *
 * Backend Instances:
 * - no-sessions (8081): Always empty - for empty state tests
 * - populated (8082): Pre-seeded with sessions - for stable visual tests
 * - shared (8080): Allows creation - for session-specific tests (default)
 *
 * Prerequisites:
 * 1. Docker backends running (via global-setup or manually)
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
});

/**
 * Empty State Tests
 *
 * Use the 'no-sessions' backend which is guaranteed to be empty.
 * Tests should NOT create sessions on this backend.
 */
test.describe('Empty State Tests', () => {
  test.use({ backend: 'no-sessions' });

  test('shows empty state on no-sessions backend', async ({ page, gotoAndWaitForAngular }) => {
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    // Session list should be visible
    await expect(page.locator('app-session-list')).toBeVisible({ timeout: 30000 });

    // Should show "No sessions" empty state
    const emptyState = page.getByText(/no sessions available/i);
    await expect(emptyState).toBeVisible({ timeout: 10000 });
  });

  test('visual regression - empty session list', async ({ page, gotoAndWaitForAngular }) => {
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    // Verify empty state is shown
    const emptyState = page.getByText(/no sessions available/i);
    await expect(emptyState).toBeVisible({ timeout: 10000 });

    // Take screenshot of empty state
    await expect(page).toHaveScreenshot('session-list-empty.png', {
      fullPage: true,
    });
  });
});

/**
 * Populated Backend Tests
 *
 * Use the 'populated' backend which has pre-seeded sessions.
 * Tests should NOT create new sessions on this backend (keeps screenshots stable).
 */
test.describe('Populated Backend Tests', () => {
  test.use({ backend: 'populated' });

  test('shows session list with pre-seeded sessions', async ({ page, gotoAndWaitForAngular }) => {
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    // Session list should be visible
    await expect(page.locator('app-session-list')).toBeVisible({ timeout: 30000 });

    // Should have session items (pre-seeded)
    const sessionItems = page.locator('app-session-card');
    await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

    // Count sessions - should have at least the seeded ones
    const count = await sessionItems.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('displays seeded session descriptions', async ({ page, gotoAndWaitForAngular }) => {
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    // Check for one of the pre-seeded session descriptions
    // These are defined in seed-populated-backend.ts
    const seedDescriptions = [
      'Weather Assistant Demo',
      'Code Review Agent',
      'Customer Support Bot',
      'Data Analysis Pipeline',
      'Documentation Generator',
    ];

    // At least one should be visible
    let foundSession = false;
    for (const desc of seedDescriptions) {
      const element = page.getByText(desc, { exact: false });
      if ((await element.count()) > 0) {
        foundSession = true;
        break;
      }
    }
    expect(foundSession).toBe(true);
  });

  test('visual regression - populated session list', async ({ page, gotoAndWaitForAngular }) => {
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    // Verify sessions are loaded
    const sessionItems = page.locator('app-session-card');
    await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

    // Take screenshot of populated session list (stable due to seeded data)
    await expect(page).toHaveScreenshot('session-list-populated.png', {
      fullPage: true,
    });
  });
});

/**
 * Session Creation Tests
 *
 * Use the default 'shared' backend which allows session creation.
 * Each test can safely create its own sessions with unique IDs.
 */
test.describe('Session Creation Tests', () => {
  // Uses default 'shared' backend

  test('displays sessions created via API in the session list', async ({
    page,
    gotoAndWaitForAngular,
    client,
  }) => {
    // Create a session via the backend API before navigating to the UI
    const timestamp = Date.now();
    const { session } = await client.createSession({ description: `E2E Test Session ${timestamp}` });

    // Navigate to the session list
    await gotoAndWaitForAngular('/');

    // Wait for the session list to load and display sessions
    await page.waitForTimeout(2000); // Allow API call to complete

    // Verify the session list is visible
    await expect(page.locator('app-session-list')).toBeVisible({ timeout: 30000 });

    // Verify the created session appears in the list
    // Sessions display truncated IDs, so we check for partial match
    const sessionIdPrefix = session.id.substring(0, 8);
    const sessionItem = page.locator('app-session-card').filter({
      has: page.locator('[data-testid="session-id"]', { hasText: sessionIdPrefix }),
    });

    await expect(sessionItem).toBeVisible({ timeout: 10000 });

    // Verify the session description is displayed
    await expect(page.getByText(session.description)).toBeVisible();
  });

  test('can create multiple sessions', async ({
    page,
    gotoAndWaitForAngular,
    client,
  }) => {
    // Create multiple sessions
    const sessions = [];
    for (let i = 1; i <= 3; i++) {
      const { session } = await client.createSession({ description: `Multi-Session Test ${i}` });
      sessions.push(session!);
    }

    // Navigate to the session list
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    // Verify all created sessions appear (use .first() to handle duplicates from previous runs)
    for (const session of sessions) {
      await expect(page.getByText(session.description).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('can navigate to a session created via API', async ({
    page,
    gotoAndWaitForAngular,
    client,
  }) => {
    // Create a session via the backend API
    const { session } = await client.createSession({ description: 'E2E Navigation Test Session' });

    // Navigate to the session list
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    // Find and click on the created session
    const sessionIdPrefix = session.id.substring(0, 8);
    const sessionItem = page.locator('app-session-card').filter({
      has: page.locator('[data-testid="session-id"]', { hasText: sessionIdPrefix }),
    });

    await sessionItem.click();

    // Verify navigation to the session view
    await expect(page).toHaveURL(new RegExp(`/session/${session.id}`), { timeout: 30000 });

    // Verify the session component is displayed
    await expect(page.locator('app-session, .session-container').first()).toBeVisible({
      timeout: 30000,
    });
  });
});

// NOTE: Visual regression tests are in the backend-specific test.describe blocks:
// - "Empty State Tests" contains session-list-empty.png (no-sessions backend)
// - "Populated Backend Tests" contains session-list-populated.png (populated backend)
// This ensures deterministic screenshots by using backends with known, stable state.
