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

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { ActivatedRoute, Router } from '@angular/router';

import { type Session, SessionFacade } from '../../data-access/session';
import { SessionCardComponent } from '../../ui/session';
import {
  EmptyStateComponent,
  ErrorBannerComponent,
  ErrorStateComponent,
  LoadingStateComponent,
} from '../../ui/shared';

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
    EmptyStateComponent,
    ErrorBannerComponent,
    ErrorStateComponent,
    LoadingStateComponent,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatListModule,
    SessionCardComponent,
  ],
  templateUrl: './session-list.component.html',
  styleUrl: './session-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionListComponent implements OnInit {
  private readonly facade = inject(SessionFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  /** List of sessions retrieved from the backend */
  readonly sessions = signal<Session[]>([]);

  /** Whether we're currently loading sessions */
  readonly isLoading = signal(false);

  /** Error message from URL query params (e.g., redirect from invalid session) */
  private readonly _routeError = signal<string | null>(null);
  readonly routeError = this._routeError.asReadonly();

  /** Whether there's a route error */
  readonly hasRouteError = computed(() => this._routeError() !== null);

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
   * Also subscribes to query params to display route errors (e.g., from invalid session redirect).
   */
  ngOnInit(): void {
    void this.loadSessions();
    this.subscribeToRouteErrors();
  }

  /**
   * Subscribes to query params to detect and display route errors.
   * The session route guard redirects to /?error=... when session validation fails.
   */
  private subscribeToRouteErrors(): void {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const errorParam = params['error'] as string | undefined;
      this._routeError.set(errorParam ?? null);
    });
  }

  /**
   * Dismisses the route error message.
   */
  dismissRouteError(): void {
    this._routeError.set(null);
    // Remove the error query param from the URL without navigation
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { error: null },
      queryParamsHandling: 'merge',
    });
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
}
