/**
 * @fileoverview Route guard for session validation.
 *
 * Validates that a session exists before allowing navigation to the session route.
 * Implements FR-004 (Invalid Session Handling) by redirecting to the session list
 * with an error query parameter when validation fails.
 *
 * @see mddocs/frontend/frontend-tdd.md#routing-configuration
 * @see mddocs/frontend/frontend-spec.md#fr-session-management
 */

import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { SessionFacade } from '../../data-access/session';

/**
 * Route guard that validates session existence before navigation.
 *
 * This guard:
 * - Extracts the session ID from route params
 * - Validates the session exists via SessionFacade
 * - Redirects to home with error query param on failure
 *
 * @example
 * ```typescript
 * // In routes configuration
 * {
 *   path: 'session/:id',
 *   loadComponent: () => import('./features/session').then(m => m.SessionComponent),
 *   canActivate: [sessionExistsGuard],
 * }
 * ```
 */
export const sessionExistsGuard: CanActivateFn = async (route) => {
  const facade = inject(SessionFacade);
  const router = inject(Router);
  const sessionId = route.paramMap.get('id');

  // Handle missing session ID
  if (!sessionId) {
    return router.createUrlTree(['/'], {
      queryParams: { error: 'No session ID provided' },
    });
  }

  try {
    await facade.validateSession(sessionId);
    return true;
  } catch {
    return router.createUrlTree(['/'], {
      queryParams: { error: 'Session not found' },
    });
  }
};
