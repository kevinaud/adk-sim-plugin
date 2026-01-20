/**
 * @fileoverview Split-pane layout component with resizable divider.
 *
 * A reusable layout component that displays two content areas with a draggable
 * divider. Supports both horizontal (side-by-side) and vertical (stacked) modes.
 *
 * Uses content projection with named slots for flexibility.
 *
 * @see mddocs/frontend/frontend-spec.md#us-4-split-pane-interface-layout
 */

import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  type ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

/**
 * Configuration for split-pane constraints and initialization.
 *
 * For horizontal mode (side-by-side):
 * - Use percentage-based constraints (primaryMinPercent, primaryMaxPercent)
 * - initialPrimaryPercent sets starting size
 *
 * For vertical mode (stacked):
 * - Use pixel-based constraints (primaryMinPx, primaryMaxPx)
 * - contentAwareMax limits primary to content height when smaller than maxPx
 * - initialPrimaryPx sets starting size (or 'auto' for content-based)
 */
export interface SplitPaneConfig {
  /** Minimum size of primary pane as percentage (0-100). Used in horizontal mode. */
  primaryMinPercent?: number;
  /** Maximum size of primary pane as percentage (0-100). Used in horizontal mode. */
  primaryMaxPercent?: number;
  /** Initial size of primary pane as percentage (0-100). Used in horizontal mode. */
  initialPrimaryPercent?: number;

  /** Minimum size of primary pane in pixels. Used in vertical mode. */
  primaryMinPx?: number;
  /** Maximum size of primary pane in pixels. Used in vertical mode. */
  primaryMaxPx?: number;
  /**
   * If true, primary max is capped by content height (vertical mode only).
   * Effective max = min(primaryMaxPx, contentScrollHeight).
   */
  contentAwareMax?: boolean;
  /** Initial size of primary pane in pixels, or 'auto' for content height. */
  initialPrimaryPx?: number | 'auto';
}

/** Default configuration for horizontal mode. */
const DEFAULT_HORIZONTAL_CONFIG: Required<
  Pick<SplitPaneConfig, 'primaryMinPercent' | 'primaryMaxPercent' | 'initialPrimaryPercent'>
> = {
  primaryMinPercent: 30,
  primaryMaxPercent: 70,
  initialPrimaryPercent: 70,
};

/** Default configuration for vertical mode. */
const DEFAULT_VERTICAL_CONFIG: Required<
  Pick<SplitPaneConfig, 'primaryMinPx' | 'primaryMaxPx' | 'contentAwareMax'>
> & { initialPrimaryPx: number | 'auto' } = {
  primaryMinPx: 100,
  primaryMaxPx: 600,
  contentAwareMax: true,
  initialPrimaryPx: 'auto',
};

/**
 * Split-pane layout component with resizable divider.
 *
 * Supports two orientations:
 * - **horizontal**: Primary on left, secondary on right (default)
 * - **vertical**: Primary on top, secondary on bottom
 *
 * @example
 * ```html
 * <!-- Horizontal mode (default) -->
 * <app-split-pane orientation="horizontal" [config]="{ initialPrimaryPercent: 70 }">
 *   <div primary>Main content here</div>
 *   <div secondary>Sidebar content here</div>
 * </app-split-pane>
 *
 * <!-- Vertical mode with content-aware max -->
 * <app-split-pane orientation="vertical" [config]="{ primaryMaxPx: 400, contentAwareMax: true }">
 *   <div primary>Top content (height limited by content)</div>
 *   <div secondary>Bottom content (takes remaining space)</div>
 * </app-split-pane>
 * ```
 */
