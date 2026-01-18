/**
 * @fileoverview Component tests for EventBlockComponent.
 *
 * Tests the visual appearance of individual event blocks
 * for different content types: user input, model response, and tool execution.
 *
 * Uses visual regression testing with screenshots to verify the
 * component renders correctly with proper icons, colors, and styling.
 *
 * Uses the theme fixture to automatically run tests in both light and dark modes,
 * generating separate snapshots for each theme variant.
 *
 * @see frontend/src/app/ui/event-stream/event-block/event-block.component.ts
 */

import type { Content } from '@adk-sim/converters';
import { expect, test } from './fixtures/theme.fixture';

import { EventBlockComponent } from '../../src/app/ui/event-stream/event-block';

test.describe('EventBlockComponent', () => {
  test.describe('renders correctly for each block type', () => {
    test('displays user input with person icon', async ({ mount, page }) => {
      const content: Content = {
        role: 'user',
        parts: [{ text: 'Hello, how can you help me today?' }],
      };

      const component = await mount(EventBlockComponent, {
        props: { content },
      });

      // Verify text content
      await expect(component).toContainText('User Input');
      await expect(component).toContainText('Hello, how can you help me today?');

      // Verify the icon is present
      const icon = page.locator('mat-icon').first();
      await expect(icon).toContainText('person');

      // Verify the block type attribute
      const block = page.locator('[data-testid="event-block"]');
      await expect(block).toHaveAttribute('data-type', 'user');
    });

    test('displays model response with smart_toy icon', async ({ mount, page }) => {
      const content: Content = {
        role: 'model',
        parts: [{ text: 'I can help you with various tasks.' }],
      };

      const component = await mount(EventBlockComponent, {
        props: { content },
      });

      // Verify text content
      await expect(component).toContainText('Agent Response');
      await expect(component).toContainText('I can help you with various tasks.');

      // Verify the icon is present
      const icon = page.locator('mat-icon').first();
      await expect(icon).toContainText('smart_toy');

      // Verify the block type attribute
      const block = page.locator('[data-testid="event-block"]');
      await expect(block).toHaveAttribute('data-type', 'model');
    });

    test('displays function call as tool execution', async ({ mount, page }) => {
      const content: Content = {
        role: 'model',
        parts: [
          {
            functionCall: {
              name: 'get_weather',
              args: { location: 'San Francisco', unit: 'fahrenheit' },
            },
          },
        ],
      };

      const component = await mount(EventBlockComponent, {
        props: { content },
      });

      // Verify text content
      await expect(component).toContainText('Tool Execution');
      await expect(component).toContainText('get_weather');
      await expect(component).toContainText('San Francisco');

      // Verify the icon is present
      const icon = page.locator('mat-icon').first();
      await expect(icon).toContainText('build');

      // Verify the block type attribute
      const block = page.locator('[data-testid="event-block"]');
      await expect(block).toHaveAttribute('data-type', 'tool');
    });

    test('displays function response as tool execution', async ({ mount, page }) => {
      const content: Content = {
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: 'get_weather',
              response: { temperature: 72, condition: 'Sunny' },
            },
          },
        ],
      };

      const component = await mount(EventBlockComponent, {
        props: { content },
      });

      // Verify text content
      await expect(component).toContainText('Tool Execution');
      await expect(component).toContainText('get_weather');
      await expect(component).toContainText('72');
      await expect(component).toContainText('Sunny');

      // Verify the block type attribute
      const block = page.locator('[data-testid="event-block"]');
      await expect(block).toHaveAttribute('data-type', 'tool');
    });

    test('handles multiple parts in single content', async ({ mount, page }) => {
      const content: Content = {
        role: 'model',
        parts: [
          { text: 'Here is the weather information:' },
          {
            functionCall: {
              name: 'display_weather',
              args: { data: 'formatted' },
            },
          },
        ],
      };

      const component = await mount(EventBlockComponent, {
        props: { content },
      });

      // Should be classified as tool due to functionCall
      const block = page.locator('[data-testid="event-block"]');
      await expect(block).toHaveAttribute('data-type', 'tool');

      // Both parts should be rendered
      await expect(component).toContainText('Here is the weather information:');
      await expect(component).toContainText('display_weather');
    });
  });

  test.describe('visual regression', () => {
    test('user input visual appearance', async ({ mount }) => {
      const content: Content = {
        role: 'user',
        parts: [{ text: 'Hello, how can you help me today?' }],
      };

      const component = await mount(EventBlockComponent, {
        props: { content },
      });

      await expect(component).toHaveScreenshot('event-block-user.png');
    });

    test('model response visual appearance', async ({ mount }) => {
      const content: Content = {
        role: 'model',
        parts: [{ text: 'I can help you with various tasks. What would you like to do?' }],
      };

      const component = await mount(EventBlockComponent, {
        props: { content },
      });

      await expect(component).toHaveScreenshot('event-block-model.png');
    });

    test('function call visual appearance', async ({ mount }) => {
      const content: Content = {
        role: 'model',
        parts: [
          {
            functionCall: {
              name: 'get_weather',
              args: { location: 'San Francisco', unit: 'fahrenheit' },
            },
          },
        ],
      };

      const component = await mount(EventBlockComponent, {
        props: { content },
      });

      // Higher threshold due to font rendering differences between local Docker and CI Docker
      await expect(component).toHaveScreenshot('event-block-function-call.png', {
        maxDiffPixelRatio: 0.10,
      });
    });

    test('function response visual appearance', async ({ mount }) => {
      const content: Content = {
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: 'get_weather',
              response: { temperature: 72, condition: 'Sunny', humidity: '45%' },
            },
          },
        ],
      };

      const component = await mount(EventBlockComponent, {
        props: { content },
      });

      // Higher threshold due to font rendering differences between local Docker and CI Docker
      await expect(component).toHaveScreenshot('event-block-function-response.png', {
        maxDiffPixelRatio: 0.10,
      });
    });

    test('long text content visual appearance', async ({ mount }) => {
      const content: Content = {
        role: 'model',
        parts: [
          {
            text: `This is a longer response that demonstrates how the component handles multi-line text content. The text should wrap properly and maintain readability while preserving the overall layout of the event block.

The component should handle:
- Multiple paragraphs
- Line breaks
- Long unbroken strings without overflowing

This helps ensure the visual appearance remains consistent across different content lengths.`,
          },
        ],
      };

      const component = await mount(EventBlockComponent, {
        props: { content },
      });

      await expect(component).toHaveScreenshot('event-block-long-text.png');
    });
  });
});
