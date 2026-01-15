import { type Routes } from '@angular/router';

import { sessionExistsGuard } from './features/session';

/**
 * Application routes configuration.
 *
 * Routes:
 * - `/` - Session list (default route) - FR-002
 * - `/session/:id` - Session detail with validation guard - FR-001, FR-004
 *
 * @see mddocs/frontend/frontend-tdd.md#routing-configuration
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/session-list').then((m) => m.SessionListComponent),
  },
  {
    path: 'session/:id',
    loadComponent: () => import('./features/session').then((m) => m.SessionComponent),
    canActivate: [sessionExistsGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
