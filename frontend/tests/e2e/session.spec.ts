/**
 * E2E tests for Session page with split-pane layout.
 *
 * Tests cover:
 * - Header bar with "Simulating: {agentName}" and status badge
 * - Status badge states: "Awaiting Query", "Active", "Completed"
 * - Collapsible "System Instructions" section
 * - Split-pane layout with Event Stream (left) and Control Panel (right)
 * - Control Panel integration with tool catalog and tabs
 *
 * Backend Instances:
 * - populated (8082): For session page tests (pre-seeded sessions)
 * - shared (8080): For session creation tests (default)
 *
 * Prerequisites:
 * 1. Docker backends running (via global-setup or manually)
 * 2. Angular dev server running (via webServer config or manually)
 *
 * @see mddocs/frontend/sprints/sprint5.md#s5pr10-integrate-controlpanel-into-sessioncomponent
 */

import { expect, test } from './utils';

test.describe('Session Page Layout', () => {
  // Use populated backend which has pre-seeded sessions
  test.use({ backend: 'populated' });

  test('displays header bar with agent name', async ({ page, gotoAndWaitForAngular }) => {
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    const sessionItems = page.locator('app-session-card mat-list-item');
    await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

    // Navigate to a session
    await sessionItems.first().click();
    await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });

    // Wait for component to load
    await page.waitForTimeout(1000);

    // Check header bar
    const header = page.locator('[data-testid="session-header"]');
    await expect(header).toBeVisible();
    await expect(header).toContainText('Simulating:');
    await expect(header).toContainText('TestAgent');
  });

  test('displays status badge with "Awaiting Query" initially', async ({
    page,
    gotoAndWaitForAngular,
  }) => {
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    const sessionItems = page.locator('app-session-card mat-list-item');
    await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

    await sessionItems.first().click();
    await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });
    await page.waitForTimeout(1000);

    // Check status badge
    const badge = page.locator('[data-testid="status-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('Awaiting Query');
    await expect(badge).toHaveClass(/awaiting/);
  });

  test('has collapsible System Instructions section', async ({ page, gotoAndWaitForAngular }) => {
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    const sessionItems = page.locator('app-session-card mat-list-item');
    await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

    await sessionItems.first().click();
    await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });
    await page.waitForTimeout(1000);

    // Check System Instructions section exists
    const section = page.locator('[data-testid="system-instructions"]');
    await expect(section).toBeVisible();
    await expect(section).toContainText('System Instructions');

    // Initially collapsed
    const content = page.locator('[data-testid="instructions-content"]');
    await expect(content).not.toBeVisible();

    // Click to expand
    const header = section.locator('.instructions-header');
    await header.click();
    await expect(content).toBeVisible();

    // Click again to collapse
    await header.click();
    await expect(content).not.toBeVisible();
  });

  test('displays split-pane layout with Event Stream and Control Panel', async ({
    page,
    gotoAndWaitForAngular,
  }) => {
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    const sessionItems = page.locator('app-session-card mat-list-item');
    await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

    await sessionItems.first().click();
    await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });
    await page.waitForTimeout(1000);

    // Check split-pane exists
    const splitPane = page.locator('app-split-pane');
    await expect(splitPane).toBeVisible();

    // Check Event Stream pane
    const eventStreamPane = page.locator('[data-testid="event-stream-pane"]');
    await expect(eventStreamPane).toBeVisible();
    await expect(eventStreamPane.locator('.event-stream-title')).toContainText('Event Stream');

    // Check Control Panel sidebar
    const sidebar = page.locator('[data-testid="control-panel-sidebar"]');
    await expect(sidebar).toBeVisible();

    // Check Control Panel component
    const controlPanel = page.locator('[data-testid="control-panel"]');
    await expect(controlPanel).toBeVisible();
  });

  test('Event Stream shows empty state when no events', async ({ page, gotoAndWaitForAngular }) => {
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    const sessionItems = page.locator('app-session-card mat-list-item');
    await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

    await sessionItems.first().click();
    await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });
    await page.waitForTimeout(1000);

    // Check EventStreamComponent empty state (scoped to event-stream)
    const eventStream = page.locator('[data-testid="event-stream"]');
    await expect(eventStream).toBeVisible();
    const emptyState = eventStream.locator('[data-testid="empty-state"]');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('No conversation events yet');
  });

  test('Event Stream has expand/collapse buttons', async ({ page, gotoAndWaitForAngular }) => {
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    const sessionItems = page.locator('app-session-card mat-list-item');
    await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

    await sessionItems.first().click();
    await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });
    await page.waitForTimeout(1000);

    // Check expand/collapse buttons
    const actions = page.locator('.event-stream-actions');
    await expect(actions).toBeVisible();

    const buttons = actions.locator('button');
    await expect(buttons).toHaveCount(2);
  });

  test('Control Panel shows "Choose Action" header', async ({ page, gotoAndWaitForAngular }) => {
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    const sessionItems = page.locator('app-session-card mat-list-item');
    await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

    await sessionItems.first().click();
    await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });
    await page.waitForTimeout(1000);

    // Check Control Panel header
    const panelHeader = page.locator('[data-testid="panel-header"]');
    await expect(panelHeader).toBeVisible();
    await expect(panelHeader).toContainText('Choose Action');
  });

  test('Control Panel has CALL TOOL and FINAL RESPONSE tabs', async ({
    page,
    gotoAndWaitForAngular,
  }) => {
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    const sessionItems = page.locator('app-session-card mat-list-item');
    await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

    await sessionItems.first().click();
    await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });
    await page.waitForTimeout(1000);

    // Check tabs
    const tabNavigation = page.locator('[data-testid="tab-navigation"]');
    await expect(tabNavigation).toBeVisible();

    const toolTab = page.locator('[data-testid="tab-tool"]');
    await expect(toolTab).toBeVisible();
    await expect(toolTab).toContainText('CALL TOOL');

    const responseTab = page.locator('[data-testid="tab-response"]');
    await expect(responseTab).toBeVisible();
    await expect(responseTab).toContainText('FINAL RESPONSE');
  });

  test('can switch between tabs', async ({ page, gotoAndWaitForAngular }) => {
    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    const sessionItems = page.locator('app-session-card mat-list-item');
    await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

    await sessionItems.first().click();
    await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });
    await page.waitForTimeout(1000);

    // Initially on CALL TOOL tab
    const toolTab = page.locator('[data-testid="tab-tool"]');
    await expect(toolTab).toHaveClass(/active/);

    const catalogView = page.locator('[data-testid="catalog-view"]');
    await expect(catalogView).toBeVisible();

    // Click FINAL RESPONSE tab
    const responseTab = page.locator('[data-testid="tab-response"]');
    await responseTab.click();
    await page.waitForTimeout(300);

    // FINAL RESPONSE tab should be active
    await expect(responseTab).toHaveClass(/active/);

    // Final response view should be visible
    const finalResponseView = page.locator('[data-testid="final-response-view"]');
    await expect(finalResponseView).toBeVisible();
  });
});

