---
title: Angular Architecture Best Practices Analysis
type: research
parent: ../frontend-spec.md
related:
  - ../frontend-spec.md
  - ./prototype-findings.md
---

# Angular Architecture Best Practices Analysis

**Source**: `docs/developers/angular/angular-architecture-practices.md`
**Date**: January 11, 2026
**Purpose**: Apply enterprise Angular architectural heuristics to the ADK Simulator Web UI design.

## Related Documents

- [Frontend Spec](../frontend-spec.md) - Feature specification this research supports
- [Prototype Findings](./prototype-findings.md) - Patterns from streaming prototype

---

## Table of Contents

- [Related Documents](#related-documents)
- [Overview](#overview)
- [Architectural Topology Decision](#architectural-topology-decision)
  - [Recommendation: Modular Monolith](#recommendation-modular-monolith)
- [Library Type Taxonomy](#library-type-taxonomy)
  - [Proposed Library Structure for ADK Simulator](#proposed-library-structure-for-adk-simulator)
  - [Dependency Rules](#dependency-rules)
- [Prototype Compliance Assessment](#prototype-compliance-assessment)
  - [What the Prototype Did Well](#what-the-prototype-did-well)
  - [Areas for Improvement](#areas-for-improvement)
  - [Critical Improvement: The Facade Pattern](#critical-improvement-the-facade-pattern)
- [State Management Strategy](#state-management-strategy)
  - [The State/Event Duality](#the-stateevent-duality)
  - [Global vs. Feature State](#global-vs-feature-state)
- [Component Architecture](#component-architecture)
  - [Smart vs. Dumb Boundary](#smart-vs-dumb-boundary)
  - [Signal Inputs for Dumb Components](#signal-inputs-for-dumb-components)
- [Testability Design](#testability-design)
  - [The Humble Component Rule](#the-humble-component-rule)
  - [Abstract Ports for Infrastructure Testing](#abstract-ports-for-infrastructure-testing)
- [Zoneless Readiness](#zoneless-readiness)
- [Boundary Enforcement Strategy](#boundary-enforcement-strategy)
  - [Option 1: Nx Constraints (If Using Nx)](#option-1-nx-constraints-if-using-nx)
  - [Option 2: Sheriff (Standalone Enforcement)](#option-2-sheriff-standalone-enforcement)
- [Recommendations Summary](#recommendations-summary)
- [Open Questions for Technical Design](#open-questions-for-technical-design)


## Overview

This document analyzes how the Angular Architecture Best Practices guide applies to our frontend design. The guide emphasizes **boundary enforcement**, **loose coupling**, **testability**, and **Signal-based reactivity**—all critical for a maintainable application.

---

## Architectural Topology Decision

### Recommendation: Modular Monolith

Per the architecture guide's "Unity Default" heuristic, we should use a **Modular Monolith** rather than Micro Frontends:

> "Default to a Modular Monolith structured via strict workspace tools (Nx) or boundary enforcement libraries (Sheriff). Adopting Micro Frontends is a 'last resort' optimization."

**Rationale for our project**:
- Single development team
- Unified deployment cadence
- Shared state across features (session, connection status)
- Type safety across the entire application is critical for protobuf types

**Application**: Organize our frontend as a single Angular application with enforced library boundaries, not as federated modules.

---

## Library Type Taxonomy

The architecture guide prescribes four library types with strict unidirectional dependencies:

```
Feature → UI → Data-Access → Utility
```

### Proposed Library Structure for ADK Simulator

```
frontend/src/app/
├── features/                    # Feature Libraries
│   ├── session-list/           # FR-002, FR-003: Browse sessions
│   ├── session/                # FR-001, FR-005: Main simulation interface
│   └── join-session/           # FR-001, FR-004: Join by ID
│
├── ui/                         # UI Libraries (Presentational)
│   ├── event-stream/           # FR-007-015: Event blocks, data trees
│   │   ├── event-block/
│   │   ├── data-tree/
│   │   └── smart-blob/
│   ├── control-panel/          # FR-016-019: Tool catalog, forms
│   │   ├── tool-catalog/
│   │   ├── dynamic-form/
│   │   └── final-response/
│   └── shared/                 # Connection status, layout primitives
│       ├── connection-status/
│       └── split-pane/
│
├── data-access/                # Data-Access Libraries
│   ├── session/                # Session state, gRPC service
│   └── llm-request/            # LlmRequest processing
│
├── util/                       # Utility Libraries
│   ├── json-detection/         # SmartBlob JSON/MD detection
│   ├── schema-utils/           # JSON Schema helpers
│   └── reconnect/              # Reconnection logic
│
└── generated/                  # Protobuf types (external)
```

### Dependency Rules

| Library Type | Can Import From | Cannot Import From |
|--------------|-----------------|-------------------|
| `features/*` | `ui/*`, `data-access/*`, `util/*`, `generated/` | Other features |
| `ui/*` | `util/*`, `generated/` (types only) | `data-access/*`, `features/*` |
| `data-access/*` | `util/*`, `generated/` | `ui/*`, `features/*` |
| `util/*` | Nothing (self-contained) | Everything else |

**Maintenance Nightmare Prevented**: Circular dependencies and spaghetti imports. A UI component cannot accidentally call a service method that triggers side effects.

---

## Prototype Compliance Assessment

Comparing the [prototype architecture](./prototype-findings.md#architecture-summary) against best practices:

### What the Prototype Did Well

| Practice | Prototype Implementation | Status |
|----------|-------------------------|--------|
| Signal-based state | `SessionStateService` with private/readonly signals | ✅ Compliant |
| Computed derivations | `pendingProposal`, `proposalHistory` | ✅ Compliant |
| Standalone components | All components are standalone | ✅ Compliant |
| Lazy-loaded routes | Feature routes use `loadComponent` | ✅ Compliant |
| Smart/Dumb separation | Container (`SessionComponent`) vs Presentational (`HistoryPanel`) | ✅ Partial |

### Areas for Improvement

| Practice | Prototype Gap | Recommendation |
|----------|--------------|----------------|
| **Facade Pattern** | Components inject both `SessionStateService` AND `ApprovalService` directly | Introduce `SessionFacade` that combines state + RPC operations |
| **Library Boundaries** | Flat folder structure, no enforcement | Organize into `features/`, `ui/`, `data-access/`, `util/` with linting rules |
| **Component Logic** | `SessionComponent` contains reconnection logic | Extract to `ReconnectionService` in `util/` |
| **Hexagonal Ports** | `ApprovalService` directly creates gRPC transport | Define abstract `SessionGateway` port, implement as `GrpcSessionGateway` |

### Critical Improvement: The Facade Pattern

The prototype's `DecisionPanelComponent` injects both services:

```typescript
// Prototype pattern (suboptimal)
export class DecisionPanelComponent {
  private readonly approvalService = inject(ApprovalService);
  readonly sessionState = inject(SessionStateService);

  async submitDecision(approved: boolean): Promise<void> {
    // Component orchestrates state + RPC
    const response = await this.approvalService.submitDecision(...);
    this.sessionState.updateProposal(response.proposal);
  }
}
```

**Improved pattern per architecture guide**:

```typescript
// Recommended: Facade encapsulates orchestration
@Injectable()
export class SessionFacade {
  private readonly state = inject(SessionStateService);
  private readonly gateway = inject(SessionGateway); // Abstract port

  // Expose signals for reading
  readonly pendingProposal = this.state.pendingProposal;
  readonly connectionStatus = this.state.connectionStatus;

  // Encapsulate write operations
  async submitDecision(approved: boolean): Promise<void> {
    const pending = this.state.pendingProposal();
    if (!pending) return;

    const response = await this.gateway.submitDecision(
      this.state.sessionId()!,
      pending.proposalId,
      approved
    );
    this.state.updateProposal(response.proposal);
  }
}

// Component becomes "humble"
export class DecisionPanelComponent {
  readonly facade = inject(SessionFacade);

  onApprove(): void {
    this.facade.submitDecision(true);
  }
}
```

**Benefits**:
- Component has no knowledge of `ApprovalService` or state mutation
- Facade can be easily mocked for testing
- If we change from gRPC to REST, only the gateway adapter changes

---

## State Management Strategy

### The State/Event Duality

Per the architecture guide:

> "Use Signals for State (holding data). Use RxJS for Events (streams of actions)."

**Application to our spec**:

| Concern | Primitive | Rationale |
|---------|-----------|-----------|
| Current `LlmRequest` | `Signal<LlmRequest \| null>` | Single current value, rendered in template |
| Connection status | `Signal<ConnectionStatus>` | Discrete states, rendered in template |
| Request queue | `Signal<LlmRequest[]>` | Ordered list, derived views via `computed` |
| Server stream | `AsyncIterable` (RxJS internally) | Event-driven, transformed to signal updates |
| Form submission | `Promise` (one-shot) | Single response, not ongoing stream |

### Global vs. Feature State

Per "Push State Down" heuristic:

| State Type | Scope | Implementation |
|------------|-------|----------------|
| Session ID, Connection Status | Global | Root-provided `SessionFacade` |
| Current LlmRequest, Request Queue | Feature | Route-provided `SimulationStore` (SignalStore) |
| Tool selection, Form state | Component | Local `signal()` in component |
| UI toggles (collapse state) | Component | Local `signal()` in component |

**Proposed SignalStore for Simulation Feature**:

```typescript
export const SimulationStore = signalStore(
  withState<SimulationState>({
    currentRequest: null,
    requestQueue: [],
    selectedTool: null,
  }),
  withComputed((store) => ({
    hasRequest: computed(() => store.currentRequest() !== null),
    queueLength: computed(() => store.requestQueue().length),
    availableTools: computed(() => store.currentRequest()?.tools ?? []),
  })),
  withMethods((store, facade = inject(SessionFacade)) => ({
    processIncomingRequest(request: LlmRequest): void {
      // If no current request, set it; otherwise queue it (FR-024)
      if (store.currentRequest() === null) {
        patchState(store, { currentRequest: request });
      } else {
        patchState(store, {
          requestQueue: [...store.requestQueue(), request]
        });
      }
    },
    async submitToolResponse(toolName: string, args: unknown): Promise<void> {
      await facade.submitToolInvocation(toolName, args);
      this.advanceQueue();
    },
    advanceQueue(): void {
      const [next, ...rest] = store.requestQueue();
      patchState(store, {
        currentRequest: next ?? null,
        requestQueue: rest
      });
    },
  }))
);
```

---

## Component Architecture

### Smart vs. Dumb Boundary

Per spec [FR-005](../frontend-spec.md#fr-layout-and-navigation), the simulation interface has two panes. Applying the Humble Object pattern:

**Smart Components (Features)**:
- `SessionComponent` - Orchestrates lifecycle, provides stores
- `SessionListComponent` - Fetches and displays sessions

**Dumb Components (UI)**:
- `EventStreamComponent` - Renders `EventBlock[]` input
- `EventBlockComponent` - Renders single block
- `DataTreeComponent` - Renders JSON hierarchy (FR-008-011)
- `SmartBlobComponent` - Handles JSON/MD/RAW toggle (FR-012-014)
- `ToolCatalogComponent` - Renders `Tool[]` input, emits selection
- `DynamicFormComponent` - Renders form from JSON Schema, emits value
- `ConnectionStatusComponent` - Renders status input

### Signal Inputs for Dumb Components

Per architecture guide:

> "Use `input()` and `output()` (Signal primitives) for all Presentational Components."

**Example: DataTreeComponent**:

```typescript
@Component({
  selector: 'app-data-tree',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `...`
})
export class DataTreeComponent {
  // Signal inputs
  readonly data = input.required<unknown>();
  readonly expanded = input(true); // FR-009: expanded by default
  readonly showThreadLines = input(true); // FR-010

  // Computed for rendering
  readonly entries = computed(() => this.flattenForRender(this.data()));
}
```

This ensures fine-grained change detection—only `DataTreeComponent` re-renders when its inputs change, not the entire tree.

---

## Testability Design

### The Humble Component Rule

Per architecture guide:

> "Extract all complex logic into a helper class, Service, or Facade. The Component class should be a 'Humble Object.'"

**Application**:

| Logic | Location | Testing Approach |
|-------|----------|------------------|
| JSON detection | `JsonDetectionService` in `util/` | Plain unit test (no TestBed) |
| Schema-to-form mapping | `SchemaFormService` in `util/` | Plain unit test |
| Reconnection backoff | `ReconnectionStrategy` in `util/` | Plain unit test |
| LlmRequest processing | `SimulationStore` methods | SignalStore test (no TestBed) |
| Event block rendering | `EventBlockComponent` | Component test with mock inputs |

**Example: Testing JSON Detection Without TestBed**:

```typescript
// util/json-detection/json-detection.service.spec.ts
describe('JsonDetectionService', () => {
  const service = new JsonDetectionService();

  it('detects valid JSON strings', () => {
    expect(service.isJson('{"key": "value"}')).toBe(true);
  });

  it('returns false for invalid JSON', () => {
    expect(service.isJson('not json')).toBe(false);
  });

  it('returns false for JSON-like but invalid strings', () => {
    expect(service.isJson('{key: value}')).toBe(false); // Per clarification
  });
});
```

No Angular, no DOM, no TestBed—runs in milliseconds.

### Abstract Ports for Infrastructure Testing

Per Hexagonal Architecture heuristic:

```typescript
// data-access/session/session.gateway.ts (Port)
export abstract class SessionGateway {
  abstract getSession(id: string): Promise<Session>;
  abstract subscribe(sessionId: string): AsyncIterable<SessionEvent>;
  abstract submitResponse(response: LlmResponse): Promise<void>;
}

// data-access/session/grpc-session.gateway.ts (Adapter)
@Injectable()
export class GrpcSessionGateway extends SessionGateway {
  // Real implementation using Connect-ES
}

// data-access/session/mock-session.gateway.ts (Test Adapter)
@Injectable()
export class MockSessionGateway extends SessionGateway {
  // In-memory implementation for testing
}
```

**Configuration**:
```typescript
// app.config.ts (production)
{ provide: SessionGateway, useClass: GrpcSessionGateway }

// test setup
{ provide: SessionGateway, useClass: MockSessionGateway }
```

---

## Zoneless Readiness

The architecture guide emphasizes preparing for Zoneless Angular:

> "Never mutate state in a way that expects Angular to 'magically' know about it."

**Compliance Checklist**:

- [ ] All async operations update Signals, not plain properties
- [ ] No `setTimeout`/`setInterval` without Signal updates
- [ ] Use `effect()` for side effects, not lifecycle hooks
- [ ] Avoid direct DOM manipulation
- [ ] All components use `OnPush` change detection

**The prototype uses Zoneless** (Angular 21), so this is already validated. Our implementation must maintain this.

---

## Boundary Enforcement Strategy

### Option 1: Nx Constraints (If Using Nx)

```json
// nx.json
{
  "targetDefaults": {
    "@nx/enforce-module-boundaries": {
      "depConstraints": [
        { "sourceTag": "type:feature", "onlyDependOnLibsWithTags": ["type:ui", "type:data-access", "type:util"] },
        { "sourceTag": "type:ui", "onlyDependOnLibsWithTags": ["type:util"] },
        { "sourceTag": "type:data-access", "onlyDependOnLibsWithTags": ["type:util"] },
        { "sourceTag": "type:util", "onlyDependOnLibsWithTags": [] }
      ]
    }
  }
}
```

### Option 2: Sheriff (Standalone Enforcement)

If not using full Nx monorepo tooling, Sheriff can enforce boundaries:

```typescript
// sheriff.config.ts
import { sameTag, noDependencies } from '@softarc/sheriff-core';

export const config = {
  tagging: {
    'src/app/features/<feature>': 'type:feature',
    'src/app/ui/<component>': 'type:ui',
    'src/app/data-access/<domain>': 'type:data-access',
    'src/app/util/<lib>': 'type:util',
  },
  depRules: {
    'type:feature': ['type:ui', 'type:data-access', 'type:util'],
    'type:ui': ['type:util'],
    'type:data-access': ['type:util'],
    'type:util': noDependencies,
  }
};
```

**Recommendation**: Use Sheriff since we're not in a full Nx monorepo. It integrates with ESLint.

---

## Recommendations Summary

| Category | Recommendation | Spec Requirements Addressed |
|----------|---------------|---------------------------|
| Topology | Modular Monolith with Sheriff boundaries | All (maintainability) |
| State | SignalStore for feature state, Signals for component state | FR-006, FR-024 |
| Facades | `SessionFacade` wrapping state + gateway | FR-020-023 |
| UI Components | Humble presentational components with Signal inputs | FR-007-019 |
| Ports | Abstract `SessionGateway` for testability | FR-020 |
| Testing | Logic in services, no TestBed for business logic | All (maintainability) |
| Boundaries | Sheriff rules for dependency enforcement | All (maintainability) |

---

## Open Questions for Technical Design

1. **SignalStore vs. Plain Signal Service**: Is the additional structure of NgRx SignalStore worth it for our feature state, or is a plain Signal service (like the prototype) sufficient?

2. **Dynamic Form Library**: Should we build custom dynamic forms or evaluate libraries like `ngx-formly` or `@angular/forms` JSON Schema integration?

3. **Data Tree Rendering**: Build custom tree component or use library like `@angular/cdk` tree or a third-party option?

4. **Sheriff Integration**: How to configure Sheriff for our existing folder structure without major reorganization?
