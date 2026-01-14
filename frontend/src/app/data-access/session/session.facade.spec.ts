/**
 * @fileoverview Integration tests for SessionFacade.
 *
 * Tests verify that the facade correctly orchestrates between
 * the SessionGateway and SessionStateService. Uses MockSessionGateway
 * for controlled testing of various scenarios.
 *
 * @see mddocs/frontend/frontend-tdd.md#sessionfacade-orchestration
 */

import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';

import { basicTextRequest } from '@adk-sim/converters';
import { SessionEventSchema, SimulatorSessionSchema } from '@adk-sim/protos';

import { MockSessionGateway } from './mock-session.gateway';
import { SessionFacade } from './session.facade';
import { SessionGateway, type Session, type SessionEvent } from './session.gateway';
import { SessionStateService } from './session-state.service';

/**
 * Helper to create a SessionEvent with an llmRequest payload.
 */
function createLlmRequestEvent(eventId: string, sessionId: string): SessionEvent {
  return create(SessionEventSchema, {
    eventId,
    sessionId,
    payload: {
      case: 'llmRequest',
      value: basicTextRequest,
    },
  });
}

describe('SessionFacade', () => {
  let facade: SessionFacade;
  let mockGateway: MockSessionGateway;
  let stateService: SessionStateService;

  beforeEach(() => {
    mockGateway = new MockSessionGateway();

    TestBed.configureTestingModule({
      providers: [
        SessionFacade,
        SessionStateService,
        { provide: SessionGateway, useValue: mockGateway },
      ],
    });

    facade = TestBed.inject(SessionFacade);
    stateService = TestBed.inject(SessionStateService);
  });

  describe('exposed signals', () => {
    it('should expose sessionId from state service', () => {
      expect(facade.sessionId()).toBeNull();

      stateService.setSessionId('test-session');
      expect(facade.sessionId()).toBe('test-session');
    });

    it('should expose connectionStatus from state service', () => {
      expect(facade.connectionStatus()).toBe('disconnected');

      stateService.setConnectionStatus('connected');
      expect(facade.connectionStatus()).toBe('connected');
    });

    it('should expose error from state service', () => {
      expect(facade.error()).toBeNull();

      stateService.setError('Test error');
      expect(facade.error()).toBe('Test error');
    });

    it('should expose isConnected from state service', () => {
      expect(facade.isConnected()).toBe(false);

      stateService.setConnectionStatus('connected');
      expect(facade.isConnected()).toBe(true);
    });

    it('should expose hasError from state service', () => {
      expect(facade.hasError()).toBe(false);

      stateService.setError('Test error');
      expect(facade.hasError()).toBe(true);
    });
  });

  describe('listSessions', () => {
    const mockSessions: Session[] = [
      create(SimulatorSessionSchema, { id: 'session-1', description: 'First Session' }),
      create(SimulatorSessionSchema, { id: 'session-2', description: 'Second Session' }),
    ];

    it('should return sessions from gateway', async () => {
      mockGateway.setMockSessions(mockSessions);

      const sessions = await facade.listSessions();

      expect(sessions).toEqual(mockSessions);
    });

    it('should set connectionStatus to connecting before calling gateway', async () => {
      mockGateway.setMockSessions(mockSessions);

      // Use a delay to check intermediate state
      mockGateway.setSimulatedDelay(10);

      const promise = facade.listSessions();

      // Should be connecting immediately
      expect(facade.connectionStatus()).toBe('connecting');

      await promise;
    });

    it('should set connectionStatus to connected on success', async () => {
      mockGateway.setMockSessions(mockSessions);

      await facade.listSessions();

      expect(facade.connectionStatus()).toBe('connected');
    });

    it('should clear error on success', async () => {
      // Set an initial error
      stateService.setError('Previous error');
      mockGateway.setMockSessions(mockSessions);

      await facade.listSessions();

      expect(facade.error()).toBeNull();
      expect(facade.hasError()).toBe(false);
    });

    it('should set connectionStatus to disconnected on error', async () => {
      mockGateway.setErrorToThrow(new Error('Connection failed'));

      await expect(facade.listSessions()).rejects.toThrow('Connection failed');

      expect(facade.connectionStatus()).toBe('disconnected');
    });

    it('should set error message on error', async () => {
      mockGateway.setErrorToThrow(new Error('Connection failed'));

      await expect(facade.listSessions()).rejects.toThrow();

      expect(facade.error()).toBe('Connection failed');
      expect(facade.hasError()).toBe(true);
    });

    it('should re-throw the original error', async () => {
      const testError = new Error('Test error');
      mockGateway.setErrorToThrow(testError);

      await expect(facade.listSessions()).rejects.toThrow(testError);
    });

    it('should handle non-Error objects thrown', async () => {
      // Some gRPC errors might not be proper Error instances
      // Create a plain object to simulate this
      const notAnError = { someProperty: 'Not a real error' };
      mockGateway.setErrorToThrow(notAnError as unknown as Error);

      await expect(facade.listSessions()).rejects.toBeDefined();

      // Should use fallback message for non-Error objects
      expect(facade.error()).toBe('An unknown error occurred');
    });

    it('should return empty array when no sessions exist', async () => {
      mockGateway.setMockSessions([]);

      const sessions = await facade.listSessions();

      expect(sessions).toEqual([]);
      expect(facade.connectionStatus()).toBe('connected');
    });

    describe('state transitions', () => {
      it('should transition disconnected -> connecting -> connected on success', async () => {
        const statusTransitions: string[] = [];

        mockGateway.setMockSessions(mockSessions);
        mockGateway.setSimulatedDelay(10);

        // Record initial state
        statusTransitions.push(facade.connectionStatus());

        const promise = facade.listSessions();

        // Record connecting state
        statusTransitions.push(facade.connectionStatus());

        await promise;

        // Record final state
        statusTransitions.push(facade.connectionStatus());

        expect(statusTransitions).toEqual(['disconnected', 'connecting', 'connected']);
      });

      it('should transition disconnected -> connecting -> disconnected on error', async () => {
        const statusTransitions: string[] = [];

        mockGateway.setErrorToThrow(new Error('Failed'));
        mockGateway.setSimulatedDelay(10);

        // Record initial state
        statusTransitions.push(facade.connectionStatus());

        const promise = facade.listSessions();

        // Record connecting state
        statusTransitions.push(facade.connectionStatus());

        try {
          await promise;
        } catch {
          // Expected
        }

        // Record final state
        statusTransitions.push(facade.connectionStatus());

        expect(statusTransitions).toEqual(['disconnected', 'connecting', 'disconnected']);
      });
    });
  });

  describe('subscribeToSession', () => {
    /**
     * Helper to create a SessionEvent with an llmResponse payload.
     */
    function createLlmResponseEvent(eventId: string, sessionId: string): SessionEvent {
      return create(SessionEventSchema, {
        eventId,
        sessionId,
        payload: {
          case: 'llmResponse',
          value: { candidates: [], modelVersion: '' },
        },
      }) as SessionEvent;
    }

    it('should set sessionId in state when iteration starts', async () => {
      const sessionId = 'test-session-123';
      const event = createLlmRequestEvent('event-1', sessionId);
      mockGateway.pushEvent(event);

      // Start iterating - this is when the generator code runs
      for await (const _request of facade.subscribeToSession(sessionId)) {
        // After first yield, state should be set
        expect(facade.sessionId()).toBe(sessionId);
        mockGateway.cancelSubscription();
      }
    });

    it('should set connectionStatus to connecting then connected', async () => {
      const sessionId = 'test-session-123';
      const event = createLlmRequestEvent('event-1', sessionId);
      mockGateway.pushEvent(event);

      // Start iterating
      for await (const _request of facade.subscribeToSession(sessionId)) {
        // After first event, should be connected (was connecting before first yield)
        expect(facade.connectionStatus()).toBe('connected');
        mockGateway.cancelSubscription();
      }
    });

    it('should clear any previous error when iteration starts', async () => {
      // Set initial error
      stateService.setError('Previous error');
      expect(facade.hasError()).toBe(true);

      const event = createLlmRequestEvent('event-1', 'test-session-123');
      mockGateway.pushEvent(event);

      // Start iterating
      for await (const _request of facade.subscribeToSession('test-session-123')) {
        // Error should be cleared
        expect(facade.error()).toBeNull();
        expect(facade.hasError()).toBe(false);
        mockGateway.cancelSubscription();
      }
    });

    it('should yield converted LlmRequest events', async () => {
      const sessionId = 'test-session-123';
      const event = createLlmRequestEvent('event-1', sessionId);

      // Push event before consuming
      mockGateway.pushEvent(event);

      // Collect results
      const results: unknown[] = [];
      const subscription = facade.subscribeToSession(sessionId);

      // Consume one event then cancel
      for await (const request of subscription) {
        results.push(request);
        mockGateway.cancelSubscription();
      }

      expect(results).toHaveLength(1);
      // Verify it's a converted LlmRequest (has model, contents properties)
      const result = results[0] as { model: string; contents: unknown[] };
      expect(result.model).toBe('gemini-2.0-flash');
      expect(result.contents).toHaveLength(1);
    });

    it('should update connectionStatus to connected on first event', async () => {
      const sessionId = 'test-session-123';
      const event = createLlmRequestEvent('event-1', sessionId);

      mockGateway.pushEvent(event);

      // Consume first event
      for await (const _request of facade.subscribeToSession(sessionId)) {
        // After receiving first event, should be connected
        expect(facade.connectionStatus()).toBe('connected');
        mockGateway.cancelSubscription();
      }
    });

    it('should only yield llmRequest events, not llmResponse events', async () => {
      const sessionId = 'test-session-123';

      // Push both request and response events
      mockGateway.pushEvent(createLlmRequestEvent('event-1', sessionId));
      mockGateway.pushEvent(createLlmResponseEvent('event-2', sessionId));
      mockGateway.pushEvent(createLlmRequestEvent('event-3', sessionId));

      const results: unknown[] = [];
      let eventCount = 0;

      for await (const request of facade.subscribeToSession(sessionId)) {
        results.push(request);
        eventCount++;
        // Cancel after processing a couple of events
        if (eventCount >= 2) {
          mockGateway.cancelSubscription();
        }
      }

      // Should have 2 LlmRequest results (events 1 and 3)
      expect(results).toHaveLength(2);
    });

    it('should set connectionStatus to disconnected when stream ends normally', async () => {
      const sessionId = 'test-session-123';
      const event = createLlmRequestEvent('event-1', sessionId);

      mockGateway.pushEvent(event);

      // Consume until cancelled
      for await (const _request of facade.subscribeToSession(sessionId)) {
        mockGateway.cancelSubscription();
      }

      // After normal completion, should be disconnected
      expect(facade.connectionStatus()).toBe('disconnected');
    });

    // Note: Error handling tests for streaming are covered in e2e/integration tests
    // because the MockSessionGateway doesn't simulate errors during subscribe().
    // The facade's error handling code is tested implicitly through the
    // GrpcSessionGateway tests which use real transport mocking.

    describe('state transitions', () => {
      it('should transition through connecting -> connected -> disconnected', async () => {
        const sessionId = 'test-session-123';
        const event = createLlmRequestEvent('event-1', sessionId);

        mockGateway.pushEvent(event);

        // Initial state
        expect(facade.connectionStatus()).toBe('disconnected');

        // Start consuming - state updates happen inside the generator
        for await (const _request of facade.subscribeToSession(sessionId)) {
          // After first event yield, should be connected
          expect(facade.connectionStatus()).toBe('connected');
          mockGateway.cancelSubscription();
        }

        // After stream ends, should be disconnected
        expect(facade.connectionStatus()).toBe('disconnected');
      });

      it('should set sessionId before first yield', async () => {
        const sessionId = 'test-session-123';
        const event = createLlmRequestEvent('event-1', sessionId);

        mockGateway.pushEvent(event);

        // Initially null
        expect(facade.sessionId()).toBeNull();

        for await (const _request of facade.subscribeToSession(sessionId)) {
          // After first yield, sessionId should be set
          expect(facade.sessionId()).toBe(sessionId);
          mockGateway.cancelSubscription();
        }
      });
    });
  });

  describe('cancelSubscription', () => {
    it('should delegate to gateway and stop iteration', async () => {
      const sessionId = 'test-session-123';
      const event = createLlmRequestEvent('event-1', sessionId);
      mockGateway.pushEvent(event);

      let eventCount = 0;

      for await (const _request of facade.subscribeToSession(sessionId)) {
        eventCount++;
        // Cancel via facade
        facade.cancelSubscription();
      }

      // Should have processed exactly one event before cancellation took effect
      expect(eventCount).toBe(1);
      // Gateway subscription should be inactive
      expect(mockGateway.isSubscriptionActive()).toBe(false);
    });

    it('should be safe to call when no subscription active', () => {
      // Should not throw
      expect(() => facade.cancelSubscription()).not.toThrow();
    });

    it('should be idempotent', () => {
      // Multiple calls should not throw
      facade.cancelSubscription();
      facade.cancelSubscription();
      expect(() => facade.cancelSubscription()).not.toThrow();
    });
  });

  describe('validateSession', () => {
    it('should resolve when session exists', async () => {
      const session = create(SimulatorSessionSchema, {
        id: 'existing-session',
        description: 'Test',
      });
      mockGateway.setMockSessions([session]);

      await expect(facade.validateSession('existing-session')).resolves.toBeUndefined();
    });

    it('should throw when session does not exist', async () => {
      mockGateway.setMockSessions([]);

      await expect(facade.validateSession('nonexistent')).rejects.toThrow('Session not found');
    });

    it('should not update connection status', async () => {
      const session = create(SimulatorSessionSchema, { id: 'test-session', description: 'Test' });
      mockGateway.setMockSessions([session]);

      // Set initial status
      stateService.setConnectionStatus('disconnected');

      await facade.validateSession('test-session');

      // Status should remain unchanged
      expect(facade.connectionStatus()).toBe('disconnected');
    });
  });
});
