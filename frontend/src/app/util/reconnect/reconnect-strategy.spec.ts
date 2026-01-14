import { describe, it, expect, beforeEach } from 'vitest';
import { ReconnectStrategy, ReconnectConfig, DEFAULT_RECONNECT_CONFIG } from './reconnect-strategy';

describe('ReconnectStrategy', () => {
  describe('with default configuration', () => {
    let strategy: ReconnectStrategy;

    beforeEach(() => {
      strategy = new ReconnectStrategy();
    });

    it('should use default config values', () => {
      expect(DEFAULT_RECONNECT_CONFIG).toEqual({
        maxAttempts: 5,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
      });
    });

    it('should start with zero attempts', () => {
      expect(strategy.currentAttempt).toBe(0);
    });

    it('should allow retries when under max attempts', () => {
      expect(strategy.canRetry()).toBe(true);
    });

    describe('getNextDelay', () => {
      it('should return 1000ms for first attempt', () => {
        expect(strategy.getNextDelay()).toBe(1000);
      });

      it('should return 2000ms for second attempt', () => {
        strategy.getNextDelay(); // First attempt
        expect(strategy.getNextDelay()).toBe(2000);
      });

      it('should return 4000ms for third attempt', () => {
        strategy.getNextDelay(); // First
        strategy.getNextDelay(); // Second
        expect(strategy.getNextDelay()).toBe(4000);
      });

      it('should return 8000ms for fourth attempt', () => {
        strategy.getNextDelay(); // First
        strategy.getNextDelay(); // Second
        strategy.getNextDelay(); // Third
        expect(strategy.getNextDelay()).toBe(8000);
      });

      it('should return 16000ms for fifth attempt', () => {
        strategy.getNextDelay(); // First
        strategy.getNextDelay(); // Second
        strategy.getNextDelay(); // Third
        strategy.getNextDelay(); // Fourth
        expect(strategy.getNextDelay()).toBe(16000);
      });

      it('should produce correct exponential backoff sequence', () => {
        const delays: number[] = [];
        for (let i = 0; i < 5; i++) {
          delays.push(strategy.getNextDelay());
        }
        expect(delays).toEqual([1000, 2000, 4000, 8000, 16000]);
      });

      it('should increment attempt counter', () => {
        expect(strategy.currentAttempt).toBe(0);
        strategy.getNextDelay();
        expect(strategy.currentAttempt).toBe(1);
        strategy.getNextDelay();
        expect(strategy.currentAttempt).toBe(2);
      });
    });

    describe('canRetry', () => {
      it('should return true for attempts 0-4', () => {
        for (let i = 0; i < 5; i++) {
          expect(strategy.canRetry()).toBe(true);
          strategy.getNextDelay();
        }
      });

      it('should return false after 5 attempts', () => {
        for (let i = 0; i < 5; i++) {
          strategy.getNextDelay();
        }
        expect(strategy.canRetry()).toBe(false);
      });
    });

    describe('reset', () => {
      it('should reset attempt counter to zero', () => {
        strategy.getNextDelay();
        strategy.getNextDelay();
        expect(strategy.currentAttempt).toBe(2);

        strategy.reset();
        expect(strategy.currentAttempt).toBe(0);
      });

      it('should allow retries again after reset', () => {
        for (let i = 0; i < 5; i++) {
          strategy.getNextDelay();
        }
        expect(strategy.canRetry()).toBe(false);

        strategy.reset();
        expect(strategy.canRetry()).toBe(true);
      });

      it('should restart delay sequence after reset', () => {
        strategy.getNextDelay(); // 1000
        strategy.getNextDelay(); // 2000
        strategy.reset();
        expect(strategy.getNextDelay()).toBe(1000);
      });
    });
  });

  describe('with custom configuration', () => {
    it('should use custom maxAttempts', () => {
      const config: ReconnectConfig = {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
      };
      const strategy = new ReconnectStrategy(config);

      expect(strategy.canRetry()).toBe(true);
      strategy.getNextDelay();
      strategy.getNextDelay();
      strategy.getNextDelay();
      expect(strategy.canRetry()).toBe(false);
    });

    it('should use custom baseDelayMs', () => {
      const config: ReconnectConfig = {
        maxAttempts: 5,
        baseDelayMs: 500,
        maxDelayMs: 30000,
      };
      const strategy = new ReconnectStrategy(config);

      expect(strategy.getNextDelay()).toBe(500);
      expect(strategy.getNextDelay()).toBe(1000);
      expect(strategy.getNextDelay()).toBe(2000);
    });

    it('should cap delays at maxDelayMs', () => {
      const config: ReconnectConfig = {
        maxAttempts: 10,
        baseDelayMs: 1000,
        maxDelayMs: 5000,
      };
      const strategy = new ReconnectStrategy(config);

      // 1000, 2000, 4000, 5000 (capped), 5000 (capped), ...
      expect(strategy.getNextDelay()).toBe(1000);
      expect(strategy.getNextDelay()).toBe(2000);
      expect(strategy.getNextDelay()).toBe(4000);
      expect(strategy.getNextDelay()).toBe(5000); // Would be 8000, capped
      expect(strategy.getNextDelay()).toBe(5000); // Would be 16000, capped
    });

    it('should handle maxDelayMs smaller than baseDelayMs', () => {
      const config: ReconnectConfig = {
        maxAttempts: 5,
        baseDelayMs: 1000,
        maxDelayMs: 500,
      };
      const strategy = new ReconnectStrategy(config);

      // All delays should be capped at 500
      expect(strategy.getNextDelay()).toBe(500);
      expect(strategy.getNextDelay()).toBe(500);
      expect(strategy.getNextDelay()).toBe(500);
    });
  });

  describe('edge cases', () => {
    it('should handle zero maxAttempts', () => {
      const config: ReconnectConfig = {
        maxAttempts: 0,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
      };
      const strategy = new ReconnectStrategy(config);

      expect(strategy.canRetry()).toBe(false);
    });

    it('should handle one maxAttempts', () => {
      const config: ReconnectConfig = {
        maxAttempts: 1,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
      };
      const strategy = new ReconnectStrategy(config);

      expect(strategy.canRetry()).toBe(true);
      strategy.getNextDelay();
      expect(strategy.canRetry()).toBe(false);
    });

    it('should handle very large attempt counts without overflow', () => {
      const config: ReconnectConfig = {
        maxAttempts: 100,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
      };
      const strategy = new ReconnectStrategy(config);

      // Exhaust many attempts
      for (let i = 0; i < 50; i++) {
        const delay = strategy.getNextDelay();
        expect(delay).toBeLessThanOrEqual(30000);
        expect(delay).toBeGreaterThan(0);
      }
    });
  });

  describe('typical usage scenario', () => {
    it('should support reconnection loop pattern', () => {
      const strategy = new ReconnectStrategy();
      const collectedDelays: number[] = [];

      // Simulate failed connection attempts
      while (strategy.canRetry()) {
        collectedDelays.push(strategy.getNextDelay());
      }

      expect(collectedDelays).toEqual([1000, 2000, 4000, 8000, 16000]);
      expect(strategy.canRetry()).toBe(false);

      // Simulate successful reconnection on next try (from different code path)
      strategy.reset();
      expect(strategy.canRetry()).toBe(true);
      expect(strategy.getNextDelay()).toBe(1000);
    });
  });
});
