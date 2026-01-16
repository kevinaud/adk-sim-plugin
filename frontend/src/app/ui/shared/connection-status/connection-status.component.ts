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
 * Uses Tailwind utility classes for styling via theme bridge colors.
 */
const STATUS_CONFIG: Record<ConnectionStatus, StatusConfig> = {
  connected: {
    icon: 'check_circle',
    label: 'Connected',
    cssClass: 'text-success bg-success/10',
    tooltip: 'Connected to server',
  },
  connecting: {
    icon: 'sync',
    label: 'Connecting',
    cssClass: 'text-warning bg-warning/10',
    tooltip: 'Connecting to server...',
  },
  disconnected: {
    icon: 'error',
    label: 'Disconnected',
    cssClass: 'text-error bg-error/10',
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
      class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
      [class]="statusConfig().cssClass"
      [matTooltip]="statusConfig().tooltip"
      [attr.data-testid]="'connection-status-' + status()"
      data-testid="connection-status"
    >
      <mat-icon class="!text-base !w-4 !h-4" [class.spinning]="isConnecting()">{{
        statusConfig().icon
      }}</mat-icon>
      <span class="whitespace-nowrap" data-testid="connection-status-label">{{
        statusConfig().label
      }}</span>
    </div>
  `,
  styles: `
    /* Spinning animation - Tailwind cannot replace this */
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
