import { execSync } from 'child_process';
import { resolve } from 'path';

/**
 * Global setup for Playwright E2E tests (local development only).
 *
 * This script starts the Docker Compose stack before tests run.
 * In CI, Docker is managed by the workflow, so this is skipped.
 */
export default function globalSetup() {
  // Get the repo root (parent of frontend/)
  const repoRoot = resolve(__dirname, '../../..');

  console.log('🐳 Starting Docker Compose E2E stack...');
  console.log(`   Working directory: ${repoRoot}`);

  try {
    // Start Docker Compose with --wait to ensure services are healthy
    execSync('docker compose -f docker-compose.e2e.yaml up -d --wait', {
      stdio: 'inherit',
      cwd: repoRoot,
    });
    console.log('✅ Docker Compose stack is ready');
  } catch (error) {
    console.error('❌ Failed to start Docker Compose stack');
    throw error;
  }
}
