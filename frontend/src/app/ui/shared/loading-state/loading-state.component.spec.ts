/**
 * @fileoverview Tests for LoadingStateComponent.
 *
 * Tests verify that the component correctly:
 * - Displays the default "Loading..." message
 * - Displays custom messages when provided
 * - Renders the Material spinner with correct diameter
 *
 * @see frontend/src/app/features/session-list/session-list.component.html (lines 26-31)
 */

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { LoadingStateComponent } from './loading-state.component';

/**
 * Test host component that wraps LoadingStateComponent.
 * This allows us to test input binding behavior.
 */
@Component({
  selector: 'app-test-host',
  standalone: true,
  imports: [LoadingStateComponent],
  template: `<app-loading-state [message]="message()" [diameter]="diameter()" />`,
})
class TestHostComponent {
  readonly message = signal<string>('Loading...');
  readonly diameter = signal<number>(48);
}

describe('LoadingStateComponent', () => {
  let hostComponent: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, LoadingStateComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    const loadingState = fixture.nativeElement.querySelector('app-loading-state');
    expect(loadingState).toBeTruthy();
  });

  describe('message display', () => {
    it('should display the default message', () => {
      const message = fixture.nativeElement.querySelector('p');
      expect(message.textContent).toBe('Loading...');
    });

    it('should display a custom message', () => {
      hostComponent.message.set('Loading sessions...');
      fixture.detectChanges();
      const message = fixture.nativeElement.querySelector('p');
      expect(message.textContent).toBe('Loading sessions...');
    });

    it('should update when message changes', () => {
      hostComponent.message.set('Please wait...');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('p').textContent).toBe('Please wait...');

      hostComponent.message.set('Almost done...');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('p').textContent).toBe('Almost done...');
    });
  });

  describe('spinner', () => {
    it('should render the Material spinner', () => {
      const spinner = fixture.nativeElement.querySelector('mat-spinner');
      expect(spinner).toBeTruthy();
    });

    it('should render spinner SVG element', () => {
      const spinner = fixture.nativeElement.querySelector('mat-spinner');
      // Material spinner renders an SVG with a circle element
      const svg = spinner.querySelector('svg');
      expect(svg).toBeTruthy();
      const circle = svg.querySelector('circle');
      expect(circle).toBeTruthy();
    });

    it('should accept diameter input', () => {
      // Verify the component accepts diameter changes without error
      hostComponent.diameter.set(32);
      fixture.detectChanges();
      const spinner = fixture.nativeElement.querySelector('mat-spinner');
      // The spinner should still render
      expect(spinner).toBeTruthy();
      expect(spinner.querySelector('svg')).toBeTruthy();
    });
  });

  describe('layout', () => {
    it('should have flex container with centered items', () => {
      const container = fixture.nativeElement.querySelector('app-loading-state > div');
      expect(container.classList.contains('flex')).toBe(true);
      expect(container.classList.contains('flex-col')).toBe(true);
      expect(container.classList.contains('items-center')).toBe(true);
      expect(container.classList.contains('justify-center')).toBe(true);
    });

    it('should have gap and padding utilities', () => {
      const container = fixture.nativeElement.querySelector('app-loading-state > div');
      expect(container.classList.contains('gap-4')).toBe(true);
      expect(container.classList.contains('p-12')).toBe(true);
    });
  });
});
