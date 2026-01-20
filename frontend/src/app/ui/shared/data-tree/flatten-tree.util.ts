/**
 * @fileoverview Pure utility function for flattening nested data structures.
 *
 * Converts a nested object or array into a flat array of TreeNode objects
 * suitable for template iteration. Each node contains path, depth, and
 * display information for rendering hierarchical data with indentation.
 *
 * This "flat nodes" approach (vs nested recursion in template) provides:
 * - Simpler template logic with @for iteration
 * - Efficient change detection with trackBy on path
 * - Easy expansion state management via path Set
 *
 * @see mddocs/frontend/frontend-spec.md#fr-context-inspection - FR-008 through FR-011
 * @see mddocs/frontend/frontend-tdd.md#datatreecomponent
 */

import type { TreeNode } from './tree-node.types';
import { ValueType } from './tree-node.types';

/**
 * Default maximum depth to prevent infinite recursion from circular references.
 * 100 levels should be more than sufficient for any reasonable data structure.
 */
const DEFAULT_MAX_DEPTH = 100;

/**
 * Determines the ValueType for a given JavaScript value.
 *
 * @param value - The value to classify
 * @returns The appropriate ValueType enum value
 */
function getValueType(value: unknown): ValueType {
  if (value === null) {
    return ValueType.Null;
  }

  if (Array.isArray(value)) {
    return ValueType.Array;
  }

  switch (typeof value) {
    case 'string': {
      return ValueType.String;
    }
    case 'number': {
      return ValueType.Number;
    }
    case 'boolean': {
      return ValueType.Boolean;
    }
    case 'object': {
      return ValueType.Object;
    }
    default: {
      // Treat undefined, function, symbol, bigint as null for display
      return ValueType.Null;
    }
  }
}

/**
 * Formats a primitive value for display.
 *
 * @param value - The value to format
 * @param valueType - The classified value type
 * @returns Formatted string representation
 */
function formatDisplayValue(value: unknown, valueType: ValueType): string | null {
  switch (valueType) {
    case ValueType.Object:
    case ValueType.Array: {
      // Containers don't have display values
      return null;
    }
    case ValueType.String: {
      // Show strings with quotes for clarity
      return `"${String(value)}"`;
    }
    case ValueType.Null: {
      return 'null';
    }
    default: {
      // Boolean, Number, and any unexpected types
      return String(value);
    }
  }
}

/**
 * Counts the number of children for a container value.
 *
 * @param value - The value to count children for
 * @param valueType - The classified value type
 * @returns Number of children (0 for primitives)
 */
function getChildCount(value: unknown, valueType: ValueType): number {
  if (valueType === ValueType.Array && Array.isArray(value)) {
    return value.length;
  }
  if (valueType === ValueType.Object && value !== null && typeof value === 'object') {
    return Object.keys(value).length;
  }
  return 0;
}

/**
 * Creates a path string for an object property.
 *
 * @param parentPath - The parent node's path
 * @param key - The property key
 * @returns The full path (e.g., "root.user.name")
 */
function createObjectPath(parentPath: string, key: string): string {
  return parentPath ? `${parentPath}.${key}` : key;
}

/**
 * Creates a path string for an array element.
 *
 * @param parentPath - The parent node's path
 * @param index - The array index
 * @returns The full path (e.g., "root.items[0]")
 */
function createArrayPath(parentPath: string, index: number): string {
  return `${parentPath}[${String(index)}]`;
}

/**
 * Internal recursive function to flatten a value into TreeNode array.
 *
 * @param value - The value to flatten
 * @param key - The key/name for this value
 * @param path - The full path to this value
 * @param depth - Current depth level
 * @param nodes - Accumulator array for nodes
 * @param expandedPaths - Set of paths that should be expanded
 * @param maxDepth - Maximum depth limit for recursion
 * @param isArrayIndex - Whether this key is an array index
 * @param ancestorThreadState - Thread state for ancestor depths (true = more siblings exist)
 * @param isLastSibling - Whether this node is the last sibling at its depth
 */
