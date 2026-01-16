/**
 * @fileoverview Component tests for LoadingStateComponent.
 *
 * Tests the visual appearance of the loading state indicator
 * with default and custom configurations.
 *
 * Uses visual regression testing with screenshots to verify the
 * component renders correctly with proper layout and styling.
 *
 * Uses the theme fixture to automatically run tests in both light and dark modes,
 * generating separate snapshots for each theme variant.
 *
 * @see frontend/src/app/ui/shared/loading-state/loading-state.component.ts
 */

import { expect, test } from './fixtures/theme.fixture';
import { LoadingStateComponent } from '../../src/app/ui/shared/loading-state/loading-state.component';

test.describe('LoadingStateComponent', () => {
  test.describe('renders correctly with different configurations', () => {
    test('displays default message and spinner', async ({ mount, page }) => {
      const component = await mount(LoadingStateComponent);

      // Verify default text content
      await expect(component).toContainText('Loading...');

      // Verify the spinner is present
      const spinner = page.locator('mat-spinner');
      await expect(spinner).toBeVisible();
    });

    test('displays custom message', async ({ mount }) => {
      const component = await mount(LoadingStateComponent, {
        props: {
          message: 'Loading sessions...',
        },
      });

      // Verify custom text content
      await expect(component).toContainText('Loading sessions...');
    });

    test('has centered layout', async ({ mount }) => {
      const component = await mount(LoadingStateComponent);

      // Verify the spinner and message are rendered and visible
      // The actual layout is verified via visual regression tests
      const spinner = component.locator('mat-spinner');
      const message = component.locator('p');

      await expect(spinner).toBeVisible();
      await expect(message).toBeVisible();
      await expect(message).toContainText('Loading...');
    });
  });

  test.describe('visual regression', () => {
    test('default state visual appearance', async ({ mount }) => {
      const component = await mount(LoadingStateComponent);

      await expect(component).toHaveScreenshot('loading-state-default.png');
    });

    test('custom message visual appearance', async ({ mount }) => {
      const component = await mount(LoadingStateComponent, {
        props: {
          message: 'Loading sessions...',
        },
      });

      await expect(component).toHaveScreenshot('loading-state-custom-message.png');
    });

    test('small spinner visual appearance', async ({ mount }) => {
      const component = await mount(LoadingStateComponent, {
        props: {
          diameter: 32,
          message: 'Please wait...',
        },
      });

      await expect(component).toHaveScreenshot('loading-state-small-spinner.png');
    });
  });
});
