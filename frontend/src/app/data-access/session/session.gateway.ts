/**
 * @fileoverview Abstract gateway port for session operations.
 *
 * This is the hexagonal architecture "port" that defines how the application
 * communicates with the backend for session management. Implementations include:
 * - GrpcSessionGateway: Real gRPC-Web adapter for production
 * - MockSessionGateway: Controllable mock for testing
 *
 * Using an abstract class (not interface) for Angular DI compatibility.
 *
 * IMPORTANT: To use SessionGateway, you must provide it in the app config:
 * ```typescript
 * providers: [
 *   { provide: SessionGateway, useClass: GrpcSessionGateway }
 * ]
 * ```
 *
 * @see mddocs/frontend/frontend-tdd.md#gateway-port-abstract
 * @see mddocs/frontend/research/angular-architecture-analysis.md#abstract-ports-for-infrastructure-testing
 */

import type {
  GenerateContentResponse,
  SessionEvent as ProtoSessionEvent,
  SimulatorSession,
} from '@adk-sim/protos';

/**
 * Session type alias for use throughout the application.
 * Uses the protobuf-generated SimulatorSession type.
 */
export type Session = SimulatorSession;

/**
 * SessionEvent type alias for use throughout the application.
 * Uses the protobuf-generated SessionEvent type.
 */
export type SessionEvent = ProtoSessionEvent;

/**
 * Abstract gateway port for session operations.
 *
 * This class defines the contract for all session-related backend communication.
 * Extend this class to provide different implementations (gRPC, mock, etc.).
 *
 * @example
 * ```typescript
 * // In a component or service
 * private readonly gateway = inject(SessionGateway);
 *
 * async loadSessions() {
 *   const sessions = await this.gateway.listSessions();
 *   // Handle sessions...
 * }
 * ```
 */
export abstract class SessionGateway {
  /**
   * Retrieves all available simulation sessions.
   *
   * @returns Promise resolving to array of sessions
   */
  abstract listSessions(): Promise<Session[]>;

  /**
   * Retrieves a specific session by ID.
   *
   * @param sessionId - The unique identifier of the session
   * @returns Promise resolving to the session
   * @throws Error if session is not found
   */
  abstract getSession(sessionId: string): Promise<Session>;

  /**
   * Subscribes to real-time events for a session.
   *
   * Returns an async iterable that yields SessionEvent objects as they
   * are received from the server. The stream continues until cancelled
   * via `cancelSubscription()` or the server closes the connection.
   *
   * @param sessionId - The session to subscribe to
   * @returns AsyncIterable that yields SessionEvent objects
   *
   * @example
   * ```typescript
   * for await (const event of gateway.subscribe('session-123')) {
   *   console.log('Received event:', event);
   * }
   * ```
   */
  abstract subscribe(sessionId: string): AsyncIterable<SessionEvent>;

  /**
   * Cancels any active subscription.
   *
   * Calling this method will cause the async iterable returned by
   * `subscribe()` to complete. Safe to call even if no subscription
   * is active.
   */
  abstract cancelSubscription(): void;

  /**
   * Submits a human decision (response) to the session.
   *
   * @param sessionId - The session to submit to
   * @param turnId - The turn ID correlating this response to its request
   * @param response - The GenerateContentResponse to submit
   * @returns Promise resolving when the decision is submitted
   */
  abstract submitDecision(
    sessionId: string,
    turnId: string,
    response: GenerateContentResponse,
  ): Promise<void>;
}
