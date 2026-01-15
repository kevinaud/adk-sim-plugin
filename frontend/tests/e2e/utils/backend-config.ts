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
  /** HTTP port for gRPC-Web endpoint */
  httpPort: number;
  /** gRPC port for direct gRPC access */
  grpcPort: number;
  /** Description of what this backend is for */
  description: string;
  /** Whether tests can create sessions on this backend */
  allowSessionCreation: boolean;
}

/**
 * Backend configurations for E2E tests.
 *
 * Each backend runs on different ports with different purposes:
 * - no-sessions: Empty state tests
 * - populated: Visual regression with pre-seeded data
 * - shared: Session-specific tests with unique IDs
 */
export const BACKENDS: Record<BackendName, BackendConfig> = {
  'no-sessions': {
    name: 'no-sessions',
    httpPort: 8081,
    grpcPort: 50052,
    description: 'Always empty - never create sessions here',
    allowSessionCreation: false,
  },
  populated: {
    name: 'populated',
    httpPort: 8082,
    grpcPort: 50053,
    description: 'Pre-seeded with fixed sessions for stable visual tests',
    allowSessionCreation: false,
  },
  shared: {
    name: 'shared',
    httpPort: 8080,
    grpcPort: 50054,
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
 * Get the HTTP base URL for a backend instance.
 *
 * @param backend - Backend name or config
 * @returns HTTP base URL (e.g., "http://127.0.0.1:8081")
 */
export function getBackendUrl(backend: BackendName | BackendConfig = DEFAULT_BACKEND): string {
  const config = typeof backend === 'string' ? BACKENDS[backend] : backend;
  return `http://127.0.0.1:${String(config.httpPort)}`;
}

/**
 * Get the gRPC URL for a backend instance.
 *
 * @param backend - Backend name or config
 * @returns gRPC URL (e.g., "127.0.0.1:50052")
 */
export function getGrpcUrl(backend: BackendName | BackendConfig = DEFAULT_BACKEND): string {
  const config = typeof backend === 'string' ? BACKENDS[backend] : backend;
  return `127.0.0.1:${String(config.grpcPort)}`;
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
