/**
 * @fileoverview Global session state management service.
 *
 * Provides reactive state for session ID, connection status, and errors
 * using Angular Signals. This service is a singleton (providedIn: 'root')
 * and serves as the source of truth for global session state.
 *
 * Pattern adapted from prototype: mddocs/frontend/research/prototype-findings.md
 * @see mddocs/frontend/frontend-tdd.md#sessionstateservice-global
 */

import { computed, Injectable, signal } from '@angular/core';

/**
 * Connection status for the gRPC streaming connection.
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

/**
 * Global session state service using Angular Signals.
 *
 * Exposes readonly signals for consumers and mutation methods
 * for use by the SessionFacade or other orchestrators.
 *
 * @example
 * ```typescript
 * // In a component
 * private readonly state = inject(SessionStateService);
 *
 * // Read state reactively
 * readonly sessionId = this.state.sessionId;
 * readonly isConnected = this.state.isConnected;
 *
 * // The facade updates state
 * // state.setSessionId('session-123');
 * ```
 */
@Injectable({ providedIn: 'root' })
export class SessionStateService {
  // ─────────────────────────────────────────────────────────────────────────
  // Private writable signals
  // ─────────────────────────────────────────────────────────────────────────

  private readonly _sessionId = signal<string | null>(null);
  private readonly _connectionStatus = signal<ConnectionStatus>('disconnected');
  private readonly _error = signal<string | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Public readonly signals (encapsulation)
  // ─────────────────────────────────────────────────────────────────────────

  /** Current active session ID, or null if not in a session. */
  readonly sessionId = this._sessionId.asReadonly();

  /** Current connection status for the gRPC streaming connection. */
  readonly connectionStatus = this._connectionStatus.asReadonly();

  /** Error message if an error has occurred, or null otherwise. */
  readonly error = this._error.asReadonly();

  // ─────────────────────────────────────────────────────────────────────────
  // Computed signals (derived state)
  // ─────────────────────────────────────────────────────────────────────────

  /** Whether the connection is currently established. */
  readonly isConnected = computed(() => this._connectionStatus() === 'connected');

  /** Whether there is currently an error. */
  readonly hasError = computed(() => this._error() !== null);

  // ─────────────────────────────────────────────────────────────────────────
  // Mutation methods (for use by Facade/orchestrators)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Sets the current session ID.
   * @param id - The session ID, or null to clear
   */
  setSessionId(id: string | null): void {
    this._sessionId.set(id);
  }

  /**
   * Sets the connection status.
   * @param status - The new connection status
   */
  setConnectionStatus(status: ConnectionStatus): void {
    this._connectionStatus.set(status);
  }

  /**
   * Sets an error message.
   * @param error - The error message, or null to clear
   */
  setError(error: string | null): void {
    this._error.set(error);
  }

  /**
   * Clears any current error.
   */
  clearError(): void {
    this._error.set(null);
  }
}
