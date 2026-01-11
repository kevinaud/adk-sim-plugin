# Sprint 1: Infrastructure & Foundation Setup


## Table of Contents

- [Sprint Goal](#sprint-goal)
- [Selected Scope](#selected-scope)
  - [Tasks from TDD](#tasks-from-tdd)
  - [Additional Infrastructure Tasks (Not in TDD Phases)](#additional-infrastructure-tasks-not-in-tdd-phases)
- [Research Summary](#research-summary)
  - [Relevant Findings](#relevant-findings)
    - [Sheriff Module Boundaries](#sheriff-module-boundaries)
    - [Environment Configuration (Dev vs Prod)](#environment-configuration-dev-vs-prod)
    - [Playwright Component Testing Setup](#playwright-component-testing-setup)
    - [Playwright E2E Testing Setup](#playwright-e2e-testing-setup)
    - [Converter Package Publishing](#converter-package-publishing)
    - [Current Frontend State](#current-frontend-state)
  - [Key Decisions Already Made](#key-decisions-already-made)
  - [Open Questions for This Sprint](#open-questions-for-this-sprint)
- [Pull Request Plan](#pull-request-plan)
  - [S1PR1: Sheriff Installation & Configuration](#s1pr1-sheriff-installation-configuration)
  - [S1PR2: Environment Configuration (Dev Proxy + Prod Same-Origin)](#s1pr2-environment-configuration-dev-proxy-prod-same-origin)
  - [S1PR3: Folder Structure Scaffold (Features, UI, Data-Access, Util)](#s1pr3-folder-structure-scaffold-features-ui-data-access-util)
  - [S1PR4: SessionGateway Port + Mock Implementation](#s1pr4-sessiongateway-port-mock-implementation)
  - [S1PR5: GrpcSessionGateway Implementation (listSessions only)](#s1pr5-grpcsessiongateway-implementation-listsessions-only)
  - [S1PR6: SessionStateService (Global Signals)](#s1pr6-sessionstateservice-global-signals)
  - [S1PR7: SessionFacade (Minimal for List)](#s1pr7-sessionfacade-minimal-for-list)
  - [S1PR8: Session List Component (Barebones)](#s1pr8-session-list-component-barebones)
  - [S1PR9: Connection Status Component](#s1pr9-connection-status-component)
  - [S1PR10: Playwright Component Testing Setup](#s1pr10-playwright-component-testing-setup)
  - [S1PR11: Playwright E2E Testing Setup](#s1pr11-playwright-e2e-testing-setup)
  - [S1PR12: CI Workflow for Frontend Tests](#s1pr12-ci-workflow-for-frontend-tests)
  - [S1PR13: @adk-sim/converters Package Scaffold](#s1pr13-adk-simconverters-package-scaffold)
  - [S1PR14: npm Publishing CI for @adk-sim/converters](#s1pr14-npm-publishing-ci-for-adk-simconverters)
  - [S1PR15: Verify Full Stack Integration](#s1pr15-verify-full-stack-integration)
- [Implementation Notes](#implementation-notes)
  - [PR Ordering Flexibility](#pr-ordering-flexibility)
  - [Testing Philosophy](#testing-philosophy)
  - [Sheriff Verification](#sheriff-verification)
  - [Manual Bootstrapping Required](#manual-bootstrapping-required)

**Created**: January 11, 2026  
**Status**: Planning  
**TDD Phase(s)**: Pre-Phase 1 (Infrastructure), Phase 1 Foundation (partial)

---

## Sprint Goal

Establish all infrastructure and tooling required for frontend development, including module boundary enforcement (Sheriff), environment configuration (dev/prod), Playwright testing (component + E2E), CI/CD integration for tests, and the new `@adk-sim/converters` npm package. Deliver a minimal "Session List" screen to validate the stack end-to-end.

By the end of this sprint:
1. Sheriff enforces module boundaries on every lint/CI run
2. Playwright component tests run in CI with screenshot regression
3. Playwright E2E tests run against a real dockerized backend in CI
4. The `@adk-sim/converters` package is published to npm alongside existing packages
5. A barebones Session List page fetches and displays real sessions from the backend
6. Dev (`ng serve` + proxy) and prod (bundled) configurations work correctly

---

## Selected Scope

### Tasks from TDD

| Task | FR | Phase | Notes |
|------|----|-------|-------|
| Project structure setup | - | Phase 1 | Sheriff, folder structure, linting rules |
| `SessionGateway` port + mock | FR-020 | Phase 1 | Abstract port + mock implementation (minimal for list) |
| `SessionFacade` skeleton | FR-020 | Phase 1 | Minimal facade for listing sessions |
| Session list route | FR-002, FR-003 | Phase 1 | List view with real data (not mock) |
| `@adk-sim/converters` package | - | Phase 2 | Package scaffold + publishing (no conversion logic yet) |
| Connection status UI | FR-023 | Phase 2 | Simple indicator component |

### Additional Infrastructure Tasks (Not in TDD Phases)

| Task | Source | Notes |
|------|--------|-------|
| Environment configuration | [Frontend Config Research](../research/frontend-configuration-research.md) | Dev proxy + prod same-origin |
| Sheriff setup | [Sheriff Research](../research/sheriff-research.md) | Module boundary enforcement |
| Playwright CT setup | [Playwright Research](../research/playwright-testing-research.md#part-1) | Component testing with VRT |
| Playwright E2E setup | [Playwright Research](../research/playwright-testing-research.md#part-3) | Real backend testing |
| CI workflow for tests | [Playwright Research](../research/playwright-testing-research.md#part-4) | GitHub Actions jobs |
| npm publishing CI | [Converter Research](../research/converter-research.md#publishing-workflow-changes) | Add converters to publish.yaml |

---

## Research Summary

### Relevant Findings

#### Sheriff Module Boundaries

**Source**: [Sheriff Research - Configuration for ADK Simulator](../research/sheriff-research.md#part-3-configuration-for-adk-simulator)

Sheriff enforces a layered architecture where `features/*` can import from `ui/*`, `data-access/*`, `util/*`, and `shared/*`, but UI components cannot import data-access (keeping UI "dumb"). The configuration uses `enableBarrelLess: true` for modern Angular patterns and tags modules by type (`type:feature`, `type:ui`, etc.). Sheriff runs as an ESLint plugin, so existing `npm run lint` and presubmit already enforce rules—no additional CI changes needed beyond installation.

#### Environment Configuration (Dev vs Prod)

**Source**: [Frontend Configuration Research - Recommended Solution](../research/frontend-configuration-research.md#part-2-recommended-solution)

The recommended approach uses Angular CLI's proxy (`proxy.conf.json`) for development, routing `/adksim.v1.SimulatorService/*` requests to `localhost:8080`. Both dev and prod environments set `grpcWebUrl: ''` (empty), meaning all gRPC-Web requests use same-origin relative paths. In dev, the proxy handles routing; in prod, the Python server serves both static files and gRPC-Web on the same port. This eliminates environment-specific configuration in the Connect-ES client.

#### Playwright Component Testing Setup

**Source**: [Playwright Testing Research - Component Testing](../research/playwright-testing-research.md#part-1-component-testing-with-visual-regression)

Use `@sand4rt/experimental-ct-angular` with `@analogjs/vite-plugin-angular` for component testing. Screenshots are stored in `tests/component/__snapshots__/` and version-controlled. The CI job runs in the `mcr.microsoft.com/playwright:v1.52.0-noble` container and fails if uncommitted screenshot changes are detected. Tests use `toHaveScreenshot()` for visual regression with a 1% pixel diff threshold.

#### Playwright E2E Testing Setup

**Source**: [Playwright Testing Research - E2E with Real Backend](../research/playwright-testing-research.md#part-3-e2e-testing-with-real-backend)

E2E tests run against a real backend in Docker Compose (matching the Python E2E pattern). A new `docker-compose.e2e.yaml` starts the backend with health checks. For CI, the workflow starts the stack with `docker compose up -d --wait`, runs Playwright, then tears down. For local dev, global setup/teardown scripts manage the Docker lifecycle. Screenshots are stored in `tests/e2e/__snapshots__/`.

#### Converter Package Publishing

**Source**: [Converter Research - Package Publishing Infrastructure](../research/converter-research.md#package-publishing-infrastructure)

The new `@adk-sim/converters` package lives at `packages/adk-converters-ts/`. It needs: (1) npm trusted publisher configured on npmjs.com, (2) addition to `sync_versions.py` for Changesets integration, (3) a build step in `verify-build` job, and (4) a publish step in `publish-npm` job. The package depends on `@google/adk` and `@adk-sim/protos` (workspace link).

#### Current Frontend State

**Source**: [Project Infrastructure - Current Frontend State](../research/project-infrastructure.md#current-frontend-state)

The frontend is an empty Angular 21 shell with generated protobuf types in `src/app/generated/`. Key dependencies (`@connectrpc/connect-web`, `@angular/material`, `vitest`) are already installed. The environment files exist but use the old pattern (`grpcWebUrl: 'http://localhost:8080'`); they need updating to use empty strings with proxy.

### Key Decisions Already Made

| Decision | Choice | Source |
|----------|--------|--------|
| Module boundary tool | Sheriff with enableBarrelLess | [Sheriff Research](../research/sheriff-research.md#executive-summary) |
| Environment strategy | Proxy for dev, same-origin for prod | [Config Research](../research/frontend-configuration-research.md#part-2-recommended-solution) |
| Component testing | @sand4rt/experimental-ct-angular + Vite | [Playwright Research](../research/playwright-testing-research.md#library-sand4rtexperimental-ct-angular) |
| E2E testing | Playwright + Docker backend | [Playwright Research](../research/playwright-testing-research.md#part-3-e2e-testing-with-real-backend) |
| State management | Native Signals + @ngrx/signals for stores | [TDD Key Decisions](../frontend-tdd.md#key-design-decisions) |

### Open Questions for This Sprint

- [ ] **npm trusted publisher bootstrapping**: Who performs the one-time `@adk-sim/converters` package creation on npmjs.com? (Must be done before CI publish works)
- [ ] **Playwright browser matrix**: Start with Chromium only for speed, or include Firefox/WebKit from day one?
- [ ] **E2E test scope**: How many E2E tests for the barebones Session List? Just "list loads" or also "create session"?

---

## Pull Request Plan

### S1PR1: Sheriff Installation & Configuration

**Estimated Lines**: ~80 lines  
**Depends On**: -

**Goal**: Install Sheriff and configure module boundary rules matching the TDD's layered architecture.

**Files to Create/Modify**:
- `frontend/package.json` - Add Sheriff devDependencies
- `frontend/sheriff.config.ts` - New file with module tags and dependency rules
- `frontend/eslint.config.js` - Add `sheriff.configs.all` to extends array

**Background Reading**:
- [Sheriff Installation & Setup](../research/sheriff-research.md#part-2-installation-setup) - Installation commands and ESLint integration
- [Sheriff Configuration for ADK Simulator](../research/sheriff-research.md#part-3-configuration-for-adk-simulator) - Full config with dependency rules
- [Migration Checklist](../research/sheriff-research.md#part-8-migration-checklist) - Verification steps

**Acceptance Criteria**:
- [ ] `npm install` adds `@softarc/sheriff-core` and `@softarc/eslint-plugin-sheriff`
- [ ] `npx sheriff list` shows detected modules
- [ ] `npm run lint` passes (no violations in empty project)
- [ ] Presubmit passes

---

### S1PR2: Environment Configuration (Dev Proxy + Prod Same-Origin)

**Estimated Lines**: ~60 lines  
**Depends On**: -

**Goal**: Configure Angular proxy for development and update environment files for same-origin gRPC-Web requests.

**Files to Create/Modify**:
- `frontend/proxy.conf.json` - New proxy configuration
- `frontend/angular.json` - Add `proxyConfig` to serve options
- `frontend/src/environments/environment.ts` - Update to `grpcWebUrl: ''`
- `frontend/src/environments/environment.prod.ts` - Confirm `grpcWebUrl: ''`

**Background Reading**:
- [Recommended Solution](../research/frontend-configuration-research.md#part-2-recommended-solution) - Proxy config and Angular setup
- [Proxy Configuration](../research/frontend-configuration-research.md#1-proxy-configuration) - Exact JSON structure
- [Connect-ES Client Configuration](../research/frontend-configuration-research.md#4-connect-es-client-configuration) - How client uses baseUrl

**Acceptance Criteria**:
- [ ] `ng serve` starts with proxy enabled (debug logs show proxy route)
- [ ] Environment files both have `grpcWebUrl: ''`
- [ ] Requests to `/adksim.v1.SimulatorService/*` proxy to `localhost:8080` in dev
- [ ] Presubmit passes

---

### S1PR3: Folder Structure Scaffold (Features, UI, Data-Access, Util)

**Estimated Lines**: ~40 lines (mostly empty index files)  
**Depends On**: S1PR1

**Goal**: Create the folder structure matching the TDD's module layout with placeholder index.ts files.

**Files to Create/Modify**:
- `frontend/src/app/features/` - Create directory
- `frontend/src/app/features/session-list/` - Feature folder for list screen
- `frontend/src/app/ui/` - UI components root
- `frontend/src/app/ui/shared/` - Shared UI components
- `frontend/src/app/data-access/` - Data access layer
- `frontend/src/app/data-access/session/` - Session data access
- `frontend/src/app/util/` - Utilities
- `frontend/src/app/shared/` - Cross-cutting shared code (models, constants)

**Background Reading**:
- [TDD Folder Layout](../frontend-tdd.md#folder-layout) - Complete structure
- [Sheriff Proposed Folder Structure](../research/sheriff-research.md#proposed-folder-structure) - How folders map to Sheriff tags

**Acceptance Criteria**:
- [ ] All folders exist with `.gitkeep` or minimal `index.ts`
- [ ] `npx sheriff list` shows modules detected in new folders
- [ ] `npm run lint` passes
- [ ] Presubmit passes

---

### S1PR4: SessionGateway Port + Mock Implementation

**Estimated Lines**: ~120 lines  
**Depends On**: S1PR3

**Goal**: Create the abstract `SessionGateway` port and a `MockSessionGateway` for testing, supporting `listSessions()` for this sprint.

**Files to Create/Modify**:
- `frontend/src/app/data-access/session/session.gateway.ts` - Abstract port class
- `frontend/src/app/data-access/session/mock-session.gateway.ts` - Mock implementation
- `frontend/src/app/data-access/session/session.gateway.spec.ts` - Unit tests for mock
- `frontend/src/app/data-access/session/index.ts` - Public exports

**Background Reading**:
- [TDD Gateway Port (Abstract)](../frontend-tdd.md#gateway-port-abstract) - Interface definition
- [TDD Mock Gateway](../frontend-tdd.md#mock-gateway-testing) - Mock implementation pattern
- [Hexagonal Architecture](../research/angular-architecture-analysis.md#abstract-ports-for-infrastructure-testing) - Why abstract ports

**Acceptance Criteria**:
- [ ] `SessionGateway` abstract class with `listSessions(): Promise<Session[]>`
- [ ] `MockSessionGateway` extends port with controllable test data
- [ ] Unit tests verify mock behavior
- [ ] Presubmit passes

---

### S1PR5: GrpcSessionGateway Implementation (listSessions only)

**Estimated Lines**: ~100 lines  
**Depends On**: S1PR2, S1PR4

**Goal**: Implement the real gRPC-Web gateway adapter for listing sessions.

**Files to Create/Modify**:
- `frontend/src/app/data-access/session/grpc-session.gateway.ts` - Connect-ES implementation
- `frontend/src/app/data-access/session/grpc-session.gateway.spec.ts` - Tests (with mock transport or MSW)
- `frontend/src/app/data-access/session/index.ts` - Add export

**Background Reading**:
- [TDD gRPC Gateway Adapter](../frontend-tdd.md#grpc-gateway-adapter) - Implementation pattern
- [Prototype gRPC-Web Streaming](../research/prototype-findings.md#grpc-web-streaming-with-connect-es) - Connect-ES patterns
- [Project Infrastructure - Server Communication](../research/project-infrastructure.md#server-communication-architecture) - Backend endpoints

**Acceptance Criteria**:
- [ ] `GrpcSessionGateway.listSessions()` calls backend via Connect-ES
- [ ] Uses `ENVIRONMENT.grpcWebUrl || window.location.origin` for base URL
- [ ] Tests pass (mock transport or actual backend)
- [ ] Presubmit passes

---

### S1PR6: SessionStateService (Global Signals)

**Estimated Lines**: ~80 lines  
**Depends On**: S1PR3

**Goal**: Create the global session state service with signals for session ID, connection status, and errors.

**Files to Create/Modify**:
- `frontend/src/app/data-access/session/session-state.service.ts` - Signal-based state
- `frontend/src/app/data-access/session/session-state.service.spec.ts` - Unit tests
- `frontend/src/app/data-access/session/index.ts` - Add export

**Background Reading**:
- [TDD SessionStateService](../frontend-tdd.md#sessionstateservice-global) - Full implementation
- [Signal-based State Management](../research/prototype-findings.md#signal-based-state-management) - Pattern from prototype

**Acceptance Criteria**:
- [ ] `sessionId`, `connectionStatus`, `error` signals exposed as readonly
- [ ] `isConnected`, `hasError` computed signals work
- [ ] Mutation methods (`setSessionId`, etc.) update state
- [ ] Unit tests cover state transitions
- [ ] Presubmit passes

---

### S1PR7: SessionFacade (Minimal for List)

**Estimated Lines**: ~60 lines  
**Depends On**: S1PR4, S1PR5, S1PR6

**Goal**: Create a minimal facade that orchestrates gateway + state for listing sessions.

**Files to Create/Modify**:
- `frontend/src/app/data-access/session/session.facade.ts` - Facade implementation
- `frontend/src/app/data-access/session/session.facade.spec.ts` - Integration tests
- `frontend/src/app/data-access/session/index.ts` - Add export

**Background Reading**:
- [TDD SessionFacade](../frontend-tdd.md#sessionfacade-orchestration) - Full pattern (implement subset)
- [Facade Pattern](../research/angular-architecture-analysis.md#critical-improvement-the-facade-pattern) - Why facades

**Acceptance Criteria**:
- [ ] `SessionFacade.listSessions()` method works
- [ ] Exposes state signals from `SessionStateService`
- [ ] Tests use `MockSessionGateway`
- [ ] Presubmit passes

---

### S1PR8: Session List Component (Barebones)

**Estimated Lines**: ~150 lines  
**Depends On**: S1PR7

**Goal**: Create a minimal session list component that displays real sessions from the backend.

**Files to Create/Modify**:
- `frontend/src/app/features/session-list/session-list.component.ts` - Component
- `frontend/src/app/features/session-list/session-list.component.html` - Template
- `frontend/src/app/features/session-list/session-list.component.scss` - Styles
- `frontend/src/app/features/session-list/session-list.component.spec.ts` - Tests
- `frontend/src/app/features/session-list/session-list.routes.ts` - Route config
- `frontend/src/app/app.routes.ts` - Wire up route

**Background Reading**:
- [FR Session Management](../frontend-spec.md#fr-session-management) - FR-002, FR-003 requirements
- [TDD Folder Layout](../frontend-tdd.md#folder-layout) - Where it goes
- [TDD Routing Configuration](../frontend-tdd.md#routing-configuration) - Route structure

**Acceptance Criteria**:
- [ ] Component fetches sessions via `SessionFacade.listSessions()` on init
- [ ] Displays session ID, creation time, status for each session (FR-003)
- [ ] Loading state while fetching
- [ ] Error state if fetch fails
- [ ] Route `/` loads the component
- [ ] Tests pass with MockSessionGateway
- [ ] Presubmit passes

---

### S1PR9: Connection Status Component

**Estimated Lines**: ~60 lines  
**Depends On**: S1PR6

**Goal**: Create a simple connection status indicator component (FR-023).

**Files to Create/Modify**:
- `frontend/src/app/ui/shared/connection-status/connection-status.component.ts` - Component
- `frontend/src/app/ui/shared/connection-status/connection-status.component.spec.ts` - Tests
- `frontend/src/app/ui/shared/connection-status/index.ts` - Export
- `frontend/src/app/features/session-list/session-list.component.html` - Add indicator

**Background Reading**:
- [FR-023 Connection Status](../frontend-spec.md#fr-communication) - Requirement
- [TDD Folder Layout](../frontend-tdd.md#folder-layout) - ui/shared location

**Acceptance Criteria**:
- [ ] Shows "Connected", "Connecting", or "Disconnected" based on `SessionStateService.connectionStatus`
- [ ] Visual indicator (icon or color)
- [ ] Unit tests cover all states
- [ ] Presubmit passes

---

### S1PR10: Playwright Component Testing Setup

**Estimated Lines**: ~150 lines  
**Depends On**: S1PR8, S1PR9

**Goal**: Set up Playwright component testing infrastructure with a sample test.

**Files to Create/Modify**:
- `frontend/package.json` - Add Playwright CT dependencies and scripts
- `frontend/playwright-ct.config.ts` - Component test config
- `frontend/playwright/index.ts` - Bootstrap file with TestBed hooks
- `frontend/tests/component/connection-status.spec.ts` - Sample component test with screenshot
- `frontend/tests/component/__snapshots__/` - Directory for baseline screenshots

**Background Reading**:
- [Playwright CT Setup](../research/playwright-testing-research.md#part-1-component-testing-with-visual-regression) - Full setup guide
- [Bootstrap File](../research/playwright-testing-research.md#bootstrap-file) - TestBed hooks
- [Component Test Examples](../research/playwright-testing-research.md#component-test-examples) - Test patterns

**Acceptance Criteria**:
- [ ] `npm run test:ct` runs Playwright component tests
- [ ] Sample test for `ConnectionStatusComponent` passes
- [ ] Screenshot saved to `__snapshots__/`
- [ ] `test:ct:update` script updates screenshots
- [ ] Presubmit passes

---

### S1PR11: Playwright E2E Testing Setup

**Estimated Lines**: ~180 lines  
**Depends On**: S1PR8

**Goal**: Set up Playwright E2E testing with Docker backend integration.

**Files to Create/Modify**:
- `docker-compose.e2e.yaml` - E2E Docker Compose stack
- `frontend/playwright.config.ts` - E2E test config
- `frontend/tests/e2e/global-setup.ts` - Docker startup (local dev)
- `frontend/tests/e2e/global-teardown.ts` - Docker cleanup (local dev)
- `frontend/tests/e2e/session-list.spec.ts` - E2E test for session list
- `frontend/tests/e2e/__snapshots__/` - Directory for E2E screenshots
- `frontend/package.json` - Add E2E test scripts

**Background Reading**:
- [E2E Testing Setup](../research/playwright-testing-research.md#part-3-e2e-testing-with-real-backend) - Docker Compose and config
- [Docker Compose for E2E](../research/playwright-testing-research.md#docker-compose-for-e2e) - YAML structure
- [E2E Test Example](../research/playwright-testing-research.md#e2e-test-example) - Test patterns

**Acceptance Criteria**:
- [ ] `npm run test:e2e` starts Docker, runs tests, stops Docker
- [ ] Session list E2E test loads page and verifies content
- [ ] Screenshot captured for session list view
- [ ] Works locally with global setup/teardown
- [ ] Presubmit passes (without E2E - those run in separate CI job)

---

### S1PR12: CI Workflow for Frontend Tests

**Estimated Lines**: ~120 lines  
**Depends On**: S1PR10, S1PR11

**Goal**: Add GitHub Actions workflow for component tests and E2E tests.

**Files to Create/Modify**:
- `.github/workflows/frontend-tests.yaml` - New workflow with two jobs

**Background Reading**:
- [CI Workflow Integration](../research/playwright-testing-research.md#part-4-ci-workflow-integration) - Full workflow YAML
- [CI Enforcement Strategy](../research/playwright-testing-research.md#ci-enforcement-strategy) - Screenshot change detection

**Acceptance Criteria**:
- [ ] `component-tests` job runs in Playwright container
- [ ] `e2e-tests` job uses Docker Compose
- [ ] Both jobs upload test results as artifacts
- [ ] Component test job fails if uncommitted screenshots detected
- [ ] Workflow triggers on `frontend/**` path changes

---

### S1PR13: @adk-sim/converters Package Scaffold

**Estimated Lines**: ~100 lines  
**Depends On**: -

**Goal**: Create the converter package scaffold (no conversion logic yet—just structure for publishing).

**Files to Create/Modify**:
- `packages/adk-converters-ts/package.json` - Package config
- `packages/adk-converters-ts/tsconfig.json` - TypeScript config
- `packages/adk-converters-ts/src/index.ts` - Placeholder exports
- `packages/adk-converters-ts/src/request-converter.ts` - Stub with TODO
- `packages/adk-converters-ts/README.md` - Package documentation

**Background Reading**:
- [Adding adk-converters-ts](../research/converter-research.md#adding-adk-converters-ts) - Package structure
- [Package Publishing Infrastructure](../research/converter-research.md#package-publishing-infrastructure) - package.json contents

**Acceptance Criteria**:
- [ ] Package builds with `npm run build`
- [ ] Exports placeholder functions
- [ ] `@google/adk` and `@adk-sim/protos` as dependencies
- [ ] Presubmit passes

---

### S1PR14: npm Publishing CI for @adk-sim/converters

**Estimated Lines**: ~50 lines  
**Depends On**: S1PR13

**Goal**: Update publish.yaml to build and publish the converters package.

**Files to Create/Modify**:
- `.github/workflows/publish.yaml` - Add converters build and publish steps
- `scripts/sync_versions.py` - Add converters to version sync

**Background Reading**:
- [Publishing Workflow Changes](../research/converter-research.md#publishing-workflow-changes) - Exact changes needed
- [Trusted Publisher Configuration](../research/converter-research.md#trusted-publisher-configuration) - npmjs.com setup (manual)

**Acceptance Criteria**:
- [ ] `verify-build` job builds converters package
- [ ] `publish-npm` job publishes converters (after trusted publisher configured)
- [ ] `sync_versions.py` includes converters package path
- [ ] Workflow syntax valid (act or manual review)

**Manual Step Required**:
- [ ] Configure npm trusted publisher for `@adk-sim/converters` on npmjs.com

---

### S1PR15: Verify Full Stack Integration

**Estimated Lines**: ~30 lines (test updates only)  
**Depends On**: S1PR8, S1PR11

**Goal**: Add an integration verification test that confirms the session list works with the real backend.

**Files to Create/Modify**:
- `frontend/tests/e2e/integration-smoke.spec.ts` - Smoke test hitting real backend

**Background Reading**:
- [E2E Test Example](../research/playwright-testing-research.md#e2e-test-example) - Test structure

**Acceptance Criteria**:
- [ ] Test creates a session via backend API
- [ ] Test verifies session appears in list
- [ ] Test takes screenshot of populated list
- [ ] E2E suite passes locally and in CI

---

## Implementation Notes

### PR Ordering Flexibility

PRs S1PR1-S1PR3 and S1PR13 have no dependencies and can be done in parallel by different developers or sessions.

The critical path is:
1. S1PR4 (Gateway Port) → S1PR5 (gRPC Gateway) → S1PR7 (Facade) → S1PR8 (Session List)
2. S1PR6 (State Service) → S1PR7 (Facade)
3. S1PR10 + S1PR11 → S1PR12 (CI)

### Testing Philosophy

- **Unit tests**: Use `vitest` for pure logic (util/, services)
- **Component tests**: Use `@angular/testing-library` with real child components (sociable)
- **Playwright CT**: Visual regression for UI components
- **Playwright E2E**: Real backend integration

### Sheriff Verification

After each PR that adds code, verify Sheriff is happy:
```bash
npm run lint
npx sheriff verify
```

### Manual Bootstrapping Required

Before S1PR14 can successfully publish:
1. Someone with npm access must create the `@adk-sim/converters` package on npmjs.com
2. Configure GitHub Actions as a trusted publisher for that package
3. The package name must match exactly: `@adk-sim/converters`
