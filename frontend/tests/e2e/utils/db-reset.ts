/**
 * @fileoverview Database reset utilities for E2E test isolation.
 *
 * Provides utilities to reset the backend database between tests,
 * ensuring each test starts with a clean state.
 *
 * ## Test Isolation Architecture
 *
 * The E2E tests use a shared Docker backend for performance reasons.
 * True per-test container isolation would be too slow. Instead, we provide:
 *
 * 1. **Browser isolation**: Each test gets a separate browser context (via `fullyParallel: true`)
 * 2. **Data isolation**: Tests use unique identifiers (timestamps/UUIDs) to avoid collisions
 * 3. **Optional DB reset**: The `resetDatabase()` function can clear all data before a test
 *
 * ## Usage
 *
 * For tests that require a completely clean database:
 * ```typescript
 * import { resetDatabase } from './utils/db-reset';
 *
 * test.beforeEach(async () => {
 *   await resetDatabase();
 * });
 * ```
 *
 * For most tests, using unique identifiers is sufficient and faster.
 */

import { execSync } from 'child_process';
import { resolve } from 'path';

/**
 * Path to the repository root (parent of frontend/).
 */
const REPO_ROOT = resolve(__dirname, '../../../..');

/**
 * Docker Compose file used for E2E tests.
 */
const COMPOSE_FILE = 'docker-compose.test.yaml';

/**
 * Reset the backend database to a clean state.
 *
 * This removes the SQLite database file inside the Docker container,
 * causing the backend to create a fresh database on the next request.
 *
 * Note: This operation is relatively fast but adds ~100-200ms overhead.
 * Use sparingly - prefer unique test identifiers for most tests.
 *
 * @throws Error if Docker operation fails
 */
export function resetDatabase(): void {
  try {
    // Remove the SQLite database file inside the container
    // The backend uses /tmp/test.db as the database path
    execSync(`docker compose -f ${COMPOSE_FILE} exec -T backend rm -f /tmp/test.db`, {
      cwd: REPO_ROOT,
      stdio: 'pipe', // Suppress output
      timeout: 5000, // 5 second timeout
    });
  } catch (error) {
    // Container might not be running - that's OK, fresh start will have clean DB
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('No such container') && !message.includes('not running')) {
      throw new Error(`Failed to reset database: ${message}`);
    }
  }
}

/**
 * Check if the Docker backend container is running.
 *
 * @returns true if the backend container is healthy and running
 */
export function isBackendRunning(): boolean {
  try {
    const output = execSync(`docker compose -f ${COMPOSE_FILE} ps --format json`, {
      cwd: REPO_ROOT,
      stdio: 'pipe',
      timeout: 5000,
    }).toString();

    // Parse JSON output to check for healthy backend
    const containers = output.trim().split('\n').filter(Boolean);
    for (const line of containers) {
      try {
        const container = JSON.parse(line) as { Service?: string; Health?: string };
        if (container.Service === 'backend' && container.Health === 'healthy') {
          return true;
        }
      } catch {
        // Skip malformed JSON lines
      }
    }
    return false;
  } catch {
    return false;
  }
}
