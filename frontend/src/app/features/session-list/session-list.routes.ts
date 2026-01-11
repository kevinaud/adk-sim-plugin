/**
 * @fileoverview Route configuration for the session list feature.
 *
 * Provides lazy-loadable route configuration for the session list component.
 * This is the default route for the application (path: '').
 *
 * @see mddocs/frontend/frontend-tdd.md#routing-configuration
 */

import type { Routes } from '@angular/router';

/**
 * Routes for the session list feature module.
 */
export const sessionListRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./session-list.component').then((m) => m.SessionListComponent),
  },
];
