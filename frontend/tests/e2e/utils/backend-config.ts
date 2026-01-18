/**
 * @fileoverview Multi-backend configuration for E2E tests.
 *
 * Defines named backend instances with different purposes:
 * - no-sessions: Always empty, for empty state tests
 * - populated: Pre-seeded with sessions, for stable visual tests
 * - shared: Allows session creation, for session-specific tests
 *
 * @example
 * ```typescript
 * import { BACKENDS, getBackendUrl } from './utils/backend-config';
 *
 * // Get URL for a specific backend
 * const url = getBackendUrl('no-sessions');
 *
 * // Use in test fixture
 * test.use({ backend: 'no-sessions' });
 * ```
 */

/**
 * Backend instance type names.
 */
export type BackendName = 'no-sessions' | 'populated' | 'shared';

/**
 * Configuration for a single backend instance.
 */
export interface BackendConfig {
  /** Backend name for identification */
  name: BackendName;
  /** HTTP port - serves both frontend and gRPC-Web API */
  port: number;
  /** Description of what this backend is for */
  description: string;
  /** Whether tests can create sessions on this backend */
  allowSessionCreation: boolean;
}

/**
 * Backend configurations for E2E tests.
 *
 * Each backend runs on a different port (non-conflicting with main docker-compose):
 * - no-sessions: Empty state tests
 * - populated: Visual regression with pre-seeded data
 * - shared: Session-specific tests with unique IDs
 */
export const BACKENDS: Record<BackendName, BackendConfig> = {
  'no-sessions': {
    name: 'no-sessions',
    port: 8091,
    description: 'Always empty - never create sessions here',
    allowSessionCreation: false,
  },
  populated: {
    name: 'populated',
    port: 8092,
    description: 'Pre-seeded with fixed sessions for stable visual tests',
    allowSessionCreation: false,
  },
  shared: {
    name: 'shared',
    port: 8093,
    description: 'Allows session creation for session-specific tests',
    allowSessionCreation: true,
  },
};

/**
 * Default backend for tests that do not specify one.
 * Uses 'shared' as it allows the most flexibility.
 */
export const DEFAULT_BACKEND: BackendName = 'shared';

/**
 * Get the base URL for a backend instance.
 *
 * @param backend - Backend name or config
 * @returns Base URL (e.g., "http://127.0.0.1:8091")
 */
export function getBackendUrl(backend: BackendName | BackendConfig = DEFAULT_BACKEND): string {
  const config = typeof backend === 'string' ? BACKENDS[backend] : backend;
  return `http://127.0.0.1:${String(config.port)}`;
}

/**
 * Get the Docker Compose service name for a backend.
 *
 * @param backend - Backend name
 * @returns Docker Compose service name (e.g., "backend-no-sessions")
 */
export function getServiceName(backend: BackendName): string {
  return `backend-${backend}`;
}

/**
 * Docker Compose file used for E2E tests with multiple backends.
 */
export const E2E_COMPOSE_FILE = 'docker-compose.e2e.yaml';
