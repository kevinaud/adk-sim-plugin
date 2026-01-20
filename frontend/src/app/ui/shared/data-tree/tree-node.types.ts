/**
 * @fileoverview TreeNode types for hierarchical data visualization.
 *
 * Defines the data structures used by DataTreeComponent to render
 * nested objects and arrays as a flat list of nodes with indentation.
 * This "flat nodes" approach enables efficient template iteration
 * with depth-based indentation and expansion tracking.
 *
 * @see mddocs/frontend/frontend-spec.md#fr-context-inspection - FR-008 through FR-011
 * @see mddocs/frontend/frontend-tdd.md#datatreecomponent
 */

/**
 * Enum defining the primitive and container value types.
 * Used for syntax coloring in the tree display (FR-011).
 */
export enum ValueType {
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Null = 'null',
  Object = 'object',
  Array = 'array',
}

/**
 * Represents a single node in the flattened tree structure.
 *
 * Each node contains all information needed for rendering:
 * - Path for unique identification and expansion state tracking
 * - Depth for indentation calculation
 * - Key/value for display
 * - Type information for syntax coloring
 * - Expansion state for containers
 */
export interface TreeNode {
  /**
   * Unique path identifier for this node.
   * Uses dot notation for objects (e.g., "root.user.name")
   * and bracket notation for arrays (e.g., "root.items[0].id").
   */
  readonly path: string;

  /**
   * 0-based depth level for indentation calculation.
   * Root level is 0, each nested level increments by 1.
   */
  readonly depth: number;

  /**
   * Property name or array index as string.
   * For array items, this is the numeric index converted to string.
   */
  readonly key: string;

  /**
   * Formatted value for display (primitives only).
   * Null for container types (object/array) since they
   * don't have a display value themselves.
   */
  readonly displayValue: string | null;

  /**
   * Type classification for syntax coloring.
   * Determines the CSS class applied to the value.
   */
  readonly valueType: ValueType;

  /**
   * Whether this node can be expanded (objects and arrays).
   * Primitives are never expandable.
   */
  readonly expandable: boolean;

  /**
   * Current expansion state.
   * Default is true per FR-009 (minimize interaction).
   */
  readonly expanded: boolean;

  /**
   * Number of children for container types.
   * Used to display item count (e.g., "Object {3}" or "Array [5]").
   * Zero for primitives.
   */
  readonly childCount: number;
}
