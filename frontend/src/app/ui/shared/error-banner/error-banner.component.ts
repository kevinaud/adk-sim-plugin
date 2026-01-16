/**
 * @fileoverview Error banner component for dismissible error messages.
 *
 * Displays a styled error/warning banner with an icon, message, and dismiss button.
 * Designed for displaying route errors, validation messages, or other dismissible alerts.
 *
 * Features:
 * - Configurable icon (default: 'warning')
 * - Message passed via input signal
 * - Dismiss event emitted when close button is clicked
 * - Uses OnPush change detection for performance
 *
 * @see mddocs/frontend/frontend-tdd.md#folder-layout
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Error banner component for dismissible error/warning messages.
 *
 * Provides a reusable banner with icon, message, and dismiss functionality.
 * Uses Angular Material components for consistent styling.
 *
 * @example
 * ```html
 * <app-error-banner
 *   [message]="errorMessage()"
 *   [icon]="'error'"
 *   (dismissed)="onDismiss()"
 * />
 * ```
 */
@Component({
  selector: 'app-error-banner',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div
      class="flex items-center gap-3 w-full py-3 px-4 rounded-lg border border-warning border-l-4 bg-warning/10"
      data-testid="error-banner"
    >
      <mat-icon class="text-warning shrink-0" data-testid="error-banner-icon">{{
        icon()
      }}</mat-icon>
      <span class="flex-1 text-warning font-medium" data-testid="error-banner-message">{{
        message()
      }}</span>
      <button
        mat-icon-button
        class="shrink-0 text-on-surface-variant hover:text-on-surface"
        (click)="dismissed.emit()"
        aria-label="Dismiss error"
        data-testid="error-banner-dismiss"
      >
        <mat-icon>close</mat-icon>
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorBannerComponent {
  /** Input signal for the error message to display */
  readonly message = input.required<string>();

  /** Input signal for the icon name (default: 'warning') */
  readonly icon = input<string>('warning');

  /** Output event emitted when the dismiss button is clicked */
  readonly dismissed = output();
}
