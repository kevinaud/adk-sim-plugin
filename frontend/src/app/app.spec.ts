import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, vi } from 'vitest';

import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  // Store original implementation
  const originalMatchMedia = globalThis.matchMedia;

  beforeEach(async () => {
    // Mock matchMedia for ThemeService (used by DarkModeToggleComponent)
    const matchMediaMock = vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }));

    Object.defineProperty(globalThis, 'matchMedia', {
      value: matchMediaMock,
      writable: true,
      configurable: true,
    });

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideNoopAnimations()],
    }).compileComponents();
  });

  afterEach(() => {
    // Restore original matchMedia
    Object.defineProperty(globalThis, 'matchMedia', {
      value: originalMatchMedia,
      writable: true,
      configurable: true,
    });
    // Clean up dark-theme class if added
    document.body.classList.remove('dark-theme');
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should have router outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('should have toolbar with app title', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const toolbar = compiled.querySelector('mat-toolbar');
    expect(toolbar).toBeTruthy();
    expect(toolbar?.textContent).toContain('ADK Simulator');
  });

  it('should have dark mode toggle in toolbar', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const toggle = compiled.querySelector('app-dark-mode-toggle');
    expect(toggle).toBeTruthy();
  });
});
