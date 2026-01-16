/**
 * @fileoverview Playwright Component Testing bootstrap file.
 *
 * This file is loaded before each component test and configures
 * the Angular TestBed with necessary providers.
 *
 * Uses zoneless Angular (default in Angular 21+) - no zone.js required.
 *
 * @see mddocs/frontend/research/playwright-testing-research.md
 */

// Note: Tailwind CSS is loaded via <link> tag in index.html
// This ensures Vite processes it correctly with @tailwindcss/vite

// Import testing modules to ensure they're bundled
import '@angular/core/testing';
import '@angular/platform-browser-dynamic/testing';

// Force JSONForms and related components to be included in the bundle.
// Rollup tree-shakes these out because JSONForms declares "sideEffects": false.
// By explicitly importing and referencing them, we create a side effect Rollup must respect.
// @see mddocs/frontend/research/deep-research/json-forms-ct-testing-findings-2.md
import { FinalResponseComponent } from '../src/app/ui/control-panel/final-response/final-response.component';
import { ToolFormComponent } from '../src/app/ui/control-panel/tool-form/tool-form.component';
import { JsonFormsModule } from '@jsonforms/angular';
import { angularMaterialRenderers } from '@jsonforms/angular-material';

// Console.log creates a side effect that forces Rollup to include the imports
console.log('[Playwright CT] Pre-loading JSONForms components:', {
  FinalResponseComponent,
  ToolFormComponent,
  JsonFormsModule,
  renderersCount: angularMaterialRenderers.length,
});

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
