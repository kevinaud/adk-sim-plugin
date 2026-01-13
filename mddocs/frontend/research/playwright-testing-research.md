---
title: Playwright Testing Strategy Research
type: research
parent: ../frontend-tdd.md
related:
  - ../frontend-spec.md
  - ./angular-testing-analysis.md
  - ./project-infrastructure.md
---

# Playwright Testing Strategy Research


## Table of Contents

- [Executive Summary](#executive-summary)
  - [Key Decisions](#key-decisions)
- [Part 1: Component Testing with Visual Regression](#part-1-component-testing-with-visual-regression)
  - [Why Component Testing?](#why-component-testing)
  - [Library: @sand4rt/experimental-ct-angular](#library-sand4rtexperimental-ct-angular)
  - [Setup Configuration](#setup-configuration)
    - [Installation](#installation)
    - [Playwright Config](#playwright-config)
    - [Bootstrap File](#bootstrap-file)
  - [Component Test Examples](#component-test-examples)
    - [Basic Render Test](#basic-render-test)
    - [Event Handling Test](#event-handling-test)
    - [Visual Regression Test with States](#visual-regression-test-with-states)
- [Part 2: Screenshot Management Strategy](#part-2-screenshot-management-strategy)
  - [Directory Structure](#directory-structure)
  - [Cross-Platform Screenshots](#cross-platform-screenshots)
    - [Option A: Platform-Specific Baselines (Recommended)](#option-a-platform-specific-baselines-recommended)
    - [Option B: Docker-Based Consistency](#option-b-docker-based-consistency)
  - [Updating Screenshots](#updating-screenshots)
  - [CI Enforcement Strategy](#ci-enforcement-strategy)
    - [The Problem](#the-problem)
    - [Solution: Two-Phase CI Check](#solution-two-phase-ci-check)
- [Part 3: E2E Testing with Real Backend](#part-3-e2e-testing-with-real-backend)
  - [Architecture](#architecture)
  - [Why Real Backend (Not Mocks)?](#why-real-backend-not-mocks)
  - [Docker Compose for E2E](#docker-compose-for-e2e)
  - [Playwright E2E Config](#playwright-e2e-config)
  - [Global Setup (Local Development)](#global-setup-local-development)
  - [E2E Test Example](#e2e-test-example)
  - [Screenshot Naming Convention](#screenshot-naming-convention)
- [Part 4: CI Workflow Integration](#part-4-ci-workflow-integration)
  - [Complete CI Workflow](#complete-ci-workflow)
  - [Local Development Workflow](#local-development-workflow)
  - [Reviewing Screenshots Locally](#reviewing-screenshots-locally)
- [Part 5: AI Agent Integration](#part-5-ai-agent-integration)
  - [Why This Matters for AI Agents](#why-this-matters-for-ai-agents)
  - [Agent Workflow](#agent-workflow)
  - [Commit Message Convention](#commit-message-convention)
- [Implementation Phases](#implementation-phases)
  - [Phase 1: Component Testing Setup (Week 1)](#phase-1-component-testing-setup-week-1)
  - [Phase 2: CI Integration (Week 2)](#phase-2-ci-integration-week-2)
  - [Phase 3: E2E Testing (Week 3)](#phase-3-e2e-testing-week-3)
- [Open Questions](#open-questions)
- [References](#references)

## Executive Summary

**Recommendation**: Adopt a two-tier Playwright testing strategy:

| Test Type | Tool | Purpose | CI Enforcement |
|-----------|------|---------|----------------|
| Component Tests (CT) | `@sand4rt/experimental-ct-angular` | Visual regression, isolated component verification | Screenshot diff check |
| E2E Tests | `@playwright/test` | Full user flows + application screenshots | Screenshot diff check + pass/fail |

### Key Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Angular CT | `@sand4rt/experimental-ct-angular` v1.57.0 | Only mature option; mirrors Playwright API |
| Screenshot Storage | Version controlled in repo | Enables PR diffs, no external service needed |
| Backend for E2E | Docker Compose (real backend) | Matches Python E2E pattern; no mocking |
| CI Screenshot Updates | Manual PR update workflow | Prevents accidental baseline drift |

---

## Part 1: Component Testing with Visual Regression

### Why Component Testing?

Component tests provide:
1. **Isolation**: Test components without full application bootstrap
2. **Speed**: Faster than E2E tests
3. **Visual Verification**: Screenshot comparison catches unintended UI changes
4. **AI Agent Validation**: Coding agents can verify changes don't break UI visually

### Library: @sand4rt/experimental-ct-angular

The official Playwright Angular component testing support is still in development. The community library `@sand4rt/experimental-ct-angular` provides a mature, well-maintained implementation.

**Package Details**:
```json
{
  "name": "@sand4rt/experimental-ct-angular",
  "version": "1.57.0",
  "peerDependencies": {
    "@angular/compiler": "^20.3.11",
    "@angular/core": "^20.3.11",
    "@angular/platform-browser-dynamic": "^20.3.11",
    "typescript": ">=5.9.3"
  }
}
```

> **Note**: Peer deps show Angular 20.x but the library should work with Angular 21 given minimal API surface.

**Key Features**:
- API mirrors official Playwright CT (React/Vue/Svelte)
- Uses Vite for fast HMR and bundling
- Supports Signal-based inputs
- Full event binding (`on: { output: handler }`)
- Hooks for TestBed configuration

### Setup Configuration

#### Installation

```bash
pnpm add -D @sand4rt/experimental-ct-angular @analogjs/vite-plugin-angular vite
```

#### Playwright Config

```typescript
// playwright-ct.config.ts
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig, devices } from '@sand4rt/experimental-ct-angular';
import { resolve } from 'path';

export default defineConfig({
  testDir: 'tests/component',
  snapshotDir: 'tests/component/__snapshots__',

  // CI-specific settings
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? [['html'], ['github']] : 'line',

  // Screenshot settings
  expect: {
    toHaveScreenshot: {
      // Pixel difference threshold (0-1, lower = stricter)
      maxDiffPixelRatio: 0.01,
      // Animation must be disabled for deterministic screenshots
      animations: 'disabled',
    },
  },

  use: {
    trace: 'on-first-retry',
    ctViteConfig: {
      plugins: [angular({
        tsconfig: resolve('./tsconfig.spec.json'),
      })],
      resolve: {
        alias: {
          '@': resolve('./src'),
          '@app': resolve('./src/app'),
        }
      }
    }
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Add more browsers as needed
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

#### Bootstrap File

```typescript
// playwright/index.ts
import 'zone.js';
import '@app/styles/main.scss';

import { beforeMount, afterMount } from '@sand4rt/experimental-ct-angular/hooks';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

export type HooksConfig = {
  withHttp?: boolean;
  withAnimations?: boolean;
};

beforeMount<HooksConfig>(async ({ hooksConfig, TestBed }) => {
  const providers = [];

  if (hooksConfig?.withHttp) {
    providers.push(provideHttpClient());
  }

  if (hooksConfig?.withAnimations) {
    providers.push(provideAnimationsAsync());
  }

  if (providers.length > 0) {
    TestBed.configureTestingModule({ providers });
  }
});
```

### Component Test Examples

#### Basic Render Test

```typescript
// tests/component/data-tree.spec.ts
import { test, expect } from '@sand4rt/experimental-ct-angular';
import { DataTreeComponent } from '@app/ui/event-stream/data-tree/data-tree.component';

test.describe('DataTreeComponent', () => {
  test('renders simple object', async ({ mount }) => {
    const component = await mount(DataTreeComponent, {
      props: {
        data: { name: 'Alice', age: 30 },
        expanded: true,
      },
    });

    await expect(component).toContainText('name');
    await expect(component).toContainText('Alice');
  });

  test('renders nested object with thread lines', async ({ mount }) => {
    const component = await mount(DataTreeComponent, {
      props: {
        data: {
          user: { name: 'Bob', address: { city: 'NYC' } }
        },
        showThreadLines: true,
      },
    });

    // Visual regression test
    await expect(component).toHaveScreenshot('data-tree-nested.png');
  });
});
```

#### Event Handling Test

```typescript
// tests/component/tool-catalog.spec.ts
import { test, expect } from '@sand4rt/experimental-ct-angular';
import { ToolCatalogComponent } from '@app/ui/control-panel/tool-catalog/tool-catalog.component';

test('emits selectTool when tool is clicked', async ({ mount }) => {
  const selectedTools: string[] = [];

  const component = await mount(ToolCatalogComponent, {
    props: {
      tools: [
        { name: 'search', description: 'Search the web' },
        { name: 'calculate', description: 'Do math' },
      ],
    },
    on: {
      selectTool: (tool) => selectedTools.push(tool.name),
    },
  });

  await component.getByText('search').click();
  expect(selectedTools).toEqual(['search']);
});
```

#### Visual Regression Test with States

```typescript
// tests/component/smart-blob.spec.ts
import { test, expect } from '@sand4rt/experimental-ct-angular';
import { SmartBlobComponent } from '@app/ui/event-stream/smart-blob/smart-blob.component';

test.describe('SmartBlobComponent visual states', () => {
  const jsonContent = '{"key": "value", "nested": {"a": 1}}';

  test('JSON mode', async ({ mount }) => {
    const component = await mount(SmartBlobComponent, {
      props: { content: jsonContent },
    });

    // Click JSON toggle
    await component.getByRole('button', { name: '[JSON]' }).click();
    await expect(component).toHaveScreenshot('smart-blob-json-mode.png');
  });

  test('RAW mode', async ({ mount }) => {
    const component = await mount(SmartBlobComponent, {
      props: { content: jsonContent },
    });

    await component.getByRole('button', { name: '[RAW]' }).click();
    await expect(component).toHaveScreenshot('smart-blob-raw-mode.png');
  });
});
```

---

## Part 2: Screenshot Management Strategy

### Directory Structure

```
frontend/
├── tests/
│   ├── component/
│   │   ├── __snapshots__/           # Version-controlled component screenshots
│   │   │   ├── data-tree.spec.ts-snapshots/
│   │   │   │   ├── data-tree-nested-chromium-linux.png
│   │   │   │   ├── data-tree-nested-chromium-darwin.png
│   │   │   │   └── data-tree-nested-chromium-win32.png
│   │   │   └── smart-blob.spec.ts-snapshots/
│   │   │       └── ...
│   │   ├── data-tree.spec.ts
│   │   ├── smart-blob.spec.ts
│   │   └── tool-catalog.spec.ts
│   └── e2e/
│       ├── __snapshots__/           # Version-controlled E2E screenshots
│       │   ├── session-flow.spec.ts-snapshots/
│       │   │   ├── session-list-chromium-linux.png
│       │   │   ├── session-active-chromium-linux.png
│       │   │   └── tool-form-submitted-chromium-linux.png
│       │   └── ...
│       ├── session-flow.spec.ts
│       └── global-setup.ts
├── playwright-ct.config.ts          # Component test config
└── playwright.config.ts             # E2E test config
```

### Cross-Platform Screenshots

Playwright generates platform-specific screenshots by default due to rendering differences. Options:

#### Option A: Platform-Specific Baselines (Recommended)

Store separate baselines per platform:
```
__snapshots__/
├── component-name-chromium-linux.png
├── component-name-chromium-darwin.png
└── component-name-chromium-win32.png
```

**Pros**: Accurate diffs on each platform
**Cons**: More files to maintain

#### Option B: Docker-Based Consistency

Run all screenshot tests in Docker for consistent rendering:
```yaml
# docker-compose.screenshots.yaml
services:
  playwright:
    image: mcr.microsoft.com/playwright:v1.52.0-noble
    volumes:
      - ./frontend:/app
    working_dir: /app
    command: npx playwright test --project=chromium --update-snapshots
```

**Pros**: Single baseline per component
**Cons**: CI/local parity complexity

### Updating Screenshots

When a component's appearance intentionally changes:

```bash
# Update all screenshots
pnpm exec playwright test --update-snapshots

# Update specific test
pnpm exec playwright test data-tree.spec.ts --update-snapshots
```

### CI Enforcement Strategy

#### The Problem

AI coding agents may inadvertently change UI. We need to:
1. Detect visual changes in PRs
2. Require explicit screenshot updates for visual changes
3. Prevent accidental baseline drift

#### Solution: Two-Phase CI Check

**Phase 1: Screenshot Comparison (Blocking)**

```yaml
# .github/workflows/playwright-ct.yaml
name: Component Tests

on:
  pull_request:

jobs:
  component-tests:
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.52.0-noble

    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        working-directory: frontend
        run: |
          npm ci
          npx playwright install --with-deps chromium

      - name: Run component tests
        working-directory: frontend
        run: npx playwright test -c playwright-ct.config.ts

      - name: Upload diff artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-diff
          path: |
            frontend/test-results/
            frontend/playwright-report/
          retention-days: 7

      - name: Check for uncommitted snapshot changes
        run: |
          if [[ -n $(git status --porcelain tests/component/__snapshots__ tests/e2e/__snapshots__) ]]; then
            echo "::error::Screenshot changes detected but not committed."
            echo "Run 'pnpm exec playwright test --update-snapshots' and commit the changes."
            git diff tests/component/__snapshots__ tests/e2e/__snapshots__
            exit 1
          fi
```

**Phase 2: PR Comment with Visual Diff**

```yaml
      - name: Comment on PR with diff images
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const diffFiles = fs.readdirSync('frontend/test-results')
              .filter(f => f.endsWith('-diff.png'));

            if (diffFiles.length > 0) {
              const body = `## 🎭 Visual Regression Detected

              The following components have visual changes:
              ${diffFiles.map(f => `- \`${f}\``).join('\n')}

              **To update screenshots:**
              \`\`\`bash
              cd frontend
              pnpm exec playwright test --update-snapshots
              git add tests/component/__snapshots__
              git commit -m "chore: update component screenshots"
              \`\`\`

              See artifacts for diff images.`;

              github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body
              });
            }
```

---

## Part 3: E2E Testing with Real Backend

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Playwright E2E Tests                      │
│                                                             │
│  test('user can submit tool response', async ({ page }) {   │
│    await page.goto('/session/123');                         │
│    await page.getByRole('button', { name: 'search' })...    │
│  });                                                        │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP/gRPC-Web
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Docker Compose Stack                       │
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────────────┐│
│  │     Frontend        │    │         Backend             ││
│  │  (Angular + Vite)   │◄──►│   (Python gRPC Server)      ││
│  │    :4200            │    │     :50051 / :8080          ││
│  └─────────────────────┘    └─────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Why Real Backend (Not Mocks)?

Per [existing Python E2E tests](../../../server/tests/e2e/conftest.py), we already use Docker to spin up real backends:

| Approach | Pros | Cons |
|----------|------|------|
| **Mock Backend** | Fast, deterministic | Mocks drift from reality; double maintenance |
| **Real Backend** | True integration test; single source of truth | Slower; requires Docker |

**Recommendation**: Use real backend in Docker Compose, matching our Python E2E pattern.

### Docker Compose for E2E

```yaml
# docker-compose.e2e.yaml
services:
  backend:
    build:
      context: .
      dockerfile: docker/backend.Dockerfile
    ports:
      - "50051:50051"
      - "8080:8080"
    environment:
      PYTHONPATH: /app
      LOG_LEVEL: INFO
      ADK_AGENT_SIM_DATABASE_URL: "sqlite+aiosqlite:///tmp/e2e-test.db"
    healthcheck:
      test: ["CMD", "python", "-c", "import socket; s=socket.socket(); s.connect(('localhost', 50051)); s.close()"]
      interval: 2s
      timeout: 5s
      retries: 10
      start_period: 5s

  frontend:
    build:
      context: ./frontend
      dockerfile: ../docker/frontend.Dockerfile
    ports:
      - "4200:4200"
    environment:
      - GRPC_WEB_URL=http://backend:8080
    depends_on:
      backend:
        condition: service_healthy
    command: npx ng serve --host 0.0.0.0

  playwright:
    image: mcr.microsoft.com/playwright:v1.52.0-noble
    volumes:
      - ./frontend:/app
      - ./frontend/test-results:/app/test-results
    working_dir: /app
    depends_on:
      - frontend
    environment:
      - BASE_URL=http://frontend:4200
    command: npx playwright test -c playwright.config.ts
```

### Playwright E2E Config

```typescript
// playwright.config.ts (E2E)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  snapshotDir: 'tests/e2e/__snapshots__',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html'], ['github']] : 'line',

  // E2E screenshot settings
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    },
  },

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure', // Debug screenshots on failure
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Global setup/teardown for Docker
  globalSetup: process.env.CI ? undefined : './tests/e2e/global-setup.ts',
  globalTeardown: process.env.CI ? undefined : './tests/e2e/global-teardown.ts',
});
```

### Global Setup (Local Development)

```typescript
// tests/e2e/global-setup.ts
import { execSync } from 'child_process';

export default async function globalSetup() {
  console.log('Starting Docker Compose stack...');
  execSync('docker compose -f docker-compose.e2e.yaml up -d --wait', {
    stdio: 'inherit',
    cwd: process.cwd().replace('/frontend', ''),
  });
}
```

```typescript
// tests/e2e/global-teardown.ts
import { execSync } from 'child_process';

export default async function globalTeardown() {
  console.log('Stopping Docker Compose stack...');
  execSync('docker compose -f docker-compose.e2e.yaml down', {
    stdio: 'inherit',
    cwd: process.cwd().replace('/frontend', ''),
  });
}
```

### E2E Test Example

```typescript
// tests/e2e/session-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Session Flow', () => {
  test('session list view', async ({ page }) => {
    await page.goto('/');

    // Wait for sessions to load
    await expect(page.getByTestId('session-list')).toBeVisible();

    // Capture full application screenshot
    await expect(page).toHaveScreenshot('session-list.png', {
      fullPage: true,
    });
  });

  test('user can create and join a session', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New Session' }).click();

    // Should navigate to session page
    await expect(page).toHaveURL(/\/session\/[\w-]+/);
    await expect(page.getByTestId('connection-status')).toHaveText('Connected');

    // Screenshot of active session view
    await expect(page).toHaveScreenshot('session-active.png', {
      fullPage: true,
    });
  });

  test('user can view LlmRequest details', async ({ page, request }) => {
    // Seed a session via API
    const response = await request.post('http://localhost:8080/api/sessions', {
      data: { description: 'E2E Test Session' }
    });
    const { session } = await response.json();

    await page.goto(`/session/${session.id}`);
    await expect(page.getByTestId('event-stream')).toBeVisible();

    // Screenshot showing event stream with data
    await expect(page).toHaveScreenshot('session-with-events.png', {
      fullPage: true,
    });
  });

  test('user can submit tool invocation', async ({ page }) => {
    // ... setup session with pending tool call
    await page.goto(`/session/test-session`);

    // Select tool and fill form
    await page.getByText('search').click();
    await page.getByLabel('query').fill('test search');

    // Screenshot before submission (shows form state)
    await expect(page).toHaveScreenshot('tool-form-filled.png', {
      fullPage: true,
    });

    // Submit
    await page.getByRole('button', { name: 'Invoke Tool' }).click();
    await expect(page.getByText('Tool invoked')).toBeVisible();

    // Screenshot after submission
    await expect(page).toHaveScreenshot('tool-form-submitted.png', {
      fullPage: true,
    });
  });
});
```

### Screenshot Naming Convention

E2E screenshots capture the full application state at key points:

| Screenshot | Purpose |
|------------|--------|
| `session-list.png` | Home view with all sessions |
| `session-active.png` | Connected session view |
| `session-with-events.png` | Event stream populated |
| `tool-form-filled.png` | Control panel with form data |
| `tool-form-submitted.png` | Post-submission state |

This provides a visual history of the application's appearance across user flows.

---

## Part 4: CI Workflow Integration

### Complete CI Workflow

```yaml
# .github/workflows/frontend-tests.yaml
name: Frontend Tests

on:
  pull_request:
    paths:
      - 'frontend/**'
      - 'docker/frontend.Dockerfile'
      - '.github/workflows/frontend-tests.yaml'

jobs:
  # Job 1: Component Tests with Visual Regression
  component-tests:
    name: Component Tests
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.52.0-noble

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
          cache-dependency-path: frontend/pnpm-lock.yaml

      - name: Install dependencies
        working-directory: frontend
        run: pnpm install --frozen-lockfile

      - name: Run component tests
        working-directory: frontend
        run: pnpm exec playwright test -c playwright-ct.config.ts

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: component-test-results
          path: |
            frontend/test-results/
            frontend/playwright-report/
          retention-days: 7

      - name: Fail if snapshots changed
        working-directory: frontend
        run: |
          if [[ -n $(git status --porcelain tests/component/__snapshots__ tests/e2e/__snapshots__) ]]; then
            echo "::error::Uncommitted screenshot changes detected"
            exit 1
          fi

  # Job 2: E2E Tests with Real Backend
  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
          cache-dependency-path: frontend/pnpm-lock.yaml

      - name: Install frontend dependencies
        working-directory: frontend
        run: pnpm install --frozen-lockfile

      - name: Build frontend
        working-directory: frontend
        run: pnpm build

      - name: Start Docker Compose stack
        run: |
          docker compose -f docker-compose.e2e.yaml up -d --wait
          docker compose -f docker-compose.e2e.yaml logs

      - name: Install Playwright
        working-directory: frontend
        run: pnpm exec playwright install --with-deps chromium

      - name: Run E2E tests
        working-directory: frontend
        run: pnpm exec playwright test -c playwright.config.ts
        env:
          BASE_URL: http://localhost:4200

      - name: Stop Docker Compose
        if: always()
        run: docker compose -f docker-compose.e2e.yaml down

      - name: Upload E2E results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-test-results
          path: |
            frontend/test-results/
            frontend/playwright-report/
          retention-days: 7
```

### Local Development Workflow

```json
// frontend/package.json scripts
{
  "scripts": {
    "test:ct": "playwright test -c playwright-ct.config.ts",
    "test:ct:ui": "playwright test -c playwright-ct.config.ts --ui",
    "test:ct:update": "playwright test -c playwright-ct.config.ts --update-snapshots",
    "test:e2e": "playwright test -c playwright.config.ts",
    "test:e2e:ui": "playwright test -c playwright.config.ts --ui",
    "test:e2e:update": "playwright test -c playwright.config.ts --update-snapshots",
    "test:e2e:docker": "docker compose -f ../docker-compose.e2e.yaml up --abort-on-container-exit --exit-code-from playwright",
    "test:update-all": "npm run test:ct:update && npm run test:e2e:update"
  }
}
```

### Reviewing Screenshots Locally

After running tests, screenshots are stored as PNG files that can be:

1. **Viewed directly** in VS Code or any image viewer
2. **Compared via Git** - `git diff` shows which screenshots changed
3. **Reviewed in PR** - GitHub renders PNG diffs inline
4. **Inspected in Playwright report** - `npx playwright show-report` shows visual diffs

---

## Part 5: AI Agent Integration

### Why This Matters for AI Agents

When AI coding agents modify components:

1. **Visual Regression Detection**: Screenshot diffs catch unintended UI changes
2. **Explicit Approval**: Agents must commit updated screenshots (intentional change)
3. **Audit Trail**: Git history shows what visual changes were made and why

### Agent Workflow

```
1. Agent modifies component code
          │
          ▼
2. CI runs component tests
          │
          ▼
3. Screenshot diff detected?
     │           │
    Yes          No
     │           │
     ▼           ▼
4a. CI fails    4b. CI passes
    with diff
    artifacts
     │
     ▼
5. Agent runs:
   pnpm test:ct:update
     │
     ▼
6. Agent commits updated
   screenshots with message
   explaining visual change
     │
     ▼
7. CI re-runs → passes
```

### Commit Message Convention

```
chore(ui): update data-tree screenshots

Visual changes:
- Added thread line indicators
- Adjusted spacing for nested objects

Screenshots updated:
- data-tree-nested-chromium-linux.png
- data-tree-collapsed-chromium-linux.png
```

---

## Implementation Phases

### Phase 1: Component Testing Setup (Week 1)

| Task | Deliverable |
|------|-------------|
| Install `@sand4rt/experimental-ct-angular` | package.json updated |
| Create `playwright-ct.config.ts` | Config file |
| Create `playwright/index.ts` bootstrap | Hook configuration |
| Write first component test | `data-tree.spec.ts` |
| Add `__snapshots__/` to git | Initial baselines |

### Phase 2: CI Integration (Week 2)

| Task | Deliverable |
|------|-------------|
| Create `.github/workflows/frontend-tests.yaml` | CI workflow |
| Configure screenshot diff detection | CI fail on uncommitted changes |
| Add PR comment for visual diffs | GitHub Actions script |
| Document update workflow | README section |

### Phase 3: E2E Testing (Week 3)

| Task | Deliverable |
|------|-------------|
| Create `docker-compose.e2e.yaml` | E2E stack config |
| Create `playwright.config.ts` (E2E) | E2E config |
| Write session flow tests | `session-flow.spec.ts` |
| Add E2E job to CI workflow | Extended workflow |

---

## Open Questions

1. **Browser Coverage**: Should we test on Firefox/WebKit in addition to Chromium?
   - More coverage but 3x screenshots and CI time
   - Recommendation: Start with Chromium only; expand if cross-browser bugs emerge

2. **Screenshot Update Automation**: Should we provide a GitHub Action to auto-update screenshots?
   - Risk: Accidental approval of broken UI
   - Recommendation: Keep manual for accountability; consider bot-assisted PRs later

3. **Snapshot Granularity**: Full component vs. specific regions?
   - Full: Simpler, catches layout issues
   - Regions: More stable, less noise from unrelated changes
   - Recommendation: Start with full; add region assertions for flaky areas

4. **E2E Test Data Seeding**: How to set up specific session states for tests?
   - Direct API calls before tests
   - Database seeding scripts
   - Test fixtures with mock agent
   - Recommendation: API seeding via `request` fixture

---

## References

- [Playwright Component Testing](https://playwright.dev/docs/test-components)
- [Playwright Visual Comparisons](https://playwright.dev/docs/test-snapshots)
- [Playwright Docker](https://playwright.dev/docs/docker)
- [GitHub: sand4rt/playwright-ct-angular](https://github.com/sand4rt/playwright-ct-angular)
- [Existing Python E2E Tests](../../../server/tests/e2e/conftest.py)