// TODO: Skip due to screenshot differences between local and CI environments
// See: https://github.com/kevinaud/adk-sim-plugin/issues/204
test.describe.skip('Visual Regression - Session Page', () => {
  test.use({ backend: 'populated' });

  test('session page initial state - light theme', async ({ page, gotoAndWaitForAngular }) => {
    // Set viewport to 1280px width as specified in acceptance criteria
    await page.setViewportSize({ width: 1280, height: 800 });

    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    const sessionItems = page.locator('app-session-card mat-list-item');
    await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

    await sessionItems.first().click();
    await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });
    await page.waitForTimeout(1500);

    // Capture screenshot of initial state
    await expect(page).toHaveScreenshot('session-initial-state-light.png', {
      fullPage: true,
    });
  });

  test('session page initial state - dark theme', async ({ page, gotoAndWaitForAngular }) => {
    // Set viewport to 1280px width
    await page.setViewportSize({ width: 1280, height: 800 });

    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    // Enable dark mode
    const darkModeToggle = page.locator('app-dark-mode-toggle button');
    if (await darkModeToggle.isVisible()) {
      await darkModeToggle.click();
      await page.waitForTimeout(300);
    }

    const sessionItems = page.locator('app-session-card mat-list-item');
    await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

    await sessionItems.first().click();
    await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });
    await page.waitForTimeout(1500);

    // Capture screenshot of initial state in dark mode
    await expect(page).toHaveScreenshot('session-initial-state-dark.png', {
      fullPage: true,
    });
  });

  test('session page with system instructions expanded - light theme', async ({
    page,
    gotoAndWaitForAngular,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    const sessionItems = page.locator('app-session-card mat-list-item');
    await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

    await sessionItems.first().click();
    await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });
    await page.waitForTimeout(1000);

    // Expand system instructions
    const instructionsHeader = page.locator('.instructions-header');
    await instructionsHeader.click();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('session-instructions-expanded.png', {
      fullPage: true,
    });
  });

  test('session page FINAL RESPONSE tab - light theme', async ({ page, gotoAndWaitForAngular }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await gotoAndWaitForAngular('/');
    await page.waitForTimeout(2000);

    const sessionItems = page.locator('app-session-card mat-list-item');
    await expect(sessionItems.first()).toBeVisible({ timeout: 10000 });

    await sessionItems.first().click();
    await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });
    await page.waitForTimeout(1000);

    // Switch to FINAL RESPONSE tab
    const responseTab = page.locator('[data-testid="tab-response"]');
    await responseTab.click();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('session-final-response-tab.png', {
      fullPage: true,
    });
  });
});

test.describe('Session Page with Created Session', () => {
  // Use shared backend for session creation tests

  test('can navigate to created session and see full layout', async ({
    page,
    gotoAndWaitForAngular,
    client,
  }) => {
    // Create a new session via API
    const { session } = await client.createSession({
      description: 'E2E Test Session for Split-Pane Layout',
    });

    // Navigate directly to the session
    await gotoAndWaitForAngular(`/session/${session.id}`);
    await page.waitForTimeout(1500);

    // Verify header
    const header = page.locator('[data-testid="session-header"]');
    await expect(header).toBeVisible();

    // Verify status badge
    const badge = page.locator('[data-testid="status-badge"]');
    await expect(badge).toBeVisible();

    // Verify split-pane layout
    const splitPane = page.locator('app-split-pane');
    await expect(splitPane).toBeVisible();

    // Verify Event Stream pane
    const eventStreamPane = page.locator('[data-testid="event-stream-pane"]');
    await expect(eventStreamPane).toBeVisible();

    // Verify Control Panel
    const controlPanel = page.locator('[data-testid="control-panel"]');
    await expect(controlPanel).toBeVisible();
  });
});
