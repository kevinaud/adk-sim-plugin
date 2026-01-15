/**
 * @fileoverview Loading state indicator component.
 *
 * Displays a loading spinner with a customizable message.
 * Extracted from session-list for reuse across the application.
 *
 * Uses Angular Material spinner and Tailwind utility classes for styling.
 *
 * @see frontend/src/app/features/session-list/session-list.component.html (lines 26-31)
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/**
 * Loading state indicator component.
 *
 * Shows a centered spinner with an optional message below it.
 * Fully styled with Tailwind utilities - no custom SCSS needed.
 *
 * @example
 * ```html
 * <!-- Basic usage with default message -->
 * <app-loading-state />
 *
 * <!-- Custom message -->
 * <app-loading-state message="Loading sessions..." />
 *
 * <!-- Custom spinner size -->
 * <app-loading-state [diameter]="32" message="Please wait..." />
 * ```
 */
@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [MatProgressSpinnerModule],
  template: `
    <div class="flex flex-col items-center justify-center gap-4 p-12">
      <mat-spinner [diameter]="diameter()" />
      <p class="text-on-surface-variant m-0">{{ message() }}</p>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingStateComponent {
  /** Message to display below the spinner. Defaults to "Loading..." */
  readonly message = input<string>('Loading...');

  /** Diameter of the spinner in pixels. Defaults to 48. */
  readonly diameter = input<number>(48);
}
