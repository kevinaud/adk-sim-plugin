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

import type { SimulatorSession } from '@adk-sim/protos';

/**
 * Session type alias for use throughout the application.
 * Uses the protobuf-generated SimulatorSession type.
 */
export type Session = SimulatorSession;

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
}
