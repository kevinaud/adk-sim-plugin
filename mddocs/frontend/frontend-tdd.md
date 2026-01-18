---
title: Web UI Technical Design Document
type: tdd
parent: ./frontend-spec.md
related:
  - ../tdd.md
  - ./frontend-spec.md
  - ./research/prototype-findings.md
  - ./research/angular-architecture-analysis.md
  - ./research/angular-testing-analysis.md
  - ./research/adk-typescript-research.md
  - ./research/converter-research.md
  - ./research/project-infrastructure.md
  - ./research/jsonforms-research.md
  - ./research/playwright-testing-research.md
  - ./research/sheriff-research.md
  - ./research/frontend-configuration-research.md
---

# Web UI Technical Design Document

**Feature Branch**: `002-web-ui`
**Created**: January 11, 2026
**Status**: Draft
**Spec**: [Frontend Spec](./frontend-spec.md)

## Related Documents

- [Main TDD](../tdd.md) - System technical design
- [Frontend Spec](./frontend-spec.md) - Feature requirements
- [Prototype Findings](./research/prototype-findings.md) - Validated streaming patterns
- [Architecture Analysis](./research/angular-architecture-analysis.md) - Angular best practices
- [Testing Analysis](./research/angular-testing-analysis.md) - Testing strategy
- [ADK TypeScript Research](./research/adk-typescript-research.md) - ADK data model
- [Converter Research](./research/converter-research.md) - Proto conversion design
- [Project Infrastructure](./research/project-infrastructure.md) - Existing codebase
- [JSONForms Research](./research/jsonforms-research.md) - Dynamic form generation
- [Playwright Testing Research](./research/playwright-testing-research.md) - Visual regression & E2E
- [Sheriff Research](./research/sheriff-research.md) - Dependency enforcement
- [Frontend Configuration Research](./research/frontend-configuration-research.md) - URL/port configuration

---

## Table of Contents

