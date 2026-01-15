# Sprint 3: Session Navigation & Event Stream Foundation


## Table of Contents

- [Sprint Goal](#sprint-goal)
- [Selected Scope](#selected-scope)
  - [Tasks from TDD](#tasks-from-tdd)
- [Research Summary](#research-summary)
  - [Relevant Findings](#relevant-findings)
    - [Session Validation Pattern](#session-validation-pattern)
    - [gRPC-Web Streaming Pattern](#grpc-web-streaming-pattern)
    - [Auto-Reconnect Strategy](#auto-reconnect-strategy)
    - [Event Block Rendering Pattern](#event-block-rendering-pattern)
  - [Key Decisions Already Made](#key-decisions-already-made)
  - [Open Questions for This Sprint](#open-questions-for-this-sprint)
- [Pull Request Plan](#pull-request-plan)
  - [S3PR1: Extend SessionGateway with getSession and subscribe methods](#s3pr1-extend-sessiongateway-with-getsession-and-subscribe-methods)
  - [S3PR2: Add session route with guard (FR-001, FR-004)](#s3pr2-add-session-route-with-guard-fr-001-fr-004)
  - [S3PR3: Create ReconnectStrategy utility](#s3pr3-create-reconnectstrategy-utility)
  - [S3PR4: Extend SessionFacade with subscribe and validation methods](#s3pr4-extend-sessionfacade-with-subscribe-and-validation-methods)
  - [S3PR5: Create EventStreamComponent container](#s3pr5-create-eventstreamcomponent-container)
  - [S3PR6: Create EventBlockComponent](#s3pr6-create-eventblockcomponent)
  - [S3PR7: Add E2E tests for session navigation and event rendering](#s3pr7-add-e2e-tests-for-session-navigation-and-event-rendering)
- [Implementation Notes](#implementation-notes)
  - [Patterns to Follow](#patterns-to-follow)
  - [Gotchas to Avoid](#gotchas-to-avoid)
- [Definition of Done](#definition-of-done)
- [Retrospective Notes](#retrospective-notes)

## Sprint Goal

Complete the remaining Week 1-2 infrastructure tasks and establish the foundation for event stream visualization. By sprint end, users will be able to navigate to a specific session via URL, see the session validated, and view incoming events rendered as conversation blocks. This sprint bridges the gap between session listing and full session interaction.

---

## Selected Scope

### Tasks from TDD

| Task | FR | Phase | Notes |
|------|----|-------|-------|
| Session route + guard | FR-001, FR-004 | Phase 1 | Navigation + session validation |
| `GrpcSessionGateway` (extend) | FR-020 | Phase 2 | Add `getSession` and `subscribe` methods |
| Auto-reconnect logic | FR-022, FR-023 | Phase 2 | `ReconnectStrategy` utility |
| `EventStreamComponent` | FR-007 | Phase 3 | Container for blocks |
| `EventBlockComponent` | FR-007 | Phase 3 | User/Agent/Tool blocks |

**Carry-over from Week 1**: Session route + guard was the only incomplete Week 1 task.
**Carry-over from Week 2**: gRPC gateway extensions and auto-reconnect logic were not covered in Sprint 2.
**Week 3 Start**: EventStreamComponent and EventBlockComponent begin the event stream work.

---

## Research Summary

### Relevant Findings

#### Session Validation Pattern

**Source**: [Session Validation on Navigation](../research/prototype-findings.md#session-validation-on-navigation)

The prototype validates session existence before navigation using `getSession()` RPC. For direct URL navigation (e.g., `/session/:id`), this should be implemented as a route guard that calls `SessionFacade.validateSession()`. On validation failure, redirect to session list with an error query parameter. The TDD specifies this pattern in the [Routing Configuration](../frontend-tdd.md#routing-configuration) section with a `sessionExistsGuard`.

#### gRPC-Web Streaming Pattern

**Source**: [gRPC-Web Streaming with Connect-ES](../research/prototype-findings.md#grpc-web-streaming-with-connect-es)

Connect-ES v2 uses async iterators for server streaming. The pattern wraps the generated client in a service class, uses `AbortController` for cancellation, and yields events via async generator. The existing `GrpcSessionGateway` only implements `listSessions()`; it needs `getSession()` for validation and `subscribe()` for the event stream. The `subscribe()` method should match the TDD's [gRPC Gateway Adapter](../frontend-tdd.md#grpc-gateway-adapter) specification.

#### Auto-Reconnect Strategy

**Source**: [Connection Lifecycle with Auto-Reconnect](../research/prototype-findings.md#connection-lifecycle-with-auto-reconnect)

The prototype implements reconnection with fixed delay and attempt limits. The TDD enhances this with exponential backoff via `ReconnectStrategy` utility class (see [Auto-Reconnect Logic](../frontend-tdd.md#auto-reconnect-logic)). This utility should be placed in `util/reconnect/` and used by the `SessionComponent` to manage reconnection after stream disconnection. The strategy tracks attempts, calculates delays with exponential backoff, and caps at configurable limits.

#### Event Block Rendering Pattern

**Source**: [EventBlockComponent](../frontend-tdd.md#eventblockcomponent)

Event blocks render conversation turns with distinct styling for User Input, Agent Response, and Tool Execution types. The block type is computed from the Content's role and parts (e.g., model role with functionCall → "tool" type). Parts are iterated to render text, function calls (with DataTree for args), and function responses. The component uses Material icons and signals for reactive updates.

### Key Decisions Already Made

| Decision | Choice | Source |
|----------|--------|--------|
| Communication protocol | Connect-ES v2 gRPC-Web | [Key Design Decisions](../frontend-tdd.md#key-design-decisions) |
| Reconnect strategy | Exponential backoff with configurable limits | [Auto-Reconnect Logic](../frontend-tdd.md#auto-reconnect-logic) |
| Route guard pattern | Async guard with facade validation | [Routing Configuration](../frontend-tdd.md#routing-configuration) |
| Event block types | user/model/tool based on role and parts | [EventBlockComponent](../frontend-tdd.md#eventblockcomponent) |
| State management | Signals for block type, parts, icon, label | [EventBlockComponent](../frontend-tdd.md#eventblockcomponent) |

### Open Questions for This Sprint

- [ ] Should `EventStreamComponent` manage its own event list or receive it as input? (Prefer input for testability)
- [ ] Should error handling in the guard show a toast or rely on query params? (TDD specifies query params)

---

## Pull Request Plan

### S3PR1: Extend SessionGateway with getSession and subscribe methods

**Estimated Lines**: ~120 lines
**Depends On**: -

**Goal**: Add the gateway port methods and gRPC implementation needed for session validation and event streaming.

**Files to Create/Modify**:
- `frontend/src/app/data-access/session/session.gateway.ts` - Add `getSession()` and `subscribe()` abstract methods
- `frontend/src/app/data-access/session/grpc-session.gateway.ts` - Implement gRPC methods with AbortController
- `frontend/src/app/data-access/session/grpc-session.gateway.spec.ts` - Unit tests for new methods
- `frontend/src/app/data-access/session/mock-session.gateway.ts` - Add mock implementations

**Background Reading**:
- [Gateway Port (Abstract)](../frontend-tdd.md#gateway-port-abstract) - Port interface contract
- [gRPC Gateway Adapter](../frontend-tdd.md#grpc-gateway-adapter) - Implementation pattern
- [gRPC-Web Streaming with Connect-ES](../research/prototype-findings.md#grpc-web-streaming-with-connect-es) - Async generator pattern

**Acceptance Criteria**:
- [x] `SessionGateway.getSession(sessionId)` abstract method added
- [x] `SessionGateway.subscribe(sessionId)` returning `AsyncIterable<SessionEvent>` added
- [x] `SessionGateway.cancelSubscription()` abstract method added
- [x] `GrpcSessionGateway` implements all methods with AbortController cancellation
- [x] `MockSessionGateway` has controllable implementations with `pushSession()` and `pushEvent()` helpers
- [x] Unit tests cover success and error cases
- [x] Presubmit passes

---

### S3PR2: Add session route with guard (FR-001, FR-004)

**Estimated Lines**: ~150 lines
**Depends On**: S3PR1

**Goal**: Create the session feature route with a validation guard and basic SessionComponent scaffold.

**Completes TDD Task**: `Session route + guard` (Phase 1)

**Files to Create/Modify**:
- `frontend/src/app/app.routes.ts` - Add session route with guard
- `frontend/src/app/features/session/session.component.ts` - Create scaffold component
- `frontend/src/app/features/session/session.component.spec.ts` - Unit tests
- `frontend/src/app/features/session/session.guard.ts` - Route guard with facade validation
- `frontend/src/app/features/session/session.guard.spec.ts` - Guard unit tests
- `frontend/src/app/features/session/index.ts` - Public API exports
- `frontend/src/app/features/index.ts` - Update feature exports

**Background Reading**:
- [Routing Configuration](../frontend-tdd.md#routing-configuration) - Route setup and guard code
- [Session Validation on Navigation](../research/prototype-findings.md#session-validation-on-navigation) - Validation pattern
- [FR-001, FR-004](../frontend-spec.md#fr-session-management) - Requirements

**Acceptance Criteria**:
- [ ] Route `/session/:id` loads `SessionComponent` lazily
- [ ] Guard validates session existence via facade before allowing navigation
- [ ] Invalid session redirects to `/` with `?error=Session+not+found` query param
- [ ] Missing session ID redirects with appropriate error message
- [ ] `SessionComponent` scaffold displays session ID from route params
- [ ] Tests cover valid session, invalid session, and missing ID cases
- [ ] Presubmit passes

---

### S3PR3: Create ReconnectStrategy utility

**Estimated Lines**: ~80 lines
**Depends On**: -

**Goal**: Implement the exponential backoff reconnection strategy utility for use in session streaming.

**Files to Create/Modify**:
- `frontend/src/app/util/reconnect/reconnect-strategy.ts` - Strategy class
- `frontend/src/app/util/reconnect/reconnect-strategy.spec.ts` - Unit tests
- `frontend/src/app/util/reconnect/index.ts` - Public exports
- `frontend/src/app/util/index.ts` - Update util exports

**Background Reading**:
- [Auto-Reconnect Logic](../frontend-tdd.md#auto-reconnect-logic) - Implementation specification
- [Connection Lifecycle with Auto-Reconnect](../research/prototype-findings.md#connection-lifecycle-with-auto-reconnect) - Prototype pattern

**Acceptance Criteria**:
- [x] `ReconnectConfig` interface with `maxAttempts`, `baseDelayMs`, `maxDelayMs`
- [x] `ReconnectStrategy.reset()` clears attempt counter
- [x] `ReconnectStrategy.canRetry()` returns true while under max attempts
- [x] `ReconnectStrategy.getNextDelay()` returns exponentially increasing delays capped at max
- [x] `ReconnectStrategy.currentAttempt` getter returns current attempt count
- [x] Default config: 5 attempts, 1000ms base, 30000ms max
- [x] Unit tests verify backoff calculations (1s, 2s, 4s, 8s, 16s→30s)
- [x] Presubmit passes

---

### S3PR4: Extend SessionFacade with subscribe and validation methods

**Estimated Lines**: ~100 lines
**Depends On**: S3PR1, S3PR3

**Goal**: Add session validation and streaming subscription methods to the facade, integrating with gateway and state.

**Completes TDD Task**: `GrpcSessionGateway` (Phase 2), `Auto-reconnect logic` (Phase 2)

**Files to Create/Modify**:
- `frontend/src/app/data-access/session/session.facade.ts` - Add `validateSession()` and `subscribeToSession()` methods
- `frontend/src/app/data-access/session/session.facade.spec.ts` - Unit tests for new methods

**Background Reading**:
- [SessionFacade (Orchestration)](../frontend-tdd.md#sessionfacade-orchestration) - Full facade design
- [Connection Lifecycle with Auto-Reconnect](../research/prototype-findings.md#connection-lifecycle-with-auto-reconnect) - Usage pattern

**Acceptance Criteria**:
- [x] `validateSession(sessionId)` calls `gateway.getSession()` and throws on failure
- [x] `subscribeToSession(sessionId)` yields converted `LlmRequest` events
- [x] `subscribeToSession()` updates connection status during lifecycle
- [x] `cancelSubscription()` method delegates to gateway
- [x] State service updated with session ID on subscription start
- [x] Unit tests cover validation success/failure and subscription lifecycle
- [x] Presubmit passes

---

### S3PR5: Create EventStreamComponent container

**Estimated Lines**: ~80 lines
**Depends On**: -

**Goal**: Create the container component that holds the event stream, managing the list of events and rendering EventBlockComponents.

**Completes TDD Task**: `EventStreamComponent` (Phase 3)

**Files to Create/Modify**:
- `frontend/src/app/ui/event-stream/event-stream.component.ts` - Container component
- `frontend/src/app/ui/event-stream/event-stream.component.spec.ts` - Unit tests
- `frontend/src/app/ui/event-stream/index.ts` - Public exports
- `frontend/src/app/ui/index.ts` - Update ui exports

**Background Reading**:
- [Event Stream Components](../frontend-tdd.md#event-stream-components) - Component design overview
- [FR-007](../frontend-spec.md#fr-context-inspection) - Conversation history as structured blocks

**Acceptance Criteria**:
- [x] Component accepts `events` input signal of `Content[]` (conversation contents)
- [x] Component renders placeholder text when events array is empty
- [x] Component iterates events using `@for` with tracking
- [x] Component slot for rendering child EventBlockComponents (or direct render in next PR)
- [x] Uses `ChangeDetectionStrategy.OnPush` and signals
- [x] Unit tests verify empty state and event iteration
- [x] Presubmit passes

---

### S3PR6: Create EventBlockComponent

**Estimated Lines**: ~150 lines
**Depends On**: S3PR5

**Goal**: Implement the event block component that renders individual conversation turns with role-based styling.

**Completes TDD Task**: `EventBlockComponent` (Phase 3)

**Files to Create/Modify**:
- `frontend/src/app/ui/event-stream/event-block/event-block.component.ts` - Block component
- `frontend/src/app/ui/event-stream/event-block/event-block.component.spec.ts` - Unit tests
- `frontend/src/app/ui/event-stream/event-block/index.ts` - Public exports
- `frontend/src/app/ui/event-stream/index.ts` - Update exports
- `frontend/src/app/ui/event-stream/event-stream.component.ts` - Integrate EventBlockComponent

**Background Reading**:
- [EventBlockComponent](../frontend-tdd.md#eventblockcomponent) - Full implementation spec
- [FR-007](../frontend-spec.md#fr-context-inspection) - Block rendering requirements

**Acceptance Criteria**:
- [x] Component accepts `content` input signal of type `Content`
- [x] `blockType` computed signal returns 'user', 'model', or 'tool' based on role and parts
- [x] `parts` computed signal extracts parts array from content
- [x] `icon` computed signal maps block type to Material icon name
- [x] `label` computed signal maps block type to display label
- [x] Template renders header with icon and label
- [x] Template iterates parts and displays text content (function call/response display deferred to DataTree PR)
- [x] Styling differentiates block types with CSS classes
- [x] Unit tests cover all block type computations
- [x] EventStreamComponent updated to render EventBlockComponents
- [x] Presubmit passes

---

### S3PR7: Add E2E tests for session navigation and event rendering

**Estimated Lines**: ~150 lines
**Depends On**: S3PR2, S3PR6

**Goal**: Add Playwright E2E tests covering session navigation (including guard validation) and event stream rendering added in Sprint 3.

**Files to Create/Modify**:
- `frontend/tests/e2e/session-navigation.spec.ts` - E2E tests for session route and guard
- `frontend/tests/e2e/__snapshots__/session-navigation.spec.ts-snapshots/` - Screenshot baselines

**Background Reading**:
- [E2E Test Example](./research/playwright-testing-research.md#e2e-test-example) - Test structure pattern
- [Docker Compose for E2E](./research/playwright-testing-research.md#docker-compose-for-e2e) - Test environment setup
- [Session Validation on Navigation](./research/prototype-findings.md#session-validation-on-navigation) - Guard behavior to verify

**Acceptance Criteria**:
- [x] Test navigates to valid session URL and verifies SessionComponent loads
- [x] Test navigates to invalid session ID and verifies redirect to `/` with `?error=Session+not+found`
- [x] Test navigates to session URL with missing ID and verifies appropriate error handling
- [x] Test verifies EventStreamComponent renders with empty state placeholder
- [x] Test verifies EventBlockComponent renders user, model, and tool block types with correct styling
- [x] Screenshot baselines captured for session view with event blocks
- [x] Tests run successfully in Docker Compose E2E environment
- [x] Presubmit passes

---

## Implementation Notes

### Patterns to Follow

1. **Async Generator for Streaming**: Use `async *` generators in gateway and facade for subscription methods. Consumer iterates with `for await...of`.

2. **AbortController for Cancellation**: Store controller instance, check `signal.aborted` in loops, call `abort()` in `cancelSubscription()`.

3. **Signal-based Computed Properties**: Use `computed()` for derived state in components (blockType, icon, label). Avoid imperative updates.

4. **Route Guard as Function**: Use `CanActivateFn` function style per Angular 15+, not class-based guards.

5. **Query Params for Errors**: Redirect with `queryParams: { error: 'message' }` on validation failure. Session list component should display these.

### Gotchas to Avoid

- **Don't forget `cancelSubscription()` on destroy**: Use `DestroyRef.onDestroy()` to clean up subscriptions
- **Mock gateway needs async behavior**: Use `Promise.resolve()` or actual delays in mock to simulate async behavior properly
- **Route guard must be async**: Return `Promise<boolean | UrlTree>` or use `async/await`
- **Content.parts can be undefined**: Always use nullish coalescing (`content.parts ?? []`) when accessing parts
- **SessionEvent structure**: The proto uses `event.event.case` for discriminated union - check the ADK protos package for exact structure

---

## Definition of Done

- [ ] All 7 PRs merged to feature branch
- [ ] All acceptance criteria verified
- [ ] TDD tasks checked off in frontend-tdd.md
- [ ] No presubmit failures
- [ ] Manual smoke test: navigate to valid/invalid session URLs, see blocks render

---

## Retrospective Notes

*(To be filled after sprint completion)*
