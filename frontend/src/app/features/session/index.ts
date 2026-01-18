/**
 * Session feature module
 *
 * Displays an individual simulation session with event streaming.
 * Implements FR-001 (Session Navigation), FR-004 (Invalid Session Handling),
 * and FR-024 (Request Queue Management).
 *
 * @module features/session
 * @see mddocs/frontend/frontend-tdd.md#folder-layout
 */

export { SessionComponent } from './session.component';
export { sessionExistsGuard } from './session.guard';
export { type SimulationState, SimulationStore } from './simulation.store';
