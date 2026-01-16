/**
 * @fileoverview Theme service for dark/light mode state management.
 *
 * Provides reactive state for theme preference using Angular Signals.
 * Supports explicit light/dark selection, system preference detection,
 * and localStorage persistence.
 *
 * @see mddocs/frontend/research/deep-research/material-tailwind-research.md#dark-mode
 */

import { computed, effect, Injectable, signal } from '@angular/core';

/**
 * Theme preference options.
 *
 * - `'light'`: Force light mode
 * - `'dark'`: Force dark mode
 * - `'system'`: Follow system preference (prefers-color-scheme)
 */
export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * localStorage key for persisting theme preference.
 */
const STORAGE_KEY = 'theme-preference';

/**
 * CSS class applied to document.body when dark mode is active.
 */
const DARK_THEME_CLASS = 'dark-theme';

/**
 * Theme service for managing dark/light mode.
 *
 * Features:
 * - Reactive `isDarkMode` signal for consumers
 * - `toggleTheme()` for quick light/dark switching
 * - `setTheme()` for explicit mode selection including system preference
 * - localStorage persistence under 'theme-preference' key
 * - System preference detection via `prefers-color-scheme` media query
 * - Automatic `.dark-theme` class application on document.body
 *
 * @example
 * ```typescript
 * // In a component
 * private readonly theme = inject(ThemeService);
 *
 * // Read dark mode state reactively
 * readonly isDark = this.theme.isDarkMode;
 *
 * // Toggle between light/dark
 * toggle() {
 *   this.theme.toggleTheme();
 * }
 *
 * // Set explicit mode
 * useSystemTheme() {
 *   this.theme.setTheme('system');
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  // ─────────────────────────────────────────────────────────────────────────
  // Private writable signals
  // ─────────────────────────────────────────────────────────────────────────

  private readonly _preference = signal<ThemePreference>(this.loadPreference());
  private readonly _systemPrefersDark = signal<boolean>(this.detectSystemPreference());

  // ─────────────────────────────────────────────────────────────────────────
  // Public readonly signals
  // ─────────────────────────────────────────────────────────────────────────

  /** Current theme preference (light, dark, or system). */
  readonly preference = this._preference.asReadonly();

  /**
   * Whether dark mode is currently active.
   *
   * Computed based on preference:
   * - `'dark'`: always true
   * - `'light'`: always false
   * - `'system'`: follows system preference
   */
  readonly isDarkMode = computed(() => {
    const pref = this._preference();
    if (pref === 'dark') return true;
    if (pref === 'light') return false;
    return this._systemPrefersDark();
  });

  constructor() {
    // Set up system preference listener
    this.setupSystemPreferenceListener();

    // Effect to apply/remove dark-theme class reactively
    effect(() => {
      const isDark = this.isDarkMode();
      document.body.classList.toggle(DARK_THEME_CLASS, isDark);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Toggle between light and dark modes.
   *
   * If currently in system mode, this will switch to the opposite
   * of what the system preference currently is.
   */
  toggleTheme(): void {
    const currentlyDark = this.isDarkMode();
    this.setTheme(currentlyDark ? 'light' : 'dark');
  }

  /**
   * Set the theme preference explicitly.
   *
   * @param mode - The theme mode to set
   */
  setTheme(mode: ThemePreference): void {
    this._preference.set(mode);
    this.persistPreference(mode);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Load theme preference from localStorage.
   * Falls back to 'system' if no preference is stored.
   */
  private loadPreference(): ThemePreference {
    if (typeof localStorage === 'undefined') {
      return 'system';
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  }

  /**
   * Persist theme preference to localStorage.
   */
  private persistPreference(mode: ThemePreference): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  }

  /**
   * Detect system color scheme preference.
   */
  private detectSystemPreference(): boolean {
    return globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /**
   * Set up listener for system preference changes.
   */
  private setupSystemPreferenceListener(): void {
    const mediaQuery = globalThis.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (event) => {
      this._systemPrefersDark.set(event.matches);
    });
  }
}
