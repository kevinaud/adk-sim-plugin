/**
 * @fileoverview Tests for ErrorBannerComponent.
 *
 * Tests verify that the component correctly:
 * - Displays the error message
 * - Shows the default warning icon
 * - Shows custom icons when provided
 * - Emits dismissed event when dismiss button is clicked
 */

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { ErrorBannerComponent } from './error-banner.component';

/**
 * Test host component that wraps ErrorBannerComponent.
 * This allows us to test input binding and output event behavior.
 */
@Component({
  selector: 'app-test-host',
  standalone: true,
  imports: [ErrorBannerComponent],
  template: `<app-error-banner [message]="message()" [icon]="icon()" (dismissed)="onDismiss()" />`,
})
class TestHostComponent {
  readonly message = signal<string>('Test error message');
  readonly icon = signal<string>('warning');
  dismissedCount = 0;

  onDismiss(): void {
    this.dismissedCount++;
  }
}

describe('ErrorBannerComponent', () => {
  let hostComponent: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, ErrorBannerComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    const errorBanner = fixture.nativeElement.querySelector('app-error-banner');
    expect(errorBanner).toBeTruthy();
  });

  describe('message display', () => {
    it('should display the error message', () => {
      const message = fixture.nativeElement.querySelector('[data-testid="error-banner-message"]');
      expect(message.textContent).toBe('Test error message');
    });

    it('should update message when input changes', () => {
      hostComponent.message.set('Updated error message');
      fixture.detectChanges();

      const message = fixture.nativeElement.querySelector('[data-testid="error-banner-message"]');
      expect(message.textContent).toBe('Updated error message');
    });
  });

  describe('icon display', () => {
    it('should display the default warning icon', () => {
      const icon = fixture.nativeElement.querySelector('[data-testid="error-banner-icon"]');
      expect(icon.textContent).toContain('warning');
    });

    it('should display custom icon when provided', () => {
      hostComponent.icon.set('error');
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('[data-testid="error-banner-icon"]');
      expect(icon.textContent).toContain('error');
    });

    it('should display info icon when set', () => {
      hostComponent.icon.set('info');
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('[data-testid="error-banner-icon"]');
      expect(icon.textContent).toContain('info');
    });
  });

  describe('dismiss functionality', () => {
    it('should have a dismiss button', () => {
      const dismissButton = fixture.nativeElement.querySelector(
        '[data-testid="error-banner-dismiss"]',
      );
      expect(dismissButton).toBeTruthy();
    });

    it('should emit dismissed event when dismiss button is clicked', () => {
      const dismissButton = fixture.nativeElement.querySelector(
        '[data-testid="error-banner-dismiss"]',
      ) as HTMLButtonElement;

      expect(hostComponent.dismissedCount).toBe(0);
      dismissButton.click();
      expect(hostComponent.dismissedCount).toBe(1);
    });

    it('should emit multiple times on multiple clicks', () => {
      const dismissButton = fixture.nativeElement.querySelector(
        '[data-testid="error-banner-dismiss"]',
      ) as HTMLButtonElement;

      dismissButton.click();
      dismissButton.click();
      dismissButton.click();

      expect(hostComponent.dismissedCount).toBe(3);
    });

    it('should have accessible aria-label on dismiss button', () => {
      const dismissButton = fixture.nativeElement.querySelector(
        '[data-testid="error-banner-dismiss"]',
      );
      expect(dismissButton.getAttribute('aria-label')).toBe('Dismiss error');
    });
  });

  describe('styling', () => {
    it('should have error-banner data-testid on container', () => {
      const container = fixture.nativeElement.querySelector('[data-testid="error-banner"]');
      expect(container).toBeTruthy();
    });

    it('should have close icon in dismiss button', () => {
      const dismissButton = fixture.nativeElement.querySelector(
        '[data-testid="error-banner-dismiss"]',
      );
      const icon = dismissButton.querySelector('mat-icon');
      expect(icon.textContent).toContain('close');
    });
  });
});
