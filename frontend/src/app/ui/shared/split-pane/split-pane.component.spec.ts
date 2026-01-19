/**
 * @fileoverview Tests for SplitPaneComponent.
 *
 * Tests verify that the component correctly:
 * - Projects content into main and sidebar slots
 * - Applies default sidebar width of 400px
 * - Accepts custom sidebar width via input
 * - Uses proper flexbox layout classes
 * - Both panes have independent scrolling
 * - Supports resizable divider via drag interaction
 *
 * @see mddocs/frontend/sprints/sprint5.md#s5pr5-create-splitpanecomponent-layout-primitive
 * @see mddocs/frontend/sprints/sprint6.md#s6pr6-add-resizable-divider-to-splitpanecomponent
 */

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { SplitPaneComponent } from './split-pane.component';

/**
 * Test host component that wraps SplitPaneComponent.
 * This allows us to test input binding and content projection behavior.
 */
@Component({
  selector: 'app-test-host',
  standalone: true,
  imports: [SplitPaneComponent],
  template: `
    <app-split-pane [sidebarWidth]="sidebarWidth()">
      <div main data-testid="main-content">Main Content</div>
      <div sidebar data-testid="sidebar-content">Sidebar Content</div>
    </app-split-pane>
  `,
})
class TestHostComponent {
  readonly sidebarWidth = signal<number>(400);
}

/**
 * Minimal test host that projects only main content.
 */
@Component({
  selector: 'app-main-only-host',
  standalone: true,
  imports: [SplitPaneComponent],
  template: `
    <app-split-pane>
      <div main data-testid="main-only">Only Main Content</div>
    </app-split-pane>
  `,
})
class MainOnlyHostComponent {}

/**
 * Minimal test host that projects only sidebar content.
 */
@Component({
  selector: 'app-sidebar-only-host',
  standalone: true,
  imports: [SplitPaneComponent],
  template: `
    <app-split-pane>
      <div sidebar data-testid="sidebar-only">Only Sidebar Content</div>
    </app-split-pane>
  `,
})
class SidebarOnlyHostComponent {}

