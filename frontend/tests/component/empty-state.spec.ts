/**
 * @fileoverview Component tests for EmptyStateComponent.
 *
 * Tests the visual appearance of the empty state indicator
 * with default and custom configurations.
 *
 * Uses visual regression testing with screenshots to verify the
 * component renders correctly with proper layout and styling.
 *
 * Uses the theme fixture to automatically run tests in both light and dark modes,
 * generating separate snapshots for each theme variant.
 *
 * @see frontend/src/app/ui/shared/empty-state/empty-state.component.ts
 */

import { expect, test } from './fixtures/theme.fixture';
import { EmptyStateComponent } from '../../src/app/ui/shared/empty-state/empty-state.component';

test.describe('EmptyStateComponent', () => {
  test.describe('renders correctly with different configurations', () => {
    test('displays message with default icon', async ({ mount, page }) => {
      const component = await mount(EmptyStateComponent, {
        props: {
          message: 'No items available',
        },
      });

      // Verify message text content
      await expect(component).toContainText('No items available');

      // Verify the icon is present with default 'inbox'
      const icon = page.locator('mat-icon');
      await expect(icon).toBeVisible();
      await expect(icon).toContainText('inbox');
    });

    test('displays custom icon', async ({ mount, page }) => {
      const component = await mount(EmptyStateComponent, {
        props: {
          icon: 'search_off',
          message: 'No results found',
        },
      });

      // Verify custom icon
      const icon = page.locator('mat-icon');
      await expect(icon).toContainText('search_off');
      await expect(component).toContainText('No results found');
    });

    test('displays hint text when provided', async ({ mount }) => {
      const component = await mount(EmptyStateComponent, {
        props: {
          message: 'No sessions available',
          hint: 'Sessions will appear here when created by an ADK agent.',
        },
      });

      // Verify both message and hint
      await expect(component).toContainText('No sessions available');
      await expect(component).toContainText('Sessions will appear here when created by an ADK agent.');
    });

    test('has centered layout', async ({ mount }) => {
      const component = await mount(EmptyStateComponent, {
        props: {
          message: 'No items',
        },
      });

      // Verify the icon and message are rendered and visible
      const icon = component.locator('mat-icon');
      const message = component.locator('p').first();

      await expect(icon).toBeVisible();
      await expect(message).toBeVisible();
    });
  });

  test.describe('visual regression', () => {
    test('default state visual appearance', async ({ mount }) => {
      const component = await mount(EmptyStateComponent, {
        props: {
          message: 'No items available',
        },
      });

      await expect(component).toHaveScreenshot('empty-state-default.png');
    });

    test('custom icon visual appearance', async ({ mount }) => {
      const component = await mount(EmptyStateComponent, {
        props: {
          icon: 'folder_off',
          message: 'No folders found',
        },
      });

      await expect(component).toHaveScreenshot('empty-state-custom-icon.png');
    });

    test('with hint visual appearance', async ({ mount }) => {
      const component = await mount(EmptyStateComponent, {
        props: {
          message: 'No sessions available',
          hint: 'Sessions will appear here when created by an ADK agent.',
        },
      });

      await expect(component).toHaveScreenshot('empty-state-with-hint.png');
    });

    test('full configuration visual appearance', async ({ mount }) => {
      const component = await mount(EmptyStateComponent, {
        props: {
          icon: 'search_off',
          message: 'No results found',
          hint: 'Try adjusting your search criteria.',
        },
      });

      await expect(component).toHaveScreenshot('empty-state-full-config.png');
    });
  });
});
