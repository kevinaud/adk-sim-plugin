/**
 * @fileoverview Tests for EmptyStateComponent.
 *
 * Tests verify that the component correctly:
 * - Displays the required message
 * - Displays the default 'inbox' icon
 * - Displays custom icons when provided
 * - Displays hint text when provided
 * - Hides hint text when not provided
 *
 * @see frontend/src/app/features/session-list/session-list.component.html (lines 45-52)
 */

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { EmptyStateComponent } from './empty-state.component';

/**
 * Test host component that wraps EmptyStateComponent.
 * This allows us to test input binding behavior.
 */
@Component({
  selector: 'app-test-host',
  standalone: true,
  imports: [EmptyStateComponent],
  template: `<app-empty-state [icon]="icon()" [message]="message()" [hint]="hint()" />`,
})
class TestHostComponent {
  readonly icon = signal<string>('inbox');
  readonly message = signal<string>('No items available');
  readonly hint = signal<string | undefined>(undefined);
}

describe('EmptyStateComponent', () => {
  let hostComponent: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, EmptyStateComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    const emptyState = fixture.nativeElement.querySelector('app-empty-state');
    expect(emptyState).toBeTruthy();
  });

  describe('icon display', () => {
    it('should display the default inbox icon', () => {
      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent.trim()).toBe('inbox');
    });

    it('should display a custom icon', () => {
      hostComponent.icon.set('search_off');
      fixture.detectChanges();
      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent.trim()).toBe('search_off');
    });

    it('should update when icon changes', () => {
      hostComponent.icon.set('folder_off');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('mat-icon').textContent.trim()).toBe('folder_off');

      hostComponent.icon.set('cloud_off');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('mat-icon').textContent.trim()).toBe('cloud_off');
    });

    it('should have large icon size styling', () => {
      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.style.fontSize).toBe('64px');
      expect(icon.style.width).toBe('64px');
      expect(icon.style.height).toBe('64px');
    });
  });

  describe('message display', () => {
    it('should display the message', () => {
      const paragraphs = fixture.nativeElement.querySelectorAll('p');
      expect(paragraphs[0].textContent).toBe('No items available');
    });

    it('should display a custom message', () => {
      hostComponent.message.set('No sessions found');
      fixture.detectChanges();
      const paragraphs = fixture.nativeElement.querySelectorAll('p');
      expect(paragraphs[0].textContent).toBe('No sessions found');
    });

    it('should update when message changes', () => {
      hostComponent.message.set('Empty list');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('p')[0].textContent).toBe('Empty list');

      hostComponent.message.set('Nothing here');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('p')[0].textContent).toBe('Nothing here');
    });

    it('should have message styling classes', () => {
      const message = fixture.nativeElement.querySelectorAll('p')[0];
      expect(message.classList.contains('text-lg')).toBe(true);
      expect(message.classList.contains('text-on-surface-variant')).toBe(true);
    });
  });

  describe('hint display', () => {
    it('should not display hint when not provided', () => {
      const paragraphs = fixture.nativeElement.querySelectorAll('p');
      expect(paragraphs.length).toBe(1);
    });

    it('should display hint when provided', () => {
      hostComponent.hint.set('Items will appear here when added.');
      fixture.detectChanges();
      const paragraphs = fixture.nativeElement.querySelectorAll('p');
      expect(paragraphs.length).toBe(2);
      expect(paragraphs[1].textContent).toBe('Items will appear here when added.');
    });

    it('should have hint styling classes', () => {
      hostComponent.hint.set('Some hint text');
      fixture.detectChanges();
      const hint = fixture.nativeElement.querySelectorAll('p')[1];
      expect(hint.classList.contains('text-sm')).toBe(true);
    });

    it('should hide hint when set back to undefined', () => {
      hostComponent.hint.set('Hint text');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('p').length).toBe(2);

      hostComponent.hint.set(undefined);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('p').length).toBe(1);
    });
  });

  describe('layout', () => {
    it('should have flex container with centered items', () => {
      const container = fixture.nativeElement.querySelector('app-empty-state > div');
      expect(container.classList.contains('flex')).toBe(true);
      expect(container.classList.contains('flex-col')).toBe(true);
      expect(container.classList.contains('items-center')).toBe(true);
      expect(container.classList.contains('justify-center')).toBe(true);
    });

    it('should have gap and padding utilities', () => {
      const container = fixture.nativeElement.querySelector('app-empty-state > div');
      expect(container.classList.contains('gap-2')).toBe(true);
      expect(container.classList.contains('p-12')).toBe(true);
    });
  });
});
