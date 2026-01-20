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
 */
function flattenValue(
  value: unknown,
  key: string,
  path: string,
  depth: number,
  nodes: TreeNode[],
  expandedPaths: Set<string> | null,
  maxDepth: number,
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

  const node: TreeNode = {
    path,
    depth,
    key,
    displayValue: formatDisplayValue(value, valueType),
    valueType,
    expandable,
    expanded,
    childCount: getChildCount(value, valueType),
  };

  nodes.push(node);

  // Only recurse into children if expanded and expandable
  if (!expanded) {
    return;
  }

  // Handle arrays
  if (valueType === ValueType.Array && Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const itemPath = createArrayPath(path, index);
      flattenValue(item, String(index), itemPath, depth + 1, nodes, expandedPaths, maxDepth);
    }
    return;
  }

  // Handle objects
  if (valueType === ValueType.Object && value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const propKey of Object.keys(obj)) {
      const propPath = createObjectPath(path, propKey);
      flattenValue(obj[propKey], propKey, propPath, depth + 1, nodes, expandedPaths, maxDepth);
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
 *
 * // Flatten with specific paths expanded
 * const expandedPaths = new Set(['root', 'root.user']);
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

  flattenValue(data, 'root', 'root', 0, nodes, expandedSet, maxDepth);

  return nodes;
}
