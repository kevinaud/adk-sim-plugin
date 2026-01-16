/**
 * @fileoverview Split-pane layout component.
 *
 * A reusable layout component that displays a main content area and a sidebar
 * side by side using CSS flexbox. Both panes scroll independently.
 *
 * Uses content projection with named slots for flexibility.
 *
 * @see mddocs/frontend/frontend-spec.md#us-4-split-pane-interface-layout
 * @see mddocs/frontend/sprints/sprint5.md#s5pr5-create-splitpanecomponent-layout-primitive
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Split-pane layout component.
 *
 * Renders a two-column layout with a main content area that takes remaining
 * space and a sidebar with configurable fixed width. Both panes have
 * independent scrolling via `overflow-auto`.
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
    <div class="flex h-full w-full">
      <div class="flex-1 overflow-auto">
        <ng-content select="[main]" />
      </div>
      <div
        class="overflow-auto border-l border-outline-variant bg-surface"
        [style.width.px]="sidebarWidth()"
        [style.flex-shrink]="0"
      >
        <ng-content select="[sidebar]" />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SplitPaneComponent {
  /**
   * Width of the sidebar in pixels.
   * The sidebar has a fixed width while the main content takes remaining space.
   * Defaults to 400px as specified in the design.
   */
  readonly sidebarWidth = input<number>(400);
}
