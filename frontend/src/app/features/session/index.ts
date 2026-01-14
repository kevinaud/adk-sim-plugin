/**
 * Session feature module
 *
 * Displays an individual simulation session with event streaming.
 * Implements FR-001 (Session Navigation) and FR-004 (Invalid Session Handling).
 *
 * @module features/session
 * @see mddocs/frontend/frontend-tdd.md#folder-layout
 */

export { SessionComponent } from './session.component';
export { sessionExistsGuard } from './session.guard';
