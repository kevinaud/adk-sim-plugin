/**
 * @fileoverview Component tests for EventStreamComponent.
 *
 * Tests the visual appearance of the event stream container
 * across different states: empty and with events.
 *
 * Uses visual regression testing with screenshots to verify the
 * component renders correctly with proper layout and styling.
 *
 * Uses the theme fixture to automatically run tests in both light and dark modes,
 * generating separate snapshots for each theme variant.
 *
 * @see frontend/src/app/ui/event-stream/event-stream.component.ts
 */

import type { Content } from '@adk-sim/converters';
import { expect, test } from './fixtures/theme.fixture';

import { EventStreamComponent } from '../../src/app/ui/event-stream/event-stream.component';

/**
 * Create a sample Content object for testing.
 */
function createContent(role: 'user' | 'model', text: string): Content {
  return {
    role,
    parts: [{ text }],
  };
}

/**
 * Create a Content object with a function call.
 */
function createFunctionCallContent(name: string, args: Record<string, unknown>): Content {
  return {
    role: 'model',
    parts: [
      {
        functionCall: { name, args },
      },
    ],
  };
}

/**
 * Create a Content object with a function response.
 */
function createFunctionResponseContent(name: string, response: Record<string, unknown>): Content {
  return {
    role: 'user',
    parts: [
      {
        functionResponse: { name, response },
      },
    ],
  };
}

test.describe('EventStreamComponent', () => {
  test.describe('renders correctly for each state', () => {
    test('displays empty state when no events', async ({ mount, page }) => {
      const component = await mount(EventStreamComponent, {
        props: {
          events: [],
        },
      });

      // Verify empty state content
      await expect(component).toContainText('No conversation events yet');
      await expect(component).toContainText('Events will appear here');

      // Verify the empty state container is visible
      const emptyState = page.locator('[data-testid="empty-state"]');
      await expect(emptyState).toBeVisible();
    });

    test('displays single user message', async ({ mount, page }) => {
      const events: Content[] = [createContent('user', 'Hello, how can you help me today?')];

      const component = await mount(EventStreamComponent, {
        props: { events },
      });

      // Verify user message is displayed
      await expect(component).toContainText('Hello, how can you help me today?');

      // Verify event block is visible
      const eventBlock = page.locator('[data-testid="event-block"]');
      await expect(eventBlock).toBeVisible();
    });

    test('displays single model response', async ({ mount, page }) => {
      const events: Content[] = [
        createContent('model', 'I can help you with various tasks. What would you like to do?'),
      ];

      const component = await mount(EventStreamComponent, {
        props: { events },
      });

      // Verify model response is displayed
      await expect(component).toContainText('I can help you with various tasks');

      // Verify event block is visible
      const eventBlock = page.locator('[data-testid="event-block"]');
      await expect(eventBlock).toBeVisible();
    });

    test('displays conversation with multiple events', async ({ mount, page }) => {
      const events: Content[] = [
        createContent('user', 'What is the weather like?'),
        createFunctionCallContent('get_weather', { location: 'San Francisco' }),
        createFunctionResponseContent('get_weather', {
          temperature: 72,
          condition: 'Sunny',
        }),
        createContent(
          'model',
          'The weather in San Francisco is sunny with a temperature of 72 degrees.',
        ),
      ];

      const component = await mount(EventStreamComponent, {
        props: { events },
      });

      // Verify all events are displayed
      await expect(component).toContainText('What is the weather like?');
      await expect(component).toContainText('get_weather');
      await expect(component).toContainText('San Francisco');
      await expect(component).toContainText('72 degrees');

      // Verify multiple event blocks are visible
      const eventBlocks = page.locator('[data-testid="event-block"]');
      await expect(eventBlocks).toHaveCount(4);
    });
  });

  test.describe('visual regression', () => {
    test('empty state visual appearance', async ({ mount }) => {
      const component = await mount(EventStreamComponent, {
        props: {
          events: [],
        },
      });

      await expect(component).toHaveScreenshot('event-stream-empty.png');
    });

    test('single user message visual appearance', async ({ mount }) => {
      const events: Content[] = [createContent('user', 'Hello, how can you help me today?')];

      const component = await mount(EventStreamComponent, {
        props: { events },
      });

      await expect(component).toHaveScreenshot('event-stream-user-message.png');
    });

    test('single model response visual appearance', async ({ mount }) => {
      const events: Content[] = [
        createContent('model', 'I can help you with various tasks. What would you like to do?'),
      ];

      const component = await mount(EventStreamComponent, {
        props: { events },
      });

      await expect(component).toHaveScreenshot('event-stream-model-response.png');
    });

    // TODO: Re-enable once snapshot baseline is updated - size mismatch between CI and local Docker
    test.skip('conversation with tool execution visual appearance', async ({ mount }) => {
      const events: Content[] = [
        createContent('user', 'What is the weather like?'),
        createFunctionCallContent('get_weather', { location: 'San Francisco' }),
        createFunctionResponseContent('get_weather', {
          temperature: 72,
          condition: 'Sunny',
        }),
        createContent(
          'model',
          'The weather in San Francisco is sunny with a temperature of 72 degrees.',
        ),
      ];

      const component = await mount(EventStreamComponent, {
        props: { events },
      });

      // Higher threshold due to font rendering differences between local Docker and CI Docker
      await expect(component).toHaveScreenshot('event-stream-conversation.png', {
        maxDiffPixelRatio: 0.1,
      });
    });
  });
});
