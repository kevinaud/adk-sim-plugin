/**
 * @fileoverview Tests for SessionCardComponent.
 *
 * Tests verify that the component correctly:
 * - Displays session ID truncated (first 8 chars) with full ID in title
 * - Displays session description when available
 * - Displays formatted creation time or "Unknown" fallback
 * - Displays status indicator (Active)
 * - Emits selected event with session ID on click
 * - Emits selected event with session ID on Enter key
 * - Is keyboard accessible
 *
 * @see frontend/src/app/features/session-list/session-list.component.html (lines 56-92)
 */

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { type SimulatorSession, SimulatorSessionSchema } from '@adk-sim/protos';
import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';

import { SessionCardComponent } from './session-card.component';

/**
 * Creates a test session with the given overrides.
 */
function createTestSession(overrides: Partial<SimulatorSession> = {}): SimulatorSession {
  return create(SimulatorSessionSchema, {
    id: 'test-session-12345678-abcd-efgh',
    description: '',
    ...overrides,
  });
}

/**
 * Test host component that wraps SessionCardComponent.
 * This allows us to test input binding and output behavior.
 */
@Component({
  selector: 'app-test-host',
  standalone: true,
  imports: [SessionCardComponent],
  template: `<app-session-card [session]="session()" (selected)="onSelected($event)" />`,
})
class TestHostComponent {
  readonly session = signal<SimulatorSession>(createTestSession());
  selectedId: string | null = null;

  onSelected(id: string): void {
    this.selectedId = id;
  }
}

describe('SessionCardComponent', () => {
  let hostComponent: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, SessionCardComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    const card = fixture.nativeElement.querySelector('app-session-card');
    expect(card).toBeTruthy();
  });

  describe('session ID display', () => {
    it('should display truncated session ID (first 8 chars)', () => {
      const idSpan = fixture.nativeElement.querySelector('[data-testid="session-id"]');
      expect(idSpan.textContent.trim()).toBe('test-ses...');
    });

    it('should have full session ID in title attribute', () => {
      const idSpan = fixture.nativeElement.querySelector('[data-testid="session-id"]');
      expect(idSpan.title).toBe('test-session-12345678-abcd-efgh');
    });

    it('should display short IDs without truncation', () => {
      hostComponent.session.set(createTestSession({ id: 'abc123' }));
      fixture.detectChanges();
      const idSpan = fixture.nativeElement.querySelector('[data-testid="session-id"]');
      expect(idSpan.textContent.trim()).toBe('abc123');
    });

    it('should update when session ID changes', () => {
      hostComponent.session.set(createTestSession({ id: 'new-id-123456789' }));
      fixture.detectChanges();
      const idSpan = fixture.nativeElement.querySelector('[data-testid="session-id"]');
      expect(idSpan.textContent.trim()).toBe('new-id-1...');
    });
  });

  describe('session description display', () => {
    it('should not display description when empty', () => {
      const desc = fixture.nativeElement.querySelector('[data-testid="session-description"]');
      expect(desc).toBeNull();
    });

    it('should display description when provided', () => {
      hostComponent.session.set(createTestSession({ description: 'Test description' }));
      fixture.detectChanges();
      const desc = fixture.nativeElement.querySelector('[data-testid="session-description"]');
      expect(desc).toBeTruthy();
      expect(desc.textContent).toBe('Test description');
    });

    it('should update when description changes', () => {
      hostComponent.session.set(createTestSession({ description: 'First' }));
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('[data-testid="session-description"]').textContent,
      ).toBe('First');

      hostComponent.session.set(createTestSession({ description: 'Second' }));
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('[data-testid="session-description"]').textContent,
      ).toBe('Second');
    });
  });

  describe('creation time display', () => {
    it('should display "Unknown" when createdAt is not set', () => {
      const created = fixture.nativeElement.querySelector('[data-testid="session-created"]');
      expect(created.textContent).toContain('Unknown');
    });

    it('should display formatted date when createdAt is set', () => {
      const testDate = new Date('2024-06-15T10:30:00Z');
      hostComponent.session.set(
        createTestSession({
          createdAt: timestampFromDate(testDate),
        }),
      );
      fixture.detectChanges();
      const created = fixture.nativeElement.querySelector('[data-testid="session-created"]');
      // DatePipe 'medium' format varies by locale, just check it contains the date portion
      expect(created.textContent).not.toContain('Unknown');
      expect(created.textContent).toContain('Jun');
      expect(created.textContent).toContain('15');
      expect(created.textContent).toContain('2024');
    });

    it('should display schedule icon', () => {
      const created = fixture.nativeElement.querySelector('[data-testid="session-created"]');
      const icon = created.querySelector('mat-icon');
      expect(icon.textContent.trim()).toBe('schedule');
    });
  });

  describe('status display', () => {
    it('should display Active status', () => {
      const status = fixture.nativeElement.querySelector('[data-testid="session-status"]');
      expect(status.textContent).toContain('Active');
    });

    it('should display circle icon for status', () => {
      const status = fixture.nativeElement.querySelector('[data-testid="session-status"]');
      const icon = status.querySelector('mat-icon');
      expect(icon.textContent.trim()).toBe('circle');
    });
  });

  describe('selection events', () => {
    it('should emit selected event on click', () => {
      const listItem = fixture.nativeElement.querySelector('mat-list-item');
      listItem.click();
      expect(hostComponent.selectedId).toBe('test-session-12345678-abcd-efgh');
    });

    it('should emit correct session ID when session changes', () => {
      hostComponent.session.set(createTestSession({ id: 'different-id' }));
      fixture.detectChanges();
      const listItem = fixture.nativeElement.querySelector('mat-list-item');
      listItem.click();
      expect(hostComponent.selectedId).toBe('different-id');
    });

    it('should emit selected event on Enter key', () => {
      const listItem = fixture.nativeElement.querySelector('mat-list-item');
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      listItem.dispatchEvent(enterEvent);
      expect(hostComponent.selectedId).toBe('test-session-12345678-abcd-efgh');
    });
  });

  describe('accessibility', () => {
    it('should have tabindex for keyboard navigation', () => {
      const listItem = fixture.nativeElement.querySelector('mat-list-item');
      expect(listItem.getAttribute('tabindex')).toBe('0');
    });

    it('should have data-testid attribute with session ID', () => {
      const listItem = fixture.nativeElement.querySelector('mat-list-item');
      expect(listItem.getAttribute('data-testid')).toBe(
        'session-card-test-session-12345678-abcd-efgh',
      );
    });
  });

  describe('icons', () => {
    it('should display folder_open icon', () => {
      const icon = fixture.nativeElement.querySelector('mat-list-item mat-icon');
      expect(icon.textContent.trim()).toBe('folder_open');
    });

    it('should display chevron_right meta icon', () => {
      const icons = fixture.nativeElement.querySelectorAll('mat-list-item mat-icon');
      const metaIcon = icons[icons.length - 1];
      expect(metaIcon.textContent.trim()).toBe('chevron_right');
    });
  });
});
