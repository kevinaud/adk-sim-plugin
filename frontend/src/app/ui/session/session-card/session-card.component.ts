/**
 * @fileoverview Session card component for displaying session metadata.
 *
 * Displays a session's ID, description, creation time, and status
 * in a clickable list item format. This is a dumb/presentational component
 * with no service dependencies.
 *
 * Extracted from session-list for reuse and better separation of concerns.
 *
 * @see frontend/src/app/features/session-list/session-list.component.html (lines 56-92)
 */

import { type SimulatorSession } from '@adk-sim/protos';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { timestampDate } from '@bufbuild/protobuf/wkt';

/**
 * Session card component that displays session metadata.
 *
 * This component renders a single session item with:
 * - Truncated session ID (first 8 chars) with full ID in title
 * - Optional description
 * - Formatted creation time
 * - Active status indicator
 *
 * The component is fully keyboard accessible (Enter key triggers selection).
 *
 * @example
 * ```html
 * <!-- Basic usage -->
 * <app-session-card
 *   [session]="session"
 *   (selected)="onSessionSelected($event)"
 * />
 * ```
 */
@Component({
  selector: 'app-session-card',
  standalone: true,
  imports: [DatePipe, MatIconModule, MatListModule],
  template: `
    <mat-list-item
      class="cursor-pointer rounded-lg mb-2 transition-colors duration-200
             hover:bg-surface-variant/30 focus:outline-2 focus:outline-primary
             focus:outline-offset-2"
      (click)="onSelect()"
      (keydown.enter)="onSelect()"
      tabindex="0"
      [attr.data-testid]="'session-card-' + session().id"
    >
      <mat-icon matListItemIcon>folder_open</mat-icon>

      <div matListItemTitle class="flex items-center gap-3">
        <span
          class="font-mono font-medium text-primary"
          [title]="session().id"
          data-testid="session-id"
          >{{ truncatedId() }}</span
        >
        @if (session().description) {
          <span class="text-on-surface-variant font-normal" data-testid="session-description">{{
            session().description
          }}</span>
        }
      </div>

      <div class="session-meta">
        <mat-icon class="meta-icon">schedule</mat-icon>
        <span data-testid="session-created">
          @if (createdAt(); as date) {
            {{ date | date: 'medium' }}
          } @else {
            Unknown
          }
        </span>
        <span class="separator">·</span>
        <mat-icon class="status-icon">circle</mat-icon>
        <span data-testid="session-status">Active</span>
      </div>

      <mat-icon matListItemMeta>chevron_right</mat-icon>
    </mat-list-item>
  `,
  styles: `
    :host {
      display: block;
    }

    mat-list-item {
      height: auto !important;
      min-height: 72px;
    }

    /* Session metadata line (timestamp + status) */
    .session-meta {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.75rem;
      color: var(--sys-on-surface-variant);
      margin-top: 4px;
    }

    .meta-icon {
      font-size: 14px !important;
      width: 14px !important;
      height: 14px !important;
      line-height: 1 !important;
    }

    .separator {
      margin: 0 0.75rem;
    }

    .status-icon {
      font-size: 8px !important;
      width: 8px !important;
      height: 8px !important;
      line-height: 1 !important;
      color: var(--color-success);
    }

    /* Focus styles */
    mat-list-item:focus {
      outline: 2px solid var(--sys-primary);
      outline-offset: 2px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionCardComponent {
  /** The session to display. Required. */
  readonly session = input.required<SimulatorSession>();

  /** Emits the session ID when the card is clicked or Enter is pressed. */
  readonly selected = output<string>();

  /** Computed truncated ID (first 8 chars). */
  readonly truncatedId = computed(() => {
    const id = this.session().id;
    return id.length > 8 ? `${id.slice(0, 8)}...` : id;
  });

  /** Computed creation date from session's createdAt timestamp. */
  readonly createdAt = computed<Date | null>(() => {
    const session = this.session();
    if (!session.createdAt) {
      return null;
    }
    return timestampDate(session.createdAt);
  });

  /** Handles selection event (click or Enter key). */
  onSelect(): void {
    this.selected.emit(this.session().id);
  }
}
