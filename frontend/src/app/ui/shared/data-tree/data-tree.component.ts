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
 * Also implements smart blob detection for string values:
 * - Detects JSON strings and renders nested DataTree when toggled
 * - Detects markdown strings and renders formatted HTML when toggled
 *
 * @see mddocs/frontend/frontend-spec.md#fr-context-inspection - FR-008 through FR-011
 * @see mddocs/frontend/frontend-tdd.md#datatreecomponent
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { ContentDetectionService } from '../../../util/content-detection';
import { MarkdownPipe } from '../markdown-pipe';
import { flattenTree } from './flatten-tree.util';
import { JsonSyntaxPipe } from './json-syntax.pipe';
import type { SmartBlobDetection, SmartBlobNodeMode, TreeNode } from './tree-node.types';

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
 * String values are analyzed for smart blob content (JSON or markdown) and
 * display inline toggle buttons when detected.
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
  imports: [MatIconModule, MarkdownPipe, JsonSyntaxPipe],
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
        <!-- Main node line -->
        <div
          class="tree-node"
          [style.padding-left.px]="getIndent(node.depth)"
          [class.expandable]="node.expandable"
          [class.expanded]="node.expanded"
          [class.closing-brace]="node.isClosingBrace"
          [attr.data-path]="node.path"
          [attr.data-value-type]="node.valueType"
          [attr.data-last-sibling]="node.isLastSibling"
          data-testid="tree-node"
        >
          <!-- Chevron column - fixed width, always present -->
          <span class="chevron-column">
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
          </span>
          <!-- Content column -->
          <span class="content-column">
            @if (node.isClosingBrace) {
              <!-- Closing brace node -->
              <span class="bracket">{{ node.closingBrace }}</span>
            } @else {
              <!-- Key display: root nodes have no key, array indices are bracketed, object keys are quoted -->
              @if (!node.isRoot) {
                @if (node.isArrayIndex) {
                  <span class="key">[{{ node.key }}]</span><span class="colon">:</span>
                } @else {
                  <span class="key">"{{ node.key }}"</span><span class="colon">:</span>
                }
              }
              @if (!node.expandable && node.displayValue !== null) {
                <!-- Smart blob detection for string values -->
                @if (node.valueType === 'string' && node.rawStringValue) {
                  @let detection = getSmartBlobDetection(node);
                  @let mode = getSmartBlobMode(node.path, detection);
                  @if (detection.isJson || detection.isMarkdown) {
                    <!-- Only show raw value when in raw mode -->
                    @if (mode === 'raw') {
                      <span class="value" [class]="node.valueType">{{ node.displayValue }}</span>
                    }
                    <span class="smart-blob-toggles" data-testid="smart-blob-toggles">
                      <button
                        type="button"
                        class="mode-toggle"
                        [class.active]="mode === 'raw'"
                        (click)="setSmartBlobMode(node.path, 'raw')"
                        data-testid="raw-toggle"
                      >
                        RAW
                      </button>
                      @if (detection.isMarkdown) {
                        <button
                          type="button"
                          class="mode-toggle"
                          [class.active]="mode === 'markdown'"
                          (click)="setSmartBlobMode(node.path, 'markdown')"
                          data-testid="md-toggle"
                        >
                          MD
                        </button>
                      }
                      @if (detection.isJson) {
                        <button
                          type="button"
                          class="mode-toggle"
                          [class.active]="mode === 'json'"
                          (click)="setSmartBlobMode(node.path, 'json')"
                          data-testid="json-toggle"
                        >
                          JSON
                        </button>
                      }
                    </span>
                  } @else {
                    <!-- Non-smart-blob string: show value normally -->
                    <span class="value" [class]="node.valueType">{{ node.displayValue }}</span>
                  }
                } @else {
                  <!-- Non-string primitives: show value normally -->
                  <span class="value" [class]="node.valueType">{{ node.displayValue }}</span>
                }
              }
              @if (node.expandable && node.expanded) {
                <span class="bracket">{{ node.valueType === 'array' ? '[' : '{' }}</span>
              }
              @if (node.expandable && !node.expanded) {
                <span class="bracket">{{ node.valueType === 'array' ? '[...]' : '{...}' }}</span>
              }
            }
          </span>
        </div>
        <!-- Smart blob rendered content (below the node line) -->
        @if (node.valueType === 'string' && node.rawStringValue) {
          @let detection = getSmartBlobDetection(node);
          @let mode = getSmartBlobMode(node.path, detection);
          @if (
            (detection.isMarkdown && mode === 'markdown') || (detection.isJson && mode === 'json')
          ) {
            <div
              class="smart-blob-content"
              [style.padding-left.px]="getIndent(node.depth + 1)"
              data-testid="smart-blob-content"
            >
              @if (mode === 'markdown') {
                <div
                  class="markdown-rendered"
                  [innerHTML]="node.rawStringValue | markdown"
                  data-testid="markdown-content"
                ></div>
              }
              @if (mode === 'json' && detection.parsedJson !== undefined) {
                <pre
                  class="json-rendered"
                  data-testid="nested-json-tree"
                  [innerHTML]="detection.parsedJson | jsonSyntax"
                ></pre>
              }
            </div>
          }
        }
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
      align-items: flex-start;
      padding: 2px 0;
      position: relative;
    }

    /* Chevron column - fixed width, always present for alignment */
    .chevron-column {
      width: 20px;
      min-width: 20px;
      flex-shrink: 0;
      display: inline-flex;
      justify-content: center;
      align-items: center;
      height: 20px;
    }

    /* Content column - contains key, value, and toggles */
    .content-column {
      display: inline;
    }

    /* =========================================================================
       Thread Lines (FR-010)
       Visual connectors between parent and child nodes using CSS borders.
       Uses a vertical line at each depth level to show hierarchy.

       NOTE: Thread lines are supported up to MAX_THREAD_LINE_DEPTH (8) levels.
       Nodes deeper than this will not display thread lines.
       To extend support, add more CSS selectors below.
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
       Keys are styled with purple/magenta color to match UI mock.
       ========================================================================= */

    .key {
      color: #c586c0; /* Purple/magenta for keys - matches VS Code theme */
    }

    /* Colon separator - default text color */
    .colon {
      color: var(--sys-on-surface);
      margin-right: 4px;
    }

    /* =========================================================================
       Value Type Syntax Coloring (FR-011)
       Colors match VS Code / Monaco Editor theme for JSON.
       ========================================================================= */

    .value {
      color: var(--sys-on-surface-variant);
    }

    /* String values - green color */
    .value.string {
      color: #6a9955; /* Green for strings */
    }

    /* Number values - teal/cyan color (matches mock) */
    .value.number {
      color: #4ec9b0; /* Teal/cyan for numbers - matches VS Code "number" token */
    }

    /* Boolean values - blue color */
    .value.boolean {
      color: #569cd6; /* Blue for booleans */
    }

    /* Null values - blue with italic */
    .value.null {
      color: #569cd6; /* Blue for null */
      font-style: italic;
    }

    /* =========================================================================
       Brackets and Braces
       Default text color for structural characters
       ========================================================================= */

    .bracket {
      color: var(--sys-on-surface);
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

    /* =========================================================================
       Smart Blob Toggle Buttons
       Inline RAW/MD/JSON toggle buttons for string values with smart content.
       ========================================================================= */

    .smart-blob-toggles {
      display: inline-flex;
      gap: 4px;
      margin-left: 8px;
    }

    .mode-toggle {
      padding: 1px 6px;
      font-size: 10px;
      font-family: 'Roboto Mono', monospace;
      font-weight: 500;
      border: 1px solid var(--mat-sys-outline-variant, #cac4d0);
      border-radius: 3px;
      background-color: var(--mat-sys-surface, #fff);
      color: var(--mat-sys-on-surface-variant, #49454f);
      cursor: pointer;
      transition:
        background-color 0.15s,
        border-color 0.15s,
        color 0.15s;
    }

    .mode-toggle:hover {
      background-color: var(--mat-sys-surface-container-high, #e6e0e9);
    }

    .mode-toggle.active {
      background-color: var(--mat-sys-primary-container, #eaddff);
      border-color: var(--mat-sys-primary, #6750a4);
      color: var(--mat-sys-on-primary-container, #21005d);
    }

    /* =========================================================================
       Smart Blob Rendered Content
       Container for rendered markdown or nested JSON below the value line.
       ========================================================================= */

    .smart-blob-content {
      margin: 4px 0;
      position: relative;
    }

    .markdown-rendered {
      padding: 8px 12px;
      border-left: 3px solid var(--mat-sys-primary, #6750a4);
      background-color: var(--mat-sys-surface-container, #f3edf7);
      border-radius: 0 4px 4px 0;
      font-family:
        system-ui,
        -apple-system,
        sans-serif;
      font-size: 13px;
      line-height: 1.5;
    }

    .markdown-rendered h1,
    .markdown-rendered h2,
    .markdown-rendered h3,
    .markdown-rendered h4,
    .markdown-rendered h5,
    .markdown-rendered h6 {
      margin-top: 12px;
      margin-bottom: 6px;
      font-weight: 600;
      line-height: 1.25;
    }

    .markdown-rendered h1 {
      font-size: 1.4em;
    }
    .markdown-rendered h2 {
      font-size: 1.2em;
    }
    .markdown-rendered h3 {
      font-size: 1.1em;
    }

    .markdown-rendered p {
      margin-top: 0;
      margin-bottom: 8px;
    }

    .markdown-rendered ul,
    .markdown-rendered ol {
      margin-top: 0;
      margin-bottom: 8px;
      padding-left: 20px;
    }

    .markdown-rendered li {
      margin-bottom: 2px;
    }

    .markdown-rendered code {
      padding: 1px 4px;
      font-family: 'Roboto Mono', monospace;
      font-size: 0.9em;
      background-color: var(--mat-sys-surface-container-highest, #e6e0e9);
      border-radius: 3px;
    }

    .markdown-rendered pre {
      padding: 8px;
      margin: 8px 0;
      overflow: auto;
      font-family: 'Roboto Mono', monospace;
      font-size: 0.9em;
      background-color: var(--mat-sys-surface-container-highest, #e6e0e9);
      border-radius: 4px;
    }

    .markdown-rendered pre code {
      padding: 0;
      background-color: transparent;
    }

    .json-rendered {
      padding: 8px 12px;
      margin: 0;
      border-left: 3px solid var(--mat-sys-tertiary, #7d5260);
      background-color: var(--mat-sys-surface-container, #f3edf7);
      border-radius: 0 4px 4px 0;
      font-family: 'Roboto Mono', monospace;
      font-size: 12px;
      line-height: 1.4;
      overflow: auto;
      white-space: pre;
    }

    /* JSON syntax highlighting styles are in global styles.scss
       because they target innerHTML content that is outside Angular's
       view encapsulation. */
  `,
})
export class DataTreeComponent {
  private readonly detectionService = inject(ContentDetectionService);

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

  /**
   * Internal signal tracking smart blob display modes per node path.
   * Maps node path to display mode ('raw' | 'markdown' | 'json').
   * Default is 'raw' for all nodes.
   */
  private readonly _smartBlobModes = signal<Map<string, SmartBlobNodeMode>>(new Map());

  /**
   * Cache for smart blob detection results.
   * Avoids re-detecting content on every render.
   */
  private readonly _detectionCache = new Map<string, SmartBlobDetection>();

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
   * Gets the smart blob detection result for a node.
   * Uses cached detection to avoid re-computing on every render.
   *
   * @param node - The tree node to analyze
   * @returns Detection result with isJson, isMarkdown, and optional parsedJson
   */
  getSmartBlobDetection(node: TreeNode): SmartBlobDetection {
    const rawValue = node.rawStringValue;
    if (!rawValue) {
      return { isJson: false, isMarkdown: false };
    }

    // Check cache first
    const cacheKey = node.path;
    const cached = this._detectionCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Perform detection
    const isJson = this.detectionService.isJson(rawValue);
    const isMarkdown = this.detectionService.isMarkdown(rawValue);
    const parsedJson = isJson ? this.detectionService.parseJson(rawValue) : undefined;

    const detection: SmartBlobDetection = {
      isJson,
      isMarkdown,
      parsedJson,
    };

    // Cache the result
    this._detectionCache.set(cacheKey, detection);

    return detection;
  }

  /**
   * Gets the current smart blob display mode for a node.
   * Returns the explicitly set mode, or null if no mode has been set yet.
   * This allows the template to determine the default based on detection.
   *
   * @param path - The node path
   * @returns The current display mode, or null if not explicitly set
   */
  private getExplicitSmartBlobMode(path: string): SmartBlobNodeMode | null {
    return this._smartBlobModes().get(path) ?? null;
  }

  /**
   * Gets the effective smart blob display mode for a node.
   * If not explicitly set, defaults to 'markdown' if markdown detected,
   * 'json' if JSON detected, otherwise 'raw'.
   *
   * This matches the UI mock where MD/JSON are the default active modes
   * when smart blob content is detected.
   *
   * @param path - The node path
   * @param detection - The smart blob detection result for this node
   * @returns The effective display mode
   */
  getSmartBlobMode(path: string, detection?: SmartBlobDetection): SmartBlobNodeMode {
    const explicit = this.getExplicitSmartBlobMode(path);
    if (explicit !== null) {
      return explicit;
    }

    // Default to rendered mode when smart blob content is detected
    if (detection?.isMarkdown) {
      return 'markdown';
    }
    if (detection?.isJson) {
      return 'json';
    }
    return 'raw';
  }

  /**
   * Sets the smart blob display mode for a node.
   *
   * @param path - The node path
   * @param mode - The display mode to set
   */
  setSmartBlobMode(path: string, mode: SmartBlobNodeMode): void {
    this._smartBlobModes.update((modes) => {
      const newModes = new Map(modes);
      newModes.set(path, mode);
      return newModes;
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
    this.collectPaths(this.data(), '$', paths);
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

  /**
   * Formats a parsed JSON value for display.
   * Uses JSON.stringify with indentation for readable formatting.
   *
   * @param value - The parsed JSON value to format
   * @returns Formatted JSON string
   */
  protected formatJsonForDisplay(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }
}
