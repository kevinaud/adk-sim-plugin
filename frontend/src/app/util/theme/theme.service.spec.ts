import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeService, type ThemePreference } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let localStorageStore: Record<string, string>;
  let mediaQueryListeners: Array<(event: { matches: boolean }) => void>;
  let matchMediaMatches: boolean;

  // Store original implementations
  const originalLocalStorage = globalThis.localStorage;
  const originalMatchMedia = globalThis.matchMedia;

  beforeEach(() => {
    // Reset storage mock
    localStorageStore = {};

    // Create localStorage mock
    const localStorageMock = {
      getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageStore[key];
      }),
      clear: vi.fn(() => {
        localStorageStore = {};
      }),
      length: 0,
      key: vi.fn(() => null),
    };

    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });

    // Reset matchMedia mock
    mediaQueryListeners = [];
    matchMediaMatches = false;

    const matchMediaMock = vi.fn((query: string) => ({
      matches: matchMediaMatches,
      media: query,
      onchange: null,
      addEventListener: (_event: string, listener: (event: { matches: boolean }) => void) => {
        mediaQueryListeners.push(listener);
      },
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

    // Also set on window for compatibility
    Object.defineProperty(window, 'matchMedia', {
      value: matchMediaMock,
      writable: true,
      configurable: true,
    });

    // Clean up document.body classes
    document.body.classList.remove('dark-theme');
  });

  afterEach(() => {
    // Restore original implementations
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'matchMedia', {
      value: originalMatchMedia,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'matchMedia', {
      value: originalMatchMedia,
      writable: true,
      configurable: true,
    });

    document.body.classList.remove('dark-theme');
  });

  function createService(): ThemeService {
    TestBed.configureTestingModule({});
    return TestBed.inject(ThemeService);
  }

  describe('initialization', () => {
    it('should be created', () => {
      service = createService();
      expect(service).toBeTruthy();
    });

    it('should default to system preference when no localStorage value', () => {
      service = createService();
      expect(service.preference()).toBe('system');
    });

    it('should read stored preference from localStorage', () => {
      localStorageStore['theme-preference'] = 'dark';
      service = createService();
      expect(service.preference()).toBe('dark');
    });

    it('should handle invalid localStorage values by defaulting to system', () => {
      localStorageStore['theme-preference'] = 'invalid-value';
      service = createService();
      expect(service.preference()).toBe('system');
    });
  });

  describe('isDarkMode computed signal', () => {
    it('should return true when preference is dark', () => {
      localStorageStore['theme-preference'] = 'dark';
      service = createService();
      expect(service.isDarkMode()).toBe(true);
    });

    it('should return false when preference is light', () => {
      localStorageStore['theme-preference'] = 'light';
      service = createService();
      expect(service.isDarkMode()).toBe(false);
    });

    it('should follow system preference when preference is system and system is dark', () => {
      matchMediaMatches = true;
      service = createService();
      expect(service.preference()).toBe('system');
      expect(service.isDarkMode()).toBe(true);
    });

    it('should follow system preference when preference is system and system is light', () => {
      matchMediaMatches = false;
      service = createService();
      expect(service.preference()).toBe('system');
      expect(service.isDarkMode()).toBe(false);
    });
  });

  describe('setTheme', () => {
    beforeEach(() => {
      service = createService();
    });

    it('should set preference to light', () => {
      service.setTheme('light');
      expect(service.preference()).toBe('light');
      expect(service.isDarkMode()).toBe(false);
    });

    it('should set preference to dark', () => {
      service.setTheme('dark');
      expect(service.preference()).toBe('dark');
      expect(service.isDarkMode()).toBe(true);
    });

    it('should set preference to system', () => {
      service.setTheme('dark');
      service.setTheme('system');
      expect(service.preference()).toBe('system');
    });

    it('should persist preference to localStorage', () => {
      service.setTheme('dark');
      expect(localStorageStore['theme-preference']).toBe('dark');

      service.setTheme('light');
      expect(localStorageStore['theme-preference']).toBe('light');

      service.setTheme('system');
      expect(localStorageStore['theme-preference']).toBe('system');
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from light to dark', () => {
      localStorageStore['theme-preference'] = 'light';
      service = createService();

      service.toggleTheme();

      expect(service.preference()).toBe('dark');
      expect(service.isDarkMode()).toBe(true);
    });

    it('should toggle from dark to light', () => {
      localStorageStore['theme-preference'] = 'dark';
      service = createService();

      service.toggleTheme();

      expect(service.preference()).toBe('light');
      expect(service.isDarkMode()).toBe(false);
    });

    it('should toggle to light when system preference is dark', () => {
      matchMediaMatches = true;
      service = createService();

      expect(service.preference()).toBe('system');
      expect(service.isDarkMode()).toBe(true);

      service.toggleTheme();

      expect(service.preference()).toBe('light');
      expect(service.isDarkMode()).toBe(false);
    });

    it('should toggle to dark when system preference is light', () => {
      matchMediaMatches = false;
      service = createService();

      expect(service.preference()).toBe('system');
      expect(service.isDarkMode()).toBe(false);

      service.toggleTheme();

      expect(service.preference()).toBe('dark');
      expect(service.isDarkMode()).toBe(true);
    });
  });

  describe('document.body class management', () => {
    it('should add dark-theme class when dark mode is active', () => {
      localStorageStore['theme-preference'] = 'dark';
      service = createService();

      // Run effects
      TestBed.flushEffects();

      expect(document.body.classList.contains('dark-theme')).toBe(true);
    });

    it('should not add dark-theme class when light mode is active', () => {
      localStorageStore['theme-preference'] = 'light';
      service = createService();

      // Run effects
      TestBed.flushEffects();

      expect(document.body.classList.contains('dark-theme')).toBe(false);
    });

    it('should remove dark-theme class when switching from dark to light', () => {
      localStorageStore['theme-preference'] = 'dark';
      service = createService();
      TestBed.flushEffects();

      expect(document.body.classList.contains('dark-theme')).toBe(true);

      service.setTheme('light');
      TestBed.flushEffects();

      expect(document.body.classList.contains('dark-theme')).toBe(false);
    });

    it('should add dark-theme class when switching from light to dark', () => {
      localStorageStore['theme-preference'] = 'light';
      service = createService();
      TestBed.flushEffects();

      expect(document.body.classList.contains('dark-theme')).toBe(false);

      service.setTheme('dark');
      TestBed.flushEffects();

      expect(document.body.classList.contains('dark-theme')).toBe(true);
    });
  });

  describe('system preference change listener', () => {
    it('should update isDarkMode when system preference changes to dark', () => {
      matchMediaMatches = false;
      service = createService();

      expect(service.isDarkMode()).toBe(false);

      // Simulate system preference change
      mediaQueryListeners.forEach((listener) => {
        listener({ matches: true });
      });

      expect(service.isDarkMode()).toBe(true);
    });

    it('should update isDarkMode when system preference changes to light', () => {
      matchMediaMatches = true;
      service = createService();

      expect(service.isDarkMode()).toBe(true);

      // Simulate system preference change
      mediaQueryListeners.forEach((listener) => {
        listener({ matches: false });
      });

      expect(service.isDarkMode()).toBe(false);
    });

    it('should not affect isDarkMode when explicit preference is set', () => {
      matchMediaMatches = false;
      localStorageStore['theme-preference'] = 'dark';
      service = createService();

      expect(service.isDarkMode()).toBe(true);

      // Simulate system preference change - should have no effect
      mediaQueryListeners.forEach((listener) => {
        listener({ matches: false });
      });

      // Still dark because explicit preference overrides system
      expect(service.isDarkMode()).toBe(true);
    });
  });

  describe('localStorage persistence', () => {
    it('should save theme preference when setTheme is called', () => {
      service = createService();

      service.setTheme('dark');
      expect(localStorage.setItem).toHaveBeenCalledWith('theme-preference', 'dark');

      service.setTheme('light');
      expect(localStorage.setItem).toHaveBeenCalledWith('theme-preference', 'light');
    });

    it('should load saved preference on service creation', () => {
      localStorageStore['theme-preference'] = 'dark';
      service = createService();

      expect(localStorage.getItem).toHaveBeenCalledWith('theme-preference');
      expect(service.preference()).toBe('dark');
    });
  });

  describe('edge cases', () => {
    it('should handle multiple rapid toggles', () => {
      service = createService();

      service.toggleTheme();
      service.toggleTheme();
      service.toggleTheme();

      // Started at system (light), toggle to dark, light, dark
      expect(service.preference()).toBe('dark');
      expect(service.isDarkMode()).toBe(true);
    });

    it('should handle setting same theme multiple times', () => {
      service = createService();

      service.setTheme('dark');
      service.setTheme('dark');
      service.setTheme('dark');

      expect(service.preference()).toBe('dark');
      expect(localStorageStore['theme-preference']).toBe('dark');
    });
  });
});
