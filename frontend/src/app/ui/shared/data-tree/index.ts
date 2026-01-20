/**
 * Data tree component barrel export.
 *
 * Provides hierarchical visualization for nested objects and arrays.
 * Uses a flat nodes approach for efficient template rendering.
 *
 * @module ui/event-stream/data-tree
 * @see mddocs/frontend/frontend-tdd.md#datatreecomponent
 */

export { DataTreeComponent } from './data-tree.component';
export { flattenTree } from './flatten-tree.util';
export type { TreeNode } from './tree-node.types';
export { ValueType } from './tree-node.types';
