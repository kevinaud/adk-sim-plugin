/**
 * @fileoverview Component tests for SessionCardListComponent.
 *
 * Visual regression tests for session cards rendered in a list context.
 * The list component provides the mat-list parent required for proper
 * Material styling of mat-list-item elements.
 *
 * Tests various configurations:
 * - Single card vs multiple cards
 * - Cards with and without descriptions
 * - Light and dark modes (automatic via theme fixture)
 *
 * @see frontend/src/app/ui/session/session-card-list/session-card-list.component.ts
 */

import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';

import { expect, test } from './fixtures/theme.fixture';
import { SessionCardListComponent } from '../../src/app/ui/session/session-card-list/session-card-list.component';
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
    createdAt: timestampFromDate(new Date('2024-06-15T10:30:00Z')),
    ...overrides,
  });
}

test.describe('SessionCardListComponent', () => {
  test.describe('visual regression', () => {
    test('single session card', async ({ mount }) => {
      const sessions = [createTestSession()];
      const component = await mount(SessionCardListComponent, {
        props: { sessions },
      });

      await expect(component).toHaveScreenshot('session-card-list-single.png');
    });

    test('session card with description', async ({ mount }) => {
      const sessions = [
        createTestSession({
          description: 'Weather Assistant Demo',
        }),
      ];
      const component = await mount(SessionCardListComponent, {
        props: { sessions },
      });

      await expect(component).toHaveScreenshot('session-card-list-with-description.png');
    });

    test('multiple session cards', async ({ mount }) => {
      const sessions = [
        createTestSession({
          id: '3f13be02-1234-5678-90ab-cdef12345678',
          description: 'Weather Assistant Demo',
        }),
        createTestSession({
          id: '843d4a5a-2345-6789-01bc-def123456789',
          description: 'Code Review Agent',
        }),
        createTestSession({
          id: 'f9dd4ef1-3456-7890-12cd-ef1234567890',
          description: 'Customer Support Bot',
        }),
      ];
      const component = await mount(SessionCardListComponent, {
        props: { sessions },
      });

      await expect(component).toHaveScreenshot('session-card-list-multiple.png');
    });

    test('session card without timestamp', async ({ mount }) => {
      const sessions = [
        create(SimulatorSessionSchema, {
          id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          description: 'Session without timestamp',
        }),
      ];
      const component = await mount(SessionCardListComponent, {
        props: { sessions },
      });

      await expect(component).toHaveScreenshot('session-card-list-no-timestamp.png');
    });

    test('session card with long description', async ({ mount }) => {
      const sessions = [
        createTestSession({
          description: 'This is a very long description that might wrap to multiple lines in the UI',
        }),
      ];
      const component = await mount(SessionCardListComponent, {
        props: { sessions },
      });

      await expect(component).toHaveScreenshot('session-card-list-long-description.png');
    });
  });
});
