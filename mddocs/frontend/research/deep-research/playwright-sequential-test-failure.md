# Playwright Sequential Test Failure Investigation


## Table of Contents

- [Executive Summary](#executive-summary)
- [Problem Description](#problem-description)
  - [Observed Behavior](#observed-behavior)
  - [Key Observations](#key-observations)
- [Test Setup](#test-setup)
  - [Test File Structure](#test-file-structure)
  - [Playwright Configuration](#playwright-configuration)
  - [Global Setup (Docker Backend)](#global-setup-docker-backend)
- [Environment Details](#environment-details)
- [Technology Context](#technology-context)
  - [Angular 21 Changes](#angular-21-changes)
  - [Playwright Test Isolation Model](#playwright-test-isolation-model)
  - [Expected Behavior](#expected-behavior)
- [Hypotheses](#hypotheses)
  - [Hypothesis 1: Angular Dev Server State Corruption](#hypothesis-1-angular-dev-server-state-corruption)
  - [Hypothesis 2: Vite WebSocket Connection Interference](#hypothesis-2-vite-websocket-connection-interference)
  - [Hypothesis 3: Browser Context Not Fully Isolated](#hypothesis-3-browser-context-not-fully-isolated)
  - [Hypothesis 4: Port/Connection Exhaustion](#hypothesis-4-portconnection-exhaustion)
  - [Hypothesis 5: Angular Lazy Loading Race Condition](#hypothesis-5-angular-lazy-loading-race-condition)
  - [Hypothesis 6: Docker Backend State](#hypothesis-6-docker-backend-state)
  - [Hypothesis 7: Hidden Element Due to CSS/Visibility](#hypothesis-7-hidden-element-due-to-cssvisibility)
- [Questions for Investigation](#questions-for-investigation)
- [Diagnostic Code to Try](#diagnostic-code-to-try)
  - [Add More Debugging to beforeEach](#add-more-debugging-to-beforeeach)
  - [Test with Manual Browser Management](#test-with-manual-browser-management)
  - [Test Without HMR](#test-without-hmr)
- [Files for Reference](#files-for-reference)
- [Successful Test Output (Test 1)](#successful-test-output-test-1)
- [Failed Test Output (Test 2)](#failed-test-output-test-2)
- [Desired Outcome](#desired-outcome)

**Date**: January 12, 2026
**Status**: Open - Need Deep Research
**Related**: [Playwright E2E Blocking Investigation](./playwright-e2e-blocking-investigation.md)
**Author**: Sprint Orchestrator Agent

---

## Executive Summary

After resolving the initial Playwright startup blocking issues (Angular CLI analytics prompt, IPv6/IPv4 mismatch), we now face a **new failure mode**: the **first test in a test suite passes**, but **all subsequent tests fail** with elements not found, even though:

1. Tests use `test.beforeEach()` to navigate fresh to the page
2. Tests run serially with `workers: 1`
3. The webServer stays running between tests
4. Each test gets a fresh browser context (Playwright default)

This document provides context for investigating why multiple tests cannot run sequentially in this Playwright + Angular 21 + Docker backend configuration.

---

## Problem Description

### Observed Behavior

```
Running 5 tests using 1 worker

✓ [chromium] › session-list.spec.ts:37:7 › Session List › loads the application (PASSES)
✗ [chromium] › session-list.spec.ts:51:7 › Session List › displays the session list view (FAILS)
✗ [chromium] › session-list.spec.ts:60:7 › Session List › shows loading or content state (FAILS)
✗ [chromium] › session-list.spec.ts:80:7 › Session List › has connection status indicator (FAILS)
✗ [chromium] › session-list.spec.ts:86:7 › Session List › page structure is correct (FAILS)

1 passed, 4 failed
```

### Key Observations

1. **First test always passes**: The initial test successfully loads the Angular app, waits for bootstrap, and passes assertions.

2. **Subsequent tests fail immediately**: Tests 2-5 fail with "element(s) not found" errors, suggesting the page is blank or not loading.

3. **Screenshots are identical**: All failure screenshots are exactly 4254 bytes - likely identical blank pages.

4. **`app-root` is "hidden"**: In one failure, Playwright found `app-root` but reported it as `hidden`:
   ```
   Locator: locator('app-root')
   Expected: visible
   Received: hidden
   Timeout: 10000ms

   Call log:
     - waiting for locator('app-root')
       14 × locator resolved to <app-root ng-version="21.0.8">…</app-root>
          - unexpected value "hidden"
   ```

5. **`beforeEach` executes but page is blank**: Each test calls `page.goto('/')` in `beforeEach`, and `waitForAngularApp()` passes, but subsequent locators find nothing.

---

## Test Setup

### Test File Structure

```typescript
import { expect, test } from '@playwright/test';

async function waitForAngularApp(page) {
  await page.waitForFunction(
    () => {
      const appRoot = document.querySelector('app-root');
      return appRoot && appRoot.innerHTML.trim().length > 10;
    },
    { timeout: 45000 }
  );
  await page.waitForTimeout(500);
}

test.describe('Session List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAngularApp(page);
  });

  test('loads the application', async ({ page }) => {
    // PASSES - URL contains 127.0.0.1
    expect(page.url()).toContain('127.0.0.1');
  });

  test('displays the session list view', async ({ page }) => {
    // FAILS - mat-card not found
    await expect(page.locator('mat-card').first()).toBeVisible({ timeout: 30000 });
  });

  // ... more tests that all fail
});
```

### Playwright Configuration

```typescript
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,

  use: {
    baseURL: 'http://127.0.0.1:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  globalSetup: process.env['CI'] ? undefined : './tests/e2e/global-setup.ts',
  globalTeardown: process.env['CI'] ? undefined : './tests/e2e/global-teardown.ts',

  webServer: {
    command: 'NG_CLI_ANALYTICS=false npx ng serve --host 127.0.0.1 --port 4200 --allowed-hosts=all',
    url: 'http://127.0.0.1:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
```

### Global Setup (Docker Backend)

```typescript
export default async function globalSetup() {
  const repoRoot = resolve(__dirname, '../../..');
  execSync('docker compose -f docker-compose.e2e.yaml up -d --wait', {
    stdio: 'inherit',
    cwd: repoRoot,
  });
}
```

---

## Environment Details

| Component | Version |
|-----------|---------|
| Playwright | 1.52.0 |
| Angular | 21.0.0 |
| Node.js | 20.19.2 |
| npm | 9.2.0 |
| OS | Debian 13 (trixie) in VS Code Dev Container |
| Browser | Chromium (bundled with Playwright) |

---

## Technology Context

### Angular 21 Changes

- Uses **Vite** as the development server (not Webpack)
- **Esbuild** for compilation
- **Zoneless** change detection available (though this project uses Zone.js)
- Standalone components by default
- Lazy loading via `@defer` and dynamic imports

### Playwright Test Isolation Model

Per Playwright documentation:
- Each test gets a **fresh browser context** (cookies, localStorage cleared)
- The **page fixture** creates a new page in that context
- Tests in the same file run in order with `workers: 1`
- `beforeEach` runs before each test with the fresh page

### Expected Behavior

With `workers: 1` and `test.beforeEach`:
1. Test 1: New context → new page → goto('/') → run test → close
2. Test 2: New context → new page → goto('/') → run test → close
3. etc.

Each test should see a fresh page load of the Angular app.

---

## Hypotheses

### Hypothesis 1: Angular Dev Server State Corruption

The Vite-based Angular dev server may maintain state that becomes corrupted or stale after the first page load:
- **HMR (Hot Module Replacement)** WebSocket connections may not cleanly disconnect
- **Module cache** may serve stale content after initial hydration
- **Server-side state** in Vite may become inconsistent

### Hypothesis 2: Vite WebSocket Connection Interference

Angular 21's Vite dev server uses WebSocket for HMR. Browser console logs show:
```
debug: [vite] connecting...
debug: [vite] connected.
```

If the WebSocket connection from Test 1's browser context is not properly terminated, subsequent connections may:
- Fail to establish
- Receive stale or corrupted data
- Block page rendering

### Hypothesis 3: Browser Context Not Fully Isolated

Despite Playwright's isolation model, something may persist between tests:
- **Service Worker** registration from the Angular app
- **IndexedDB** or other persistent storage not cleared
- **Network cache** from Chromium

### Hypothesis 4: Port/Connection Exhaustion

Running multiple sequential page loads against the same dev server may:
- Exhaust available connections
- Trigger rate limiting
- Create TCP TIME_WAIT states that block new connections

### Hypothesis 5: Angular Lazy Loading Race Condition

The session-list component is lazy-loaded:
```
chunk-BCTRAJHI.js   | session-list-component | 140 bytes
```

The first load may succeed, but subsequent loads may:
- Hit a caching issue with the lazy chunk
- Fail to trigger the lazy load
- Load a stale or empty component

### Hypothesis 6: Docker Backend State

The Docker backend starts fresh before all tests. After the first test:
- Database state may change
- Server may enter an unexpected state
- Connections may not be properly pooled/released

### Hypothesis 7: Hidden Element Due to CSS/Visibility

The error `Received: hidden` for `app-root` suggests the element exists but isn't visible:
- CSS `visibility: hidden` or `display: none`
- Element is off-screen or has zero dimensions
- Overlay or loading screen covering content

---

## Questions for Investigation

1. **What is the page content on the second test?**
   - Is `app-root` empty, or does it contain content that's hidden?
   - What CSS is applied to `app-root` in subsequent tests?

2. **Is the Vite HMR WebSocket causing issues?**
   - Does disabling HMR (`--no-hmr` or `--no-live-reload`) fix the issue?
   - Are there WebSocket errors in browser console on subsequent tests?

3. **Is browser context truly isolated?**
   - Does adding `await context.clearCookies()` and `await context.clearPermissions()` help?
   - Does using `test.use({ storageState: undefined })` help?

4. **Is the Angular router state persisting?**
   - Is there a navigation guard or resolver that fails on subsequent loads?
   - Does the lazy-loaded route fail to re-initialize?

5. **Is there a timing/race condition?**
   - Does adding longer waits between tests help?
   - Does running with `--headed` show different behavior?

6. **Is Playwright's page fixture actually fresh?**
   - Does manually creating `browser.newContext()` and `context.newPage()` work better?
   - Does using `test.describe.serial` with explicit setup change behavior?

7. **Is the webServer being reused correctly?**
   - What happens if we set `reuseExistingServer: false`?
   - Does starting the Angular server manually (outside Playwright) fix it?

8. **Is there a Chromium-specific issue?**
   - Does running with Firefox (`--project=firefox`) show the same issue?

---

## Diagnostic Code to Try

### Add More Debugging to beforeEach

```typescript
test.beforeEach(async ({ page, context }) => {
  console.log(`[beforeEach] Starting test, context ID: ${context}`);

  // Clear any possible cached state
  await context.clearCookies();

  // Navigate with explicit wait
  const response = await page.goto('/', { waitUntil: 'networkidle' });
  console.log(`[beforeEach] Navigation status: ${response?.status()}`);

  // Log page content length
  const content = await page.content();
  console.log(`[beforeEach] Page content length: ${content.length}`);

  // Check if app-root exists and has content
  const appRootContent = await page.evaluate(() => {
    const root = document.querySelector('app-root');
    return {
      exists: !!root,
      innerHTML: root?.innerHTML?.substring(0, 200),
      visible: root ? getComputedStyle(root).visibility : 'N/A',
      display: root ? getComputedStyle(root).display : 'N/A',
    };
  });
  console.log(`[beforeEach] app-root state:`, appRootContent);

  await waitForAngularApp(page);
});
```

### Test with Manual Browser Management

```typescript
test.describe('Manual Browser Test', () => {
  let browser: Browser;

  test.beforeAll(async () => {
    browser = await chromium.launch();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('test 1', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4200/');
    // ... assertions
    await context.close();
  });

  test('test 2', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4200/');
    // ... assertions
    await context.close();
  });
});
```

### Test Without HMR

```typescript
// In playwright.config.ts
webServer: {
  command: 'NG_CLI_ANALYTICS=false npx ng serve --host 127.0.0.1 --port 4200 --allowed-hosts=all --live-reload=false',
  // ...
}
```

---

## Files for Reference

| File | Purpose |
|------|---------|
| `frontend/playwright.config.ts` | Playwright configuration |
| `frontend/tests/e2e/session-list.spec.ts` | Test file |
| `frontend/tests/e2e/global-setup.ts` | Docker startup |
| `frontend/tests/e2e/global-teardown.ts` | Docker cleanup |
| `frontend/angular.json` | Angular CLI configuration |
| `frontend/src/app/features/session-list/` | Component being tested |
| `docker-compose.e2e.yaml` | Backend Docker config |

---

## Successful Test Output (Test 1)

```
[WebServer] ✔ Building...
[WebServer] Application bundle generation complete. [1.642 seconds]
[WebServer]   ➜  Local:   http://127.0.0.1:4200/

🐳 Starting Docker Compose E2E stack...
✅ Docker Compose stack is ready

Running 5 tests using 1 worker
[chromium] › session-list.spec.ts:37:7 › Session List › loads the application
Browser console: debug: [vite] connecting...
debug: [vite] connected.
log: Angular is running in development mode.
  ✓ 1 passed
```

---

## Failed Test Output (Test 2)

```
[chromium] › session-list.spec.ts:51:7 › Session List › displays the session list view

Error: expect(locator).toBeVisible() failed

Locator: locator('mat-card').first()
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 30000ms
  - waiting for locator('mat-card').first()
```

---

## Desired Outcome

We need Playwright E2E tests to:
1. Run **multiple tests sequentially** against the same Angular dev server
2. Have **each test see a fresh, fully-loaded page**
3. Work with Angular 21's Vite-based dev server
4. Run reliably in a Docker-based dev container environment

The immediate goal is to understand **why only the first test passes** and what state is preventing subsequent tests from seeing a fully-rendered Angular application.
