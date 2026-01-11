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

import { SimulatorSessionSchema } from '@adk-sim/protos';

import { MockSessionGateway } from './mock-session.gateway';
import { SessionFacade } from './session.facade';
import { SessionGateway, type Session } from './session.gateway';
import { SessionStateService } from './session-state.service';

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
});
