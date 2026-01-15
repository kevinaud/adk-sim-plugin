/**
 * @fileoverview Tests for ConnectionStatusComponent.
 *
 * Tests verify that the component correctly:
 * - Displays "Connected" state with green icon
 * - Displays "Connecting" state with orange spinning icon
 * - Displays "Disconnected" state with red icon
 *
 * @see mddocs/frontend/frontend-spec.md#fr-communication - FR-023
 */

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { ConnectionStatusComponent, type ConnectionStatus } from './connection-status.component';

/**
 * Test host component that wraps ConnectionStatusComponent.
 * This allows us to test input binding behavior.
 */
@Component({
  selector: 'app-test-host',
  standalone: true,
  imports: [ConnectionStatusComponent],
  template: `<app-connection-status [status]="status()" />`,
})
class TestHostComponent {
  readonly status = signal<ConnectionStatus>('disconnected');
}

describe('ConnectionStatusComponent', () => {
  let hostComponent: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, ConnectionStatusComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    const connectionStatus = fixture.nativeElement.querySelector('app-connection-status');
    expect(connectionStatus).toBeTruthy();
  });

  describe('connected state', () => {
    beforeEach(() => {
      hostComponent.status.set('connected');
      fixture.detectChanges();
    });

    it('should display "Connected" label', () => {
      const label = fixture.nativeElement.querySelector('[data-testid="connection-status-label"]');
      expect(label.textContent).toBe('Connected');
    });

    it('should display check_circle icon', () => {
      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent).toContain('check_circle');
    });

    it('should have connected CSS class', () => {
      const container = fixture.nativeElement.querySelector(
        '[data-testid="connection-status-connected"]',
      );
      expect(container).toBeTruthy();
    });

    it('should not have spinning animation', () => {
      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.classList.contains('spinning')).toBe(false);
    });
  });

  describe('connecting state', () => {
    beforeEach(() => {
      hostComponent.status.set('connecting');
      fixture.detectChanges();
    });

    it('should display "Connecting" label', () => {
      const label = fixture.nativeElement.querySelector('[data-testid="connection-status-label"]');
      expect(label.textContent).toBe('Connecting');
    });

    it('should display sync icon', () => {
      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent).toContain('sync');
    });

    it('should have connecting CSS class', () => {
      const container = fixture.nativeElement.querySelector(
        '[data-testid="connection-status-connecting"]',
      );
      expect(container).toBeTruthy();
    });

    it('should have spinning animation', () => {
      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.classList.contains('spinning')).toBe(true);
    });
  });

  describe('disconnected state', () => {
    beforeEach(() => {
      hostComponent.status.set('disconnected');
      fixture.detectChanges();
    });

    it('should display "Disconnected" label', () => {
      const label = fixture.nativeElement.querySelector('[data-testid="connection-status-label"]');
      expect(label.textContent).toBe('Disconnected');
    });

    it('should display error icon', () => {
      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent).toContain('error');
    });

    it('should have disconnected CSS class', () => {
      const container = fixture.nativeElement.querySelector(
        '[data-testid="connection-status-disconnected"]',
      );
      expect(container).toBeTruthy();
    });

    it('should not have spinning animation', () => {
      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.classList.contains('spinning')).toBe(false);
    });
  });

  describe('state transitions', () => {
    it('should update when connection status changes', () => {
      const labelSelector = '[data-testid="connection-status-label"]';

      // Start disconnected
      hostComponent.status.set('disconnected');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector(labelSelector).textContent).toBe('Disconnected');

      // Transition to connecting
      hostComponent.status.set('connecting');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector(labelSelector).textContent).toBe('Connecting');

      // Transition to connected
      hostComponent.status.set('connected');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector(labelSelector).textContent).toBe('Connected');
    });
  });
});
