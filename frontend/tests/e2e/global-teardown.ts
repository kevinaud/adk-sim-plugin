import { execSync } from 'child_process';
import { resolve } from 'path';

/**
 * Global teardown for Playwright E2E tests (local development only).
 *
 * This script stops the Docker Compose stack after tests complete.
 * In CI, Docker is managed by the workflow, so this is skipped.
 */
export default function globalTeardown() {
  // Get the repo root (parent of frontend/)
  const repoRoot = resolve(__dirname, '../../..');

  console.log('🐳 Stopping Docker Compose test stack...');

  try {
    execSync('docker compose -f docker-compose.test.yaml down', {
      stdio: 'inherit',
      cwd: repoRoot,
    });
    console.log('✅ Docker Compose stack stopped');
  } catch {
    console.error('⚠️ Failed to stop Docker Compose stack (may already be stopped)');
    // Don't throw - teardown errors shouldn't fail the test run
  }
}
