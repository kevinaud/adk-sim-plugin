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

  /**
   * Whether this key represents an array index (e.g., "0", "1", "2").
   * Used to render indices as [0], [1], etc. instead of quoted strings.
   */
  readonly isArrayIndex: boolean;

  /**
   * Whether this node is a closing brace/bracket.
   * Used to render the closing } or ] on a separate line.
   */
  readonly isClosingBrace: boolean;

  /**
   * The closing brace character to display (} or ]).
   * Only set when isClosingBrace is true.
   */
  readonly closingBrace?: string;

  /**
   * Whether this node is the root node of the tree.
   * The root node represents the top-level object/array/primitive.
   */
  readonly isRoot?: boolean;

  /**
   * The raw string value (unquoted) for smart blob detection.
   * Only set for string value nodes. Undefined for non-string nodes.
   */
  readonly rawStringValue?: string | undefined;

  /**
   * Whether this node is the last sibling at its depth level.
   * Used to determine thread line termination (L-shape vs T-shape connector).
   */
  readonly isLastSibling?: boolean;

  /**
   * Thread state for ancestor depths.
   * For each ancestor depth (index), true means more siblings exist below that ancestor,
   * so a vertical thread line should continue. False means the vertical line should stop.
   * This enables drawing correct thread lines at all indent levels.
   */
  readonly ancestorThreadState?: readonly boolean[];
}

/**
 * Display mode for smart blob content within a tree node.
 */
export type SmartBlobNodeMode = 'raw' | 'markdown' | 'json';

/**
 * Detection result for a string value that may contain smart content.
 */
export interface SmartBlobDetection {
  /** Whether the string contains valid JSON */
  readonly isJson: boolean;
  /** Whether the string contains markdown-like content */
  readonly isMarkdown: boolean;
  /** Parsed JSON object if isJson is true */
  readonly parsedJson?: unknown;
}
