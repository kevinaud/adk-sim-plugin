/**
 * @fileoverview Custom Playwright fixture for theme (light/dark mode) testing.
 *
 * This fixture automatically applies the `.dark-theme` class to the document body
 * when running tests with the dark theme project, enabling automatic visual
 * regression testing in both light and dark modes without duplicating test code.
 *
 * The theme is determined by project metadata set in playwright-ct.config.ts.
 *
 * @example
 * // In playwright-ct.config.ts projects:
 * { name: 'chromium-light', metadata: { theme: 'light' }, ... }
 * { name: 'chromium-dark', metadata: { theme: 'dark' }, ... }
 */

import { test as base } from '@sand4rt/experimental-ct-angular';

/**
 * Extended test fixture that applies theme class based on project configuration.
 *
 * Before each test:
 * - If theme is 'dark', adds `.dark-theme` class to document.body
 * - If theme is 'light' (or not specified), ensures no `.dark-theme` class is present
 *
 * This enables all component tests to automatically run in both themes without
 * any changes to individual test files.
 */
export const test = base.extend({
  /**
   * Automatically apply theme class before each test based on project metadata.
   */
  page: async ({ page }, use, testInfo) => {
    // Get theme from project metadata (defaults to 'light')
    const theme = (testInfo.project.metadata as { theme?: string })?.theme ?? 'light';

    // Apply theme class immediately when page loads using addInitScript
    // This ensures the class is present before any component rendering
    await page.addInitScript((themeValue: string) => {
      // Apply theme as soon as possible
      const applyTheme = () => {
        if (themeValue === 'dark') {
          document.body.classList.add('dark-theme');
        } else {
          document.body.classList.remove('dark-theme');
        }
      };

      // Apply immediately if body exists, otherwise wait
      if (document.body) {
        applyTheme();
      }

      // Also apply on DOMContentLoaded to ensure it's set
      document.addEventListener('DOMContentLoaded', applyTheme);

      // Use MutationObserver to ensure class persists even if body is replaced
      const observer = new MutationObserver(() => {
        if (document.body && !document.body.classList.contains('dark-theme') && themeValue === 'dark') {
          document.body.classList.add('dark-theme');
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }, theme);

    // Also apply via page.evaluate as a fallback (after page navigation in CT)
    await page.evaluate((themeValue) => {
      if (themeValue === 'dark') {
        document.body.classList.add('dark-theme');
      } else {
        document.body.classList.remove('dark-theme');
      }
    }, theme);

    // Use the page with theme applied
    await use(page);
  },
});

// Re-export expect for convenience
export { expect } from '@sand4rt/experimental-ct-angular';
