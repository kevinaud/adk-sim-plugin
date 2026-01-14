/**
 * Exponential backoff reconnection strategy for session streaming.
 *
 * Provides configurable retry logic with exponential delay increases
 * capped at a maximum delay value.
 *
 * @example
 * ```typescript
 * const strategy = new ReconnectStrategy();
 *
 * async function handleDisconnect(sessionId: string): Promise<void> {
 *   if (strategy.canRetry()) {
 *     const delay = strategy.getNextDelay();
 *     await sleep(delay);
 *     await reconnect(sessionId);
 *   } else {
 *     showError('Connection lost after multiple retries');
 *   }
 * }
 *
 * // On successful connection:
 * strategy.reset();
 * ```
 *
 * @see mddocs/frontend/frontend-tdd.md#auto-reconnect-logic
 */

/**
 * Configuration for reconnection behavior.
 */
export interface ReconnectConfig {
  /** Maximum number of reconnection attempts before giving up */
  maxAttempts: number;
  /** Initial delay in milliseconds before first retry */
  baseDelayMs: number;
  /** Maximum delay in milliseconds (caps exponential growth) */
  maxDelayMs: number;
}

/**
 * Default reconnection configuration.
 *
 * - 5 attempts total
 * - 1 second initial delay
 * - 30 second maximum delay
 *
 * Delay sequence: 1s, 2s, 4s, 8s, 16s (capped at 30s for higher attempts)
 */
export const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
};

/**
 * Manages exponential backoff for reconnection attempts.
 *
 * Tracks the number of retry attempts and calculates appropriate
 * delay durations using exponential backoff with a configurable cap.
 */
export class ReconnectStrategy {
  private attempts = 0;

  constructor(private readonly config: ReconnectConfig = DEFAULT_RECONNECT_CONFIG) {}

  /**
   * Resets the attempt counter to zero.
   *
   * Call this after a successful connection to restart the backoff sequence.
   */
  reset(): void {
    this.attempts = 0;
  }

  /**
   * Checks if another retry attempt is allowed.
   *
   * @returns `true` if attempts are below the maximum, `false` otherwise
   */
  canRetry(): boolean {
    return this.attempts < this.config.maxAttempts;
  }

  /**
   * Calculates and returns the next delay duration.
   *
   * Uses exponential backoff: `baseDelayMs * 2^attempts`, capped at `maxDelayMs`.
   * Increments the attempt counter after calculating the delay.
   *
   * @returns Delay in milliseconds before the next retry should be attempted
   */
  getNextDelay(): number {
    const delay = Math.min(
      this.config.baseDelayMs * Math.pow(2, this.attempts),
      this.config.maxDelayMs,
    );
    this.attempts++;
    return delay;
  }

  /**
   * Returns the current attempt count (0-indexed).
   *
   * This reflects the number of `getNextDelay()` calls since the last `reset()`.
   */
  get currentAttempt(): number {
    return this.attempts;
  }
}
