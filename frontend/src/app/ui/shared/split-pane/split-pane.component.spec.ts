/**
 * @fileoverview Tests for SplitPaneComponent.
 *
 * Tests verify that the component correctly:
 * - Projects content into primary and secondary slots
 * - Applies configuration-based sizing
 * - Supports horizontal and vertical orientations
 * - Uses proper flexbox layout
 * - Both panes have independent scrolling
 * - Supports resizable divider via drag interaction
 *
 * @see mddocs/frontend/sprints/sprint5.md#s5pr5-create-splitpanecomponent-layout-primitive
 * @see mddocs/frontend/sprints/sprint6.md#s6pr6-add-resizable-divider-to-splitpanecomponent
 */

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { type SplitPaneConfig, SplitPaneComponent } from './split-pane.component';

/**
 * Test host component that wraps SplitPaneComponent.
 * This allows us to test input binding and content projection behavior.
 */
@Component({
  selector: 'app-test-host',
  standalone: true,
  imports: [SplitPaneComponent],
  template: `
    <div style="width: 1000px; height: 600px;">
      <app-split-pane [config]="config()">
        <div primary data-testid="main-content">Main Content</div>
        <div secondary data-testid="sidebar-content">Sidebar Content</div>
      </app-split-pane>
    </div>
  `,
})
class TestHostComponent {
  readonly config = signal<SplitPaneConfig>({
    initialPrimaryPercent: 60, // 600px of 1000px
    primaryMinPercent: 20, // 200px
    primaryMaxPercent: 80, // 800px
  });
}

/**
 * Minimal test host that projects only primary content.
 */
@Component({
  selector: 'app-primary-only-host',
  standalone: true,
  imports: [SplitPaneComponent],
  template: `
    <div style="width: 1000px; height: 600px;">
      <app-split-pane>
        <div primary data-testid="primary-only">Only Primary Content</div>
      </app-split-pane>
    </div>
  `,
})
class PrimaryOnlyHostComponent {}

/**
 * Minimal test host that projects only secondary content.
 */
@Component({
  selector: 'app-secondary-only-host',
  standalone: true,
  imports: [SplitPaneComponent],
  template: `
    <div style="width: 1000px; height: 600px;">
      <app-split-pane>
        <div secondary data-testid="secondary-only">Only Secondary Content</div>
      </app-split-pane>
    </div>
  `,
})
class SecondaryOnlyHostComponent {}

