# Playwright E2E Test Blocking Investigation


## Table of Contents

- [Executive Summary](#executive-summary)
- [Project Context](#project-context)
  - [Technology Stack](#technology-stack)
  - [Repository Structure](#repository-structure)
  - [npm Workspace Configuration](#npm-workspace-configuration)
- [Problem Description](#problem-description)
  - [Symptoms](#symptoms)
  - [Commands Tried and Results](#commands-tried-and-results)
  - [Expected Behavior](#expected-behavior)
  - [Actual Behavior](#actual-behavior)
- [Configuration Files](#configuration-files)
  - [playwright.config.ts](#playwrightconfigts)
  - [global-setup.ts (for local dev, skipped in CI)](#global-setupts-for-local-dev-skipped-in-ci)
  - [global-teardown.ts](#global-teardownts)
  - [frontend/package.json scripts](#frontendpackagejson-scripts)
  - [Test File: session-list.spec.ts](#test-file-session-listspects)
- [Known Issues / Context](#known-issues-context)
  - [1. Missing docker-compose.e2e.yaml](#1-missing-docker-composee2eyaml)
  - [2. CI Environment Variable](#2-ci-environment-variable)
  - [3. webServer Configuration](#3-webserver-configuration)
  - [4. Dev Container Environment](#4-dev-container-environment)
- [Hypotheses for Why Tests Hang](#hypotheses-for-why-tests-hang)
  - [Hypothesis 1: webServer blocking](#hypothesis-1-webserver-blocking)
  - [Hypothesis 2: reuseExistingServer not working](#hypothesis-2-reuseexistingserver-not-working)
  - [Hypothesis 3: Terminal/TTY issues in dev container](#hypothesis-3-terminaltty-issues-in-dev-container)
  - [Hypothesis 4: Chromium not properly installed](#hypothesis-4-chromium-not-properly-installed)
  - [Hypothesis 5: npm workspace resolution issues](#hypothesis-5-npm-workspace-resolution-issues)
  - [Hypothesis 6: stdout/stderr buffering](#hypothesis-6-stdoutstderr-buffering)
- [What We've Already Tried](#what-weve-already-tried)
  - [1. Clean node_modules reinstall](#1-clean-nodemodules-reinstall)
  - [2. Different reporter options](#2-different-reporter-options)
  - [3. Shorter timeouts](#3-shorter-timeouts)
  - [4. Single test filter](#4-single-test-filter)
  - [5. Different CI values](#5-different-ci-values)
  - [6. Killing processes](#6-killing-processes)
- [Questions for Deep Research](#questions-for-deep-research)
- [Environment Details](#environment-details)
  - [Node/npm versions](#nodenpm-versions)
  - [Playwright version](#playwright-version)
  - [OS details](#os-details)
  - [Dev container base image](#dev-container-base-image)
- [Desired Outcome](#desired-outcome)
- [Additional Files for Reference](#additional-files-for-reference)
- [Sprint Context](#sprint-context)

**Date**: January 12, 2026  
**Status**: Open - Need Deep Research  
**Author**: Sprint Orchestrator Agent

---

## Executive Summary

We are attempting to set up Playwright E2E tests for an Angular 21 frontend application. The tests should run against a real backend (Docker Compose) and validate the Session List page. **Tests hang indefinitely** without producing output or error messages. This document provides all context for a deep research agent to investigate.

---

## Project Context

### Technology Stack

| Component | Version | Notes |
|-----------|---------|-------|
| Angular | 21.0.0 | Latest, using standalone components |
| Node.js | 20.19.2 | LTS version |
| npm | 9.2.0 | Workspace-enabled |
| Playwright | 1.52.0 | `@playwright/test` package |
| Vitest | 4.0.8 | Used for unit tests (not E2E) |
| OS | Debian 13 (trixie) | Running in VS Code Dev Container |

### Repository Structure

```
adk-sim-plugin/                    # Monorepo root
├── frontend/                      # Angular 21 application
│   ├── package.json               # Frontend dependencies
│   ├── playwright.config.ts       # Playwright E2E config
│   ├── tests/
│   │   └── e2e/
│   │       ├── session-list.spec.ts    # E2E test file
│   │       ├── global-setup.ts         # Docker startup (local only)
│   │       └── global-teardown.ts      # Docker shutdown (local only)
│   └── src/
│       └── app/                   # Angular source
├── server/                        # Python backend (gRPC + HTTP)
├── docker-compose.yaml            # Main compose file
└── docker-compose.e2e.yaml        # E2E test compose (DOES NOT EXIST)
```

### npm Workspace Configuration

The repo uses npm workspaces. The root `package.json` links:
- `frontend/` (Angular app)
- `packages/adk-sim-protos-ts/` (TypeScript protobuf definitions)

---

## Problem Description

### Symptoms

1. **Tests hang indefinitely**: Running `npx playwright test` produces no output and never completes
2. **No error messages**: No exceptions, stack traces, or error output
3. **Timeout does nothing useful**: Commands with `timeout` just exit with code 124/143
4. **Tests list correctly**: `npx playwright test --list` works fine, showing 5 tests
5. **Playwright CLI works**: `npx playwright test --help` works correctly

### Commands Tried and Results

```bash
# Command 1: List tests - WORKS
$ cd frontend && npx playwright test --list
Listing tests:
  [chromium] › session-list.spec.ts:14:7 › Session List › loads the application
  [chromium] › session-list.spec.ts:31:7 › Session List › displays the session list view
  [chromium] › session-list.spec.ts:50:7 › Session List › shows session list card with actions
  [chromium] › session-list.spec.ts:72:7 › Session List › displays either sessions or empty state
  [chromium] › session-list.spec.ts:98:7 › Session List › refresh button can be clicked
Total: 5 tests in 1 file

# Command 2: Run tests with CI=true - HANGS (no output, no error)
$ cd frontend && CI=true npx playwright test
# <hangs indefinitely, produces nothing>

# Command 3: Run with timeout - KILLED after timeout
$ cd frontend && CI=true timeout 60 npx playwright test 2>&1
# <exits with code 124 after 60 seconds, no output>

# Command 4: Run single test with timeout - KILLED
$ cd frontend && CI=true timeout 60 npx playwright test session-list.spec.ts:14 2>&1
# <exits with code 143 after 60 seconds, no output>

# Command 5: Run with line reporter - HANGS
$ cd frontend && CI=true npx playwright test --reporter=line 2>&1
# <hangs indefinitely>
```

### Expected Behavior

Playwright should:
1. Start the Angular dev server (configured in `webServer` option)
2. Wait for http://localhost:4200 to be available
3. Launch Chromium browser
4. Run tests
5. Report results

### Actual Behavior

Playwright produces **zero output** and appears to block on something before even starting the test run. It doesn't report:
- Starting the web server
- Waiting for the server
- Browser launch
- Test execution
- Any errors

---

## Configuration Files

### playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI'] ? [['html'], ['github']] : 'line',

  // Timeouts
  timeout: 60000,
  expect: {
    timeout: 10000,
  },

  use: {
    baseURL: process.env['BASE_URL'] || 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Global setup/teardown for Docker (only for local development)
  globalSetup: process.env['CI'] ? undefined : './tests/e2e/global-setup.ts',
  globalTeardown: process.env['CI'] ? undefined : './tests/e2e/global-teardown.ts',

  // Start Angular dev server for E2E tests
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120000,
  },
});
```

### global-setup.ts (for local dev, skipped in CI)

```typescript
import { execSync } from 'child_process';
import { resolve } from 'path';

export default async function globalSetup() {
  const repoRoot = resolve(__dirname, '../../..');

  console.log('🐳 Starting Docker Compose E2E stack...');
  console.log(`   Working directory: ${repoRoot}`);

  try {
    execSync('docker compose -f docker-compose.e2e.yaml up -d --wait', {
      stdio: 'inherit',
      cwd: repoRoot,
    });
    console.log('✅ Docker Compose stack is ready');
  } catch (error) {
    console.error('❌ Failed to start Docker Compose stack');
    throw error;
  }
}
```

### global-teardown.ts

```typescript
import { execSync } from 'child_process';
import { resolve } from 'path';

export default async function globalTeardown() {
  const repoRoot = resolve(__dirname, '../../..');

  console.log('🐳 Stopping Docker Compose E2E stack...');

  try {
    execSync('docker compose -f docker-compose.e2e.yaml down', {
      stdio: 'inherit',
      cwd: repoRoot,
    });
    console.log('✅ Docker Compose stack stopped');
  } catch (error) {
    console.error('⚠️ Failed to stop Docker Compose stack (may already be stopped)');
  }
}
```

### frontend/package.json scripts

```json
{
  "scripts": {
    "start": "ng serve",
    "test:e2e": "npx playwright test",
    "test:e2e:ui": "npx playwright test --ui",
    "test:e2e:headed": "npx playwright test --headed"
  }
}
```

### Test File: session-list.spec.ts

```typescript
import { expect, test } from '@playwright/test';

test.describe('Session List', () => {
  test('loads the application', async ({ page }) => {
    await page.goto('/');

    await page.waitForFunction(
      () => {
        const appRoot = document.querySelector('app-root');
        return appRoot && appRoot.innerHTML.trim().length > 50;
      },
      { timeout: 30000 }
    );

    expect(page.url()).toContain('localhost');
  });

  // ... more tests
});
```

---

## Known Issues / Context

### 1. Missing docker-compose.e2e.yaml

The file `docker-compose.e2e.yaml` **does not exist** in the repo. The global-setup.ts tries to run:
```bash
docker compose -f docker-compose.e2e.yaml up -d --wait
```

However, this should only matter for **local development** (`CI=` not set). When `CI=true`, the global setup is skipped entirely (see config: `globalSetup: process.env['CI'] ? undefined : ...`).

### 2. CI Environment Variable

We are testing with `CI=true` to skip the Docker global setup. The expected behavior is:
- Skip global-setup.ts
- Skip global-teardown.ts
- Use the `webServer` config to start Angular dev server
- Run tests

### 3. webServer Configuration

The config expects `npm run start` to start Angular on port 4200. However:
- The `npm run start` script runs `ng serve`
- `ng serve` is a blocking command that runs indefinitely
- Playwright should handle this via the `webServer.url` health check

### 4. Dev Container Environment

Running inside a VS Code Dev Container on Debian 13. The dev container:
- Has Node.js 20.19.2 pre-installed
- Has Docker CLI available (Docker-in-Docker setup)
- Has Chromium available via Playwright (installed via `npx playwright install`)

---

## Hypotheses for Why Tests Hang

### Hypothesis 1: webServer blocking

The `webServer.command` (`npm run start`) might be blocking Playwright from proceeding. Playwright should:
1. Start the command
2. Wait for `webServer.url` to respond
3. Continue to tests

But maybe there's a bug or misconfiguration causing it to block indefinitely.

### Hypothesis 2: reuseExistingServer not working

With `CI=true`, `reuseExistingServer` is `false`. This means Playwright will:
1. Kill any existing server on port 4200
2. Start a new server
3. Wait for it to be ready

If there's a stale process or port conflict, this might hang.

### Hypothesis 3: Terminal/TTY issues in dev container

The dev container might have TTY/terminal issues that prevent Playwright from working correctly. Playwright uses child_process to spawn browsers and servers.

### Hypothesis 4: Chromium not properly installed

Although `npx playwright install` was likely run, Chromium might not be properly installed or configured for the headless environment.

### Hypothesis 5: npm workspace resolution issues

The frontend is in an npm workspace. When Playwright runs `npm run start`, it might resolve packages from the wrong location or have hoisting issues.

### Hypothesis 6: stdout/stderr buffering

Output might be getting buffered and not displayed. The test might actually be running but output isn't visible.

---

## What We've Already Tried

### 1. Clean node_modules reinstall

```bash
rm -rf node_modules frontend/node_modules packages/*/node_modules
npm install
```

Result: Unit tests work (94 passing), but E2E still hangs.

### 2. Different reporter options

```bash
npx playwright test --reporter=line
npx playwright test --reporter=list
npx playwright test --reporter=dot
```

Result: All hang with no output.

### 3. Shorter timeouts

```bash
npx playwright test --timeout=5000
npx playwright test --timeout=10000
```

Result: Still hangs; timeout doesn't help because Playwright isn't even starting tests.

### 4. Single test filter

```bash
npx playwright test session-list.spec.ts:14
```

Result: Still hangs.

### 5. Different CI values

```bash
CI=true npx playwright test
CI=false npx playwright test
unset CI && npx playwright test
```

Result: All hang. Without CI, it tries to run global-setup which fails (missing file), but that produces an error. With CI, no output at all.

### 6. Killing processes

```bash
pkill -f playwright
pkill -f chromium
pkill -f "ng serve"
```

Result: Cleaned up orphaned processes, but subsequent runs still hang.

---

## Questions for Deep Research

1. **Why does Playwright produce no output?** Even with `--reporter=line`, nothing is printed. Is there a known issue with Playwright output buffering in containerized environments?

2. **Is there a known issue with Playwright webServer in npm workspaces?** The frontend is a workspace package. Could npm workspace hoisting cause issues with the webServer command?

3. **Should we use a different webServer configuration?** Maybe specify the full path, use `cwd`, or use a different approach?

4. **Is there a dev container / Docker-in-Docker issue with Playwright?** Running in a dev container with Docker-in-Docker might have specific requirements.

5. **Could the Angular CLI be causing the hang?** `ng serve` might not play well with Playwright's process management.

6. **What debugging options exist for Playwright startup?** Is there a way to get verbose logs from Playwright about what it's doing during initialization?

7. **Is the issue specific to Playwright 1.52.0?** Should we try a different version?

8. **Could there be a port conflict?** How can we verify port 4200 is truly available?

---

## Environment Details

### Node/npm versions
```
$ node --version
v20.19.2

$ npm --version
9.2.0
```

### Playwright version
```
$ npx playwright --version
Version 1.52.0
```

### OS details
```
PRETTY_NAME="Debian GNU/Linux 13 (trixie)"
NAME="Debian GNU/Linux"
VERSION_ID="13"
VERSION="13 (trixie)"
VERSION_CODENAME=trixie
```

### Dev container base image
Uses a custom Dockerfile based on Microsoft's dev containers with:
- Python 3.x
- Node.js 20.x
- Docker-in-Docker support

---

## Desired Outcome

We need Playwright E2E tests to:
1. Run successfully in the dev container (local development)
2. Run successfully in GitHub Actions CI
3. Produce meaningful output (pass/fail, test names, errors)
4. Work with the Angular 21 frontend and Python backend

The immediate goal is to understand **why tests hang with no output** and get a working configuration.

---

## Additional Files for Reference

If the research agent needs more context, these files exist:
- `frontend/angular.json` - Angular CLI configuration
- `frontend/proxy.conf.json` - Dev server proxy config
- `frontend/src/main.ts` - Angular bootstrap
- `server/` - Python gRPC backend
- `.devcontainer/devcontainer.json` - Dev container config
- `docker-compose.yaml` - Main Docker Compose file

---

## Sprint Context

This work is part of **Sprint 1, PR 10-11** (Playwright testing setup). PRs 1-9 are already merged:
- S1PR1: Sheriff Installation & Configuration
- S1PR2: Environment Configuration (Dev Proxy + Prod Same-Origin)
- S1PR3: Folder Structure Scaffold
- S1PR4: SessionGateway Port + Mock Implementation
- S1PR5: GrpcSessionGateway Implementation
- S1PR6: SessionStateService (Global Signals)
- S1PR7: SessionFacade (Minimal for List)
- S1PR8: Session List Component (Barebones)
- S1PR9: Connection Status Component

The frontend is functional - unit tests pass (94 tests), the app builds and runs. Only Playwright E2E tests are blocked.
