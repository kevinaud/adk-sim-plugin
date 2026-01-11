/**
 * @fileoverview Unit tests for SessionStateService.
 *
 * Tests verify that the service correctly:
 * - Initializes with default values
 * - Exposes readonly signals
 * - Updates state via mutation methods
 * - Computes derived state correctly
 *
 * @see mddocs/frontend/frontend-tdd.md#sessionstateservice-global
 */

import { TestBed } from '@angular/core/testing';
import { SessionStateService, type ConnectionStatus } from './session-state.service';

describe('SessionStateService', () => {
  let service: SessionStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SessionStateService],
    });
    service = TestBed.inject(SessionStateService);
  });

  describe('initial state', () => {
    it('should have null sessionId initially', () => {
      expect(service.sessionId()).toBeNull();
    });

    it('should have disconnected connectionStatus initially', () => {
      expect(service.connectionStatus()).toBe('disconnected');
    });

    it('should have null error initially', () => {
      expect(service.error()).toBeNull();
    });

    it('should have isConnected as false initially', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('should have hasError as false initially', () => {
      expect(service.hasError()).toBe(false);
    });
  });

  describe('setSessionId', () => {
    it('should update sessionId signal', () => {
      service.setSessionId('session-123');

      expect(service.sessionId()).toBe('session-123');
    });

    it('should allow setting sessionId to null', () => {
      service.setSessionId('session-123');
      service.setSessionId(null);

      expect(service.sessionId()).toBeNull();
    });

    it('should allow changing sessionId', () => {
      service.setSessionId('session-1');
      service.setSessionId('session-2');

      expect(service.sessionId()).toBe('session-2');
    });
  });

  describe('setConnectionStatus', () => {
    it('should update connectionStatus to connecting', () => {
      service.setConnectionStatus('connecting');

      expect(service.connectionStatus()).toBe('connecting');
    });

    it('should update connectionStatus to connected', () => {
      service.setConnectionStatus('connected');

      expect(service.connectionStatus()).toBe('connected');
    });

    it('should update connectionStatus to disconnected', () => {
      service.setConnectionStatus('connected');
      service.setConnectionStatus('disconnected');

      expect(service.connectionStatus()).toBe('disconnected');
    });

    it('should update isConnected computed when status changes', () => {
      expect(service.isConnected()).toBe(false);

      service.setConnectionStatus('connecting');
      expect(service.isConnected()).toBe(false);

      service.setConnectionStatus('connected');
      expect(service.isConnected()).toBe(true);

      service.setConnectionStatus('disconnected');
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('setError', () => {
    it('should update error signal', () => {
      service.setError('Connection failed');

      expect(service.error()).toBe('Connection failed');
    });

    it('should allow setting error to null', () => {
      service.setError('Some error');
      service.setError(null);

      expect(service.error()).toBeNull();
    });

    it('should update hasError computed when error changes', () => {
      expect(service.hasError()).toBe(false);

      service.setError('Error occurred');
      expect(service.hasError()).toBe(true);

      service.setError(null);
      expect(service.hasError()).toBe(false);
    });
  });

  describe('clearError', () => {
    it('should clear existing error', () => {
      service.setError('Some error');

      service.clearError();

      expect(service.error()).toBeNull();
      expect(service.hasError()).toBe(false);
    });

    it('should be safe to call when no error exists', () => {
      service.clearError();

      expect(service.error()).toBeNull();
      expect(service.hasError()).toBe(false);
    });
  });

  describe('state transitions', () => {
    it('should handle typical connection lifecycle', () => {
      // Initial state
      expect(service.connectionStatus()).toBe('disconnected');
      expect(service.isConnected()).toBe(false);

      // User initiates connection
      service.setSessionId('session-abc');
      service.setConnectionStatus('connecting');
      expect(service.sessionId()).toBe('session-abc');
      expect(service.connectionStatus()).toBe('connecting');
      expect(service.isConnected()).toBe(false);

      // Connection established
      service.setConnectionStatus('connected');
      expect(service.connectionStatus()).toBe('connected');
      expect(service.isConnected()).toBe(true);

      // Connection lost
      service.setConnectionStatus('disconnected');
      expect(service.connectionStatus()).toBe('disconnected');
      expect(service.isConnected()).toBe(false);
    });

    it('should handle error during connection', () => {
      service.setSessionId('session-xyz');
      service.setConnectionStatus('connecting');

      // Error occurs
      service.setError('Failed to connect: timeout');
      service.setConnectionStatus('disconnected');

      expect(service.hasError()).toBe(true);
      expect(service.error()).toBe('Failed to connect: timeout');
      expect(service.isConnected()).toBe(false);

      // User retries - clear error
      service.clearError();
      service.setConnectionStatus('connecting');

      expect(service.hasError()).toBe(false);
      expect(service.connectionStatus()).toBe('connecting');
    });

    it('should handle session change', () => {
      // Connected to first session
      service.setSessionId('session-1');
      service.setConnectionStatus('connected');

      // Switch to new session
      service.setConnectionStatus('disconnected');
      service.setSessionId('session-2');
      service.setConnectionStatus('connecting');
      service.setConnectionStatus('connected');

      expect(service.sessionId()).toBe('session-2');
      expect(service.isConnected()).toBe(true);
    });
  });

  describe('type safety', () => {
    it('should only accept valid ConnectionStatus values', () => {
      const validStatuses: ConnectionStatus[] = ['connected', 'connecting', 'disconnected'];

      for (const status of validStatuses) {
        service.setConnectionStatus(status);
        expect(service.connectionStatus()).toBe(status);
      }
    });
  });
});
