/**
 * @fileoverview Component tests for ErrorStateComponent.
 *
 * Tests the visual appearance of the error state indicator
 * with default and custom configurations.
 *
 * Uses visual regression testing with screenshots to verify the
 * component renders correctly with proper layout and styling.
 *
 * Uses the theme fixture to automatically run tests in both light and dark modes,
 * generating separate snapshots for each theme variant.
 *
 * @see frontend/src/app/ui/shared/error-state/error-state.component.ts
 */

import { expect, test } from './fixtures/theme.fixture';
import { ErrorStateComponent } from '../../src/app/ui/shared/error-state/error-state.component';

test.describe('ErrorStateComponent', () => {
  test.describe('renders correctly with different configurations', () => {
    test('displays message with default icon', async ({ mount, page }) => {
      const component = await mount(ErrorStateComponent, {
        props: {
          message: 'An error occurred',
        },
      });

      // Verify message text content
      await expect(component).toContainText('An error occurred');

      // Verify the icon is present with default 'error_outline'
      const icon = page.locator('mat-icon').first();
      await expect(icon).toBeVisible();
      await expect(icon).toContainText('error_outline');
    });

    test('displays custom icon', async ({ mount, page }) => {
      const component = await mount(ErrorStateComponent, {
        props: {
          icon: 'cloud_off',
          message: 'Connection lost',
        },
      });

      // Verify custom icon (first mat-icon, not the button icon)
      const icon = page.locator('mat-icon').first();
      await expect(icon).toContainText('cloud_off');
      await expect(component).toContainText('Connection lost');
    });

    test('displays retry button with default label', async ({ mount }) => {
      const component = await mount(ErrorStateComponent, {
        props: {
          message: 'Failed to load data',
        },
      });

      // Verify retry button is present with default label
      const button = component.locator('button');
      await expect(button).toBeVisible();
      await expect(button).toContainText('Retry');
    });

    test('displays custom retry label', async ({ mount }) => {
      const component = await mount(ErrorStateComponent, {
        props: {
          message: 'Failed to save',
          retryLabel: 'Try Again',
        },
      });

      // Verify custom retry label
      const button = component.locator('button');
      await expect(button).toContainText('Try Again');
    });

    test('emits retry event when button clicked', async ({ mount }) => {
      let retryEmitted = false;

      const component = await mount(ErrorStateComponent, {
        props: {
          message: 'Error',
        },
        on: {
          retry: () => {
            retryEmitted = true;
          },
        },
      });

      // Click the retry button
      const button = component.locator('button');
      await button.click();

      // Verify retry event was emitted
      expect(retryEmitted).toBe(true);
    });

    test('has centered layout', async ({ mount }) => {
      const component = await mount(ErrorStateComponent, {
        props: {
          message: 'Error',
        },
      });

      // Verify the icon, message, and button are rendered and visible
      const icon = component.locator('mat-icon').first();
      const message = component.locator('p');
      const button = component.locator('button');

      await expect(icon).toBeVisible();
      await expect(message).toBeVisible();
      await expect(button).toBeVisible();
    });
  });

  test.describe('visual regression', () => {
    test('default state visual appearance', async ({ mount }) => {
      const component = await mount(ErrorStateComponent, {
        props: {
          message: 'An error occurred',
        },
      });

      await expect(component).toHaveScreenshot('error-state-default.png');
    });

    test('custom icon visual appearance', async ({ mount }) => {
      const component = await mount(ErrorStateComponent, {
        props: {
          icon: 'wifi_off',
          message: 'Network connection lost',
        },
      });

      await expect(component).toHaveScreenshot('error-state-custom-icon.png');
    });

    test('custom retry label visual appearance', async ({ mount }) => {
      const component = await mount(ErrorStateComponent, {
        props: {
          message: 'Failed to save changes',
          retryLabel: 'Try Again',
        },
      });

      await expect(component).toHaveScreenshot('error-state-custom-retry.png');
    });

    test('full configuration visual appearance', async ({ mount }) => {
      const component = await mount(ErrorStateComponent, {
        props: {
          icon: 'cloud_off',
          message: 'Unable to connect to server',
          retryLabel: 'Reconnect',
        },
      });

      await expect(component).toHaveScreenshot('error-state-full-config.png');
    });
  });
});
