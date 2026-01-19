/**
 * @fileoverview Split-pane layout component with resizable divider.
 *
 * A reusable layout component that displays a main content area and a sidebar
 * side by side using CSS flexbox. Both panes scroll independently. The divider
 * between panes can be dragged to resize the sidebar.
 *
 * Uses content projection with named slots for flexibility.
 *
 * @see mddocs/frontend/frontend-spec.md#us-4-split-pane-interface-layout
 * @see mddocs/frontend/sprints/sprint5.md#s5pr5-create-splitpanecomponent-layout-primitive
 * @see mddocs/frontend/sprints/sprint6.md#s6pr6-add-resizable-divider-to-splitpanecomponent
 */

import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

/** Minimum sidebar width as a fraction of container width (30%). */
const MIN_SIDEBAR_WIDTH_FRACTION = 0.3;
/** Maximum sidebar width as a fraction of container width (70%). */
const MAX_SIDEBAR_WIDTH_FRACTION = 0.7;

/**
 * Split-pane layout component with resizable divider.
 *
 * Renders a two-column layout with a main content area that takes remaining
 * space and a sidebar with configurable fixed width. Both panes have
 * independent scrolling via `overflow-auto`. The divider between panes can
 * be dragged to resize the sidebar width.
 *
 * @example
 * ```html
 * <!-- Basic usage with default sidebar width (400px) -->
 * <app-split-pane>
 *   <div main>Main content here</div>
 *   <div sidebar>Sidebar content here</div>
 * </app-split-pane>
 *
 * <!-- With custom sidebar width -->
 * <app-split-pane [sidebarWidth]="320">
 *   <div main>Main content</div>
 *   <div sidebar>Narrower sidebar</div>
 * </app-split-pane>
 * ```
 */
@Component({
  selector: 'app-split-pane',
  standalone: true,
  imports: [],
  template: `
    <div #container class="flex h-full w-full">
      <div class="flex-1 overflow-auto">
        <ng-content select="[main]" />
      </div>
      <div
        class="divider"
        [class.dragging]="isDragging()"
        (pointerdown)="onDividerPointerDown($event)"
        data-testid="split-pane-divider"
      >
        <div class="grip"></div>
      </div>
      <div
        class="overflow-auto bg-surface"
        [style.width.px]="currentWidth()"
        [style.flex-shrink]="0"
      >
        <ng-content select="[sidebar]" />
      </div>
    </div>
  `,
  styles: `
    .divider {
      width: 8px;
      background: var(--mat-sys-outline-variant);
      cursor: col-resize;
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

    .grip {
      width: 4px;
      height: 32px;
      border-radius: 2px;
      background-color: var(--mat-sys-on-surface-variant);
      transition: background-color 0.15s ease;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SplitPaneComponent {
  private readonly destroyRef = inject(DestroyRef);

  /** Reference to the flex container for calculating max width. */
  private readonly containerRef = viewChild<ElementRef<HTMLElement>>('container');

  /**
   * Initial width of the sidebar in pixels.
   * The sidebar has a fixed width while the main content takes remaining space.
   * Defaults to 400px as specified in the design.
   */
  readonly sidebarWidth = input<number>(400);

  /** Whether a drag operation is currently in progress. */
  private readonly _isDragging = signal(false);
  readonly isDragging = this._isDragging.asReadonly();

  /** The current sidebar width, initialized from input and updated during drag. */
  private readonly _currentWidth = signal<number>(400);
  readonly currentWidth = this._currentWidth.asReadonly();

  /** The starting X position when drag began. */
  private dragStartX = 0;
  /** The sidebar width when drag began. */
  private dragStartWidth = 0;

  /** Computed minimum sidebar width based on container size (30%). */
  private readonly minWidth = computed(() => {
    const container = this.containerRef()?.nativeElement;
    if (container && container.clientWidth > 0) {
      return container.clientWidth * MIN_SIDEBAR_WIDTH_FRACTION;
    }
    // Fallback for test environments where clientWidth may be 0
    return 200;
  });

  /** Computed maximum sidebar width based on container size (70%). */
  private readonly maxWidth = computed(() => {
    const container = this.containerRef()?.nativeElement;
    if (container && container.clientWidth > 0) {
      return container.clientWidth * MAX_SIDEBAR_WIDTH_FRACTION;
    }
    // Fallback for test environments where clientWidth may be 0
    return Infinity;
  });

  constructor() {
    // Set initial width to 30% of container after first render
    afterNextRender(() => {
      const container = this.containerRef()?.nativeElement;
      if (container && container.clientWidth > 0) {
        this._currentWidth.set(container.clientWidth * MIN_SIDEBAR_WIDTH_FRACTION);
      }
    });

    // Set up document-level event listeners for drag
    this.setupDragListeners();
  }

  /**
   * Handle pointer down on the divider to start dragging.
   */
  onDividerPointerDown(event: PointerEvent): void {
    event.preventDefault();

    this._isDragging.set(true);
    this.dragStartX = event.clientX;
    this.dragStartWidth = this._currentWidth();

    // Capture pointer events to this element (guard for JSDOM in tests)
    const target = event.target as HTMLElement;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (target.setPointerCapture) {
      target.setPointerCapture(event.pointerId);
    }
  }

  /**
   * Set up document-level listeners for pointer move and up events.
   * This ensures drag continues even when pointer moves outside the divider.
   */
  private setupDragListeners(): void {
    const onPointerMove = (event: PointerEvent) => {
      if (!this._isDragging()) return;

      const deltaX = this.dragStartX - event.clientX;
      const newWidth = this.dragStartWidth + deltaX;

      // Clamp to min/max constraints (30% to 70% of container)
      const clampedWidth = Math.max(this.minWidth(), Math.min(newWidth, this.maxWidth()));

      this._currentWidth.set(clampedWidth);
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
