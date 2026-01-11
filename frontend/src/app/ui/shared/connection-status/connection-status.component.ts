/**
 * @fileoverview Connection status indicator component.
 *
 * Displays a visual indicator showing the current connection state
 * (connected, connecting, or disconnected) as required by FR-023.
 *
 * Uses Angular Material icons with color-coded states:
 * - Connected: green check_circle icon
 * - Connecting: orange sync icon (animated)
 * - Disconnected: red error icon
 *
 * @see mddocs/frontend/frontend-spec.md#fr-communication - FR-023
 * @see mddocs/frontend/frontend-tdd.md#folder-layout
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * Connection status type (mirrors SessionStateService's type).
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

/**
 * Configuration for each connection status.
 */
interface StatusConfig {
  icon: string;
  label: string;
  cssClass: string;
  tooltip: string;
}

/**
 * Map of connection status to display configuration.
 */
const STATUS_CONFIG: Record<ConnectionStatus, StatusConfig> = {
  connected: {
    icon: 'check_circle',
    label: 'Connected',
    cssClass: 'status-connected',
    tooltip: 'Connected to server',
  },
  connecting: {
    icon: 'sync',
    label: 'Connecting',
    cssClass: 'status-connecting',
    tooltip: 'Connecting to server...',
  },
  disconnected: {
    icon: 'error',
    label: 'Disconnected',
    cssClass: 'status-disconnected',
    tooltip: 'Disconnected from server',
  },
};

/**
 * Connection status indicator component (FR-023).
 *
 * Shows the current connection state using icons and colors.
 * Receives connectionStatus via input signal from parent component.
 *
 * @example
 * ```html
 * <!-- Pass status from facade -->
 * <app-connection-status [status]="facade.connectionStatus()" />
 * ```
 */
@Component({
  selector: 'app-connection-status',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule],
  template: `
    <div
      class="connection-status"
      [class]="statusConfig().cssClass"
      [matTooltip]="statusConfig().tooltip"
    >
      <mat-icon [class.spinning]="isConnecting()">{{ statusConfig().icon }}</mat-icon>
      <span class="status-label">{{ statusConfig().label }}</span>
    </div>
  `,
  styles: `
    .connection-status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-label {
      white-space: nowrap;
    }

    mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .status-connected {
      color: #2e7d32;
      background-color: rgba(46, 125, 50, 0.1);
    }

    .status-connecting {
      color: #ed6c02;
      background-color: rgba(237, 108, 2, 0.1);
    }

    .status-disconnected {
      color: #d32f2f;
      background-color: rgba(211, 47, 47, 0.1);
    }

    .spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectionStatusComponent {
  /** Input signal for connection status */
  readonly status = input.required<ConnectionStatus>();

  /** Whether we're currently connecting (for animation) */
  readonly isConnecting = computed(() => this.status() === 'connecting');

  /** Configuration for the current status */
  readonly statusConfig = computed<StatusConfig>(() => STATUS_CONFIG[this.status()]);
}
