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

import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

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
 * Individual nodes can be collapsed/expanded via toggle buttons.
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
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hasExpandableNodes()) {
      <div class="tree-header" data-testid="tree-header">
        <button
          type="button"
          class="action-btn"
          (click)="expandAll()"
          data-testid="expand-all"
          title="Expand all nodes"
        >
          <mat-icon>unfold_more</mat-icon>
        </button>
        <button
          type="button"
          class="action-btn"
          (click)="collapseAll()"
          data-testid="collapse-all"
          title="Collapse all nodes"
        >
          <mat-icon>unfold_less</mat-icon>
        </button>
      </div>
    }
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
          @if (node.expandable) {
            <button
              class="toggle"
              (click)="toggleNode(node.path)"
              data-testid="expand-toggle"
              type="button"
            >
              <mat-icon>{{ node.expanded ? 'expand_more' : 'chevron_right' }}</mat-icon>
            </button>
          }
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
    /* =========================================================================
       Tree Header with Expand All / Collapse All buttons
       ========================================================================= */

    .tree-header {
      display: flex;
      gap: 4px;
      margin-bottom: 8px;
    }

    .action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      padding: 4px;
      cursor: pointer;
      border-radius: 4px;
      color: var(--sys-on-surface-variant);
      opacity: 0.7;

      &:hover {
        background: var(--sys-surface-container-high);
        opacity: 1;
      }

      &:focus-visible {
        outline: 2px solid var(--sys-primary);
        outline-offset: 1px;
        opacity: 1;
      }

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

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
      position: relative;
    }

    /* =========================================================================
       Thread Lines (FR-010)
       Visual connectors between parent and child nodes using CSS borders.
       Uses a vertical line at each depth level to show hierarchy.
       ========================================================================= */

    .thread-lines .tree-node::before {
      content: '';
      position: absolute;
      left: 8px; /* Centered in first indent level */
      top: 0;
      bottom: 0;
      width: 0;
      border-left: 1px solid var(--sys-outline-variant);
      pointer-events: none;
    }

    /* Root node (depth 0) has no thread line */
    .thread-lines .tree-node[style*='padding-left: 0px']::before {
      display: none;
    }

    /* Position thread lines at each depth level */
    .thread-lines .tree-node[style*='padding-left: 16px']::before {
      left: 8px;
    }
    .thread-lines .tree-node[style*='padding-left: 32px']::before {
      left: 24px;
    }
    .thread-lines .tree-node[style*='padding-left: 48px']::before {
      left: 40px;
    }
    .thread-lines .tree-node[style*='padding-left: 64px']::before {
      left: 56px;
    }
    .thread-lines .tree-node[style*='padding-left: 80px']::before {
      left: 72px;
    }
    .thread-lines .tree-node[style*='padding-left: 96px']::before {
      left: 88px;
    }
    .thread-lines .tree-node[style*='padding-left: 112px']::before {
      left: 104px;
    }
    .thread-lines .tree-node[style*='padding-left: 128px']::before {
      left: 120px;
    }

    /* Horizontal connector from vertical line to node content */
    .thread-lines .tree-node::after {
      content: '';
      position: absolute;
      top: 50%;
      width: 6px;
      height: 0;
      border-top: 1px solid var(--sys-outline-variant);
      pointer-events: none;
    }

    /* Root node has no horizontal connector */
    .thread-lines .tree-node[style*='padding-left: 0px']::after {
      display: none;
    }

    /* Position horizontal connectors */
    .thread-lines .tree-node[style*='padding-left: 16px']::after {
      left: 8px;
    }
    .thread-lines .tree-node[style*='padding-left: 32px']::after {
      left: 24px;
    }
    .thread-lines .tree-node[style*='padding-left: 48px']::after {
      left: 40px;
    }
    .thread-lines .tree-node[style*='padding-left: 64px']::after {
      left: 56px;
    }
    .thread-lines .tree-node[style*='padding-left: 80px']::after {
      left: 72px;
    }
    .thread-lines .tree-node[style*='padding-left: 96px']::after {
      left: 88px;
    }
    .thread-lines .tree-node[style*='padding-left: 112px']::after {
      left: 104px;
    }
    .thread-lines .tree-node[style*='padding-left: 128px']::after {
      left: 120px;
    }

    /* =========================================================================
       Key Styling (FR-011)
       Keys are styled distinctly with a different color
       ========================================================================= */

    .key {
      color: var(--sys-primary);
      font-weight: 500;
    }

    /* =========================================================================
       Value Type Syntax Coloring (FR-011)
       Different colors for each value type using Material Design tokens.
       Colors are semantic and work in both light and dark themes.
       ========================================================================= */

    .value {
      color: var(--sys-on-surface-variant);
    }

    /* String values - green tint using tertiary color */
    .value.string {
      color: var(--sys-tertiary);
    }

    /* Number values - blue using primary color */
    .value.number {
      color: var(--sys-primary);
    }

    /* Boolean values - purple/magenta using secondary color */
    .value.boolean {
      color: var(--sys-secondary);
    }

    /* Null values - muted gray with italic */
    .value.null {
      color: var(--sys-on-surface-variant);
      font-style: italic;
      opacity: 0.7;
    }

    /* =========================================================================
       Container Info (objects and arrays)
       ========================================================================= */

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

    /* =========================================================================
       Toggle Button
       ========================================================================= */

    .toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      padding: 0;
      margin: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      color: var(--sys-on-surface-variant);
      border-radius: 2px;

      &:hover {
        background: var(--sys-surface-variant);
      }

      &:focus-visible {
        outline: 2px solid var(--sys-primary);
        outline-offset: 1px;
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
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
   * When true, starts with all nodes expanded. Individual nodes can then
   * be collapsed via toggle buttons. When false, starts with all collapsed.
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
   * Internal signal tracking which paths are currently expanded.
   *
   * Uses null to represent "all expanded" state (FR-009 default), which
   * avoids needing to pre-compute all expandable paths. When a toggle
   * occurs, this converts to an explicit Set tracking individual states.
   *
   * When expanded input is false, initializes to empty Set (all collapsed).
   */
  private readonly _expandedPaths = signal<Set<string> | null>(null);

  /**
   * Publicly readable expansion state.
   */
  readonly expandedPaths = this._expandedPaths.asReadonly();

  constructor() {
    // Initialize expandedPaths based on the expanded input.
    // Using effect to react to input changes.
    effect(() => {
      const isExpanded = this.expanded();
      // When expanded is true, use null to mean "all expanded"
      // When expanded is false, use empty Set to mean "all collapsed"
      this._expandedPaths.set(isExpanded ? null : new Set<string>());
    });
  }

  /**
   * Computed signal that flattens the input data into TreeNode array.
   *
   * Uses the flattenTree utility which:
   * - Recursively traverses the data structure
   * - Creates TreeNode for each value with path, depth, and display info
   * - Respects expansion state (all expanded when expandedPaths is undefined)
   *
   * The flattened array is suitable for @for iteration with trackBy on path.
   */
  readonly flatNodes = computed<TreeNode[]>(() => {
    const data = this.data();
    const pathsSet = this._expandedPaths();

    // flattenTree interprets undefined as "expand all", and a Set as explicit tracking
    // Convert null to undefined for the utility
    const expandedPaths = pathsSet ?? undefined;

    return flattenTree(data, expandedPaths);
  });

  /**
   * Computed signal indicating whether the tree has any expandable nodes.
   * Used to conditionally show the expand all / collapse all buttons.
   */
  readonly hasExpandableNodes = computed(() => {
    return this.flatNodes().some((node) => node.expandable);
  });

  /**
   * Expands all nodes in the tree.
   * Sets _expandedPaths to null, which signals "all expanded" state.
   */
  expandAll(): void {
    this._expandedPaths.set(null);
  }

  /**
   * Collapses all nodes in the tree.
   * Sets _expandedPaths to empty Set, which means no nodes are expanded.
   */
  collapseAll(): void {
    this._expandedPaths.set(new Set());
  }

  /**
   * Toggles the expansion state of a node at the given path.
   *
   * On first toggle when starting in "all expanded" state (null), this
   * materializes the full set of expandable paths, then removes the toggled one.
   *
   * @param path - The path of the node to toggle
   */
  toggleNode(path: string): void {
    this._expandedPaths.update((paths) => {
      if (paths === null) {
        // First toggle from "all expanded" state - materialize all expandable paths
        // then remove the one being collapsed
        const allPaths = this.collectExpandablePaths();
        allPaths.delete(path);
        return allPaths;
      }

      // Explicit tracking mode - toggle the path
      const newPaths = new Set(paths);
      if (newPaths.has(path)) {
        newPaths.delete(path);
      } else {
        newPaths.add(path);
      }
      return newPaths;
    });
  }

  /**
   * Collects all expandable node paths from the current data.
   *
   * Used when transitioning from "all expanded" (null) state to explicit tracking.
   * Walks the entire data structure to find all object/array nodes.
   *
   * @returns Set of all expandable paths
   */
  private collectExpandablePaths(): Set<string> {
    const paths = new Set<string>();
    this.collectPaths(this.data(), 'root', paths);
    return paths;
  }

  /**
   * Recursively collects paths of expandable nodes.
   */
  private collectPaths(value: unknown, path: string, paths: Set<string>): void {
    if (value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      paths.add(path);
      for (const [index, item] of value.entries()) {
        this.collectPaths(item, `${path}[${String(index)}]`, paths);
      }
    } else if (typeof value === 'object') {
      paths.add(path);
      const obj = value as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        this.collectPaths(obj[key], `${path}.${key}`, paths);
      }
    }
    // Primitives are not expandable, skip
  }

  /**
   * Calculate indentation in pixels for a given depth level.
   * Used in template for padding-left style binding.
   */
  protected getIndent(depth: number): number {
    return calculateIndent(depth);
  }
}
