/**
 * @fileoverview Session card list component for displaying multiple sessions.
 *
 * A dumb/presentational component that renders a list of session cards
 * with proper Material list styling. This component provides the mat-list
 * context required for mat-list-item to render correctly.
 *
 * @see SessionCardComponent for individual card rendering
 */

import { type SimulatorSession } from '@adk-sim/protos';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatListModule } from '@angular/material/list';

import { SessionCardComponent } from '../session-card';

/**
 * Renders a list of session cards with proper Material list styling.
 *
 * This component wraps SessionCardComponent instances in a mat-list,
 * providing the required parent context for proper Material styling.
 *
 * @example
 * ```html
 * <app-session-card-list
 *   [sessions]="sessions"
 *   (sessionSelected)="onSelect($event)"
 * />
 * ```
 */
@Component({
  selector: 'app-session-card-list',
  standalone: true,
  imports: [MatListModule, SessionCardComponent],
  template: `
    <mat-list class="p-0">
      @for (session of sessions(); track session.id) {
        <app-session-card [session]="session" (selected)="sessionSelected.emit($event)" />
      }
    </mat-list>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionCardListComponent {
  /** List of sessions to display. */
  readonly sessions = input.required<SimulatorSession[]>();

  /** Emits the session ID when a card is selected. */
  readonly sessionSelected = output<string>();
}
