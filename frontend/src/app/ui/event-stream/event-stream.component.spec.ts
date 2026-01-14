/**
 * @fileoverview Tests for EventStreamComponent.
 *
 * Tests verify that the component correctly:
 * - Displays empty state when no events are provided
 * - Renders event placeholders when events are provided
 * - Uses @for iteration with proper tracking
 * - Shows correct role information for each event
 *
 * @see mddocs/frontend/frontend-spec.md#fr-context-inspection - FR-007
 */

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { Content } from '@adk-sim/converters';

import { EventStreamComponent } from './event-stream.component';

/**
 * Create a test Content object with specified role and parts count.
 *
 * @param role - The role for the content ('user' or 'model')
 * @param partsCount - Number of text parts to include
 * @returns A Content object suitable for testing
 */
function createTestContent(role: 'user' | 'model', partsCount = 1): Content {
  const parts = Array.from({ length: partsCount }, (_, i) => ({
    text: `Test content ${i + 1}`,
  }));
  return { role, parts };
}

/**
 * Test host component that wraps EventStreamComponent.
 * This allows us to test input binding behavior.
 */
@Component({
  selector: 'app-test-host',
  standalone: true,
  imports: [EventStreamComponent],
  template: `<app-event-stream [events]="events()" />`,
})
class TestHostComponent {
  readonly events = signal<Content[]>([]);
}

describe('EventStreamComponent', () => {
  let hostComponent: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, EventStreamComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    const eventStream = fixture.nativeElement.querySelector('app-event-stream');
    expect(eventStream).toBeTruthy();
  });

  describe('empty state', () => {
    it('should display empty state when events array is empty', () => {
      hostComponent.events.set([]);
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('[data-testid="empty-state"]');
      expect(emptyState).toBeTruthy();
    });

    it('should display helpful message in empty state', () => {
      hostComponent.events.set([]);
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('[data-testid="empty-state"]');
      expect(emptyState.textContent).toContain('No conversation events yet');
    });

    it('should display hint about when events appear', () => {
      hostComponent.events.set([]);
      fixture.detectChanges();

      const hint = fixture.nativeElement.querySelector('.empty-hint');
      expect(hint.textContent).toContain('Events will appear here');
    });

    it('should not show event list when empty', () => {
      hostComponent.events.set([]);
      fixture.detectChanges();

      const eventBlocks = fixture.nativeElement.querySelectorAll('[data-testid="event-block"]');
      expect(eventBlocks.length).toBe(0);
    });
  });

  describe('with events', () => {
    it('should hide empty state when events are provided', () => {
      hostComponent.events.set([createTestContent('user')]);
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('[data-testid="empty-state"]');
      expect(emptyState).toBeNull();
    });

    it('should render one event block per content item', () => {
      const events = [
        createTestContent('user'),
        createTestContent('model'),
        createTestContent('user'),
      ];
      hostComponent.events.set(events);
      fixture.detectChanges();

      const eventBlocks = fixture.nativeElement.querySelectorAll('[data-testid="event-block"]');
      expect(eventBlocks.length).toBe(3);
    });

    it('should display role for each event', () => {
      hostComponent.events.set([createTestContent('user'), createTestContent('model')]);
      fixture.detectChanges();

      const roleBadges = fixture.nativeElement.querySelectorAll('.role-badge');
      expect(roleBadges[0].textContent).toBe('user');
      expect(roleBadges[1].textContent).toBe('model');
    });

    it('should set data-role attribute on event blocks', () => {
      hostComponent.events.set([createTestContent('user'), createTestContent('model')]);
      fixture.detectChanges();

      const eventBlocks = fixture.nativeElement.querySelectorAll('[data-testid="event-block"]');
      expect(eventBlocks[0].getAttribute('data-role')).toBe('user');
      expect(eventBlocks[1].getAttribute('data-role')).toBe('model');
    });

    it('should display correct parts count for each event', () => {
      hostComponent.events.set([createTestContent('user', 1), createTestContent('model', 3)]);
      fixture.detectChanges();

      const partsCounts = fixture.nativeElement.querySelectorAll('.parts-count');
      expect(partsCounts[0].textContent).toContain('1 part(s)');
      expect(partsCounts[1].textContent).toContain('3 part(s)');
    });

    it('should handle content with undefined parts', () => {
      const contentWithUndefinedParts: Content = { role: 'user' };
      hostComponent.events.set([contentWithUndefinedParts]);
      fixture.detectChanges();

      const partsCount = fixture.nativeElement.querySelector('.parts-count');
      expect(partsCount.textContent).toContain('0 part(s)');
    });
  });

  describe('event iteration and tracking', () => {
    it('should update when events change', () => {
      // Start with one event
      hostComponent.events.set([createTestContent('user')]);
      fixture.detectChanges();

      let eventBlocks = fixture.nativeElement.querySelectorAll('[data-testid="event-block"]');
      expect(eventBlocks.length).toBe(1);

      // Add another event
      hostComponent.events.set([createTestContent('user'), createTestContent('model')]);
      fixture.detectChanges();

      eventBlocks = fixture.nativeElement.querySelectorAll('[data-testid="event-block"]');
      expect(eventBlocks.length).toBe(2);
    });

    it('should preserve order of events', () => {
      const events = [
        createTestContent('user'),
        createTestContent('model'),
        createTestContent('user'),
        createTestContent('model'),
      ];
      hostComponent.events.set(events);
      fixture.detectChanges();

      const roleBadges = fixture.nativeElement.querySelectorAll('.role-badge');
      expect(roleBadges[0].textContent).toBe('user');
      expect(roleBadges[1].textContent).toBe('model');
      expect(roleBadges[2].textContent).toBe('user');
      expect(roleBadges[3].textContent).toBe('model');
    });

    it('should handle transition from events to empty', () => {
      // Start with events
      hostComponent.events.set([createTestContent('user')]);
      fixture.detectChanges();

      let eventBlocks = fixture.nativeElement.querySelectorAll('[data-testid="event-block"]');
      expect(eventBlocks.length).toBe(1);

      // Clear events
      hostComponent.events.set([]);
      fixture.detectChanges();

      eventBlocks = fixture.nativeElement.querySelectorAll('[data-testid="event-block"]');
      expect(eventBlocks.length).toBe(0);

      const emptyState = fixture.nativeElement.querySelector('[data-testid="empty-state"]');
      expect(emptyState).toBeTruthy();
    });
  });

  describe('computed signals', () => {
    it('should correctly compute isEmpty for empty array', () => {
      hostComponent.events.set([]);
      fixture.detectChanges();

      // Access child component via debugElement - non-null assertion is safe
      // because test will fail on toBeTruthy if undefined
      const debugChild = fixture.debugElement.children[0];
      expect(debugChild).toBeTruthy();
      const component = debugChild!.componentInstance as EventStreamComponent;
      expect(component.isEmpty()).toBe(true);
    });

    it('should correctly compute isEmpty for non-empty array', () => {
      hostComponent.events.set([createTestContent('user')]);
      fixture.detectChanges();

      // Access child component via debugElement - non-null assertion is safe
      // because test will fail on toBeTruthy if undefined
      const debugChild = fixture.debugElement.children[0];
      expect(debugChild).toBeTruthy();
      const component = debugChild!.componentInstance as EventStreamComponent;
      expect(component.isEmpty()).toBe(false);
    });
  });
});
