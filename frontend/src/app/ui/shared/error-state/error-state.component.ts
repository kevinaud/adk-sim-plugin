/**
 * @fileoverview Error state indicator component.
 *
 * Displays an error icon with a message and retry action button.
 * Extracted from session-list for reuse across the application.
 *
 * Uses Angular Material icon and button components with Tailwind utility classes.
 *
 * @see frontend/src/app/features/session-list/session-list.component.html (lines 33-43)
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Error state indicator component.
 *
 * Shows a centered error icon with a message and retry button.
 * Fully styled with Tailwind utilities - no custom SCSS needed.
 *
 * @example
 * ```html
 * <!-- Basic usage with required message -->
 * <app-error-state message="Failed to load data" (retry)="loadData()" />
 *
 * <!-- With custom icon -->
 * <app-error-state icon="cloud_off" message="Connection lost" (retry)="reconnect()" />
 *
 * <!-- With custom retry label -->
 * <app-error-state
 *   message="Failed to save"
 *   retryLabel="Try Again"
 *   (retry)="save()"
 * />
 * ```
 */
@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  template: `
    <div class="flex flex-col items-center justify-center gap-4 p-12">
      <mat-icon class="text-error" style="font-size: 48px; width: 48px; height: 48px">{{
        icon()
      }}</mat-icon>
      <p class="text-error text-center m-0">{{ message() }}</p>
      <button mat-raised-button color="primary" (click)="retry.emit()">
        <mat-icon>refresh</mat-icon>
        {{ retryLabel() }}
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorStateComponent {
  /** Icon name from Material Icons. Defaults to 'error_outline'. */
  readonly icon = input<string>('error_outline');

  /** Primary error message to display. Required. */
  readonly message = input.required<string>();

  /** Label for the retry button. Defaults to 'Retry'. */
  readonly retryLabel = input<string>('Retry');

  /** Event emitted when the retry button is clicked. */
  readonly retry = output();
}
