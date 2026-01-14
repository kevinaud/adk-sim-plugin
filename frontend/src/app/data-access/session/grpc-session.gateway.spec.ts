/**
 * @fileoverview Tests for GrpcSessionGateway.
 *
 * Uses Connect-ES mock transport to test the gateway without a real backend.
 *
 * @see mddocs/frontend/research/prototype-findings.md#grpc-web-streaming-with-connect-es
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Transport } from '@connectrpc/connect';
import { createClient, createRouterTransport, ConnectError, Code } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';

import {
  SimulatorService,
  SimulatorSessionSchema,
  ListSessionsResponseSchema,
  SessionEventSchema,
  SubscribeResponseSchema,
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
 * Creates a mock transport with streaming support.
 */
function createStreamingTransport(
  sessions: Array<{ id: string; description: string }>,
  events: Array<{ eventId: string; sessionId: string }>,
): Transport {
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
      createSession: () => {
        throw new Error('Not implemented');
      },
      subscribe: async function* () {
        for (const event of events) {
          yield create(SubscribeResponseSchema, {
            event: create(SessionEventSchema, {
              eventId: event.eventId,
              sessionId: event.sessionId,
            }),
          });
        }
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
  // Mock crypto.randomUUID for consistent test behavior
  beforeEach(() => {
    vi.stubGlobal('crypto', {
      randomUUID: () => 'test-uuid-12345',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  describe('getSession', () => {
    it('should return session when found', async () => {
      const mockSessions = [
        { id: 'session-1', description: 'First session' },
        { id: 'session-2', description: 'Second session' },
      ];
      const transport = createMockTransport(mockSessions);
      const gateway = createGatewayWithTransport(transport);

      const session = await gateway.getSession('session-2');

      expect(session.id).toBe('session-2');
      expect(session.description).toBe('Second session');
    });

    it('should throw error when session not found', async () => {
      const mockSessions = [{ id: 'session-1', description: 'First session' }];
      const transport = createMockTransport(mockSessions);
      const gateway = createGatewayWithTransport(transport);

      await expect(gateway.getSession('nonexistent')).rejects.toThrow(
        'Session not found: nonexistent',
      );
    });

    it('should propagate backend errors', async () => {
      const transport = createErrorTransport('Backend unavailable');
      const gateway = createGatewayWithTransport(transport);

      await expect(gateway.getSession('session-1')).rejects.toThrow('Backend unavailable');
    });
  });

  describe('subscribe', () => {
    it('should yield events from the stream', async () => {
      const mockEvents = [
        { eventId: 'event-1', sessionId: 'session-1' },
        { eventId: 'event-2', sessionId: 'session-1' },
      ];
      const transport = createStreamingTransport([], mockEvents);
      const gateway = createGatewayWithTransport(transport);

      const events: Array<{ eventId: string }> = [];
      for await (const event of gateway.subscribe('session-1')) {
        events.push({ eventId: event.eventId });
      }

      expect(events).toHaveLength(2);
      expect(events[0]?.eventId).toBe('event-1');
      expect(events[1]?.eventId).toBe('event-2');
    });

    it('should complete when stream ends', async () => {
      const transport = createStreamingTransport([], []);
      const gateway = createGatewayWithTransport(transport);

      const events: unknown[] = [];
      for await (const event of gateway.subscribe('session-1')) {
        events.push(event);
      }

      expect(events).toHaveLength(0);
    });

    it('should cancel previous subscription when starting new one', async () => {
      const mockEvents = [{ eventId: 'event-1', sessionId: 'session-1' }];
      const transport = createStreamingTransport([], mockEvents);
      const gateway = createGatewayWithTransport(transport);

      // Start first subscription (don't consume it)
      const _firstSubscription = gateway.subscribe('session-1');

      // Start second subscription - should cancel first
      const events: Array<{ eventId: string }> = [];
      for await (const event of gateway.subscribe('session-1')) {
        events.push({ eventId: event.eventId });
      }

      expect(events).toHaveLength(1);
    });
  });

  describe('cancelSubscription', () => {
    it('should be safe to call when no subscription active', () => {
      const transport = createMockTransport([]);
      const gateway = createGatewayWithTransport(transport);

      // Should not throw
      expect(() => gateway.cancelSubscription()).not.toThrow();
    });

    it('should be idempotent', () => {
      const transport = createMockTransport([]);
      const gateway = createGatewayWithTransport(transport);

      // Multiple calls should not throw
      gateway.cancelSubscription();
      gateway.cancelSubscription();
      expect(() => gateway.cancelSubscription()).not.toThrow();
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
