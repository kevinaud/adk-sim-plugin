/**
 * Session data access module
 *
 * Manages session state and communication with the backend.
 * Contains: SessionFacade, SessionStateService, SessionGateway.
 *
 * @module data-access/session
 * @see mddocs/frontend/frontend-tdd.md#folder-layout
 */

// Facade (primary entry point for components)
export { SessionFacade } from './session.facade';

// Gateway port and implementations
export { GrpcSessionGateway } from './grpc-session.gateway';
export { MockSessionGateway } from './mock-session.gateway';
export type { Session } from './session.gateway';
export { SessionGateway } from './session.gateway';

// State management
export type { ConnectionStatus } from './session-state.service';
export { SessionStateService } from './session-state.service';
