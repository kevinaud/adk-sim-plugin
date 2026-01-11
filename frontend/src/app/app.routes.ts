import { type Routes } from '@angular/router';

/**
 * Application routes configuration.
 *
 * Routes:
 * - `/` - Session list (default route) - FR-002
 * - `/session/:id` - Session detail (to be implemented)
 *
 * @see mddocs/frontend/frontend-tdd.md#routing-configuration
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/session-list').then((m) => m.SessionListComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
