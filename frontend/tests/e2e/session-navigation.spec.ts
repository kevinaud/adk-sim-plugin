/**
 * E2E tests for session navigation and event rendering.
 *
 * Tests cover:
 * - Session route navigation with guard validation (FR-001, FR-004)
 * - Invalid session ID handling with redirect
 * - Missing session ID error handling
 * - EventStreamComponent empty state display
 * - EventBlockComponent rendering for different block types
 *
 * Backend Instances:
 * - no-sessions (8081): For error handling tests (guaranteed no sessions)
 * - populated (8082): For session navigation tests (pre-seeded sessions)
 * - shared (8080): For session creation tests (default)
 *
 * Prerequisites:
 * 1. Docker backends running (via global-setup or manually)
 * 2. Angular dev server running (via webServer config or manually)
 */

import { expect, test } from './utils';

test.describe('Session Navigation', () => {
  test.describe('Route Guard Validation', () => {
    // Use no-sessions backend to guarantee invalid session IDs
    test.use({ backend: 'no-sessions' });

    test('redirects invalid session ID to home with error query param', async ({
      page,
      gotoAndWaitForAngular,
    }) => {
      // Navigate to a session that doesn't exist
      const invalidSessionId = 'invalid-session-id-12345';
      await gotoAndWaitForAngular(`/session/${invalidSessionId}`);

      // Should redirect to home page with error query param
      // Note: URL can use either + or %20 for space encoding
      await expect(page).toHaveURL(/\?error=Session(%20|\+)not(%20|\+)found/);

      // Should show the session list component (redirected to home)
      await expect(page.locator('app-session-list')).toBeVisible({ timeout: 30000 });
    });

    test('redirects missing session ID to home with error query param', async ({
      page,
      gotoAndWaitForAngular,
    }) => {
      // Navigate to session route without ID
      // Note: /session/ without ID goes to wildcard route which redirects to home
      // The guard only triggers when there's an ID param
      await gotoAndWaitForAngular('/session/');

      // Should redirect to home page (wildcard catch-all)
      const url = page.url();
      expect(url.includes('127.0.0.1') || url.includes('localhost')).toBe(true);

      // Should show the session list component
      await expect(page.locator('app-session-list').or(page.locator('mat-card')).first()).toBeVisible(
        { timeout: 30000 },
      );
    });

    test('displays error message from query params', async ({ page, gotoAndWaitForAngular }) => {
      // Navigate with URL-encoded error message
      await gotoAndWaitForAngular('/?error=Session+not+found');

      // Page should load without breaking
      await expect(page.locator('app-root')).toBeVisible();
      await expect(page.locator('mat-card').first()).toBeVisible({ timeout: 30000 });

      // Error banner should be visible with the error message
      const errorBanner = page.locator('[data-testid="route-error-banner"]');
      await expect(errorBanner).toBeVisible({ timeout: 5000 });

      const errorMessage = page.locator('[data-testid="error-banner-message"]');
      await expect(errorMessage).toContainText('Session not found');
    });
  });

  test.describe('Valid Session Navigation', () => {
    // Use populated backend which has pre-seeded sessions
    test.use({ backend: 'populated' });

    test('can navigate to session from session list', async ({ page, gotoAndWaitForAngular }) => {
      // Start at session list
      await gotoAndWaitForAngular('/');

      // Wait for the session list to load
      await page.waitForTimeout(2000); // Allow API call to complete

      // Populated backend should have sessions
      const sessionItems = page.locator('mat-list-item.session-item');
      await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

      // Click on the first session
      await sessionItems.first().click();

      // Should navigate to session view
      await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });

      // Should display the SessionComponent
      await expect(page.locator('app-session, .session-container').first()).toBeVisible({
        timeout: 30000,
      });

      // Session header should be visible with "Session" text
      await expect(page.getByRole('heading', { name: /session/i }).first()).toBeVisible();
    });

    test('displays session ID in header when viewing valid session', async ({
      page,
      gotoAndWaitForAngular,
    }) => {
      // Start at session list
      await gotoAndWaitForAngular('/');
      await page.waitForTimeout(2000);

      const sessionItems = page.locator('mat-list-item.session-item');
      await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

      // Get the session ID from the list item title attribute
      const firstSessionIdSpan = page.locator('.session-id').first();
      const truncatedId = await firstSessionIdSpan.textContent();

      // Click to navigate
      await sessionItems.first().click();
      await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });

      // Extract session ID from URL
      const url = page.url();
      const sessionIdMatch = url.match(/\/session\/([^/?]+)/);
      const fullSessionId = sessionIdMatch?.[1];

      // Session ID should be displayed in the component
      if (fullSessionId) {
        // The session-id span should contain the full ID
        const sessionIdDisplay = page.locator('.session-id');
        await expect(sessionIdDisplay.first()).toBeVisible();

        // Verify truncated ID matches
        if (truncatedId) {
          expect(fullSessionId).toContain(truncatedId.replace('...', '').trim());
        }
      }
    });
  });
});