@Component({
  selector: 'app-split-pane',
  standalone: true,
  imports: [],
  template: `
    <div
      #container
      class="split-container"
      [class.horizontal]="orientation() === 'horizontal'"
      [class.vertical]="orientation() === 'vertical'"
    >
      <div
        #primaryPane
        class="primary-pane"
        [style.width]="orientation() === 'horizontal' ? primarySize() + 'px' : null"
        [style.height]="orientation() === 'vertical' ? primarySize() + 'px' : null"
      >
        <ng-content select="[primary],[main]" />
      </div>
      <div
        class="divider"
        [class.dragging]="isDragging()"
        [class.horizontal]="orientation() === 'horizontal'"
        [class.vertical]="orientation() === 'vertical'"
        (pointerdown)="onDividerPointerDown($event)"
        data-testid="split-pane-divider"
      >
        <div class="grip"></div>
      </div>
      <div class="secondary-pane">
        <ng-content select="[secondary],[sidebar]" />
      </div>
    </div>
  `,
  styles: `
    .split-container {
      display: flex;
      height: 100%;
      width: 100%;
    }

    .split-container.horizontal {
      flex-direction: row;
    }

    .split-container.vertical {
      flex-direction: column;
    }

    .primary-pane {
      overflow: auto;
      flex-shrink: 0;
    }

    .secondary-pane {
      flex: 1;
      overflow: auto;
      min-height: 0;
      min-width: 0;
    }

    /* Horizontal divider (between left and right) */
    .divider.horizontal {
      width: 8px;
      cursor: col-resize;
    }

    /* Vertical divider (between top and bottom) */
    .divider.vertical {
      height: 8px;
      cursor: row-resize;
    }

    .divider {
      background: var(--mat-sys-outline-variant);
      flex-shrink: 0;
      touch-action: none;
      transition: background 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover,
      &.dragging {
        background: var(--mat-sys-primary);

        .grip {
          background-color: var(--mat-sys-on-primary);
        }
      }
    }

    .divider.horizontal .grip {
      width: 4px;
      height: 32px;
      border-radius: 2px;
    }

    .divider.vertical .grip {
      width: 32px;
      height: 4px;
      border-radius: 2px;
    }

    .grip {
      background-color: var(--mat-sys-on-surface-variant);
      transition: background-color 0.15s ease;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SplitPaneComponent {
  private readonly destroyRef = inject(DestroyRef);

  /** Reference to the flex container for calculating dimensions. */
  private readonly containerRef = viewChild<ElementRef<HTMLElement>>('container');

  /** Reference to the primary pane for measuring content height. */
  private readonly primaryPaneRef = viewChild<ElementRef<HTMLElement>>('primaryPane');

  /**
   * Orientation of the split pane.
   * - 'horizontal': primary on left, secondary on right
   * - 'vertical': primary on top, secondary on bottom
   */
  readonly orientation = input<'horizontal' | 'vertical'>('horizontal');

  /**
   * Configuration for constraints and initialization.
   * Merged with defaults based on orientation.
   */
  readonly config = input<SplitPaneConfig>({});

  /**
   * @deprecated Use `config` input instead. Kept for backwards compatibility.
   * Initial width of the sidebar in pixels (horizontal mode only).
   */
  readonly sidebarWidth = input<number>(400);

  /** Whether a drag operation is currently in progress. */
  private readonly _isDragging = signal(false);
  readonly isDragging = this._isDragging.asReadonly();

  /**
   * The current primary pane size (in pixels), updated during drag.
   * When undefined, calculated from config or defaults.
   */
  // eslint-disable-next-line unicorn/no-useless-undefined -- Angular signal() requires explicit initial value
  private readonly _userDraggedSize = signal<number | undefined>(undefined);

  /** Flag to track if initial size has been set. */
  private initialSizeSet = false;

  /** The effective current size of the primary pane in pixels. */
  readonly primarySize = computed(() => {
    const userSize = this._userDraggedSize();
    if (userSize !== undefined) {
      return userSize;
    }

    // Fall back to calculated initial size
    return this.calculateInitialSize();
  });

  /** The starting position when drag began. */
  private dragStartPos = 0;
  /** The primary size when drag began. */
  private dragStartSize = 0;

  /** Computed minimum size based on orientation and config. */
  private readonly minSize = computed(() => {
    const container = this.containerRef()?.nativeElement;
    const cfg = this.config();

    if (this.orientation() === 'horizontal') {
      const minPercent = cfg.primaryMinPercent ?? DEFAULT_HORIZONTAL_CONFIG.primaryMinPercent;
      if (container && container.clientWidth > 0) {
        return (container.clientWidth * minPercent) / 100;
      }
      return 200; // Fallback
    } else {
      return cfg.primaryMinPx ?? DEFAULT_VERTICAL_CONFIG.primaryMinPx;
    }
  });

  /** Computed maximum size based on orientation, config, and content. */
  private readonly maxSize = computed(() => {
    const container = this.containerRef()?.nativeElement;
    const primaryPane = this.primaryPaneRef()?.nativeElement;
    const cfg = this.config();

    if (this.orientation() === 'horizontal') {
      const maxPercent = cfg.primaryMaxPercent ?? DEFAULT_HORIZONTAL_CONFIG.primaryMaxPercent;
      if (container && container.clientWidth > 0) {
        return (container.clientWidth * maxPercent) / 100;
      }
      return Infinity; // Fallback
    } else {
      const maxPx = cfg.primaryMaxPx ?? DEFAULT_VERTICAL_CONFIG.primaryMaxPx;
      const contentAware = cfg.contentAwareMax ?? DEFAULT_VERTICAL_CONFIG.contentAwareMax;
      const minPx = cfg.primaryMinPx ?? DEFAULT_VERTICAL_CONFIG.primaryMinPx;

      if (contentAware && primaryPane) {
        // Content-aware: cap at content scroll height, but only if content
        // is actually larger than min. Otherwise the scrollHeight might just
        // be the current constrained height, not the natural content height.
        const contentHeight = primaryPane.scrollHeight;
        // Only apply content-aware cap if content is meaningfully larger than min
        if (contentHeight > minPx) {
          return Math.min(maxPx, contentHeight);
        }
      }
      return maxPx;
    }
  });

  constructor() {
    // Set up document-level event listeners for drag
    this.setupDragListeners();

    // Initialize size after first render
    afterNextRender(() => {
      if (!this.initialSizeSet) {
        const initialSize = this.calculateInitialSize();
        this._userDraggedSize.set(initialSize);
        this.initialSizeSet = true;
      }
    });
  }

  /**
   * Calculate the initial size based on orientation and config.
   */
  private calculateInitialSize(): number {
    const container = this.containerRef()?.nativeElement;
    const primaryPane = this.primaryPaneRef()?.nativeElement;
    const cfg = this.config();

    if (this.orientation() === 'horizontal') {
      // Horizontal: use percentage or fallback to sidebarWidth for backwards compat
      const initialPercent =
        cfg.initialPrimaryPercent ?? DEFAULT_HORIZONTAL_CONFIG.initialPrimaryPercent;
      if (container && container.clientWidth > 0) {
        return (container.clientWidth * initialPercent) / 100;
      }
      // Backwards compatibility: use sidebarWidth input
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional fallback for backwards compat
      return this.sidebarWidth();
    } else {
      // Vertical: use pixel value or 'auto' for content height
      const initialPx = cfg.initialPrimaryPx ?? DEFAULT_VERTICAL_CONFIG.initialPrimaryPx;
      const minPx = cfg.primaryMinPx ?? DEFAULT_VERTICAL_CONFIG.primaryMinPx;
      const maxPx = cfg.primaryMaxPx ?? DEFAULT_VERTICAL_CONFIG.primaryMaxPx;

      if (initialPx === 'auto' && primaryPane) {
        // Auto: use content height, clamped between min and max.
        // Note: scrollHeight may not reflect true content height if the element
        // is constrained, so we ensure at least minPx is used.
        const contentHeight = primaryPane.scrollHeight;
        return Math.max(minPx, Math.min(contentHeight, maxPx));
      }
      // Explicit pixel value: clamp to min/max range
      const explicitPx = typeof initialPx === 'number' ? initialPx : minPx;
      return Math.max(minPx, Math.min(explicitPx, maxPx));
    }
  }

  /**
   * Handle pointer down on the divider to start dragging.
   */
  onDividerPointerDown(event: PointerEvent): void {
    event.preventDefault();

    this._isDragging.set(true);

    this.dragStartPos = this.orientation() === 'horizontal' ? event.clientX : event.clientY;
    this.dragStartSize = this.primarySize();

    // Capture pointer events to this element (not available in jsdom tests)
    const target = event.target as HTMLElement;
    if (typeof target.setPointerCapture === 'function') {
      target.setPointerCapture(event.pointerId);
    }
  }

  /**
   * Set up document-level listeners for pointer move and up events.
   */
  private setupDragListeners(): void {
    const onPointerMove = (event: PointerEvent) => {
      if (!this._isDragging()) return;

      // Horizontal: dragging right increases primary (left pane)
      // Vertical: dragging down increases primary (top pane)
      const delta =
        this.orientation() === 'horizontal'
          ? event.clientX - this.dragStartPos
          : event.clientY - this.dragStartPos;

      const newSize = this.dragStartSize + delta;

      // Clamp to min/max constraints
      const clampedSize = Math.max(this.minSize(), Math.min(newSize, this.maxSize()));

      this._userDraggedSize.set(clampedSize);
    };

    const onPointerUp = () => {
      this._isDragging.set(false);
    };

    // Add listeners to document for drag tracking
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);

    // Clean up on destroy
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    });
  }
}
