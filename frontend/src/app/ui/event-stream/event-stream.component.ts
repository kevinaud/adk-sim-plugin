/**
 * @fileoverview Event stream container component.
 *
 * Container component that displays a list of conversation events
 * as structured blocks. Implements FR-007: Conversation history
 * rendered as a structured stream of distinct blocks.
 *
 * The component receives Content[] (conversation turns) via input signal
 * and iterates over them using @for control flow. In its current state,
 * it renders a placeholder for each event - actual EventBlockComponent
 * integration will be added in S3PR6.
 *
 * @see mddocs/frontend/frontend-spec.md#fr-context-inspection - FR-007
 * @see mddocs/frontend/frontend-tdd.md#event-stream-components
 */

import type { Content } from '@adk-sim/converters';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Event stream container component (FR-007).
 *
 * Displays conversation history as a stream of event blocks.
 * Each Content item represents a turn in the conversation
 * (user input, agent response, or tool execution).
 *
 * @example
 * ```html
 * <app-event-stream [events]="contents()" />
 * ```
 */
@Component({
  selector: 'app-event-stream',
  standalone: true,
  imports: [],
  template: `
    <div class="event-stream" data-testid="event-stream">
      @if (isEmpty()) {
        <div class="empty-state" data-testid="empty-state">
          <p>No conversation events yet.</p>
          <p class="empty-hint">
            Events will appear here when the session receives an LLM request.
          </p>
        </div>
      } @else {
        <div class="event-list">
          @for (event of events(); track trackByIndex($index)) {
            <!-- EventBlockComponent will be integrated here in S3PR6 -->
            <div class="event-placeholder" [attr.data-role]="event.role" data-testid="event-block">
              <span class="role-badge">{{ event.role }}</span>
              <span class="parts-count">{{ getPartsCount(event) }} part(s)</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .event-stream {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
      color: var(--mat-sys-on-surface-variant, #666);
      background-color: var(--mat-sys-surface-variant, #f5f5f5);
      border-radius: 8px;
    }

    .empty-state p {
      margin: 0;
    }

    .empty-hint {
      font-size: 14px;
      margin-top: 8px !important;
      opacity: 0.7;
    }

    .event-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .event-placeholder {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background-color: var(--mat-sys-surface-container, #fafafa);
      border-radius: 8px;
      border-left: 4px solid var(--mat-sys-primary, #6750a4);
    }

    .event-placeholder[data-role='user'] {
      border-left-color: #2196f3;
    }

    .event-placeholder[data-role='model'] {
      border-left-color: #4caf50;
    }

    .role-badge {
      font-weight: 500;
      text-transform: capitalize;
      font-size: 14px;
    }

    .parts-count {
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant, #666);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventStreamComponent {
  /**
   * Input signal for conversation events (Content array).
   * Each Content represents a turn in the conversation with role and parts.
   */
  readonly events = input<Content[]>([]);

  /**
   * Computed signal indicating whether the events array is empty.
   */
  readonly isEmpty = computed(() => this.events().length === 0);

  /**
   * Track function for @for iteration.
   * Uses index for stable tracking since Content objects may not have unique IDs.
   *
   * @param index - The index of the item in the array
   * @returns The index as the tracking key
   */
  trackByIndex(index: number): number {
    return index;
  }

  /**
   * Helper to get the number of parts in a Content item.
   * Handles undefined/null parts array safely.
   *
   * @param event - The Content item to count parts for
   * @returns The number of parts, or 0 if parts is undefined
   */
  getPartsCount(event: Content): number {
    return event.parts?.length ?? 0;
  }
}
