/**
 * @fileoverview Empty state indicator component.
 *
 * Displays an icon with a message and optional hint text.
 * Extracted from session-list for reuse across the application.
 *
 * Uses Angular Material icon and Tailwind utility classes for styling.
 *
 * @see frontend/src/app/features/session-list/session-list.component.html (lines 45-52)
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Empty state indicator component.
 *
 * Shows a centered icon with a message and optional hint below it.
 * Fully styled with Tailwind utilities - no custom SCSS needed.
 *
 * @example
 * ```html
 * <!-- Basic usage with required message -->
 * <app-empty-state message="No items found" />
 *
 * <!-- With custom icon -->
 * <app-empty-state icon="search_off" message="No results" />
 *
 * <!-- With hint text -->
 * <app-empty-state
 *   message="No sessions available"
 *   hint="Sessions will appear here when created by an ADK agent."
 * />
 * ```
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="flex flex-col items-center justify-center gap-2 p-12">
      <mat-icon
        class="text-on-surface-variant/50"
        style="font-size: 64px; width: 64px; height: 64px"
        >{{ icon() }}</mat-icon
      >
      <p class="text-lg text-on-surface-variant m-0">{{ message() }}</p>
      @if (hint()) {
        <p class="text-sm text-on-surface-variant/70 m-0">{{ hint() }}</p>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  /** Icon name from Material Icons. Defaults to 'inbox'. */
  readonly icon = input<string>('inbox');

  /** Primary message to display. Required. */
  readonly message = input.required<string>();

  /** Optional hint text for additional context. */
  readonly hint = input<string | undefined>();
}
