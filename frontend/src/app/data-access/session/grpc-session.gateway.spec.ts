/**
 * @fileoverview Tests for GrpcSessionGateway.
 *
 * Uses Connect-ES mock transport to test the gateway without a real backend.
 *
 * @see mddocs/frontend/research/prototype-findings.md#grpc-web-streaming-with-connect-es
 */

import { describe, it, expect } from 'vitest';
import type { Transport } from '@connectrpc/connect';
import { createClient, createRouterTransport, ConnectError, Code } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';

import {
  SimulatorService,
  SimulatorSessionSchema,
  ListSessionsResponseSchema,
} from '@adk-sim/protos';

import { GrpcSessionGateway } from './grpc-session.gateway';

/**
 * Creates a mock transport that returns the specified sessions.
 */
function createMockTransport(sessions: Array<{ id: string; description: string }>): Transport {
  return createRouterTransport(({ service }) => {
    service(SimulatorService, {
      listSessions: () => {
        return create(ListSessionsResponseSchema, {
          sessions: sessions.map((s) =>
            create(SimulatorSessionSchema, {
              id: s.id,
              description: s.description,
            }),
          ),
          nextPageToken: '',
        });
      },
      // Other methods not implemented for this PR
      createSession: () => {
        throw new Error('Not implemented');
      },
      subscribe: async function* () {
        throw new Error('Not implemented');
      },
      submitRequest: () => {
        throw new Error('Not implemented');
      },
      submitDecision: () => {
        throw new Error('Not implemented');
      },
    });
  });
}

/**
 * Creates a mock transport that throws a ConnectError.
 */
function createErrorTransport(errorMessage: string): Transport {
  return createRouterTransport(({ service }) => {
    service(SimulatorService, {
      listSessions: () => {
        throw new ConnectError(errorMessage, Code.Unavailable);
      },
      createSession: () => {
        throw new Error('Not implemented');
      },
      subscribe: async function* () {
        throw new Error('Not implemented');
      },
      submitRequest: () => {
        throw new Error('Not implemented');
      },
      submitDecision: () => {
        throw new Error('Not implemented');
      },
    });
  });
}

/**
 * Creates a GrpcSessionGateway with a custom transport for testing.
 * Uses dependency injection override pattern.
 */
function createGatewayWithTransport(transport: Transport): GrpcSessionGateway {
  const gateway = new GrpcSessionGateway();
  // Override the private client with one using our mock transport
  const mockClient = createClient(SimulatorService, transport);
  Object.defineProperty(gateway, 'client', {
    value: mockClient,
    writable: false,
  });
  return gateway;
}

describe('GrpcSessionGateway', () => {
  describe('listSessions', () => {
    it('should return empty array when no sessions exist', async () => {
      const transport = createMockTransport([]);
      const gateway = createGatewayWithTransport(transport);

      const sessions = await gateway.listSessions();

      expect(sessions).toEqual([]);
    });

    it('should return sessions from the backend', async () => {
      const mockSessions = [
        { id: 'session-1', description: 'First session' },
        { id: 'session-2', description: 'Second session' },
      ];
      const transport = createMockTransport(mockSessions);
      const gateway = createGatewayWithTransport(transport);

      const sessions = await gateway.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions[0]?.id).toBe('session-1');
      expect(sessions[0]?.description).toBe('First session');
      expect(sessions[1]?.id).toBe('session-2');
      expect(sessions[1]?.description).toBe('Second session');
    });

    it('should propagate errors from the backend', async () => {
      const transport = createErrorTransport('Backend unavailable');
      const gateway = createGatewayWithTransport(transport);

      await expect(gateway.listSessions()).rejects.toThrow('Backend unavailable');
    });

    it('should handle sessions with undefined createdAt', async () => {
      const mockSessions = [{ id: 'session-no-date', description: 'No date' }];
      const transport = createMockTransport(mockSessions);
      const gateway = createGatewayWithTransport(transport);

      const sessions = await gateway.listSessions();

      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.createdAt).toBeUndefined();
    });
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      // Test that the gateway can be instantiated
      // This will use the real transport (from ENVIRONMENT), but we're just checking construction
      const gateway = new GrpcSessionGateway();
      expect(gateway).toBeInstanceOf(GrpcSessionGateway);
    });
  });
});
