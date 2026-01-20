/**
 * Event stream UI module barrel export.
 *
 * Contains components for rendering conversation history
 * as a structured stream of event blocks.
 *
 * @module ui/event-stream
 * @see mddocs/frontend/frontend-tdd.md#event-stream-components
 */

// Re-export DataTree from shared for backwards compatibility
export type { TreeNode } from '../shared/data-tree';
export { DataTreeComponent, flattenTree, ValueType } from '../shared/data-tree';
export type { BlockType } from './event-block';
export { EventBlockComponent } from './event-block';
export { EventStreamComponent } from './event-stream.component';
