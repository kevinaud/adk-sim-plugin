/**
 * @fileoverview Session component for displaying an individual simulation session.
 *
 * This is a scaffold component that displays the current session ID.
 * It will be extended in future PRs to include event streaming and interaction.
 *
 * Implements FR-001 (Session Navigation).
 *
 * @see mddocs/frontend/frontend-spec.md#fr-session-management
 * @see mddocs/frontend/frontend-tdd.md#routing-configuration
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

/**
 * Session component that displays an individual simulation session.
 *
 * This scaffold component:
 * - Extracts the session ID from route parameters
 * - Displays the session ID in the view
 * - Will be extended to show event stream and controls
 *
 * @example
 * ```html
 * <!-- Rendered at /session/:id -->
 * <app-session></app-session>
 * ```
 */
@Component({
  selector: 'app-session',
  standalone: true,
  imports: [],
  template: `
    <div class="session-container">
      <header class="session-header">
        <h1>Session</h1>
        <span class="session-id">{{ sessionId() }}</span>
      </header>
      <main class="session-content">
        <p>Session content will be implemented in future PRs.</p>
      </main>
    </div>
  `,
  styles: `
    .session-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 16px;
    }

    .session-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }

    .session-header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 500;
    }

    .session-id {
      font-family: monospace;
      font-size: 14px;
      color: var(--mat-sys-on-surface-variant, #666);
      background: var(--mat-sys-surface-variant, #f5f5f5);
      padding: 4px 8px;
      border-radius: 4px;
    }

    .session-content {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--mat-sys-on-surface-variant, #666);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionComponent {
  private readonly route = inject(ActivatedRoute);

  /** Observable stream of route params converted to signal */
  private readonly params = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))));

  /** Current session ID from route parameters */
  readonly sessionId = computed(() => this.params() ?? 'Unknown');
}
