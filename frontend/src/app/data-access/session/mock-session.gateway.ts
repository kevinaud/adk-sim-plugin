/**
 * @fileoverview Mock implementation of SessionGateway for testing.
 *
 * Provides a controllable mock that extends the abstract SessionGateway port.
 * Test code can inject mock data using `setMockSessions()` and the gateway
 * will return that data when `listSessions()` is called.
 *
 * @see mddocs/frontend/frontend-tdd.md#mock-gateway-testing
 */

import { Injectable, signal } from '@angular/core';

import type { Session } from './session.gateway';
import { SessionGateway } from './session.gateway';

/**
 * Mock implementation of SessionGateway for testing purposes.
 *
 * This implementation allows tests to control exactly what data is returned,
 * making it easy to test various scenarios without a real backend.
 *
 * @example
 * ```typescript
 * // In a test
 * const mockGateway = new MockSessionGateway();
 * mockGateway.setMockSessions([
 *   { id: 'session-1', description: 'Test Session', createdAt: undefined },
 * ]);
 *
 * const sessions = await mockGateway.listSessions();
 * expect(sessions).toHaveLength(1);
 * ```
 */
@Injectable()
export class MockSessionGateway extends SessionGateway {
  /** Internal signal holding mock session data */
  private readonly sessions = signal<Session[]>([]);

  /** Optional delay to simulate network latency (in milliseconds) */
  private simulatedDelayMs = 0;

  /** Optional error to throw on next call */
  private errorToThrow: Error | null = null;

  /**
   * Sets the sessions that will be returned by `listSessions()`.
   *
   * @param sessions - Array of sessions to return
   */
  setMockSessions(sessions: Session[]): void {
    this.sessions.set(sessions);
  }

  /**
   * Adds a single session to the mock data.
   *
   * @param session - Session to add
   */
  addSession(session: Session): void {
    this.sessions.update((existing) => [...existing, session]);
  }

  /**
   * Clears all mock session data.
   */
  clearSessions(): void {
    this.sessions.set([]);
  }

  /**
   * Sets a simulated network delay for testing loading states.
   *
   * @param delayMs - Delay in milliseconds (0 to disable)
   */
  setSimulatedDelay(delayMs: number): void {
    this.simulatedDelayMs = delayMs;
  }

  /**
   * Sets an error to throw on the next gateway call.
   * The error is cleared after being thrown once.
   *
   * @param error - Error to throw (null to clear)
   */
  setErrorToThrow(error: Error | null): void {
    this.errorToThrow = error;
  }

  /**
   * Returns the currently configured mock sessions.
   * Supports simulated delay and error injection for testing.
   */
  override async listSessions(): Promise<Session[]> {
    // Apply simulated delay if configured
    if (this.simulatedDelayMs > 0) {
      await this.delay(this.simulatedDelayMs);
    }

    // Throw error if configured (and clear it)
    if (this.errorToThrow) {
      const error = this.errorToThrow;
      this.errorToThrow = null;
      throw error;
    }

    // Return a copy to prevent external mutation
    return [...this.sessions()];
  }

  /**
   * Helper to create a delay promise.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
