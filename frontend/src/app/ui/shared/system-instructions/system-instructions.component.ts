/**
 * @fileoverview System instructions component with collapsible accordion.
 *
 * Displays system instructions in a collapsible section with:
 * - Header button with psychology icon and expand/collapse indicator
 * - Content area using SmartBlobComponent for markdown rendering
 * - Accessible ARIA attributes for accordion pattern
 *
 * @see mddocs/frontend/frontend-spec.md#system-instructions
 */

import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { SmartBlobComponent } from '../smart-blob';

/**
 * System instructions component with collapsible accordion.
 *
 * @example
 * ```html
 * <app-system-instructions
 *   [content]="systemInstructionText()"
 *   [initiallyExpanded]="true"
 * />
 * ```
 */
@Component({
  selector: 'app-system-instructions',
  standalone: true,
  imports: [MatIconModule, SmartBlobComponent],
  template: `
    <div class="system-instructions" data-testid="system-instructions">
      <button
        class="instructions-header"
        (click)="toggle()"
        type="button"
        [attr.aria-expanded]="expanded()"
        aria-controls="instructions-content"
      >
        <mat-icon class="instructions-icon">psychology</mat-icon>
        <span class="instructions-label">System Instructions</span>
        <mat-icon class="expand-icon">
          {{ expanded() ? 'expand_less' : 'expand_more' }}
        </mat-icon>
      </button>
      @if (expanded()) {
        <div
          class="instructions-content"
          id="instructions-content"
          data-testid="instructions-content"
        >
          @if (content()) {
            <app-smart-blob [content]="content()!" />
          } @else {
            <p class="no-instructions">No system instructions provided.</p>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .system-instructions {
      flex-shrink: 0;
      background-color: var(--sys-surface);
      border-bottom: 1px solid var(--sys-outline-variant);
    }

    .instructions-header {
      display: flex;
      align-items: center;
      width: 100%;
      padding: 12px 24px;
      background: none;
      border: none;
      cursor: pointer;
      text-align: left;
      gap: 12px;
      color: var(--sys-on-surface);
    }

    .instructions-header:hover {
      background-color: var(--sys-surface-container-high);
    }

    .instructions-icon {
      color: var(--sys-on-surface-variant);
    }

    .instructions-label {
      flex: 1;
      font-size: 14px;
      font-weight: 500;
    }

    .expand-icon {
      color: var(--sys-on-surface-variant);
    }

    .instructions-content {
      padding: 0 24px 16px 60px;
      max-height: 300px;
      overflow-y: auto;
    }

    .no-instructions {
      margin: 0;
      font-size: 14px;
      color: var(--sys-on-surface-variant);
      font-style: italic;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SystemInstructionsComponent {
  /**
   * The system instruction text to display.
   * Supports markdown rendering via SmartBlobComponent.
   */
  readonly content = input<string>();

  /**
   * Whether the accordion should start expanded.
   * @default true
   */
  readonly initiallyExpanded = input(true);

  /** Tracks whether user has toggled (to stop reacting to input changes) */
  private hasUserToggled = false;

  /** Internal expanded state */
  private readonly _expanded = signal(true);

  /** Whether the instructions section is currently expanded */
  readonly expanded = this._expanded.asReadonly();

  constructor() {
    // Initialize from input when it becomes available
    effect(
      () => {
        const initial = this.initiallyExpanded();
        // Only sync if user hasn't manually toggled yet
        if (!this.hasUserToggled) {
          this._expanded.set(initial);
        }
      },
      { allowSignalWrites: true },
    );
  }

  /** Toggle the expanded state */
  toggle(): void {
    this.hasUserToggled = true;
    this._expanded.update((v) => !v);
  }
}
