/**
 * @fileoverview Component tests for SessionCardComponent.
 *
 * Tests the visual appearance of the session card in various configurations:
 * - With and without description
 * - With and without creation time
 * - In light and dark modes (automatic via theme fixture)
 *
 * Uses visual regression testing with screenshots to verify the
 * component renders correctly with proper layout and styling.
 *
 * @see frontend/src/app/ui/session/session-card/session-card.component.ts
 */

import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';

import { expect, test } from './fixtures/theme.fixture';
import { SessionCardComponent } from '../../src/app/ui/session/session-card/session-card.component';
import {
  SimulatorSessionSchema,
  type SimulatorSession,
} from '../../src/app/generated/adksim/v1/simulator_session_pb';

/**
 * Creates a test session with the given overrides.
 */
function createTestSession(overrides: Partial<SimulatorSession> = {}): SimulatorSession {
  return create(SimulatorSessionSchema, {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: '',
    ...overrides,
  });
}

test.describe('SessionCardComponent', () => {
  test.describe('renders correctly with different configurations', () => {
    test('displays session ID truncated', async ({ mount }) => {
      const session = createTestSession();
      const component = await mount(SessionCardComponent, {
        props: { session },
      });

      // Verify truncated ID
      const idElement = component.locator('[data-testid="session-id"]');
      await expect(idElement).toContainText('a1b2c3d4...');
    });

    test('displays full session ID in title attribute', async ({ mount }) => {
      const session = createTestSession();
      const component = await mount(SessionCardComponent, {
        props: { session },
      });

      const idElement = component.locator('[data-testid="session-id"]');
      await expect(idElement).toHaveAttribute('title', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    });

    test('displays description when provided', async ({ mount }) => {
      const session = createTestSession({ description: 'Test simulation run' });
      const component = await mount(SessionCardComponent, {
        props: { session },
      });

      const descElement = component.locator('[data-testid="session-description"]');
      await expect(descElement).toContainText('Test simulation run');
    });

    test('does not display description when empty', async ({ mount }) => {
      const session = createTestSession({ description: '' });
      const component = await mount(SessionCardComponent, {
        props: { session },
      });

      const descElement = component.locator('[data-testid="session-description"]');
      await expect(descElement).toHaveCount(0);
    });

    test('displays formatted creation time', async ({ mount }) => {
      const session = createTestSession({
        createdAt: timestampFromDate(new Date('2024-06-15T10:30:00Z')),
      });
      const component = await mount(SessionCardComponent, {
        props: { session },
      });

      const createdElement = component.locator('[data-testid="session-created"]');
      await expect(createdElement).toContainText('Jun');
      await expect(createdElement).toContainText('15');
      await expect(createdElement).toContainText('2024');
    });

    test('displays Unknown when creation time not set', async ({ mount }) => {
      const session = createTestSession();
      const component = await mount(SessionCardComponent, {
        props: { session },
      });

      const createdElement = component.locator('[data-testid="session-created"]');
      await expect(createdElement).toContainText('Unknown');
    });

    test('displays Active status', async ({ mount }) => {
      const session = createTestSession();
      const component = await mount(SessionCardComponent, {
        props: { session },
      });

      const statusElement = component.locator('[data-testid="session-status"]');
      await expect(statusElement).toContainText('Active');
    });

    test('displays folder_open icon', async ({ mount, page }) => {
      const session = createTestSession();
      await mount(SessionCardComponent, {
        props: { session },
      });

      const icon = page.locator('mat-list-item mat-icon').first();
      await expect(icon).toContainText('folder_open');
    });

    test('displays chevron_right meta icon', async ({ mount, page }) => {
      const session = createTestSession();
      await mount(SessionCardComponent, {
        props: { session },
      });

      const icons = page.locator('mat-list-item mat-icon');
      const lastIcon = icons.last();
      await expect(lastIcon).toContainText('chevron_right');
    });

    test('is keyboard accessible with tabindex', async ({ mount, page }) => {
      const session = createTestSession();
      await mount(SessionCardComponent, {
        props: { session },
      });

      const listItem = page.locator('mat-list-item');
      await expect(listItem).toHaveAttribute('tabindex', '0');
    });
  });

  test.describe('visual regression', () => {
    test('basic session card visual appearance', async ({ mount }) => {
      const session = createTestSession({
        createdAt: timestampFromDate(new Date('2024-06-15T10:30:00Z')),
      });
      const component = await mount(SessionCardComponent, {
        props: { session },
      });

      await expect(component).toHaveScreenshot('session-card-basic.png');
    });

    test('session card with description visual appearance', async ({ mount }) => {
      const session = createTestSession({
        description: 'Test simulation with custom agent',
        createdAt: timestampFromDate(new Date('2024-06-15T10:30:00Z')),
      });
      const component = await mount(SessionCardComponent, {
        props: { session },
      });

      await expect(component).toHaveScreenshot('session-card-with-description.png');
    });

    test('session card without creation time visual appearance', async ({ mount }) => {
      const session = createTestSession({
        description: 'Session without timestamp',
      });
      const component = await mount(SessionCardComponent, {
        props: { session },
      });

      await expect(component).toHaveScreenshot('session-card-no-timestamp.png');
    });

    test('session card with long description visual appearance', async ({ mount }) => {
      const session = createTestSession({
        description: 'This is a very long description that might wrap to multiple lines',
        createdAt: timestampFromDate(new Date('2024-06-15T10:30:00Z')),
      });
      const component = await mount(SessionCardComponent, {
        props: { session },
      });

      await expect(component).toHaveScreenshot('session-card-long-description.png');
    });
  });
});
