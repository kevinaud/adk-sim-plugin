/**
 * @fileoverview Event stream container component.
 *
 * Container component that displays a list of conversation events
 * as structured blocks. Implements FR-007: Conversation history
 * rendered as a structured stream of distinct blocks.
 *
 * The component receives Content[] (conversation turns) via input signal
 * and iterates over them using @for control flow. Each event is rendered
 * using EventBlockComponent which handles role-based styling.
 *
 * @see mddocs/frontend/frontend-spec.md#fr-context-inspection - FR-007
 * @see mddocs/frontend/frontend-tdd.md#event-stream-components
 */

import type { Content } from '@adk-sim/converters';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { EventBlockComponent } from './event-block';

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
  imports: [EventBlockComponent],
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
            <app-event-block [content]="event" />
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
      color: var(--sys-on-surface-variant);
      background-color: var(--sys-surface-variant);
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
}
