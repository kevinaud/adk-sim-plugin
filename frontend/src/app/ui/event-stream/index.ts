/**
 * Event stream UI module barrel export.
 *
 * Contains components for rendering conversation history
 * as a structured stream of event blocks.
 *
 * @module ui/event-stream
 * @see mddocs/frontend/frontend-tdd.md#event-stream-components
 */

export type { TreeNode } from './data-tree';
export { DataTreeComponent, flattenTree, ValueType } from './data-tree';
export type { BlockType } from './event-block';
export { EventBlockComponent } from './event-block';
export { EventStreamComponent } from './event-stream.component';
