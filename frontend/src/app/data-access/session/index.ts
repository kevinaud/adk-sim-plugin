/**
 * Session data access module
 *
 * Manages session state and communication with the backend.
 * Contains: SessionFacade, SessionStateService, SessionGateway.
 *
 * @module data-access/session
 * @see mddocs/frontend/frontend-tdd.md#folder-layout
 */

// Gateway port and implementations
export { GrpcSessionGateway } from './grpc-session.gateway';
export { MockSessionGateway } from './mock-session.gateway';
export type { Session } from './session.gateway';
export { SessionGateway } from './session.gateway';
