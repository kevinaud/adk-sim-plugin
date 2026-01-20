/**
 * Utilities module - pure functions and helpers
 *
 * Utility modules are leaf dependencies with no external imports.
 * They contain pure functions, constants, and helper utilities.
 *
 * Import directly from submodules due to Sheriff module boundaries:
 * - Reconnect: `./util/reconnect`
 * - Theme: `./util/theme`
 * - JSON Detection: `./util/json-detection` (planned)
 * - MD Detection: `./util/md-detection` (planned)
 *
 * @module util
 * @see mddocs/frontend/frontend-tdd.md#folder-layout
 */

/**
 * Libraries available in the util layer.
 * Each library has its own index.ts barrel file for exports.
 */
export type UtilLibrary = 'content-detection' | 'reconnect' | 'theme';