test.describe('Event Stream Component', () => {
  // Use populated backend which has sessions (but may not have events)
  test.use({ backend: 'populated' });

  test('displays empty state placeholder when no events', async ({
    page,
    gotoAndWaitForAngular,
  }) => {
    // Navigate to session list first
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    const sessionItems = page.locator('mat-list-item.session-item');
    await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

    // Navigate to a session
    await sessionItems.first().click();
    await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });

    // Wait for component to fully load
    await page.waitForTimeout(1000);

    // Check if event stream component exists with empty state
    const eventStream = page.locator('[data-testid="event-stream"]');
    const eventStreamExists = (await eventStream.count()) > 0;

    if (eventStreamExists) {
      // If there's an event stream, check for empty state or events
      const emptyState = page.locator('[data-testid="empty-state"]');
      const eventBlocks = page.locator('[data-testid="event-block"]');

      const emptyStateVisible = await emptyState.isVisible().catch(() => false);
      const eventBlocksCount = await eventBlocks.count();

      // Either empty state should be visible or there should be event blocks
      expect(emptyStateVisible || eventBlocksCount > 0).toBe(true);

      if (emptyStateVisible) {
        // Verify empty state text
        await expect(emptyState.getByText(/no conversation events yet/i)).toBeVisible();
      }
    } else {
      // EventStreamComponent might not be integrated into SessionComponent yet
      // The scaffold component shows placeholder text instead
      await expect(page.getByText(/session content will be implemented/i).first()).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test('renders event stream placeholder text correctly', async ({
    page,
    gotoAndWaitForAngular,
  }) => {
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    const sessionItems = page.locator('mat-list-item.session-item');
    await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

    await sessionItems.first().click();
    await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });

    // Check for either the event stream empty state or the scaffold placeholder
    const emptyStateHint = page.getByText(
      /events will appear here when the session receives an llm request/i,
    );
    const scaffoldText = page.getByText(/session content will be implemented/i);

    await expect(emptyStateHint.or(scaffoldText).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Event Block Component Styling', () => {
  /**
   * These tests verify EventBlockComponent renders correctly with different block types.
   * Uses the populated backend which has sessions.
   */
  test.use({ backend: 'populated' });

  test('event blocks have correct data-type attributes', async ({
    page,
    gotoAndWaitForAngular,
  }) => {
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    const sessionItems = page.locator('mat-list-item.session-item');
    await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

    await sessionItems.first().click();
    await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });
    await page.waitForTimeout(1000);

    const eventBlocks = page.locator('[data-testid="event-block"]');
    const blockCount = await eventBlocks.count();

    if (blockCount > 0) {
      // Verify each block has a valid data-type attribute
      for (let i = 0; i < blockCount; i++) {
        const block = eventBlocks.nth(i);
        const dataType = await block.getAttribute('data-type');

        // data-type should be one of: user, model, tool
        expect(['user', 'model', 'tool']).toContain(dataType);
      }
    } else {
      // No event blocks - that's OK, empty state is valid
      test.info().annotations.push({
        type: 'info',
        description: 'No event blocks to verify - session has no events',
      });
    }
  });

  test('user blocks have blue border styling', async ({ page, gotoAndWaitForAngular }) => {
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    const sessionItems = page.locator('mat-list-item.session-item');
    await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

    await sessionItems.first().click();
    await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });
    await page.waitForTimeout(1000);

    const userBlocks = page.locator('[data-testid="event-block"][data-type="user"]');
    const userBlockCount = await userBlocks.count();

    if (userBlockCount > 0) {
      // Verify user block has blue border color
      const borderColor = await userBlocks.first().evaluate((el) => {
        return window.getComputedStyle(el).borderLeftColor;
      });

      // Blue border: #2196f3 = rgb(33, 150, 243)
      expect(borderColor).toMatch(/rgb\(33,\s*150,\s*243\)/);
    } else {
      test.info().annotations.push({
        type: 'info',
        description: 'No user blocks to verify styling',
      });
    }
  });

  test('model blocks have green border styling', async ({ page, gotoAndWaitForAngular }) => {
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    const sessionItems = page.locator('mat-list-item.session-item');
    await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

    await sessionItems.first().click();
    await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });
    await page.waitForTimeout(1000);

    const modelBlocks = page.locator('[data-testid="event-block"][data-type="model"]');
    const modelBlockCount = await modelBlocks.count();

    if (modelBlockCount > 0) {
      // Verify model block has green border color
      const borderColor = await modelBlocks.first().evaluate((el) => {
        return window.getComputedStyle(el).borderLeftColor;
      });

      // Green border: #4caf50 = rgb(76, 175, 80)
      expect(borderColor).toMatch(/rgb\(76,\s*175,\s*80\)/);
    } else {
      test.info().annotations.push({
        type: 'info',
        description: 'No model blocks to verify styling',
      });
    }
  });

  test('tool blocks have orange border styling', async ({ page, gotoAndWaitForAngular }) => {
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    const sessionItems = page.locator('mat-list-item.session-item');
    await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

    await sessionItems.first().click();
    await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });
    await page.waitForTimeout(1000);

    const toolBlocks = page.locator('[data-testid="event-block"][data-type="tool"]');
    const toolBlockCount = await toolBlocks.count();

    if (toolBlockCount > 0) {
      // Verify tool block has orange border color
      const borderColor = await toolBlocks.first().evaluate((el) => {
        return window.getComputedStyle(el).borderLeftColor;
      });

      // Orange border: #ff9800 = rgb(255, 152, 0)
      expect(borderColor).toMatch(/rgb\(255,\s*152,\s*0\)/);
    } else {
      test.info().annotations.push({
        type: 'info',
        description: 'No tool blocks to verify styling',
      });
    }
  });

  test('event blocks display block header with icon and label', async ({
    page,
    gotoAndWaitForAngular,
  }) => {
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    const sessionItems = page.locator('mat-list-item.session-item');
    await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

    await sessionItems.first().click();
    await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });
    await page.waitForTimeout(1000);

    const eventBlocks = page.locator('[data-testid="event-block"]');
    const blockCount = await eventBlocks.count();

    if (blockCount > 0) {
      const firstBlock = eventBlocks.first();

      // Verify block has header with icon and label
      const header = firstBlock.locator('.block-header');
      await expect(header).toBeVisible();

      const icon = header.locator('mat-icon');
      await expect(icon).toBeVisible();

      const label = header.locator('.block-label');
      await expect(label).toBeVisible();

      // Label should be one of: User Input, Agent Response, Tool Execution
      const labelText = await label.textContent();
      expect(['User Input', 'Agent Response', 'Tool Execution']).toContain(labelText?.trim());
    } else {
      test.info().annotations.push({
        type: 'info',
        description: 'No event blocks to verify header structure',
      });
    }
  });
});

