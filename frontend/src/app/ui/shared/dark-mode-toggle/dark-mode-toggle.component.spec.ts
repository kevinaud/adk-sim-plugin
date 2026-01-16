/**
 * @fileoverview Tests for DarkModeToggleComponent.
 *
 * Tests verify that the component correctly:
 * - Displays appropriate icon based on theme state
 * - Shows correct tooltip based on theme state
 * - Toggles theme when clicked
 * - Has proper accessibility attributes
 *
 * @see mddocs/frontend/sprints/sprint4.md#s4pr4-create-darkmodetogglecomponent
 */

import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { ThemeService } from '../../../util/theme/theme.service';
import { DarkModeToggleComponent } from './dark-mode-toggle.component';

/**
 * Fake ThemeService for testing.
 * Provides controllable isDarkMode signal and trackable toggleTheme calls.
 */
class FakeThemeService {
  private readonly _isDarkMode: WritableSignal<boolean>;
  readonly isDarkMode: ReturnType<WritableSignal<boolean>['asReadonly']>;
  toggleThemeCalls = 0;

  constructor(initialDarkMode = false) {
    this._isDarkMode = signal(initialDarkMode);
    this.isDarkMode = this._isDarkMode.asReadonly();
  }

  toggleTheme(): void {
    this.toggleThemeCalls++;
    this._isDarkMode.update((current) => !current);
  }

  /** Test helper to set dark mode state */
  setDarkMode(isDark: boolean): void {
    this._isDarkMode.set(isDark);
  }
}

describe('DarkModeToggleComponent', () => {
  let component: DarkModeToggleComponent;
  let fixture: ComponentFixture<DarkModeToggleComponent>;
  let fakeThemeService: FakeThemeService;

  beforeEach(async () => {
    fakeThemeService = new FakeThemeService(false);

    await TestBed.configureTestingModule({
      imports: [DarkModeToggleComponent],
      providers: [provideNoopAnimations(), { provide: ThemeService, useValue: fakeThemeService }],
    }).compileComponents();

    fixture = TestBed.createComponent(DarkModeToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  describe('when in light mode', () => {
    beforeEach(() => {
      fakeThemeService.setDarkMode(false);
      fixture.detectChanges();
    });

    it('should display dark_mode icon', () => {
      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent).toContain('dark_mode');
    });

    it('should have label "Switch to dark mode"', () => {
      // Verify label value through component's computed signal (used for tooltip and aria-label)
      expect(component.label()).toBe('Switch to dark mode');
    });

    it('should have aria-label "Switch to dark mode"', () => {
      const button = fixture.nativeElement.querySelector('button');
      expect(button.getAttribute('aria-label')).toBe('Switch to dark mode');
    });
  });

  describe('when in dark mode', () => {
    beforeEach(() => {
      fakeThemeService.setDarkMode(true);
      fixture.detectChanges();
    });

    it('should display light_mode icon', () => {
      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent).toContain('light_mode');
    });

    it('should have label "Switch to light mode"', () => {
      // Verify label value through component's computed signal (used for tooltip and aria-label)
      expect(component.label()).toBe('Switch to light mode');
    });

    it('should have aria-label "Switch to light mode"', () => {
      const button = fixture.nativeElement.querySelector('button');
      expect(button.getAttribute('aria-label')).toBe('Switch to light mode');
    });
  });

  describe('click behavior', () => {
    it('should call toggleTheme when clicked', () => {
      const button = fixture.nativeElement.querySelector('button');
      button.click();

      expect(fakeThemeService.toggleThemeCalls).toBe(1);
    });

    it('should toggle icon after click', () => {
      fakeThemeService.setDarkMode(false);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent).toContain('dark_mode');

      const button = fixture.nativeElement.querySelector('button');
      button.click();
      fixture.detectChanges();

      expect(icon.textContent).toContain('light_mode');
    });
  });

  describe('accessibility', () => {
    it('should have an icon button with aria-label', () => {
      const button = fixture.nativeElement.querySelector('button');
      expect(button).toBeTruthy();
      expect(button.getAttribute('aria-label')).toBeTruthy();
    });

    it('should be keyboard accessible via button element', () => {
      const button = fixture.nativeElement.querySelector('button');
      expect(button.tagName.toLowerCase()).toBe('button');
    });
  });
});