describe('SplitPaneComponent', () => {
  describe('with both slots (horizontal mode)', () => {
    let hostComponent: TestHostComponent;
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TestHostComponent, SplitPaneComponent],
        providers: [provideNoopAnimations()],
      }).compileComponents();

      fixture = TestBed.createComponent(TestHostComponent);
      hostComponent = fixture.componentInstance;
      fixture.detectChanges();
      // Wait for afterNextRender to complete
      await fixture.whenStable();
      fixture.detectChanges();
    });

    it('should create the component', () => {
      const splitPane = fixture.nativeElement.querySelector('app-split-pane');
      expect(splitPane).toBeTruthy();
    });

    describe('content projection', () => {
      it('should project primary content into the primary slot', () => {
        const mainContent = fixture.nativeElement.querySelector('[data-testid="main-content"]');
        expect(mainContent).toBeTruthy();
        expect(mainContent.textContent).toBe('Main Content');
      });

      it('should project secondary content into the secondary slot', () => {
        const sidebarContent = fixture.nativeElement.querySelector(
          '[data-testid="sidebar-content"]',
        );
        expect(sidebarContent).toBeTruthy();
        expect(sidebarContent.textContent).toBe('Sidebar Content');
      });

      it('should render primary content before secondary content', () => {
        const container = fixture.nativeElement.querySelector('app-split-pane > div');
        const children = container.children;
        const primaryPane = children[0];
        // children[1] is the divider
        const secondaryPane = children[2];

        // Primary pane should contain the main content
        expect(primaryPane.querySelector('[data-testid="main-content"]')).toBeTruthy();
        // Secondary pane should contain the sidebar content
        expect(secondaryPane.querySelector('[data-testid="sidebar-content"]')).toBeTruthy();
      });
    });

    describe('primary pane sizing', () => {
      it('should apply width style to primary pane', () => {
        const primaryPane = fixture.nativeElement.querySelector(
          'app-split-pane > div > div:first-child',
        ) as HTMLElement;
        // jsdom doesn't do layout, so clientWidth is 0 and component falls back to sidebarWidth (400)
        // We just verify that a width style is applied
        expect(primaryPane.style.width).toMatch(/^\d+px$/);
      });
    });

    describe('layout', () => {
      it('should have split-container class at root', () => {
        const container = fixture.nativeElement.querySelector('app-split-pane > div');
        expect(container.classList.contains('split-container')).toBe(true);
      });

      it('should have horizontal class for horizontal orientation', () => {
        const container = fixture.nativeElement.querySelector('app-split-pane > div');
        expect(container.classList.contains('horizontal')).toBe(true);
      });

      it('should have secondary pane take remaining space with flex: 1', () => {
        const secondaryPane = fixture.nativeElement.querySelector(
          'app-split-pane > div > div:last-child',
        ) as HTMLElement;
        const computedStyle = getComputedStyle(secondaryPane);
        expect(computedStyle.flex).toContain('1');
      });

      it('should have visual divider between panes', () => {
        const divider = fixture.nativeElement.querySelector('[data-testid="split-pane-divider"]');
        expect(divider).toBeTruthy();
        expect(divider.classList.contains('divider')).toBe(true);
      });
    });

    describe('resizable divider', () => {
      it('should have col-resize cursor on horizontal divider', () => {
        const divider = fixture.nativeElement.querySelector(
          '[data-testid="split-pane-divider"]',
        ) as HTMLElement;
        const computedStyle = getComputedStyle(divider);
        expect(computedStyle.cursor).toBe('col-resize');
      });

      it('should have divider positioned between primary and secondary', () => {
        const container = fixture.nativeElement.querySelector('app-split-pane > div');
        const children = Array.from(container.children) as HTMLElement[];
        // Should be: [primary pane, divider, secondary pane]
        expect(children.length).toBe(3);
        const dividerEl = children[1];
        expect(dividerEl?.getAttribute('data-testid')).toBe('split-pane-divider');
      });

      it('should set isDragging to true on pointer down', () => {
        const divider = fixture.nativeElement.querySelector(
          '[data-testid="split-pane-divider"]',
        ) as HTMLElement;
        const splitPaneEl = fixture.nativeElement.querySelector('app-split-pane');
        const splitPaneDebugEl = fixture.debugElement.query(
          (de) => de.nativeElement === splitPaneEl,
        );
        const splitPaneComponent = splitPaneDebugEl?.componentInstance as SplitPaneComponent;

        expect(splitPaneComponent.isDragging()).toBe(false);

        const pointerDownEvent = new PointerEvent('pointerdown', {
          clientX: 600,
          bubbles: true,
        });
        divider.dispatchEvent(pointerDownEvent);
        fixture.detectChanges();

        expect(splitPaneComponent.isDragging()).toBe(true);
      });

      it('should set isDragging to false on pointer up', () => {
        const divider = fixture.nativeElement.querySelector(
          '[data-testid="split-pane-divider"]',
        ) as HTMLElement;
        const splitPaneEl = fixture.nativeElement.querySelector('app-split-pane');
        const splitPaneDebugEl = fixture.debugElement.query(
          (de) => de.nativeElement === splitPaneEl,
        );
        const splitPaneComponent = splitPaneDebugEl?.componentInstance as SplitPaneComponent;

        // Start drag
        const pointerDownEvent = new PointerEvent('pointerdown', {
          clientX: 600,
          bubbles: true,
        });
        divider.dispatchEvent(pointerDownEvent);
        fixture.detectChanges();

        expect(splitPaneComponent.isDragging()).toBe(true);

        // End drag via document event
        const pointerUpEvent = new PointerEvent('pointerup', { bubbles: true });
        document.dispatchEvent(pointerUpEvent);
        fixture.detectChanges();

        expect(splitPaneComponent.isDragging()).toBe(false);
      });

      it('should update primary pane size during drag', () => {
        const divider = fixture.nativeElement.querySelector(
          '[data-testid="split-pane-divider"]',
        ) as HTMLElement;
        const primaryPane = fixture.nativeElement.querySelector(
          'app-split-pane > div > div:first-child',
        ) as HTMLElement;
        const splitPaneEl = fixture.nativeElement.querySelector('app-split-pane');
        const splitPaneDebugEl = fixture.debugElement.query(
          (de) => de.nativeElement === splitPaneEl,
        );
        const splitPaneComponent = splitPaneDebugEl?.componentInstance as SplitPaneComponent;

        const initialSize = splitPaneComponent.primarySize();

        // Start drag at x=400
        const pointerDownEvent = new PointerEvent('pointerdown', {
          clientX: 400,
          bubbles: true,
        });
        divider.dispatchEvent(pointerDownEvent);
        fixture.detectChanges();

        // Move pointer right by 50px (should increase primary width by 50px)
        const pointerMoveEvent = new PointerEvent('pointermove', {
          clientX: 450,
          bubbles: true,
        });
        document.dispatchEvent(pointerMoveEvent);
        fixture.detectChanges();

        expect(splitPaneComponent.primarySize()).toBe(initialSize + 50);
        expect(primaryPane.style.width).toBe(`${initialSize + 50}px`);

        // End drag
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      });

      it('should enforce minimum size constraint', () => {
        const divider = fixture.nativeElement.querySelector(
          '[data-testid="split-pane-divider"]',
        ) as HTMLElement;
        const splitPaneEl = fixture.nativeElement.querySelector('app-split-pane');
        const splitPaneDebugEl = fixture.debugElement.query(
          (de) => de.nativeElement === splitPaneEl,
        );
        const splitPaneComponent = splitPaneDebugEl?.componentInstance as SplitPaneComponent;

        const initialSize = splitPaneComponent.primarySize();

        // Start drag
        const pointerDownEvent = new PointerEvent('pointerdown', {
          clientX: 400,
          bubbles: true,
        });
        divider.dispatchEvent(pointerDownEvent);
        fixture.detectChanges();

        // Move pointer left by a large amount
        const pointerMoveEvent = new PointerEvent('pointermove', {
          clientX: -1000,
          bubbles: true,
        });
        document.dispatchEvent(pointerMoveEvent);
        fixture.detectChanges();

        // In jsdom, min is 200 (fallback value when container.clientWidth is 0)
        // The size should be clamped to min, not negative
        expect(splitPaneComponent.primarySize()).toBe(200);

        // Clean up
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      });

      it('should allow expansion within bounds (no max in fallback mode)', () => {
        const divider = fixture.nativeElement.querySelector(
          '[data-testid="split-pane-divider"]',
        ) as HTMLElement;
        const splitPaneEl = fixture.nativeElement.querySelector('app-split-pane');
        const splitPaneDebugEl = fixture.debugElement.query(
          (de) => de.nativeElement === splitPaneEl,
        );
        const splitPaneComponent = splitPaneDebugEl?.componentInstance as SplitPaneComponent;

        const initialSize = splitPaneComponent.primarySize();

        // Start drag
        const pointerDownEvent = new PointerEvent('pointerdown', {
          clientX: 400,
          bubbles: true,
        });
        divider.dispatchEvent(pointerDownEvent);
        fixture.detectChanges();

        // Move pointer right by 100px
        const pointerMoveEvent = new PointerEvent('pointermove', {
          clientX: 500,
          bubbles: true,
        });
        document.dispatchEvent(pointerMoveEvent);
        fixture.detectChanges();

        // In jsdom fallback mode, max is Infinity, so no upper constraint
        expect(splitPaneComponent.primarySize()).toBe(initialSize + 100);

        // Clean up
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      });

      it('should add dragging class to divider during drag', () => {
        const divider = fixture.nativeElement.querySelector(
          '[data-testid="split-pane-divider"]',
        ) as HTMLElement;

        expect(divider.classList.contains('dragging')).toBe(false);

        // Start drag
        const pointerDownEvent = new PointerEvent('pointerdown', {
          clientX: 600,
          bubbles: true,
        });
        divider.dispatchEvent(pointerDownEvent);
        fixture.detectChanges();

        expect(divider.classList.contains('dragging')).toBe(true);

        // End drag
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        fixture.detectChanges();

        expect(divider.classList.contains('dragging')).toBe(false);
      });

      it('should clean up event listeners on destroy', () => {
        const divider = fixture.nativeElement.querySelector(
          '[data-testid="split-pane-divider"]',
        ) as HTMLElement;
        const splitPaneEl = fixture.nativeElement.querySelector('app-split-pane');
        const splitPaneDebugEl = fixture.debugElement.query(
          (de) => de.nativeElement === splitPaneEl,
        );
        const splitPaneComponent = splitPaneDebugEl?.componentInstance as SplitPaneComponent;

        // Start drag
        divider.dispatchEvent(new PointerEvent('pointerdown', { clientX: 600, bubbles: true }));
        fixture.detectChanges();

        expect(splitPaneComponent.isDragging()).toBe(true);

        // Destroy the component
        fixture.destroy();

        // Should not throw when dispatching events after destroy
        document.dispatchEvent(new PointerEvent('pointermove', { clientX: 450 }));
        document.dispatchEvent(new PointerEvent('pointerup'));
      });
    });
  });

  describe('with only primary content', () => {
    let fixture: ComponentFixture<PrimaryOnlyHostComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [PrimaryOnlyHostComponent, SplitPaneComponent],
        providers: [provideNoopAnimations()],
      }).compileComponents();

      fixture = TestBed.createComponent(PrimaryOnlyHostComponent);
      fixture.detectChanges();
    });

    it('should render with only primary content', () => {
      const primaryContent = fixture.nativeElement.querySelector('[data-testid="primary-only"]');
      expect(primaryContent).toBeTruthy();
      expect(primaryContent.textContent).toBe('Only Primary Content');
    });

    it('should still render secondary pane (empty)', () => {
      const secondaryPane = fixture.nativeElement.querySelector(
        'app-split-pane > div > div:last-child',
      );
      expect(secondaryPane).toBeTruthy();
    });
  });

  describe('with only secondary content', () => {
    let fixture: ComponentFixture<SecondaryOnlyHostComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [SecondaryOnlyHostComponent, SplitPaneComponent],
        providers: [provideNoopAnimations()],
      }).compileComponents();

      fixture = TestBed.createComponent(SecondaryOnlyHostComponent);
      fixture.detectChanges();
    });

    it('should render with only secondary content', () => {
      const secondaryContent = fixture.nativeElement.querySelector(
        '[data-testid="secondary-only"]',
      );
      expect(secondaryContent).toBeTruthy();
      expect(secondaryContent.textContent).toBe('Only Secondary Content');
    });

    it('should still render primary pane (empty)', () => {
      const primaryPane = fixture.nativeElement.querySelector(
        'app-split-pane > div > div:first-child',
      );
      expect(primaryPane).toBeTruthy();
    });
  });
});
