/**
 * @fileoverview Component tests for ConnectionStatusComponent.
 *
 * Tests the visual appearance of the connection status indicator
 * across all three states: connected, connecting, and disconnected.
 *
 * Uses visual regression testing with screenshots to verify the
 * component renders correctly with proper icons and colors.
 *
 * Uses the theme fixture to automatically run tests in both light and dark modes,
 * generating separate snapshots for each theme variant.
 *
 * @see frontend/src/app/ui/shared/connection-status/connection-status.component.ts
 */

import { expect, test } from './fixtures/theme.fixture';
import {
  ConnectionStatusComponent,
  ConnectionStatus,
} from '../../src/app/ui/shared/connection-status/connection-status.component';

test.describe('ConnectionStatusComponent', () => {
  test.describe('renders correctly for each status', () => {
    test('displays connected state with green check icon', async ({ mount, page }) => {
      const component = await mount(ConnectionStatusComponent, {
        props: {
          status: 'connected' as ConnectionStatus,
        },
      });

      // Verify text content
      await expect(component).toContainText('Connected');

      // Verify the icon is present (use page to query inside the component)
      const icon = page.locator('mat-icon');
      await expect(icon).toContainText('check_circle');

      // Verify the CSS class is applied
      const statusElement = page.locator('.connection-status');
      await expect(statusElement).toHaveClass(/status-connected/);
    });

    test('displays connecting state with orange sync icon', async ({ mount, page }) => {
      const component = await mount(ConnectionStatusComponent, {
        props: {
          status: 'connecting' as ConnectionStatus,
        },
      });

      // Verify text content
      await expect(component).toContainText('Connecting');

      // Verify the icon is present
      const icon = page.locator('mat-icon');
      await expect(icon).toContainText('sync');

      // Verify the CSS class is applied
      const statusElement = page.locator('.connection-status');
      await expect(statusElement).toHaveClass(/status-connecting/);
    });

    test('displays disconnected state with red error icon', async ({ mount, page }) => {
      const component = await mount(ConnectionStatusComponent, {
        props: {
          status: 'disconnected' as ConnectionStatus,
        },
      });

      // Verify text content
      await expect(component).toContainText('Disconnected');

      // Verify the icon is present
      const icon = page.locator('mat-icon');
      await expect(icon).toContainText('error');

      // Verify the CSS class is applied
      const statusElement = page.locator('.connection-status');
      await expect(statusElement).toHaveClass(/status-disconnected/);
    });
  });

  test.describe('visual regression', () => {
    test('connected state visual appearance', async ({ mount }) => {
      const component = await mount(ConnectionStatusComponent, {
        props: {
          status: 'connected' as ConnectionStatus,
        },
      });

      await expect(component).toHaveScreenshot('connection-status-connected.png');
    });

    test('connecting state visual appearance', async ({ mount }) => {
      const component = await mount(ConnectionStatusComponent, {
        props: {
          status: 'connecting' as ConnectionStatus,
        },
      });

      await expect(component).toHaveScreenshot('connection-status-connecting.png');
    });

    test('disconnected state visual appearance', async ({ mount }) => {
      const component = await mount(ConnectionStatusComponent, {
        props: {
          status: 'disconnected' as ConnectionStatus,
        },
      });

      await expect(component).toHaveScreenshot('connection-status-disconnected.png');
    });
  });
});
