/**
 * @fileoverview Playwright component test bootstrap file.
 *
 * Sets up the Angular testing environment for Playwright component tests.
 * Imports global styles and configures TestBed providers.
 *
 * @see mddocs/frontend/research/playwright-testing-research.md
 */

import 'zone.js';
import '../src/styles.scss';

import { provideHttpClient } from '@angular/common/http';
import { beforeMount } from '@sand4rt/experimental-ct-angular/hooks';

/**
 * Hook configuration for component tests.
 * Allows tests to opt-in to specific providers.
 */
export interface HooksConfig {
  /** Enable HttpClient provider for components that make HTTP requests */
  withHttp?: boolean;
}

beforeMount<HooksConfig>(({ hooksConfig, TestBed }) => {
  const providers = [];

  if (hooksConfig?.withHttp) {
    providers.push(provideHttpClient());
  }

  if (providers.length > 0) {
    TestBed.configureTestingModule({ providers });
  }
});