- [Related Documents](#related-documents)
- [Executive Summary](#executive-summary)
  - [Key Design Decisions](#key-design-decisions)
- [System Architecture](#system-architecture)
  - [High-Level Component Diagram](#high-level-component-diagram)
  - [Library Dependency Graph](#library-dependency-graph)
- [Module Structure](#module-structure)
  - [Folder Layout](#folder-layout)
- [Data Model Integration](#data-model-integration)
  - [The Conversion Layer](#the-conversion-layer)
  - [Package Dependency](#package-dependency)
  - [Type Usage in Components](#type-usage-in-components)
- [State Management](#state-management)
  - [State Architecture](#state-architecture)
  - [SessionStateService (Global)](#sessionstateservice-global)
  - [SimulationStore (Feature-Scoped)](#simulationstore-feature-scoped)
  - [SessionFacade (Orchestration)](#sessionfacade-orchestration)
- [Communication Layer](#communication-layer)
  - [Gateway Port (Abstract)](#gateway-port-abstract)
  - [gRPC Gateway Adapter](#grpc-gateway-adapter)
  - [Mock Gateway (Testing)](#mock-gateway-testing)
  - [Auto-Reconnect Logic](#auto-reconnect-logic)
- [UI Components](#ui-components)
  - [Event Stream Components](#event-stream-components)
    - [EventBlockComponent](#eventblockcomponent)
    - [DataTreeComponent](#datatreecomponent)
    - [SmartBlobComponent](#smartblobcomponent)
  - [Control Panel Components](#control-panel-components)
    - [ToolCatalogComponent](#toolcatalogcomponent)
    - [ToolFormComponent (JSONForms)](#toolformcomponent-jsonforms)
    - [ToolFormService (Schema Conversion)](#toolformservice-schema-conversion)
- [Routing Configuration](#routing-configuration)
- [Testing Strategy](#testing-strategy)
  - [Test Distribution](#test-distribution)
  - [Playwright Testing Strategy](#playwright-testing-strategy)
    - [Component Tests with Visual Regression](#component-tests-with-visual-regression)
    - [E2E Tests with Real Backend](#e2e-tests-with-real-backend)
  - [Component Harness Example](#component-harness-example)
  - [Sociable Test Example](#sociable-test-example)
- [Server-Side Prerequisites](#server-side-prerequisites)
  - [Streaming Gap Resolution](#streaming-gap-resolution)
- [Implementation Phases](#implementation-phases)
  - [Phase 1: Foundation (Week 1)](#phase-1-foundation-week-1)
  - [Phase 2: Communication (Week 2)](#phase-2-communication-week-2)
  - [Phase 3: Event Stream (Week 3)](#phase-3-event-stream-week-3)
  - [Phase 4: Control Panel (Week 4)](#phase-4-control-panel-week-4)
  - [Phase 5: Polish (Week 5)](#phase-5-polish-week-5)
- [Risk Mitigation](#risk-mitigation)
- [Open Decisions](#open-decisions)

## Executive Summary

This document defines the technical implementation plan for the ADK Simulator Web UI. The design leverages proven patterns from the [streaming prototype](./research/prototype-findings.md#architecture-summary), applies [Angular v21 best practices](./research/angular-architecture-analysis.md#overview), and addresses the [identified infrastructure gaps](./research/project-infrastructure.md#2-streaming-implementation-gap).

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Modular Monolith with library boundaries | [Unity Default heuristic](./research/angular-architecture-analysis.md#recommendation-modular-monolith) |
| State Management | Signals + SignalStore | [Signal-based pattern from prototype](./research/prototype-findings.md#signal-based-state-management) |
| Communication | Connect-ES v2 gRPC-Web | [Proven in prototype](./research/prototype-findings.md#grpc-web-streaming-with-connect-es) |
| Data Model | ADK types via converter package | [Type alignment strategy](./research/adk-typescript-research.md#implications-for-adk-converters-ts) |
| Dynamic Forms | JSONForms + Angular Material | [JSONForms research](./research/jsonforms-research.md#executive-summary) |
| Visual Testing | Playwright CT + VRT | [Playwright research](./research/playwright-testing-research.md#executive-summary) |
| E2E Testing | Playwright + Docker backend | [E2E with real backend](./research/playwright-testing-research.md#part-3-e2e-testing-with-real-backend) |
| Testing | Zoneless sociable tests + harnesses | [Testing strategy](./research/angular-testing-analysis.md#sociable-testing-philosophy) |

---

## System Architecture

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Angular Application                            │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────┐ │
│  │   features/         │  │   features/         │  │   features/     │ │
│  │   session-list      │  │   session           │  │   join-session  │ │
│  │   (FR-002, FR-003)  │  │   (FR-001, FR-005)  │  │   (FR-001)      │ │
│  └─────────┬───────────┘  └─────────┬───────────┘  └────────┬────────┘ │
│            │                        │                        │          │
│  ┌─────────▼───────────────────────▼────────────────────────▼────────┐ │
│  │                          ui/ Libraries                             │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │ │
│  │  │ event-stream │  │ control-panel│  │        shared            │ │ │
│  │  │ (FR-007-015) │  │ (FR-016-019) │  │ (FR-005, FR-023)         │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘ │ │
│  └───────────────────────────────┬───────────────────────────────────┘ │
│                                  │                                      │
│  ┌───────────────────────────────▼───────────────────────────────────┐ │
│  │                      data-access/ Libraries                        │ │
│  │  ┌──────────────────────────┐  ┌────────────────────────────────┐ │ │
│  │  │    session/              │  │      llm-request/              │ │ │
│  │  │    SessionFacade         │  │      LlmRequestConverter       │ │ │
│  │  │    SessionGateway        │  │                                │ │ │
│  │  └──────────────────────────┘  └────────────────────────────────┘ │ │
│  └───────────────────────────────┬───────────────────────────────────┘ │
│                                  │                                      │
│  ┌───────────────────────────────▼───────────────────────────────────┐ │
│  │                         util/ Libraries                            │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐ │ │
│  │  │json-detect │  │schema-utils│  │ reconnect  │  │ md-detection │ │ │
│  │  └────────────┘  └────────────┘  └────────────┘  └──────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┤
│  │                     External Dependencies                            │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │  │ @adk-sim/protos │  │ @adk-sim/       │  │ @google/adk         │ │
│  │  │ (proto types)   │  │ converters      │  │ (LlmRequest types)  │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ gRPC-Web (HTTP/1.1)
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Python Server (port 8080)                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  Custom gRPC-Web Gateway (web.py)                                   ││
│  │  - Unary: CreateSession, ListSessions, SubmitRequest, SubmitDecision││
│  │  - Streaming: Subscribe (TO BE IMPLEMENTED)                         ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

### Library Dependency Graph

Per [Architecture Analysis](./research/angular-architecture-analysis.md#library-type-taxonomy):

```
features/* ──► ui/* ──► util/*
     │           │         ▲
     │           │         │
     └──────► data-access/* ──┘
                 │
                 ▼
     ┌───────────┴───────────┐
     │                       │
@adk-sim/protos    @adk-sim/converters
     │                       │
     └───────────┬───────────┘
                 │
            @google/adk
```

**Rule**: No upward or lateral dependencies. A feature cannot import another feature. UI cannot import data-access.

---
## Module Structure

### Folder Layout

```
frontend/src/app/
├── features/
│   ├── session-list/
│   │   ├── session-list.component.ts
│   │   ├── session-list.component.html
│   │   ├── session-list.component.spec.ts
│   │   └── session-list.routes.ts
│   ├── session/
│   │   ├── session.component.ts           # Container: lifecycle, subscriptions
│   │   ├── session.component.html
│   │   ├── session.component.spec.ts
│   │   ├── session.routes.ts
│   │   └── simulation.store.ts            # Feature-scoped SignalStore
│   └── join-session/
│       ├── join-session.component.ts
│       └── join-session.routes.ts
│
├── ui/
│   ├── event-stream/
│   │   ├── event-stream.component.ts      # Renders EventBlock[]
│   │   ├── event-block/
│   │   │   ├── event-block.component.ts   # Single block (User/Agent/Tool)
│   │   │   ├── event-block.harness.ts
│   │   │   └── event-block.stories.ts
│   │   ├── data-tree/
│   │   │   ├── data-tree.component.ts     # Hierarchical JSON tree (FR-008-011)
│   │   │   ├── data-tree.harness.ts
│   │   │   └── data-tree.stories.ts
│   │   └── smart-blob/
│   │       ├── smart-blob.component.ts    # JSON/MD/RAW toggle (FR-012-014)
│   │       ├── smart-blob.harness.ts
│   │       └── smart-blob.stories.ts
│   ├── control-panel/
│   │   ├── control-panel.component.ts     # Orchestrates tool catalog + forms
│   │   ├── tool-catalog/
│   │   │   ├── tool-catalog.component.ts  # Tool listing (FR-016)
│   │   │   └── tool-catalog.harness.ts
│   │   ├── tool-form/
│   │   │   ├── tool-form.component.ts     # JSONForms wrapper (FR-017)
│   │   │   └── tool-form.harness.ts
│   │   └── final-response/
│   │       ├── final-response.component.ts # Text area or schema form (FR-018-019)
│   │       └── final-response.harness.ts
│   └── shared/
│       ├── connection-status/
│       │   └── connection-status.component.ts  # Status indicator (FR-023)
│       └── split-pane/
│           └── split-pane.component.ts    # Layout primitive (FR-005)
│
├── data-access/
│   ├── session/
│   │   ├── session.facade.ts              # Orchestrates state + gateway
│   │   ├── session-state.service.ts       # Signal-based state
│   │   ├── session.gateway.ts             # Abstract port
│   │   ├── grpc-session.gateway.ts        # Connect-ES adapter
│   │   └── mock-session.gateway.ts        # Test adapter
│   └── tool-form/
│       └── tool-form.service.ts           # FunctionDeclaration → JSONForms config
│
├── util/
│   ├── json-detection/
│   │   ├── json-detection.service.ts
│   │   └── json-detection.service.spec.ts
│   ├── md-detection/
│   │   ├── md-detection.service.ts
│   │   └── md-detection.service.spec.ts
│   └── reconnect/
│       ├── reconnect-strategy.ts          # Exponential backoff logic
│       └── reconnect-strategy.spec.ts
│
└── generated/                             # @adk-sim/protos (existing)
    ├── adksim/v1/
    └── google/ai/

# Shared Package: packages/adk-sim-converters/
packages/adk-sim-converters/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                           # Public exports
│   ├── request-converter.ts               # Proto ↔ LlmRequest/LlmResponse
│   ├── schema-converter.ts                # Proto Schema → JSON Schema
│   └── types.ts                           # Shared type definitions
└── tests/
    ├── request-converter.spec.ts
    └── schema-converter.spec.ts
```

---

## Data Model Integration

### The Conversion Layer

Per [ADK TypeScript Research](./research/adk-typescript-research.md#what-we-actually-need), the frontend receives `GenerateContentRequest` protos but should work with ADK types internally.

**Flow**:
```
Server → GenerateContentRequest (proto)
           │
           ▼ protoToLlmRequest() [adk-converters-ts]
           │
        LlmRequest (ADK)
           │
           ▼ UI Components
           │
        LlmResponse (ADK)
           │
           ▼ llmResponseToProto() [adk-converters-ts]
           │
GenerateContentResponse (proto) → Server
```

### Package Dependency

The frontend will consume the new `@adk-sim/converters` package (see [Converter Research](./research/converter-research.md#adding-adk-converters-ts)):

```json
{
  "dependencies": {
    "@adk-sim/protos": "workspace:*",
    "@adk-sim/converters": "workspace:*",
    "@google/adk": "^0.2.2"
  }
}
```

### Type Usage in Components

```typescript
// UI components work with ADK types, not protos
import type { LlmRequest, LlmResponse } from '@google/adk';

@Component({ ... })
export class EventStreamComponent {
  // Input is ADK type (converted from proto in data-access layer)
  readonly request = input.required<LlmRequest>();

  // Computed for rendering
  readonly contents = computed(() => this.request().contents);
  readonly systemInstruction = computed(() => this.request().config?.systemInstruction);
}
```

---

## State Management

### State Architecture

Per [Architecture Analysis](./research/angular-architecture-analysis.md#state-management-strategy), we use Signals for state and RxJS only for event streams.

| State | Scope | Implementation |
|-------|-------|----------------|
| Session ID | Global | `SessionStateService` signal |
| Connection Status | Global | `SessionStateService` signal |
| Current `LlmRequest` | Feature | `SimulationStore` (SignalStore) |
| Request Queue | Feature | `SimulationStore` (SignalStore) |
| Selected Tool | Component | Local `signal()` |
| Form State | Component | Signal Forms |

### SessionStateService (Global)

Adapted from [prototype pattern](./research/prototype-findings.md#signal-based-state-management):

```typescript
@Injectable({ providedIn: 'root' })
export class SessionStateService {
  // Private writable
  private readonly _sessionId = signal<string | null>(null);
  private readonly _connectionStatus = signal<ConnectionStatus>('disconnected');
  private readonly _error = signal<string | null>(null);

  // Public readonly
  readonly sessionId = this._sessionId.asReadonly();
  readonly connectionStatus = this._connectionStatus.asReadonly();
  readonly error = this._error.asReadonly();

  // Computed
  readonly isConnected = computed(() => this._connectionStatus() === 'connected');
  readonly hasError = computed(() => this._error() !== null);

  // Mutations (internal use via Facade)
  setSessionId(id: string | null): void { this._sessionId.set(id); }
  setConnectionStatus(status: ConnectionStatus): void { this._connectionStatus.set(status); }
  setError(error: string | null): void { this._error.set(error); }
  clearError(): void { this._error.set(null); }
}
```

### SimulationStore (Feature-Scoped)

Using `@ngrx/signals` SignalStore for the simulation feature:

```typescript
// features/session/simulation.store.ts
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import type { LlmRequest, Tool } from '@google/adk';

interface SimulationState {
  currentRequest: LlmRequest | null;
  requestQueue: LlmRequest[];
  selectedTool: Tool | null;
}

export const SimulationStore = signalStore(
  withState<SimulationState>({
    currentRequest: null,
    requestQueue: [],
    selectedTool: null,
  }),

  withComputed((store) => ({
    hasRequest: computed(() => store.currentRequest() !== null),
    queueLength: computed(() => store.requestQueue().length),
    availableTools: computed(() => {
      const req = store.currentRequest();
      if (!req?.config?.tools) return [];
      // Flatten function declarations from all tools
      return req.config.tools.flatMap(t =>
        t.functionDeclarations ?? []
      );
    }),
    contents: computed(() => store.currentRequest()?.contents ?? []),
    systemInstruction: computed(() => store.currentRequest()?.config?.systemInstruction),
  })),

  withMethods((store) => ({
    /** Handle incoming request from stream (FR-024: queue if busy) */
    receiveRequest(request: LlmRequest): void {
      if (store.currentRequest() === null) {
        patchState(store, { currentRequest: request });
      } else {
        patchState(store, {
          requestQueue: [...store.requestQueue(), request],
        });
      }
    },

    /** Advance to next request after submission */
    advanceQueue(): void {
      const [next, ...rest] = store.requestQueue();
      patchState(store, {
        currentRequest: next ?? null,
        requestQueue: rest,
      });
    },

    selectTool(tool: Tool | null): void {
      patchState(store, { selectedTool: tool });
    },

    clearSelection(): void {
      patchState(store, { selectedTool: null });
    },
  }))
);
```

### SessionFacade (Orchestration)

Per [Facade Pattern recommendation](./research/angular-architecture-analysis.md#critical-improvement-the-facade-pattern):

```typescript
@Injectable({ providedIn: 'root' })
export class SessionFacade {
  private readonly state = inject(SessionStateService);
  private readonly gateway = inject(SessionGateway);
  private readonly converter = inject(LlmRequestConverter);

  // Expose signals for reading
  readonly sessionId = this.state.sessionId;
  readonly connectionStatus = this.state.connectionStatus;
  readonly error = this.state.error;
  readonly isConnected = this.state.isConnected;

  /** Subscribe to session events, converting protos to ADK types */
  async *subscribeToSession(sessionId: string): AsyncIterable<LlmRequest> {
    this.state.setSessionId(sessionId);
    this.state.setConnectionStatus('connecting');

    try {
      for await (const event of this.gateway.subscribe(sessionId)) {
        this.state.setConnectionStatus('connected');

        if (event.event.case === 'llmRequest') {
          // Convert proto to ADK type
          const llmRequest = this.converter.protoToLlmRequest(event.event.value);
          yield llmRequest;
        }
      }
    } catch (error) {
      this.state.setError('Connection lost');
      throw error;
    }
  }

  /** Submit tool invocation response */
  async submitToolInvocation(toolName: string, args: unknown): Promise<void> {
    const sessionId = this.state.sessionId();
    if (!sessionId) throw new Error('No active session');

    const response = this.converter.createToolInvocationResponse(toolName, args);
    await this.gateway.submitResponse(sessionId, response);
  }

  /** Submit final text response */
  async submitFinalResponse(content: string): Promise<void> {
    const sessionId = this.state.sessionId();
    if (!sessionId) throw new Error('No active session');

    const response = this.converter.createTextResponse(content);
    await this.gateway.submitResponse(sessionId, response);
  }

  /** Submit structured final response (when output_schema defined) */
  async submitStructuredResponse(data: unknown): Promise<void> {
    const sessionId = this.state.sessionId();
    if (!sessionId) throw new Error('No active session');

    const response = this.converter.createStructuredResponse(data);
    await this.gateway.submitResponse(sessionId, response);
  }
}
```

---

## Communication Layer

### Gateway Port (Abstract)

Per [Hexagonal Architecture](./research/angular-architecture-analysis.md#abstract-ports-for-infrastructure-testing):

```typescript
// data-access/session/session.gateway.ts
export abstract class SessionGateway {
  abstract listSessions(): Promise<Session[]>;
  abstract getSession(sessionId: string): Promise<Session>;
  abstract createSession(): Promise<Session>;
  abstract subscribe(sessionId: string): AsyncIterable<SessionEvent>;
  abstract submitResponse(sessionId: string, response: GenerateContentResponse): Promise<void>;
  abstract cancelSubscription(): void;
}
```

### gRPC Gateway Adapter

Adapted from [prototype pattern](./research/prototype-findings.md#grpc-web-streaming-with-connect-es):

```typescript
// data-access/session/grpc-session.gateway.ts
@Injectable()
export class GrpcSessionGateway extends SessionGateway {
  private readonly transport: Transport;
  private readonly client: Client<typeof SimulatorService>;
  private abortController: AbortController | null = null;

  constructor() {
    super();
    this.transport = createGrpcWebTransport({
      baseUrl: ENVIRONMENT.grpcWebUrl || window.location.origin,
    });
    this.client = createClient(SimulatorService, this.transport);
  }

  override async listSessions(): Promise<Session[]> {
    const response = await this.client.listSessions({});
    return response.sessions;
  }

  override async getSession(sessionId: string): Promise<Session> {
    const response = await this.client.getSession({ sessionId });
    if (!response.session) throw new Error('Session not found');
    return response.session;
  }

  override async *subscribe(sessionId: string): AsyncIterable<SessionEvent> {
    this.cancelSubscription();
    this.abortController = new AbortController();

    const request = create(SubscribeRequestSchema, { sessionId });

    try {
      for await (const response of this.client.subscribe(request, {
        signal: this.abortController.signal,
      })) {
        if (response.event) {
          yield response.event;
        }
      }
    } finally {
      this.abortController = null;
    }
  }

  override async submitResponse(
    sessionId: string,
    response: GenerateContentResponse
  ): Promise<void> {
    await this.client.submitDecision({
      sessionId,
      response,
    });
  }

  override cancelSubscription(): void {
    this.abortController?.abort();
    this.abortController = null;
  }
}
```

### Mock Gateway (Testing)

Per [Testing Analysis](./research/angular-testing-analysis.md#msw-network-mocking-strategy):

```typescript
// data-access/session/mock-session.gateway.ts
@Injectable()
export class MockSessionGateway extends SessionGateway {
  private readonly sessions = signal<Session[]>([]);
  private readonly eventQueue = signal<SessionEvent[]>([]);
  private subscriptionActive = false;

  override async listSessions(): Promise<Session[]> {
    return this.sessions();
  }

  override async *subscribe(sessionId: string): AsyncIterable<SessionEvent> {
    this.subscriptionActive = true;
    while (this.subscriptionActive) {
      const events = this.eventQueue();
      if (events.length > 0) {
        const [next, ...rest] = events;
        this.eventQueue.set(rest);
        yield next;
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  override cancelSubscription(): void {
    this.subscriptionActive = false;
  }

  // Test helpers
  pushSession(session: Session): void {
    this.sessions.update(s => [...s, session]);
  }

  pushEvent(event: SessionEvent): void {
    this.eventQueue.update(e => [...e, event]);
  }
}
```

### Auto-Reconnect Logic

Per [prototype reconnection pattern](./research/prototype-findings.md#connection-lifecycle-with-auto-reconnect), enhanced with exponential backoff:

```typescript
// util/reconnect/reconnect-strategy.ts
export interface ReconnectConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export class ReconnectStrategy {
  private attempts = 0;

  constructor(private readonly config: ReconnectConfig = {
    maxAttempts: 5,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
  }) {}

  reset(): void {
    this.attempts = 0;
  }

  canRetry(): boolean {
    return this.attempts < this.config.maxAttempts;
  }

  getNextDelay(): number {
    const delay = Math.min(
      this.config.baseDelayMs * Math.pow(2, this.attempts),
      this.config.maxDelayMs
    );
    this.attempts++;
    return delay;
  }

  get currentAttempt(): number {
    return this.attempts;
  }
}
```

Usage in `SessionComponent`:

```typescript
private readonly reconnectStrategy = new ReconnectStrategy();

private async startSubscription(sessionId: string): Promise<void> {
  try {
    for await (const request of this.facade.subscribeToSession(sessionId)) {
      this.reconnectStrategy.reset();
      this.store.receiveRequest(request);
    }
    this.handleDisconnect(sessionId);
  } catch (error) {
    this.handleDisconnect(sessionId);
  }
}

private handleDisconnect(sessionId: string): void {
  if (this.reconnectStrategy.canRetry()) {
    this.state.setConnectionStatus('reconnecting');
    const delay = this.reconnectStrategy.getNextDelay();
    setTimeout(() => this.startSubscription(sessionId), delay);
  } else {
    this.state.setError('Connection lost after multiple retries. Please refresh.');
  }
}
```

---

## UI Components

### Event Stream Components

#### EventBlockComponent

Renders a single conversation turn ([FR-007](./frontend-spec.md#fr-context-inspection)):

```typescript
@Component({
  selector: 'app-event-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTreeComponent, SmartBlobComponent],
  template: `
    <div class="event-block" [attr.data-type]="blockType()">
      <div class="block-header">
        <mat-icon>{{ icon() }}</mat-icon>
        <span class="block-label">{{ label() }}</span>
      </div>
      <div class="block-content">
        @for (part of parts(); track $index) {
          @if (part.text) {
            <app-smart-blob [content]="part.text" />
          }
          @if (part.functionCall) {
            <div class="function-call">
              <span class="function-name">{{ part.functionCall.name }}</span>
              <app-data-tree [data]="part.functionCall.args" />
            </div>
          }
          @if (part.functionResponse) {
            <div class="function-response">
              <span class="function-name">{{ part.functionResponse.name }}</span>
              <app-data-tree [data]="part.functionResponse.response" />
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class EventBlockComponent {
  readonly content = input.required<Content>();

  readonly blockType = computed<'user' | 'model' | 'tool'>(() => {
    const c = this.content();
    if (c.role === 'user') {
      // Check if it's a function response
      const hasFunctionResponse = c.parts?.some(p => p.functionResponse);
      return hasFunctionResponse ? 'tool' : 'user';
    }
    // Model role
    const hasFunctionCall = c.parts?.some(p => p.functionCall);
    return hasFunctionCall ? 'tool' : 'model';
  });

  readonly parts = computed(() => this.content().parts ?? []);

  readonly icon = computed(() => {
    switch (this.blockType()) {
      case 'user': return 'person';
      case 'model': return 'smart_toy';
      case 'tool': return 'build';
    }
  });

  readonly label = computed(() => {
    switch (this.blockType()) {
      case 'user': return 'User Input';
      case 'model': return 'Agent Response';
      case 'tool': return 'Tool Execution';
    }
  });
}
```

#### DataTreeComponent

Hierarchical JSON visualization ([FR-008 through FR-011](./frontend-spec.md#fr-context-inspection)):

```typescript
@Component({
  selector: 'app-data-tree',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="data-tree" [class.thread-lines]="showThreadLines()">
      @for (node of flatNodes(); track node.path) {
        <div
          class="tree-node"
          [style.padding-left.px]="node.depth * 16"
          [class.expandable]="node.expandable"
          [class.expanded]="node.expanded"
        >
          @if (node.expandable) {
            <button class="toggle" (click)="toggleNode(node.path)">
              <mat-icon>{{ node.expanded ? 'expand_more' : 'chevron_right' }}</mat-icon>
            </button>
          }
          <span class="key">{{ node.key }}:</span>
          @if (!node.expandable) {
            <span class="value" [class]="node.valueType">{{ node.displayValue }}</span>
          }
        </div>
      }
    </div>
  `,
})
export class DataTreeComponent {
  readonly data = input.required<unknown>();
  readonly expanded = input(true);  // FR-009: expanded by default
  readonly showThreadLines = input(true);  // FR-010

  private readonly expandedPaths = signal<Set<string>>(new Set());

  readonly flatNodes = computed(() => {
    const root = this.data();
    const nodes: TreeNode[] = [];
    this.flattenObject(root, '', 0, nodes);
    return nodes;
  });

  private flattenObject(value: unknown, path: string, depth: number, nodes: TreeNode[]): void {
    // Implementation: recursive flattening with expansion tracking
    // Handles objects, arrays, primitives
    // Produces TreeNode[] for template iteration
  }

  toggleNode(path: string): void {
    this.expandedPaths.update(paths => {
      const newPaths = new Set(paths);
      if (newPaths.has(path)) {
        newPaths.delete(path);
      } else {
        newPaths.add(path);
      }
      return newPaths;
    });
  }
}
```

#### SmartBlobComponent

Content with format toggles ([FR-012 through FR-014](./frontend-spec.md#fr-context-inspection)):

```typescript
@Component({
  selector: 'app-smart-blob',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTreeComponent, MarkdownPipe],
  template: `
    <div class="smart-blob">
      <div class="blob-controls">
        @if (isJson()) {
          <button
            [class.active]="mode() === 'json'"
            (click)="setMode('json')"
          >[JSON]</button>
        }
        @if (isMarkdown()) {
          <button
            [class.active]="mode() === 'markdown'"
            (click)="setMode('markdown')"
          >[MD]</button>
        }
        <button
          [class.active]="mode() === 'raw'"
          (click)="setMode('raw')"
        >[RAW]</button>
      </div>
      <div class="blob-content">
        @switch (mode()) {
          @case ('json') {
            <app-data-tree [data]="parsedJson()" />
          }
          @case ('markdown') {
            <div class="markdown-content" [innerHTML]="content() | markdown"></div>
          }
          @case ('raw') {
            <pre class="raw-content">{{ content() }}</pre>
          }
        }
      </div>
    </div>
  `,
})
export class SmartBlobComponent {
  private readonly jsonService = inject(JsonDetectionService);
  private readonly mdService = inject(MarkdownDetectionService);

  readonly content = input.required<string>();

  readonly isJson = computed(() => this.jsonService.isJson(this.content()));
  readonly isMarkdown = computed(() => this.mdService.isMarkdown(this.content()));
  readonly parsedJson = computed(() => {
    try { return JSON.parse(this.content()); }
    catch { return null; }
  });

  readonly mode = signal<'json' | 'markdown' | 'raw'>('raw');

  constructor() {
    // Auto-select best mode on content change
    effect(() => {
      const content = this.content();
      if (this.jsonService.isJson(content)) {
        this.mode.set('json');
      } else if (this.mdService.isMarkdown(content)) {
        this.mode.set('markdown');
      } else {
        this.mode.set('raw');
      }
    });
  }

  setMode(mode: 'json' | 'markdown' | 'raw'): void {
    this.mode.set(mode);
  }
}
```

### Control Panel Components

#### ToolCatalogComponent

Tool listing ([FR-016](./frontend-spec.md#fr-response-construction)):

```typescript
@Component({
  selector: 'app-tool-catalog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tool-catalog">
      <h3>Available Tools</h3>
      @for (tool of tools(); track tool.name) {
        <div
          class="tool-item"
          [class.selected]="selectedTool()?.name === tool.name"
          (click)="selectTool.emit(tool)"
        >
          <div class="tool-header">
            <span class="tool-name">{{ tool.name }}</span>
            <button mat-icon-button (click)="toggleSchema($event, tool.name)">
              <mat-icon>{{ isSchemaExpanded(tool.name) ? 'expand_less' : 'expand_more' }}</mat-icon>
            </button>
          </div>
          @if (tool.description) {
            <p class="tool-description">{{ tool.description }}</p>
          }
          @if (isSchemaExpanded(tool.name)) {
            <div class="tool-schema">
              <app-data-tree [data]="tool.parameters" />
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ToolCatalogComponent {
  readonly tools = input.required<FunctionDeclaration[]>();
  readonly selectedTool = input<FunctionDeclaration | null>(null);

  readonly selectTool = output<FunctionDeclaration>();

  private readonly expandedSchemas = signal<Set<string>>(new Set());

  isSchemaExpanded(toolName: string): boolean {
    return this.expandedSchemas().has(toolName);
  }

  toggleSchema(event: Event, toolName: string): void {
    event.stopPropagation();
    this.expandedSchemas.update(set => {
      const newSet = new Set(set);
      if (newSet.has(toolName)) {
        newSet.delete(toolName);
      } else {
        newSet.add(toolName);
      }
      return newSet;
    });
  }
}
```

#### ToolFormComponent (JSONForms)

Schema-driven form generation using [JSONForms](./research/jsonforms-research.md) ([FR-017](./frontend-spec.md#fr-response-construction)):

```typescript
// ui/control-panel/tool-form/tool-form.component.ts
import { Component, input, output, signal, computed } from '@angular/core';
import { JsonFormsModule } from '@jsonforms/angular';
import { angularMaterialRenderers } from '@jsonforms/angular-material';
import type { JsonSchema7, UISchemaElement } from '@jsonforms/core';
import type { ErrorObject } from 'ajv';

export interface ToolFormConfig {
  schema: JsonSchema7;
  uischema: UISchemaElement;
  toolName: string;
  toolDescription: string;
}

@Component({
  selector: 'app-tool-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonFormsModule, MatButtonModule],
  template: `
    <div class="tool-form">
      <h4>{{ config().toolName }}</h4>
      @if (config().toolDescription) {
        <p class="description">{{ config().toolDescription }}</p>
      }

      <jsonforms
        [schema]="config().schema"
        [uischema]="config().uischema"
        [data]="formData()"
        [renderers]="renderers"
        (dataChange)="formData.set($event)"
        (errors)="errors.set($event)"
      />

      <button
        mat-raised-button
        color="primary"
        [disabled]="errors().length > 0"
        (click)="submit()"
      >
        Invoke Tool
      </button>
    </div>
  `,
})
export class ToolFormComponent {
  readonly renderers = angularMaterialRenderers;

  readonly config = input.required<ToolFormConfig>();
  readonly formData = signal<unknown>({});
  readonly errors = signal<ErrorObject[]>([]);

  readonly invokeOutput = output<{ toolName: string; args: unknown }>();

  submit(): void {
    this.invokeOutput.emit({
      toolName: this.config().toolName,
      args: this.formData(),
    });
  }
}
```

#### ToolFormService (Schema Conversion)

Converts proto `FunctionDeclaration.parameters` to JSON Schema for JSONForms (see [JSONForms Research](./research/jsonforms-research.md#schema-conversion-challenge)):

```typescript
// data-access/tool-form/tool-form.service.ts
import { Injectable } from '@angular/core';
import { generateDefaultUISchema } from '@jsonforms/core';
import type { JsonSchema7, UISchemaElement } from '@jsonforms/core';
import type { FunctionDeclaration, Schema } from '@adk-sim/protos';
import { protoSchemaToJsonSchema } from '@adk-sim/converters';

@Injectable({ providedIn: 'root' })
export class ToolFormService {
  /**
   * Create JSONForms configuration from a tool's FunctionDeclaration
   */
  createFormConfig(tool: FunctionDeclaration): ToolFormConfig {
    let jsonSchema: JsonSchema7;

    if (tool.parametersJsonSchema) {
      // Tool already provides JSON Schema directly
      jsonSchema = tool.parametersJsonSchema as JsonSchema7;
    } else if (tool.parameters) {
      // Convert proto Schema to JSON Schema
      jsonSchema = protoSchemaToJsonSchema(tool.parameters);
    } else {
      // No parameters - empty object schema
      jsonSchema = { type: 'object', properties: {} };
    }

    return {
      schema: jsonSchema,
      uischema: this.createUiSchema(jsonSchema, tool.name),
      toolName: tool.name,
      toolDescription: tool.description,
    };
  }

  private createUiSchema(schema: JsonSchema7, toolName: string): UISchemaElement {
    const autoSchema = generateDefaultUISchema(schema);
    return {
      type: 'Group',
      label: toolName,
      elements: [autoSchema],
    };
  }
}
```

---

## Routing Configuration

```typescript
// app.routes.ts
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/session-list/session-list.component')
      .then(m => m.SessionListComponent),
  },
  {
    path: 'session/:id',
    loadComponent: () => import('./features/session/session.component')
      .then(m => m.SessionComponent),
    canActivate: [sessionExistsGuard],  // FR-004
  },
  {
    path: '**',
    redirectTo: '',
  },
];

// Session guard for FR-004
export const sessionExistsGuard: CanActivateFn = async (route) => {
  const facade = inject(SessionFacade);
  const router = inject(Router);
  const sessionId = route.paramMap.get('id');

  if (!sessionId) {
    return router.createUrlTree(['/'], {
      queryParams: { error: 'No session ID provided' },
    });
  }

  try {
    await facade.validateSession(sessionId);
    return true;
  } catch {
    return router.createUrlTree(['/'], {
      queryParams: { error: 'Session not found' },
    });
  }
};
```

---

## Testing Strategy

Per [Testing Analysis](./research/angular-testing-analysis.md#test-layer-mapping) and [Playwright Testing Research](./research/playwright-testing-research.md):

### Test Distribution

| Layer | Test Type | Tools | Example |
|-------|-----------|-------|---------|
| `util/*` | Unit | Vitest (no TestBed) | `JsonDetectionService` |
| `data-access/*` | Unit + Integration | Vitest + MockGateway | `SessionFacade` |
| `ui/*` | Component | Testing Library + Harnesses | `DataTreeComponent` |
| `features/*` | Integration | Testing Library + MockGateway | `SessionComponent` |
| Visual | Component VRT | Playwright CT | `data-tree.spec.ts` |
| User Flows | E2E | Playwright E2E | `session-flow.spec.ts` |

### Playwright Testing Strategy

Per [Playwright Testing Research](./research/playwright-testing-research.md), we adopt a two-tier Playwright strategy:

#### Component Tests with Visual Regression

Using `@sand4rt/experimental-ct-angular`:

```typescript
// tests/component/data-tree.spec.ts
import { test, expect } from '@sand4rt/experimental-ct-angular';
import { DataTreeComponent } from '@app/ui/event-stream/data-tree/data-tree.component';

test('renders nested object with thread lines', async ({ mount }) => {
  const component = await mount(DataTreeComponent, {
    props: {
      data: { user: { name: 'Bob', address: { city: 'NYC' } } },
      showThreadLines: true,
    },
  });

  // Visual regression test - screenshots stored in repo
  await expect(component).toHaveScreenshot('data-tree-nested.png');
});
```

**Screenshot Management**:
- Screenshots stored in `tests/component/__snapshots__/`
- Version controlled with code changes
- CI fails if screenshots change without commit
- Update with: `pnpm test:ct:update`

#### E2E Tests with Real Backend

Using dockerized backend (matches Python E2E pattern):

```typescript
// tests/e2e/session-flow.spec.ts
import { test, expect } from '@playwright/test';

test('user can create and join a session', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New Session' }).click();

  await expect(page).toHaveURL(/\/session\/[\w-]+/);
  await expect(page.getByTestId('connection-status')).toHaveText('Connected');
});
```

**E2E Infrastructure**:
- `docker-compose.e2e.yaml` starts backend + frontend
- Tests run against real gRPC backend
- No mocking required for integration tests

### Component Harness Example

Per [Harness Strategy](./research/angular-testing-analysis.md#component-harness-strategy):

```typescript
// ui/event-stream/data-tree/data-tree.harness.ts
export class DataTreeHarness extends ComponentHarness {
  static hostSelector = 'app-data-tree';

  private getNodes = this.locatorForAll('.tree-node');
  private getExpandButtons = this.locatorForAll('.toggle');

  async getNodeCount(): Promise<number> {
    return (await this.getNodes()).length;
  }

  async getNodeAtPath(path: string): Promise<TestElement | null> {
    const nodes = await this.getNodes();
    for (const node of nodes) {
      const key = await node.getAttribute('data-path');
      if (key === path) return node;
    }
    return null;
  }

  async expandNode(path: string): Promise<void> {
    const node = await this.getNodeAtPath(path);
    if (!node) throw new Error(`Node not found: ${path}`);
    const toggle = await node.querySelector('.toggle');
    if (toggle) await toggle.click();
  }

  async getVisiblePaths(): Promise<string[]> {
    const nodes = await this.getNodes();
    return Promise.all(nodes.map(n => n.getAttribute('data-path') ?? ''));
  }
}
```

### Sociable Test Example

Per [Sociable Philosophy](./research/angular-testing-analysis.md#the-no-mock-imperative):

```typescript
// features/session/session.component.spec.ts
describe('SessionComponent', () => {
  it('should display event stream when request is received', async () => {
    // Use MockGateway but REAL services
    const mockGateway = new MockSessionGateway();

    await render(SessionComponent, {
      providers: [
        { provide: SessionGateway, useValue: mockGateway },
        // Real SessionFacade, SessionStateService, SimulationStore
      ],
      componentInputs: {
        sessionId: 'test-session-123',
      },
    });

    // Inject a request event
    mockGateway.pushEvent({
      event: {
        case: 'llmRequest',
        value: createTestLlmRequest(),
      },
    });

    await fixture.whenStable();
    fixture.detectChanges();

    // Assert on DOM, not internal state
    expect(screen.getByTestId('event-stream')).toBeVisible();
    expect(screen.getAllByTestId('event-block')).toHaveLength(1);
  });
});
```

---

## Server-Side Prerequisites

### Streaming Gap Resolution

Per [Infrastructure Research](./research/project-infrastructure.md#2-streaming-implementation-gap), the `Subscribe` RPC is not yet implemented in the web gateway. This must be addressed before frontend streaming works.

**Required Server Changes** (out of scope for frontend TDD, but blocking):

1. Extend `web.py` to support server streaming via chunked transfer encoding
2. Add `Subscribe` to `_METHOD_MAP`
3. Handle streaming response encoding

**Workaround for Frontend Development**: Use `MockSessionGateway` for local development until server streaming is implemented.

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

**Goal**: Basic session management and routing

| Done | Task | FR | Deliverable |
|:----:|------|-----|-------------|
| [x] | Project structure setup | - | Library folders, linting rules |
| [x] | `SessionStateService` | FR-023 | Global state signals |
| [x] | `SessionFacade` skeleton | FR-020 | Facade with mock gateway |
| [x] | `SessionGateway` port + mock | FR-020 | Abstract + test impl |
| [x] | Session list route | FR-002, FR-003 | List view with mock data |
| [ ] | Session route + guard | FR-001, FR-004 | Navigation + validation |

### Phase 2: Communication (Week 2)

**Goal**: Real gRPC-Web integration

| Done | Task | FR | Deliverable |
|:----:|------|-----|-------------|
| [x] | `GrpcSessionGateway` | FR-020 | Connect-ES adapter |
| [x] | `@adk-sim/converters` package | - | Proto ↔ ADK conversion |
| [x] | `LlmRequestConverter` | - | Frontend-specific wrappers |
| [x] | Auto-reconnect logic | FR-022, FR-023 | `ReconnectStrategy` |
| [x] | Connection status UI | FR-023 | `ConnectionStatusComponent` |

### Phase 3: Event Stream (Week 3)

**Goal**: LlmRequest visualization

| Done | Task | FR | Deliverable |
|:----:|------|-----|-------------|
| [x] | `EventStreamComponent` | FR-007 | Container for blocks |
| [ ] | `EventBlockComponent` | FR-007 | User/Agent/Tool blocks |
| [ ] | `DataTreeComponent` | FR-008-011 | JSON tree with thread lines |
| [ ] | `SmartBlobComponent` | FR-012-014 | JSON/MD/RAW toggle |
| [ ] | System instruction accordion | FR-015 | Collapsible header |
| [ ] | Harnesses + Stories | - | Test infrastructure |

### Phase 4: Control Panel (Week 4)

**Goal**: Response construction

| Done | Task | FR | Deliverable |
|:----:|------|-----|-------------|
| [ ] | `ControlPanelComponent` | FR-005 | Right sidebar container |
| [ ] | `ToolCatalogComponent` | FR-016 | Tool listing |
| [ ] | `ToolFormComponent` + JSONForms | FR-017 | Schema-driven tool forms |
| [x] | `ToolFormService` | FR-017 | Schema conversion (proto → JSON Schema) |
| [ ] | `FinalResponseComponent` | FR-018-019 | Text area or schema form |
| [ ] | `SimulationStore` | FR-024 | Request queue management |
| [ ] | Split-pane layout | FR-005 | Layout primitive |

### Phase 5: Polish (Week 5)

**Goal**: Production readiness

| Done | Task | FR | Deliverable |
|:----:|------|-----|-------------|
| [x] | VRT baseline | - | Playwright screenshots |
| [x] | E2E tests | - | Critical user flows |
| [ ] | Error handling | FR-004 | Invalid session UX |
| [ ] | Loading states | - | Skeleton loaders |
| [ ] | Accessibility audit | - | ARIA, keyboard nav |
| [ ] | Documentation | - | Component README files |

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Server streaming not ready | Blocks real integration | Develop with MockGateway; parallelize server work |
| `@google/adk` types change | Converter breaks | Pin version; add CI type checks |
| JSON Schema form complexity | FR-017 incomplete | Start with flat schemas; iterate on nesting |
| Large conversation history | Performance issues | Virtual scrolling; lazy rendering |
| Proto/SDK type mismatch | Converter bugs | Comprehensive round-trip tests |

---

## Open Decisions

1. **~~JSON Schema Form Library~~**: ✅ **DECIDED**: Use `@jsonforms/angular-material` v3.7.0
   - See [JSONForms Research](./research/jsonforms-research.md) for rationale
   - Provides Material Design renderers out-of-box
   - Supports Angular 21 via peer deps
   - Handles nested objects and arrays automatically

2. **Markdown Rendering**: `marked` vs `ngx-markdown`?
   - `marked`: Lightweight, no Angular wrapper
   - `ngx-markdown`: Angular-native, syntax highlighting

3. **Data Tree Implementation**: Custom vs library like `@angular/cdk/tree`?
   - Custom: Matches spec exactly (thread lines, syntax coloring)
   - CDK Tree: Accessibility, keyboard navigation built-in

4. **State Library**: Native Signals vs `@ngrx/signals`?
   - Native: No dependency, simpler
   - NgRx Signals: `signalStore`, `patchState`, better DX for complex state

5. **JSONForms Enum Rendering**: Autocomplete (default) or radio buttons for small enums?
   - Consider: Add UI Schema option for `format: 'radio'` on enums with <5 options
   - See [JSONForms Research - Open Questions](./research/jsonforms-research.md#open-questions)
