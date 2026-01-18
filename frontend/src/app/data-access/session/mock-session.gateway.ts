/**
 * @fileoverview Mock implementation of SessionGateway for testing.
 *
 * Provides a controllable mock that extends the abstract SessionGateway port.
 * Test code can inject mock data using `setMockSessions()` and the gateway
 * will return that data when `listSessions()` is called.
 *
 * @see mddocs/frontend/frontend-tdd.md#mock-gateway-testing
 */

import type { GenerateContentResponse } from '@adk-sim/protos';
import { Injectable, signal } from '@angular/core';

import type { Session, SessionEvent } from './session.gateway';
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

  /** Internal signal holding queued events for subscription */
  private readonly eventQueue = signal<SessionEvent[]>([]);

  /** Flag indicating if a subscription is currently active */
  private subscriptionActive = false;

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
   * Alias for addSession to match TDD naming convention.
   *
   * @param session - Session to add
   */
  pushSession(session: Session): void {
    this.addSession(session);
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
   * Retrieves a specific session by ID from the mock data.
   *
   * @param sessionId - The unique identifier of the session
   * @returns Promise resolving to the session
   * @throws Error if session is not found
   */
  override async getSession(sessionId: string): Promise<Session> {
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

    const session = this.sessions().find((s) => s.id === sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  /**
   * Subscribes to events from the mock event queue.
   *
   * Events are yielded as they are added via `pushEvent()`.
   * The subscription continues until `cancelSubscription()` is called.
   *
   * @param sessionId - The session to subscribe to (unused in mock)
   * @returns AsyncIterable yielding SessionEvent objects
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override async *subscribe(sessionId: string): AsyncIterable<SessionEvent> {
    this.subscriptionActive = true;

    // Use isActive() method to prevent lint issue with direct property check
    while (this.isActive()) {
      const eventToYield = this.popNextEvent();
      if (eventToYield !== null) {
        yield eventToYield;
      }
      // Small delay to prevent busy loop
      await this.delay(10);
    }
  }

  /**
   * Internal check for subscription state.
   * Separated to avoid lint issues with while loop conditions.
   */
  private isActive(): boolean {
    return this.subscriptionActive;
  }

  /**
   * Cancels any active subscription.
   *
   * Sets the subscription flag to false, causing the async generator
   * to terminate on its next iteration.
   */
  override cancelSubscription(): void {
    this.subscriptionActive = false;
  }

  /** Captured decisions for test verification */
  private readonly submittedDecisions: {
    sessionId: string;
    turnId: string;
    response: GenerateContentResponse;
  }[] = [];

  /**
   * Submits a human decision (response) to the session.
   *
   * In this mock implementation, decisions are captured for test verification.
   *
   * @param sessionId - The session to submit to
   * @param turnId - The turn ID correlating this response to its request
   * @param response - The GenerateContentResponse to submit
   */
  override async submitDecision(
    sessionId: string,
    turnId: string,
    response: GenerateContentResponse,
  ): Promise<void> {
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

    // Capture the decision for test verification
    this.submittedDecisions.push({ sessionId, turnId, response });
  }

  /**
   * Returns all captured decisions for test verification.
   */
  getSubmittedDecisions(): {
    sessionId: string;
    turnId: string;
    response: GenerateContentResponse;
  }[] {
    return [...this.submittedDecisions];
  }

  /**
   * Clears all captured decisions.
   */
  clearSubmittedDecisions(): void {
    this.submittedDecisions.length = 0;
  }

  /**
   * Pushes an event to the mock event queue.
   *
   * Events pushed here will be yielded by an active subscription.
   *
   * @param event - The event to add to the queue
   */
  pushEvent(event: SessionEvent): void {
    this.eventQueue.update((existing) => [...existing, event]);
  }

  /**
   * Clears all events from the mock event queue.
   */
  clearEvents(): void {
    this.eventQueue.set([]);
  }

  /**
   * Returns whether a subscription is currently active.
   */
  isSubscriptionActive(): boolean {
    return this.subscriptionActive;
  }

  /**
   * Pops the next event from the queue if available.
   *
   * @returns The next event or null if queue is empty
   */
  private popNextEvent(): SessionEvent | null {
    const events = this.eventQueue();
    const first = events[0];
    if (first === undefined) {
      return null;
    }
    this.eventQueue.set(events.slice(1));
    return first;
  }

  /**
   * Helper to create a delay promise.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