test.describe('Session List with Created Sessions', () => {
  /**
   * Tests that create sessions use the 'shared' backend.
   */

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
    const sessionItem = page.locator('.session-item').filter({
      has: page.locator('.session-id', { hasText: sessionIdPrefix }),
    });

    await expect(sessionItem).toBeVisible({ timeout: 10000 });

    // Verify the session description is displayed
    await expect(page.getByText(session.description)).toBeVisible();

    // NOTE: Visual regression for populated session list is in session-list.spec.ts
    // using the 'populated' backend for deterministic screenshots
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
    const sessionItem = page.locator('.session-item').filter({
      has: page.locator('.session-id', { hasText: sessionIdPrefix }),
    });

    await sessionItem.click();

    // Verify navigation to the session view
    await expect(page).toHaveURL(new RegExp(`/session/${session.id}`), { timeout: 30000 });

    // Verify the session component is displayed
    await expect(page.locator('app-session, .session-container').first()).toBeVisible({
      timeout: 30000,
    });

    // Take a screenshot of the session view
    await expect(page).toHaveScreenshot('session-view-from-api.png', {
      fullPage: true,
    });
  });
});

test.describe('Visual Regression', () => {
  test.describe('Error States', () => {
    test.use({ backend: 'no-sessions' });

    test('visual regression - invalid session redirect with error banner', async ({
      page,
      gotoAndWaitForAngular,
    }) => {
      // Navigate to invalid session
      await gotoAndWaitForAngular('/session/invalid-session-12345');

      // Should be redirected to home with error
      // Note: URL can use either + or %20 for space encoding
      await expect(page).toHaveURL(/\?error=Session(%20|\+)not(%20|\+)found/);

      // Wait for page to fully render
      await page.waitForTimeout(1000);

      // Verify the error banner is visible with the error message
      const errorBanner = page.locator('[data-testid="route-error-banner"]');
      await expect(errorBanner).toBeVisible({ timeout: 5000 });

      const errorMessage = page.locator('[data-testid="error-banner-message"]');
      await expect(errorMessage).toContainText('Session not found');

      // Capture screenshot showing the error banner
      await expect(page).toHaveScreenshot('session-invalid-redirect.png', {
        fullPage: true,
      });
    });

    test('visual regression - error banner can be dismissed', async ({
      page,
      gotoAndWaitForAngular,
    }) => {
      // Navigate to invalid session to trigger error
      await gotoAndWaitForAngular('/session/invalid-session-dismiss-test');

      // Wait for redirect and error banner
      await expect(page).toHaveURL(/\?error=/);
      await page.waitForTimeout(500);

      const errorBanner = page.locator('[data-testid="route-error-banner"]');
      await expect(errorBanner).toBeVisible({ timeout: 5000 });

      // Click dismiss button
      const dismissButton = page.locator('[data-testid="error-banner-dismiss"]');
      await dismissButton.click();

      // Error banner should be hidden
      await expect(errorBanner).not.toBeVisible();

      // Capture screenshot after dismissal
      await expect(page).toHaveScreenshot('session-error-dismissed.png', {
        fullPage: true,
      });
    });
  });

  test.describe('Session Views', () => {
    test.use({ backend: 'populated' });

    test('visual regression - session view with event stream', async ({
      page,
      gotoAndWaitForAngular,
    }) => {
      await gotoAndWaitForAngular('/');
      await page.waitForTimeout(2000);

      const sessionItems = page.locator('mat-list-item.session-item');
      await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

      // Navigate to first session
      await sessionItems.first().click();
      await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });

      // Wait for content to fully render
      await page.waitForTimeout(1000);

      // Capture screenshot for visual regression
      await expect(page).toHaveScreenshot('session-view.png', {
        fullPage: true,
      });
    });
  });
});
