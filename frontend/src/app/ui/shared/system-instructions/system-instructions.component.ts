/**
 * @fileoverview System instructions component for displaying agent instructions.
 *
 * Displays system instructions with:
 * - Header with psychology icon and "System Instructions" label
 * - Content area using SmartBlobComponent for markdown rendering
 *
 * Height is controlled by the parent container (typically a vertical split-pane).
 *
 * @see mddocs/frontend/frontend-spec.md#system-instructions
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { SmartBlobComponent } from '../smart-blob';

/**
 * System instructions component.
 *
 * Displays system instructions with a header and scrollable content area.
 * The height is controlled by the parent container.
 *
 * @example
 * ```html
 * <app-system-instructions [content]="systemInstructionText()" />
 * ```
 */
@Component({
  selector: 'app-system-instructions',
  standalone: true,
  imports: [MatIconModule, SmartBlobComponent],
  template: `
    <div class="system-instructions" data-testid="system-instructions">
      <div class="instructions-header">
        <mat-icon class="instructions-icon">psychology</mat-icon>
        <span class="instructions-label">System Instructions</span>
      </div>
      <div class="instructions-content" data-testid="instructions-content">
        @if (content()) {
          <app-smart-blob [content]="content()!" />
        } @else {
          <p class="no-instructions">No system instructions provided.</p>
        }
      </div>
    </div>
  `,
  styles: `
    .system-instructions {
      display: flex;
      flex-direction: column;
      height: 100%;
      background-color: var(--sys-surface);
    }

    .instructions-header {
      display: flex;
      align-items: center;
      padding: 12px 24px;
      gap: 12px;
      color: var(--sys-on-surface);
      border-bottom: 1px solid var(--sys-outline-variant);
      flex-shrink: 0;
    }

    .instructions-icon {
      color: var(--sys-on-surface-variant);
    }

    .instructions-label {
      font-size: 14px;
      font-weight: 500;
    }

    .instructions-content {
      flex: 1;
      padding: 16px 24px 16px 60px;
      overflow-y: auto;
      min-height: 0;
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
}
