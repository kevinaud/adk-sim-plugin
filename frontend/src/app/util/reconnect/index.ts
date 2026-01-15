/**
 * Reconnection strategy utilities for session streaming.
 *
 * Provides exponential backoff logic for handling connection
 * failures and automatic reconnection attempts.
 *
 * @module util/reconnect
 * @see mddocs/frontend/frontend-tdd.md#auto-reconnect-logic
 */

export type { ReconnectConfig } from './reconnect-strategy';
export { DEFAULT_RECONNECT_CONFIG, ReconnectStrategy } from './reconnect-strategy';
