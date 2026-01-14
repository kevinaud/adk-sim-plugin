/**
 * Data Access module - services, state, and API communication
 *
 * This layer contains services that manage state and communicate with backends.
 * Components in this layer include facades, stores, and gateways.
 *
 * Import directly from submodules due to Sheriff module boundaries:
 * - Session: `./data-access/session`
 * - LLM Request: `./data-access/llm-request`
 *
 * @module data-access
 * @see mddocs/frontend/frontend-tdd.md#folder-layout
 */

/**
 * Domains available in the data-access layer.
 * Each domain has its own index.ts barrel file for exports.
 */
export type DataAccessDomain = 'session' | 'llm-request';
