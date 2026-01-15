/**
 * @fileoverview Tests for ErrorStateComponent.
 *
 * Tests verify that the component correctly:
 * - Displays the required message
 * - Displays the default 'error_outline' icon
 * - Displays custom icons when provided
 * - Emits retry event when button is clicked
 * - Displays custom retry label when provided
 *
 * @see frontend/src/app/features/session-list/session-list.component.html (lines 33-43)
 */

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { ErrorStateComponent } from './error-state.component';

/**
 * Test host component that wraps ErrorStateComponent.
 * This allows us to test input binding behavior and output events.
 */
@Component({
  selector: 'app-test-host',
  standalone: true,
  imports: [ErrorStateComponent],
  template: `<app-error-state
    [icon]="icon()"
    [message]="message()"
    [retryLabel]="retryLabel()"
    (retry)="onRetry()"
  />`,
})
class TestHostComponent {
  readonly icon = signal<string>('error_outline');
  readonly message = signal<string>('An error occurred');
  readonly retryLabel = signal<string>('Retry');
  retryCount = 0;

  onRetry(): void {
    this.retryCount++;
  }
}

describe('ErrorStateComponent', () => {
  let hostComponent: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, ErrorStateComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    const errorState = fixture.nativeElement.querySelector('app-error-state');
    expect(errorState).toBeTruthy();
  });

  describe('icon display', () => {
    it('should display the default error_outline icon', () => {
      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent.trim()).toBe('error_outline');
    });

    it('should display a custom icon', () => {
      hostComponent.icon.set('cloud_off');
      fixture.detectChanges();
      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent.trim()).toBe('cloud_off');
    });

    it('should update when icon changes', () => {
      hostComponent.icon.set('wifi_off');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('mat-icon').textContent.trim()).toBe('wifi_off');

      hostComponent.icon.set('error');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('mat-icon').textContent.trim()).toBe('error');
    });

    it('should have large icon size styling', () => {
      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.style.fontSize).toBe('48px');
      expect(icon.style.width).toBe('48px');
      expect(icon.style.height).toBe('48px');
    });

    it('should have error color styling', () => {
      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.classList.contains('text-error')).toBe(true);
    });
  });

  describe('message display', () => {
    it('should display the message', () => {
      const message = fixture.nativeElement.querySelector('p');
      expect(message.textContent).toBe('An error occurred');
    });

    it('should display a custom message', () => {
      hostComponent.message.set('Failed to load sessions');
      fixture.detectChanges();
      const message = fixture.nativeElement.querySelector('p');
      expect(message.textContent).toBe('Failed to load sessions');
    });

    it('should update when message changes', () => {
      hostComponent.message.set('Connection failed');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('p').textContent).toBe('Connection failed');

      hostComponent.message.set('Server error');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('p').textContent).toBe('Server error');
    });

    it('should have error message styling classes', () => {
      const message = fixture.nativeElement.querySelector('p');
      expect(message.classList.contains('text-error')).toBe(true);
      expect(message.classList.contains('text-center')).toBe(true);
    });
  });

  describe('retry button', () => {
    it('should display the retry button', () => {
      const button = fixture.nativeElement.querySelector('button');
      expect(button).toBeTruthy();
    });

    it('should display default retry label', () => {
      const button = fixture.nativeElement.querySelector('button');
      expect(button.textContent).toContain('Retry');
    });

    it('should display custom retry label', () => {
      hostComponent.retryLabel.set('Try Again');
      fixture.detectChanges();
      const button = fixture.nativeElement.querySelector('button');
      expect(button.textContent).toContain('Try Again');
    });

    it('should display refresh icon in button', () => {
      const buttonIcon = fixture.nativeElement.querySelector('button mat-icon');
      expect(buttonIcon.textContent.trim()).toBe('refresh');
    });

    it('should emit retry event when clicked', () => {
      expect(hostComponent.retryCount).toBe(0);

      const button = fixture.nativeElement.querySelector('button');
      button.click();
      fixture.detectChanges();

      expect(hostComponent.retryCount).toBe(1);
    });

    it('should emit retry event multiple times', () => {
      const button = fixture.nativeElement.querySelector('button');

      button.click();
      button.click();
      button.click();
      fixture.detectChanges();

      expect(hostComponent.retryCount).toBe(3);
    });

    it('should be a raised button with primary color', () => {
      const button = fixture.nativeElement.querySelector('button');
      expect(button.classList.contains('mat-mdc-raised-button')).toBe(true);
    });
  });

  describe('layout', () => {
    it('should have flex container with centered items', () => {
      const container = fixture.nativeElement.querySelector('app-error-state > div');
      expect(container.classList.contains('flex')).toBe(true);
      expect(container.classList.contains('flex-col')).toBe(true);
      expect(container.classList.contains('items-center')).toBe(true);
      expect(container.classList.contains('justify-center')).toBe(true);
    });

    it('should have gap and padding utilities', () => {
      const container = fixture.nativeElement.querySelector('app-error-state > div');
      expect(container.classList.contains('gap-4')).toBe(true);
      expect(container.classList.contains('p-12')).toBe(true);
    });
  });
});
