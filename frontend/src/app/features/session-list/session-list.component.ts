/**
 * @fileoverview Session list component for displaying available sessions.
 *
 * Implements FR-002 (Session List) and FR-003 (Session Metadata Display).
 * Fetches sessions from the backend via SessionFacade on initialization
 * and displays session ID, creation time, and status for each.
 *
 * @see mddocs/frontend/frontend-spec.md#fr-session-management
 * @see mddocs/frontend/frontend-tdd.md#folder-layout
 */

import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { timestampDate } from '@bufbuild/protobuf/wkt';

import { type Session, SessionFacade } from '../../data-access/session';

/**
 * Session list component that displays all available simulation sessions.
 *
 * This component:
 * - Fetches sessions from the backend on initialization
 * - Displays loading state while fetching
 * - Displays error state if fetch fails
 * - Shows session metadata: ID, creation time, status (FR-003)
 *
 * @example
 * ```html
 * <app-session-list></app-session-list>
 * ```
 */
@Component({
  selector: 'app-session-list',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatListModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './session-list.component.html',
  styleUrl: './session-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionListComponent implements OnInit {
  private readonly facade = inject(SessionFacade);
  private readonly router = inject(Router);

  /** List of sessions retrieved from the backend */
  readonly sessions = signal<Session[]>([]);

  /** Whether we're currently loading sessions */
  readonly isLoading = signal(false);

  /** Connection status from the facade */
  readonly connectionStatus = this.facade.connectionStatus;

  /** Error message from the facade */
  readonly error = this.facade.error;

  /** Whether there's currently an error */
  readonly hasError = this.facade.hasError;

  /** Whether we have sessions to display */
  readonly hasSessions = computed(() => this.sessions().length > 0);

  /** Whether to show the empty state (no sessions and not loading/error) */
  readonly showEmptyState = computed(
    () => !this.isLoading() && !this.hasError() && !this.hasSessions(),
  );

  /**
   * Load sessions on component initialization.
   */
  ngOnInit(): void {
    void this.loadSessions();
  }

  /**
   * Fetches sessions from the backend via the facade.
   * Updates loading and error states accordingly.
   */
  async loadSessions(): Promise<void> {
    this.isLoading.set(true);

    try {
      const sessions = await this.facade.listSessions();
      this.sessions.set(sessions);
    } catch {
      // Error is already set in the facade/state service
      // We just need to clear the sessions list
      this.sessions.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Navigates to the specified session.
   *
   * @param sessionId - ID of the session to navigate to
   */
  navigateToSession(sessionId: string): void {
    void this.router.navigate(['/session', sessionId]);
  }

  /**
   * Formats the session creation time for display.
   * Returns a human-readable date string or 'Unknown' if not available.
   *
   * @param session - Session to get creation time from
   * @returns Formatted date string
   */
  getCreationTime(session: Session): Date | null {
    if (!session.createdAt) {
      return null;
    }
    return timestampDate(session.createdAt);
  }

  /**
   * Gets a truncated session ID for display.
   * Shows first 8 characters of UUID for brevity.
   *
   * @param sessionId - Full session ID
   * @returns Truncated ID
   */
  getTruncatedId(sessionId: string): string {
    return sessionId.length > 8 ? `${sessionId.slice(0, 8)}...` : sessionId;
  }
}
