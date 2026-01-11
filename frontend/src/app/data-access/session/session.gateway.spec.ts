/**
 * @fileoverview Unit tests for MockSessionGateway.
 *
 * Tests verify that the mock gateway correctly:
 * - Returns configured mock data
 * - Supports adding/clearing sessions
 * - Simulates network delay
 * - Supports error injection for testing error handling
 */

import { MockSessionGateway } from './mock-session.gateway';
import type { Session } from './session.gateway';

describe('MockSessionGateway', () => {
  let gateway: MockSessionGateway;

  beforeEach(() => {
    gateway = new MockSessionGateway();
  });

  describe('listSessions', () => {
    it('should return empty array initially', async () => {
      const sessions = await gateway.listSessions();

      expect(sessions).toEqual([]);
    });

    it('should return configured mock sessions', async () => {
      const mockSessions: Session[] = [
        createMockSession('session-1', 'First session'),
        createMockSession('session-2', 'Second session'),
      ];
      gateway.setMockSessions(mockSessions);

      const sessions = await gateway.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions[0]?.id).toBe('session-1');
      expect(sessions[1]?.id).toBe('session-2');
    });

    it('should return a copy to prevent external mutation', async () => {
      const mockSessions: Session[] = [createMockSession('session-1', 'Test session')];
      gateway.setMockSessions(mockSessions);

      const result1 = await gateway.listSessions();
      const result2 = await gateway.listSessions();

      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });
  });

  describe('addSession', () => {
    it('should add session to existing list', async () => {
      gateway.setMockSessions([createMockSession('session-1', 'First')]);

      gateway.addSession(createMockSession('session-2', 'Second'));

      const sessions = await gateway.listSessions();
      expect(sessions).toHaveLength(2);
    });

    it('should add session to empty list', async () => {
      gateway.addSession(createMockSession('session-1', 'First'));

      const sessions = await gateway.listSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.id).toBe('session-1');
    });
  });

  describe('clearSessions', () => {
    it('should remove all sessions', async () => {
      gateway.setMockSessions([
        createMockSession('session-1', 'First'),
        createMockSession('session-2', 'Second'),
      ]);

      gateway.clearSessions();

      const sessions = await gateway.listSessions();
      expect(sessions).toEqual([]);
    });
  });

  describe('setSimulatedDelay', () => {
    it('should delay response by configured time', async () => {
      const delayMs = 50;
      gateway.setSimulatedDelay(delayMs);
      gateway.setMockSessions([createMockSession('session-1', 'Test')]);

      const startTime = Date.now();
      await gateway.listSessions();
      const elapsed = Date.now() - startTime;

      // Allow some tolerance for timing
      expect(elapsed).toBeGreaterThanOrEqual(delayMs - 10);
    });

    it('should not delay when set to 0', async () => {
      gateway.setSimulatedDelay(0);
      gateway.setMockSessions([createMockSession('session-1', 'Test')]);

      const startTime = Date.now();
      await gateway.listSessions();
      const elapsed = Date.now() - startTime;

      // Should complete almost immediately
      expect(elapsed).toBeLessThan(20);
    });
  });

  describe('setErrorToThrow', () => {
    it('should throw configured error', async () => {
      const error = new Error('Network error');
      gateway.setErrorToThrow(error);

      let thrownError: Error | undefined;
      try {
        await gateway.listSessions();
      } catch (e) {
        thrownError = e as Error;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError?.message).toBe('Network error');
    });

    it('should clear error after throwing', async () => {
      gateway.setMockSessions([createMockSession('session-1', 'Test')]);
      gateway.setErrorToThrow(new Error('Network error'));

      // First call throws
      let thrownError: Error | undefined;
      try {
        await gateway.listSessions();
      } catch (e) {
        thrownError = e as Error;
      }
      expect(thrownError).toBeDefined();

      // Second call succeeds
      const sessions = await gateway.listSessions();
      expect(sessions).toHaveLength(1);
    });

    it('should not throw when error is cleared', async () => {
      gateway.setMockSessions([createMockSession('session-1', 'Test')]);
      gateway.setErrorToThrow(new Error('Network error'));
      gateway.setErrorToThrow(null);

      const sessions = await gateway.listSessions();
      expect(sessions).toHaveLength(1);
    });
  });
});

/**
 * Helper function to create a mock Session object.
 * Uses type assertion since we're creating a partial mock for testing.
 */
function createMockSession(id: string, description: string): Session {
  return {
    $typeName: 'adksim.v1.SimulatorSession',
    id,
    description,
  } as unknown as Session;
}