function flattenValue(
  value: unknown,
  key: string,
  path: string,
  depth: number,
  nodes: TreeNode[],
  expandedPaths: Set<string> | null,
  maxDepth: number,
  isArrayIndex: boolean,
  ancestorThreadState: readonly boolean[],
  isLastSibling: boolean,
): void {
  // Safety check for max depth
  if (depth > maxDepth) {
    nodes.push({
      path,
      depth,
      key,
      displayValue: '[max depth exceeded]',
      valueType: ValueType.String,
      expandable: false,
      expanded: false,
      childCount: 0,
      isArrayIndex,
      isClosingBrace: false,
      isLastSibling,
      ancestorThreadState,
    });
    return;
  }

  const valueType = getValueType(value);
  const expandable = valueType === ValueType.Object || valueType === ValueType.Array;

  // Determine expansion state:
  // - Primitives are never expandable, so expanded is always false
  // - If expandedPaths is null, all expandable nodes are expanded (FR-009 default)
  // - If expandedPaths is provided, only paths in the set are expanded
  const expanded = expandable && (expandedPaths === null || expandedPaths.has(path));

  const childCount = getChildCount(value, valueType);

  const node: TreeNode = {
    path,
    depth,
    key,
    displayValue: formatDisplayValue(value, valueType),
    valueType,
    expandable,
    expanded,
    childCount,
    isArrayIndex,
    isClosingBrace: false,
    isLastSibling,
    ancestorThreadState,
    // Store raw string value for smart blob detection
    rawStringValue: valueType === ValueType.String ? String(value) : undefined,
  };

  nodes.push(node);

  // Only recurse into children if expanded and expandable
  if (!expanded) {
    return;
  }

  // Build thread state for children:
  // At this depth, if we're NOT the last sibling, children should continue the vertical line
  const childAncestorThreadState = [...ancestorThreadState, !isLastSibling];

  // Handle arrays
  if (valueType === ValueType.Array && Array.isArray(value)) {
    const arrayLength = value.length;
    for (const [index, item] of value.entries()) {
      const itemPath = createArrayPath(path, index);
      const isLast = index === arrayLength - 1;
      flattenValue(
        item,
        String(index),
        itemPath,
        depth + 1,
        nodes,
        expandedPaths,
        maxDepth,
        true,
        childAncestorThreadState,
        isLast,
      );
    }

    // Add closing bracket for non-empty expanded arrays
    if (arrayLength > 0) {
      nodes.push({
        path: `${path}:closing`,
        depth,
        key: '',
        displayValue: null,
        valueType,
        expandable: false,
        expanded: false,
        childCount: 0,
        isArrayIndex: false,
        isClosingBrace: true,
        closingBrace: ']',
        isLastSibling,
        ancestorThreadState,
      });
    }
    return;
  }

  // Handle objects
  if (valueType === ValueType.Object && value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    const keysLength = keys.length;
    for (const [index, propKey] of keys.entries()) {
      const propPath = createObjectPath(path, propKey);
      const isLast = index === keysLength - 1;
      flattenValue(
        obj[propKey],
        propKey,
        propPath,
        depth + 1,
        nodes,
        expandedPaths,
        maxDepth,
        false,
        childAncestorThreadState,
        isLast,
      );
    }

    // Add closing brace for non-empty expanded objects
    if (keysLength > 0) {
      nodes.push({
        path: `${path}:closing`,
        depth,
        key: '',
        displayValue: null,
        valueType,
        expandable: false,
        expanded: false,
        childCount: 0,
        isArrayIndex: false,
        isClosingBrace: true,
        closingBrace: '}',
        isLastSibling,
        ancestorThreadState,
      });
    }
  }
}

/**
 * Flattens a nested data structure into an array of TreeNode objects.
 *
 * This pure function converts hierarchical data (objects/arrays) into a flat
 * array suitable for template iteration with @for. Each node includes path,
 * depth, key, and display information needed for rendering.
 *
 * The tree renders the data's structure directly WITHOUT adding an artificial
 * "root" wrapper. For objects, the tree starts with "{"; for arrays, with "[".
 *
 * Per FR-009, all nodes are expanded by default to minimize interaction.
 * Pass an expandedPaths Set to control which nodes are expanded.
 *
 * @param data - The data to flatten (object, array, or primitive)
 * @param expandedPaths - Optional set of paths to expand. If not provided,
 *   all expandable nodes are expanded by default (FR-009).
 * @param maxDepth - Maximum recursion depth (default 100)
 * @returns Array of TreeNode objects for rendering
 *
 * @example
 * ```typescript
 * // Flatten with all nodes expanded (default)
 * const nodes = flattenTree({ user: { name: 'Bob' } });
 * // => First node has key='', valueType='object' (represents the root object itself)
 *
 * // Flatten with specific paths expanded
 * const expandedPaths = new Set(['$', '$.user']);
 * const nodes = flattenTree({ user: { name: 'Bob' } }, expandedPaths);
 * ```
 */
