/**
 * @fileoverview DataTreeComponent for hierarchical data visualization.
 *
 * Renders nested objects and arrays as a flat list of nodes with indentation.
 * Uses the flattenTree utility to convert hierarchical data into a flat array
 * suitable for template iteration with @for.
 *
 * Implements FR-008 through FR-011:
 * - FR-008: Complex data renders as hierarchical trees with collapsible nodes
 * - FR-009: All nodes expanded by default (minimize interaction)
 * - FR-010: Thread lines for visual hierarchy (styling added in S7PR4)
 * - FR-011: Syntax coloring for value types (styling added in S7PR4)
 *
 * @see mddocs/frontend/frontend-spec.md#fr-context-inspection - FR-008 through FR-011
 * @see mddocs/frontend/frontend-tdd.md#datatreecomponent
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { flattenTree } from './flatten-tree.util';
import type { TreeNode } from './tree-node.types';

/**
 * Indentation width per depth level in pixels.
 * Each nested level adds this amount of left padding.
 */
const INDENT_PX = 16;

/**
 * Calculates the indentation for a given depth level.
 * @param depth - The depth level of the node
 * @returns The indentation in pixels
 */
function calculateIndent(depth: number): number {
  return depth * INDENT_PX;
}

/**
 * DataTreeComponent renders hierarchical data as a flat list with indentation.
 *
 * Uses the "flat nodes" approach where nested data is flattened into an array
 * of TreeNode objects, each containing path, depth, and display information.
 * This enables efficient template iteration with trackBy on the unique path.
 *
 * Per FR-009, all nodes are expanded by default to minimize user interaction.
 * Expand/collapse toggle functionality will be added in S7PR3.
 *
 * @example
 * ```html
 * <!-- Basic usage with required data input -->
 * <app-data-tree [data]="myObject" />
 *
 * <!-- With all options -->
 * <app-data-tree
 *   [data]="myObject"
 *   [expanded]="true"
 *   [showThreadLines]="true"
 * />
 * ```
 */
@Component({
  selector: 'app-data-tree',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="data-tree" [class.thread-lines]="showThreadLines()" data-testid="data-tree">
      @for (node of flatNodes(); track node.path) {
        <div
          class="tree-node"
          [style.padding-left.px]="getIndent(node.depth)"
          [class.expandable]="node.expandable"
          [class.expanded]="node.expanded"
          [attr.data-path]="node.path"
          [attr.data-value-type]="node.valueType"
          data-testid="tree-node"
        >
          <span class="key">{{ node.key }}:</span>
          @if (!node.expandable && node.displayValue !== null) {
            <span class="value" [class]="node.valueType">{{ node.displayValue }}</span>
          }
          @if (node.expandable) {
            <span class="container-info">
              @if (node.valueType === 'object') {
                <span class="type-indicator">{{ '{' }}</span>
                <span class="child-count">{{ node.childCount }}</span>
                <span class="type-indicator">{{ '}' }}</span>
              }
              @if (node.valueType === 'array') {
                <span class="type-indicator">[</span>
                <span class="child-count">{{ node.childCount }}</span>
                <span class="type-indicator">]</span>
              }
            </span>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .data-tree {
      font-family: 'Roboto Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.5;
    }

    .tree-node {
      display: flex;
      align-items: baseline;
      gap: 4px;
      padding: 2px 0;
    }

    .key {
      color: var(--sys-on-surface);
      font-weight: 500;
    }

    .value {
      color: var(--sys-on-surface-variant);
    }

    .container-info {
      display: inline-flex;
      align-items: baseline;
      gap: 2px;
      color: var(--sys-on-surface-variant);
    }

    .type-indicator {
      opacity: 0.7;
    }

    .child-count {
      font-size: 11px;
      opacity: 0.6;
    }
  `,
})
export class DataTreeComponent {
  /**
   * The data to render as a tree.
   * Can be any JSON-serializable value: object, array, or primitive.
   */
  readonly data = input.required<unknown>();

  /**
   * Whether all nodes should be expanded by default.
   * Per FR-009, defaults to true to minimize user interaction.
   *
   * Note: Expand/collapse toggle functionality will be added in S7PR3.
   * For now, this controls the initial expansion state of all nodes.
   */
  readonly expanded = input<boolean>(true);

  /**
   * Whether to show visual thread lines connecting parent/child nodes.
   * Per FR-010, defaults to true for clear visual hierarchy.
   *
   * Note: Thread line styling will be added in S7PR4.
   * This input is defined now for API completeness.
   */
  readonly showThreadLines = input<boolean>(true);

  /**
   * Computed signal that flattens the input data into TreeNode array.
   *
   * Uses the flattenTree utility which:
   * - Recursively traverses the data structure
   * - Creates TreeNode for each value with path, depth, and display info
   * - Respects expansion state (all expanded when expandedPaths is null)
   *
   * The flattened array is suitable for @for iteration with trackBy on path.
   */
  readonly flatNodes = computed<TreeNode[]>(() => {
    const data = this.data();
    const isExpanded = this.expanded();

    // When expanded is true, pass undefined to flattenTree to expand all nodes
    // When expanded is false, pass an empty Set to collapse all nodes
    const expandedPaths = isExpanded ? undefined : new Set<string>();

    return flattenTree(data, expandedPaths);
  });

  /**
   * Calculate indentation in pixels for a given depth level.
   * Used in template for padding-left style binding.
   */
  protected getIndent(depth: number): number {
    return calculateIndent(depth);
  }
}
