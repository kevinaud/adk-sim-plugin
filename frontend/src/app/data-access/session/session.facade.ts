/**
 * @fileoverview Session facade for orchestrating gateway and state.
 *
 * The facade provides a single point of entry for session operations,
 * coordinating between the SessionGateway (backend communication) and
 * SessionStateService (reactive state). Components should use this facade
 * rather than directly accessing the gateway or state service.
 *
 * Per the TDD Facade Pattern recommendation:
 * @see mddocs/frontend/frontend-tdd.md#sessionfacade-orchestration
 * @see mddocs/frontend/research/angular-architecture-analysis.md#critical-improvement-the-facade-pattern
 */

import { inject, Injectable } from '@angular/core';

import type { Session } from './session.gateway';
import { SessionGateway } from './session.gateway';
import { SessionStateService } from './session-state.service';

/**
 * Session facade for orchestrating gateway and state operations.
 *
 * This facade provides:
 * - Readonly access to session state signals
 * - Coordinated operations that update state based on gateway results
 * - Error handling with state propagation
 *
 * @example
 * ```typescript
 * // In a component
 * private readonly facade = inject(SessionFacade);
 *
 * // Read state reactively
 * readonly connectionStatus = this.facade.connectionStatus;
 * readonly error = this.facade.error;
 *
 * async loadSessions() {
 *   try {
 *     const sessions = await this.facade.listSessions();
 *     // Handle sessions...
 *   } catch (error) {
 *     // Error already set in state
 *   }
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class SessionFacade {
  private readonly gateway = inject(SessionGateway);
  private readonly stateService = inject(SessionStateService);

  // ─────────────────────────────────────────────────────────────────────────
  // Expose state signals (readonly, for components to consume)
  // ─────────────────────────────────────────────────────────────────────────

  /** Current active session ID, or null if not in a session. */
  readonly sessionId = this.stateService.sessionId;

  /** Current connection status for the backend connection. */
  readonly connectionStatus = this.stateService.connectionStatus;

  /** Error message if an error has occurred, or null otherwise. */
  readonly error = this.stateService.error;

  /** Whether the connection is currently established. */
  readonly isConnected = this.stateService.isConnected;

  /** Whether there is currently an error. */
  readonly hasError = this.stateService.hasError;

  // ─────────────────────────────────────────────────────────────────────────
  // Operations (coordinate gateway + state)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Validates that a session exists.
   *
   * This method is used by route guards to verify session existence
   * before allowing navigation. It does not update connection status
   * since it's a validation check, not a data fetch operation.
   *
   * @param sessionId - The session ID to validate
   * @returns Promise that resolves if session exists
   * @throws Error if session does not exist or validation fails
   */
  async validateSession(sessionId: string): Promise<void> {
    await this.gateway.getSession(sessionId);
  }

  /**
   * Lists all available sessions.
   *
   * Updates connection status and error state based on the result.
   * On success: sets status to 'connected' and clears any error.
   * On failure: sets status to 'disconnected' and sets error message.
   *
   * @returns Promise resolving to array of sessions
   * @throws Re-throws the original error after updating state
   */
  async listSessions(): Promise<Session[]> {
    try {
      this.stateService.setConnectionStatus('connecting');

      const sessions = await this.gateway.listSessions();

      this.stateService.setConnectionStatus('connected');
      this.stateService.clearError();

      return sessions;
    } catch (error) {
      this.stateService.setConnectionStatus('disconnected');
      this.stateService.setError(
        error instanceof Error ? error.message : 'An unknown error occurred',
      );
      throw error;
    }
  }
}
