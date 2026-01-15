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
    <div class="error-banner" data-testid="error-banner">
      <mat-icon class="error-icon">{{ icon() }}</mat-icon>
      <span class="error-message" data-testid="error-banner-message">{{ message() }}</span>
      <button
        mat-icon-button
        class="error-dismiss"
        (click)="dismissed.emit()"
        aria-label="Dismiss error"
        data-testid="error-banner-dismiss"
      >
        <mat-icon>close</mat-icon>
      </button>
    </div>
  `,
  styles: `
    .error-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 12px 16px;
      background-color: #fff3e0;
      border: 1px solid #ff9800;
      border-radius: 8px;
      border-left: 4px solid #ff9800;
      box-sizing: border-box;
    }

    .error-icon {
      color: #ff9800;
      flex-shrink: 0;
    }

    .error-message {
      flex: 1;
      color: #e65100;
      font-weight: 500;
    }

    .error-dismiss {
      flex-shrink: 0;
      color: rgba(0, 0, 0, 0.54);

      &:hover {
        color: rgba(0, 0, 0, 0.87);
      }
    }
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
