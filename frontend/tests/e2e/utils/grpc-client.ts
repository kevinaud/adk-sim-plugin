/**
 * @fileoverview gRPC client for E2E test setup using Connect-ES.
 *
 * Uses @connectrpc/connect-node for Node.js-compatible gRPC-Web transport.
 * Tests should use the client directly to set up their test data.
 *
 * @example
 * ```typescript
 * import { createTestClient } from './utils/grpc-client';
 *
 * test('displays created session', async ({ page }) => {
 *   const client = createTestClient();
 *   const { session } = await client.createSession({ description: 'Test' });
 *   await page.goto(`/session/${session!.id}`);
 * });
 * ```
 */

import { SimulatorService } from '@adk-sim/protos';
import { createClient, type Client } from '@connectrpc/connect';
import { createGrpcWebTransport } from '@connectrpc/connect-node';

/**
 * Type alias for the SimulatorService client.
 */
export type SimulatorClient = Client<typeof SimulatorService>;

/**
 * Default backend URL for E2E tests.
 */
const DEFAULT_BACKEND_URL = process.env['BACKEND_URL'] ?? 'http://127.0.0.1:8080';

/**
 * Create a gRPC-Web client for the SimulatorService.
 *
 * @param baseUrl - Backend URL (defaults to BACKEND_URL env var or localhost:8080)
 * @returns A typed Connect client for SimulatorService
 */
export function createTestClient(baseUrl = DEFAULT_BACKEND_URL): SimulatorClient {
  const transport = createGrpcWebTransport({
    baseUrl,
    httpVersion: '1.1',
  });
  return createClient(SimulatorService, transport);
}
