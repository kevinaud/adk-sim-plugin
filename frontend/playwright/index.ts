/**
 * @fileoverview Playwright Component Testing bootstrap file.
 *
 * This file is loaded before each component test and configures
 * the Angular TestBed with necessary providers.
 *
 * @see mddocs/frontend/research/playwright-testing-research.md
 */

// Zone.js is required for Angular's change detection - must be imported first
import 'zone.js';
// Import testing modules to ensure they're bundled
import '@angular/core/testing';
import '@angular/platform-browser-dynamic/testing';

import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { beforeMount } from '@sand4rt/experimental-ct-angular/hooks';

/**
 * Configuration options passed to component tests via hooksConfig.
 *
 * @example
 * ```ts
 * const component = await mount(MyComponent, {
 *   hooksConfig: { enableAnimations: true },
 *   props: { ... },
 * });
 * ```
 */
export type HooksConfig = {
  /** Enable async animations (required for Material components) */
  enableAnimations?: boolean;
};

/**
 * Configure TestBed before each component mount.
 *
 * By default, provides async animations support which is required
 * for Angular Material components to render correctly.
 */
beforeMount<HooksConfig>(async ({ hooksConfig, TestBed }) => {
  const providers = [];

  // Always provide animations async unless explicitly disabled
  // This is needed for Angular Material icons and other Material components
  if (hooksConfig?.enableAnimations !== false) {
    providers.push(provideAnimationsAsync());
  }

  if (providers.length > 0) {
    TestBed.configureTestingModule({ providers });
  }
});