describe('SplitPaneComponent', () => {
  describe('with both slots', () => {
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
    });

    it('should create the component', () => {
      const splitPane = fixture.nativeElement.querySelector('app-split-pane');
      expect(splitPane).toBeTruthy();
    });

    describe('content projection', () => {
      it('should project main content into the main slot', () => {
        const mainContent = fixture.nativeElement.querySelector('[data-testid="main-content"]');
        expect(mainContent).toBeTruthy();
        expect(mainContent.textContent).toBe('Main Content');
      });

      it('should project sidebar content into the sidebar slot', () => {
        const sidebarContent = fixture.nativeElement.querySelector(
          '[data-testid="sidebar-content"]',
        );
        expect(sidebarContent).toBeTruthy();
        expect(sidebarContent.textContent).toBe('Sidebar Content');
      });

      it('should render main content before sidebar content', () => {
        const container = fixture.nativeElement.querySelector('app-split-pane > div');
        const children = container.children;
        const mainPane = children[0];
        // children[1] is the divider
        const sidebarPane = children[2];

        // Main pane should contain the main content
        expect(mainPane.querySelector('[data-testid="main-content"]')).toBeTruthy();
        // Sidebar pane should contain the sidebar content
        expect(sidebarPane.querySelector('[data-testid="sidebar-content"]')).toBeTruthy();
      });
    });

    describe('sidebar width', () => {
      it('should use default sidebar width of 400px', () => {
        const sidebarPane = fixture.nativeElement.querySelector(
          'app-split-pane > div > div:last-child',
        );
        expect(sidebarPane.style.width).toBe('400px');
      });

      it('should accept custom sidebar width', () => {
        hostComponent.sidebarWidth.set(320);
        fixture.detectChanges();
        const sidebarPane = fixture.nativeElement.querySelector(
          'app-split-pane > div > div:last-child',
        );
        expect(sidebarPane.style.width).toBe('320px');
      });

      it('should update width when input changes', () => {
        const sidebarPane = fixture.nativeElement.querySelector(
          'app-split-pane > div > div:last-child',
        );

        hostComponent.sidebarWidth.set(500);
        fixture.detectChanges();
        expect(sidebarPane.style.width).toBe('500px');

        hostComponent.sidebarWidth.set(250);
        fixture.detectChanges();
        expect(sidebarPane.style.width).toBe('250px');
      });

      it('should have flex-shrink: 0 on sidebar to maintain fixed width', () => {
        const sidebarPane = fixture.nativeElement.querySelector(
          'app-split-pane > div > div:last-child',
        );
        expect(sidebarPane.style.flexShrink).toBe('0');
      });
    });

    describe('layout', () => {
      it('should have flex container at root', () => {
        const container = fixture.nativeElement.querySelector('app-split-pane > div');
        expect(container.classList.contains('flex')).toBe(true);
      });

      it('should have full height and width', () => {
        const container = fixture.nativeElement.querySelector('app-split-pane > div');
        expect(container.classList.contains('h-full')).toBe(true);
        expect(container.classList.contains('w-full')).toBe(true);
      });

      it('should have main pane take remaining space with flex-1', () => {
        const mainPane = fixture.nativeElement.querySelector(
          'app-split-pane > div > div:first-child',
        );
        expect(mainPane.classList.contains('flex-1')).toBe(true);
      });

      it('should have independent scrolling on main pane', () => {
        const mainPane = fixture.nativeElement.querySelector(
          'app-split-pane > div > div:first-child',
        );
        expect(mainPane.classList.contains('overflow-auto')).toBe(true);
      });

      it('should have independent scrolling on sidebar pane', () => {
        const sidebarPane = fixture.nativeElement.querySelector(
          'app-split-pane > div > div:last-child',
        );
        expect(sidebarPane.classList.contains('overflow-auto')).toBe(true);
      });

      it('should have visual divider between panes', () => {
        const divider = fixture.nativeElement.querySelector('[data-testid="split-pane-divider"]');
        expect(divider).toBeTruthy();
        expect(divider.classList.contains('divider')).toBe(true);
      });

      it('should have background on sidebar pane', () => {
        const sidebarPane = fixture.nativeElement.querySelector(
          'app-split-pane > div > div:last-child',
        );
        expect(sidebarPane.classList.contains('bg-surface')).toBe(true);
      });
    });

    describe('resizable divider', () => {
      it('should have col-resize cursor on divider', () => {
        const divider = fixture.nativeElement.querySelector(
          '[data-testid="split-pane-divider"]',
        ) as HTMLElement;
        const computedStyle = getComputedStyle(divider);
        expect(computedStyle.cursor).toBe('col-resize');
      });

      it('should have divider positioned between main and sidebar', () => {
        const container = fixture.nativeElement.querySelector('app-split-pane > div');
        const children = Array.from(container.children) as HTMLElement[];
        // Should be: [main pane, divider, sidebar pane]
        expect(children.length).toBe(3);
        const dividerEl = children[1];
        expect(dividerEl?.getAttribute('data-testid')).toBe('split-pane-divider');
      });

      it('should set isDragging to true on pointer down', () => {
        const divider = fixture.nativeElement.querySelector(
          '[data-testid="split-pane-divider"]',
        ) as HTMLElement;
        const splitPaneDebugEl = fixture.debugElement.children[0];
        const splitPaneComponent = splitPaneDebugEl?.componentInstance as SplitPaneComponent;

        expect(splitPaneComponent.isDragging()).toBe(false);

        const pointerDownEvent = new PointerEvent('pointerdown', {
          clientX: 500,
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
        const splitPaneDebugEl = fixture.debugElement.children[0];
        const splitPaneComponent = splitPaneDebugEl?.componentInstance as SplitPaneComponent;

        // Start drag
        const pointerDownEvent = new PointerEvent('pointerdown', {
          clientX: 500,
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

      it('should update sidebar width during drag', () => {
        const divider = fixture.nativeElement.querySelector(
          '[data-testid="split-pane-divider"]',
        ) as HTMLElement;
        const sidebarPane = fixture.nativeElement.querySelector(
          'app-split-pane > div > div:last-child',
        ) as HTMLElement;
        const splitPaneDebugEl = fixture.debugElement.children[0];
        const splitPaneComponent = splitPaneDebugEl?.componentInstance as SplitPaneComponent;

        // Initial width is 400px
        expect(sidebarPane.style.width).toBe('400px');

        // Start drag at x=500
        const pointerDownEvent = new PointerEvent('pointerdown', {
          clientX: 500,
          bubbles: true,
        });
        divider.dispatchEvent(pointerDownEvent);
        fixture.detectChanges();

        // Move pointer left by 50px (should increase sidebar width by 50px)
        const pointerMoveEvent = new PointerEvent('pointermove', {
          clientX: 450,
          bubbles: true,
        });
        document.dispatchEvent(pointerMoveEvent);
        fixture.detectChanges();

        expect(splitPaneComponent.currentWidth()).toBe(450);
        expect(sidebarPane.style.width).toBe('450px');

        // End drag
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      });

      it('should enforce minimum width constraint (200px)', () => {
        const divider = fixture.nativeElement.querySelector(
          '[data-testid="split-pane-divider"]',
        ) as HTMLElement;
        const splitPaneDebugEl = fixture.debugElement.children[0];
        const splitPaneComponent = splitPaneDebugEl?.componentInstance as SplitPaneComponent;

        // Start drag
        const pointerDownEvent = new PointerEvent('pointerdown', {
          clientX: 500,
          bubbles: true,
        });
        divider.dispatchEvent(pointerDownEvent);
        fixture.detectChanges();

        // Move pointer right by 300px (would make width 100px, below minimum)
        const pointerMoveEvent = new PointerEvent('pointermove', {
          clientX: 800,
          bubbles: true,
        });
        document.dispatchEvent(pointerMoveEvent);
        fixture.detectChanges();

        // Should be clamped to minimum of 200px
        expect(splitPaneComponent.currentWidth()).toBe(200);

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
          clientX: 500,
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

      it('should preserve input sidebarWidth as initial value', () => {
        hostComponent.sidebarWidth.set(350);
        fixture.detectChanges();

        const splitPaneDebugEl = fixture.debugElement.children[0];
        const splitPaneComponent = splitPaneDebugEl?.componentInstance as SplitPaneComponent;
        expect(splitPaneComponent.currentWidth()).toBe(350);

        const sidebarPane = fixture.nativeElement.querySelector(
          'app-split-pane > div > div:last-child',
        ) as HTMLElement;
        expect(sidebarPane.style.width).toBe('350px');
      });

      it('should clean up event listeners on destroy', () => {
        const divider = fixture.nativeElement.querySelector(
          '[data-testid="split-pane-divider"]',
        ) as HTMLElement;
        const splitPaneDebugEl = fixture.debugElement.children[0];
        const splitPaneComponent = splitPaneDebugEl?.componentInstance as SplitPaneComponent;

        // Start drag
        divider.dispatchEvent(new PointerEvent('pointerdown', { clientX: 500, bubbles: true }));
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

  describe('with only main content', () => {
    let fixture: ComponentFixture<MainOnlyHostComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [MainOnlyHostComponent, SplitPaneComponent],
        providers: [provideNoopAnimations()],
      }).compileComponents();

      fixture = TestBed.createComponent(MainOnlyHostComponent);
      fixture.detectChanges();
    });

    it('should render with only main content', () => {
      const mainContent = fixture.nativeElement.querySelector('[data-testid="main-only"]');
      expect(mainContent).toBeTruthy();
      expect(mainContent.textContent).toBe('Only Main Content');
    });

    it('should still render sidebar pane (empty)', () => {
      const sidebarPane = fixture.nativeElement.querySelector(
        'app-split-pane > div > div:last-child',
      );
      expect(sidebarPane).toBeTruthy();
    });
  });

  describe('with only sidebar content', () => {
    let fixture: ComponentFixture<SidebarOnlyHostComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [SidebarOnlyHostComponent, SplitPaneComponent],
        providers: [provideNoopAnimations()],
      }).compileComponents();

      fixture = TestBed.createComponent(SidebarOnlyHostComponent);
      fixture.detectChanges();
    });

    it('should render with only sidebar content', () => {
      const sidebarContent = fixture.nativeElement.querySelector('[data-testid="sidebar-only"]');
      expect(sidebarContent).toBeTruthy();
      expect(sidebarContent.textContent).toBe('Only Sidebar Content');
    });

    it('should still render main pane (empty)', () => {
      const mainPane = fixture.nativeElement.querySelector(
        'app-split-pane > div > div:first-child',
      );
      expect(mainPane).toBeTruthy();
    });
  });
});