export function flattenTree(
  data: unknown,
  expandedPaths?: Set<string>,
  maxDepth: number = DEFAULT_MAX_DEPTH,
): TreeNode[] {
  const nodes: TreeNode[] = [];

  // Handle undefined at root level
  if (data === undefined) {
    return [];
  }

  // Use null to indicate "all expanded" (FR-009 default)
  const expandedSet = expandedPaths ?? null;

  const valueType = getValueType(data);
  const expandable = valueType === ValueType.Object || valueType === ValueType.Array;

  // For primitive data at root, just return a single node
  if (!expandable) {
    nodes.push({
      path: '$',
      depth: 0,
      key: '',
      displayValue: formatDisplayValue(data, valueType),
      valueType,
      expandable: false,
      expanded: false,
      childCount: 0,
      isArrayIndex: false,
      isClosingBrace: false,
      isRoot: true,
      isLastSibling: true,
      ancestorThreadState: [],
    });
    return nodes;
  }

  // For object/array at root, create a root node without a key
  // This represents the opening brace/bracket
  const expanded = expandedSet === null || expandedSet.has('$');
  const childCount = getChildCount(data, valueType);

  nodes.push({
    path: '$',
    depth: 0,
    key: '',
    displayValue: null,
    valueType,
    expandable: true,
    expanded,
    childCount,
    isArrayIndex: false,
    isClosingBrace: false,
    isRoot: true,
    isLastSibling: true,
    ancestorThreadState: [],
  });

  // Only recurse into children if expanded
  if (expanded) {
    // Root thread state: empty array since root has no ancestors
    // For children, we track that root is the last sibling (so no continuing vertical line from root)
    const childAncestorThreadState: readonly boolean[] = [false]; // Root is last sibling, no more siblings

    if (valueType === ValueType.Array && Array.isArray(data)) {
      const arrayLength = data.length;
      for (const [index, item] of data.entries()) {
        const itemPath = `$[${String(index)}]`;
        const isLast = index === arrayLength - 1;
        flattenValue(
          item,
          String(index),
          itemPath,
          1,
          nodes,
          expandedSet,
          maxDepth,
          true,
          childAncestorThreadState,
          isLast,
        );
      }

      // Add closing bracket for non-empty expanded root array
      if (arrayLength > 0) {
        nodes.push({
          path: '$:closing',
          depth: 0,
          key: '',
          displayValue: null,
          valueType,
          expandable: false,
          expanded: false,
          childCount: 0,
          isArrayIndex: false,
          isClosingBrace: true,
          closingBrace: ']',
          isLastSibling: true,
          ancestorThreadState: [],
        });
      }
    } else if (valueType === ValueType.Object && data !== null && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      const keys = Object.keys(obj);
      const keysLength = keys.length;
      for (const [index, propKey] of keys.entries()) {
        const propPath = `$.${propKey}`;
        const isLast = index === keysLength - 1;
        flattenValue(
          obj[propKey],
          propKey,
          propPath,
          1,
          nodes,
          expandedSet,
          maxDepth,
          false,
          childAncestorThreadState,
          isLast,
        );
      }

      // Add closing brace for non-empty expanded root object
      if (keysLength > 0) {
        nodes.push({
          path: '$:closing',
          depth: 0,
          key: '',
          displayValue: null,
          valueType,
          expandable: false,
          expanded: false,
          childCount: 0,
          isArrayIndex: false,
          isClosingBrace: true,
          closingBrace: '}',
          isLastSibling: true,
          ancestorThreadState: [],
        });
      }
    }
  }

  return nodes;
}
