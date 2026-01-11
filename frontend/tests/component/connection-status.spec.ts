/**
 * @fileoverview Component tests for ConnectionStatusComponent.
 *
 * Tests the visual appearance and behavior of the connection status indicator
 * in its three states: connected, connecting, and disconnected.
 *
 * @see frontend/src/app/ui/shared/connection-status/connection-status.component.ts
 */

import { expect, test } from '@sand4rt/experimental-ct-angular';

import {
  ConnectionStatus,
  ConnectionStatusComponent,
} from '../../src/app/ui/shared/connection-status/connection-status.component';

test.describe('ConnectionStatusComponent', () => {
  test('renders connected state', async ({ mount }) => {
    const component = await mount(ConnectionStatusComponent, {
      props: {
        status: 'connected' as ConnectionStatus,
      },
    });

    await expect(component).toContainText('Connected');
    await expect(component.locator('mat-icon')).toContainText('check_circle');
    await expect(component).toHaveScreenshot('connection-status-connected.png');
  });

  test('renders disconnected state', async ({ mount }) => {
    const component = await mount(ConnectionStatusComponent, {
      props: {
        status: 'disconnected' as ConnectionStatus,
      },
    });

    await expect(component).toContainText('Disconnected');
    await expect(component.locator('mat-icon')).toContainText('error');
    await expect(component).toHaveScreenshot('connection-status-disconnected.png');
  });

  test('renders connecting state with spinning icon', async ({ mount }) => {
    const component = await mount(ConnectionStatusComponent, {
      props: {
        status: 'connecting' as ConnectionStatus,
      },
    });

    await expect(component).toContainText('Connecting');
    await expect(component.locator('mat-icon')).toContainText('sync');
    // The icon should have the spinning class
    await expect(component.locator('mat-icon.spinning')).toBeVisible();
    await expect(component).toHaveScreenshot('connection-status-connecting.png');
  });
});
