---
title: Prototype Architecture Research Findings
type: research
parent: ../frontend-spec.md
related:
  - ../frontend-spec.md
---

# Prototype Architecture Research Findings

**Source**: `/tmp/rpc-streaming-prototype/frontend`
**Date**: January 11, 2026
**Purpose**: Extract proven patterns from the gRPC streaming prototype for application to the ADK Simulator Web UI.

## Related Documents

- [Frontend Spec](../frontend-spec.md) - Feature specification this research supports
- [Main TDD](../../tdd.md) - System technical design

---

## Table of Contents

- [Related Documents](#related-documents)
- [Overview](#overview)
- [Architecture Summary](#architecture-summary)
  - [Technology Stack](#technology-stack)
- [Key Patterns](#key-patterns)
  - [Signal-Based State Management](#signal-based-state-management)
  - [gRPC-Web Streaming with Connect-ES](#grpc-web-streaming-with-connect-es)
  - [Connection Lifecycle with Auto-Reconnect](#connection-lifecycle-with-auto-reconnect)
  - [Discriminated Union Event Processing](#discriminated-union-event-processing)
  - [Upsert Pattern for Idempotent Updates](#upsert-pattern-for-idempotent-updates)
  - [Component Composition](#component-composition)
  - [Session Validation on Navigation](#session-validation-on-navigation)
- [Mapping Prototype → Real Application](#mapping-prototype-real-application)
- [Gaps to Address](#gaps-to-address)
  - [Data Visualization (FR-008 through FR-014)](#data-visualization-fr-008-through-fr-014)
  - [Dynamic Form Generation (FR-017, FR-018)](#dynamic-form-generation-fr-017-fr-018)
  - [Tool Catalog (FR-016)](#tool-catalog-fr-016)
  - [Session List (FR-002, FR-003)](#session-list-fr-002-fr-003)
  - [Request Queue (FR-024)](#request-queue-fr-024)
- [Recommendations Summary](#recommendations-summary)
- [Next Research Topics](#next-research-topics)


## Overview

The prototype is a simplified approval workflow application demonstrating bidirectional gRPC-Web streaming between a browser client and Python backend. A "Proposer" submits proposals; an "Approver" (web UI user) views and approves/rejects them in real-time.

This architecture directly maps to the ADK Simulator use case where the ADK Plugin sends `LlmRequest` messages and the web UI user constructs and submits responses.

---

## Architecture Summary

| Layer | Implementation | Purpose |
|-------|----------------|---------|
| **Routing** | Lazy-loaded feature routes | `/` (join session), `/session/:id` (simulation) |
| **State** | `SessionStateService` with Angular Signals | Centralized reactive state management |
| **Communication** | `ApprovalService` with Connect-ES v2 / gRPC-Web | Server streaming + unary RPC calls |
| **UI** | Standalone components + Angular Material | Split-pane layout |

### Technology Stack

- Angular 21 with Zoneless change detection
- Angular Material for UI components
- Connect-ES v2 with `@connectrpc/connect-web` for gRPC-Web
- `@bufbuild/protobuf` for generated message types
- Vitest for testing

---

## Key Patterns

### Signal-Based State Management

The prototype uses Angular's native Signals for centralized state without external libraries (NgRx, etc.).

**Pattern**: Private writable signals with public readonly accessors and computed derived state.

```typescript
@Injectable({ providedIn: 'root' })
export class SessionStateService {
  // Private writable signals
  private readonly _connectionStatus = signal<ConnectionStatus>('disconnected');
  private readonly _proposals = signal<Proposal[]>([]);

  // Public readonly signals (encapsulation)
  readonly connectionStatus = this._connectionStatus.asReadonly();
  readonly proposals = this._proposals.asReadonly();

  // Computed signals for derived state
  readonly pendingProposal = computed(() => {
    const proposals = this._proposals();
    for (let i = proposals.length - 1; i >= 0; i--) {
      if (proposals[i]?.status === ProposalStatus.PENDING) {
        return proposals[i];
      }
    }
    return null;
  });

  readonly proposalHistory = computed(() => {
    const pending = this.pendingProposal();
    return pending
      ? this._proposals().filter(p => p.proposalId !== pending.proposalId)
      : this._proposals();
  });
}
```

**Applicability**: Maps directly to our spec requirements:
- `pendingProposal` → Current `LlmRequest` awaiting response (FR-006: stateless visualization)
- `proposalHistory` → Conversation history in Event Stream (FR-007)
- `connectionStatus` → Connection state indicator (FR-023)

**Recommendation**: Adopt this pattern. Consider whether a single `SessionStateService` suffices or if we need domain-specific stores (e.g., `EventStreamStore`, `ControlPanelStore`).

---

### gRPC-Web Streaming with Connect-ES

The prototype uses Connect-ES v2 with async iterators for server streaming.

**Pattern**: Service class wraps the generated client, exposes async generators for streaming RPCs.

```typescript
@Injectable({ providedIn: 'root' })
export class ApprovalService {
  private readonly transport: Transport;
  private readonly client: Client<typeof ProposalService>;
  private abortController: AbortController | null = null;

  constructor() {
    this.transport = createGrpcWebTransport({
      baseUrl: ENVIRONMENT.grpcWebUrl,
    });
    this.client = createClient(ProposalService, this.transport);
  }

  async *subscribe(sessionId: string, clientId: string): AsyncIterable<SubscribeResponse> {
    this.cancelSubscription();
    this.abortController = new AbortController();

    const request = create(SubscribeRequestSchema, { sessionId, clientId });

    try {
      for await (const response of this.client.subscribe(request, {
        signal: this.abortController.signal,
      })) {
        yield response;
      }
    } finally {
      this.abortController = null;
    }
  }

  cancelSubscription(): void {
    this.abortController?.abort();
    this.abortController = null;
  }
}
```

**Key Details**:
- `AbortController` enables clean cancellation on component destroy
- Async generator yields events as they arrive
- Transport configured via environment for different backends (dev/prod)

**Applicability**: Directly applicable. Our `LlmService` will have similar structure for the `Subscribe` RPC that streams `LlmRequest` events.

**Recommendation**: Adopt pattern as-is. Ensure `DestroyRef.onDestroy()` calls `cancelSubscription()`.

---

### Connection Lifecycle with Auto-Reconnect

The `SessionComponent` manages the full streaming lifecycle including reconnection.

**Pattern**: Subscription loop with error handling and exponential backoff.

```typescript
export class SessionComponent implements OnInit {
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelayMs = 2000;
  private abortController: AbortController | null = null;

  private async startSubscription(sessionId: string): Promise<void> {
    this.abortController?.abort();
    this.abortController = new AbortController();
    this.sessionState.setConnectionStatus('connecting');

    try {
      for await (const response of this.approvalService.subscribe(sessionId, this.clientId)) {
        if (this.abortController.signal.aborted) break;

        if (this.sessionState.connectionStatus() !== 'connected') {
          this.sessionState.setConnectionStatus('connected');
          this.reconnectAttempts = 0;
        }

        this.processSessionEvent(response.event);
      }

      if (!this.abortController.signal.aborted) {
        this.handleDisconnect(sessionId);
      }
    } catch (error) {
      if (!this.abortController.signal.aborted) {
        this.handleDisconnect(sessionId);
      }
    }
  }

  private handleDisconnect(sessionId: string): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.sessionState.setConnectionStatus('reconnecting');
      setTimeout(() => this.startSubscription(sessionId), this.reconnectDelayMs);
    } else {
      this.sessionState.setError('Connection lost. Please refresh to reconnect.');
    }
  }
}
```

**Applicability**: Directly addresses FR-022 (auto-reconnect) and FR-023 (visual indicator).

**Recommendation**: Adopt with modifications:
- Consider exponential backoff instead of fixed delay
- May want configurable retry limits
- Consider extracting reconnection logic to a reusable service/utility

---

### Discriminated Union Event Processing

The prototype handles protobuf `oneof` fields using TypeScript discriminated unions.

**Pattern**: Switch on `event.case` to process different event types.

```typescript
private processSessionEvent(sessionEvent: SessionEvent): void {
  const event = sessionEvent.event;
  switch (event.case) {
    case 'proposalCreated':
      this.sessionState.upsertProposal(event.value);
      break;
    case 'proposalUpdated':
      this.sessionState.upsertProposal(event.value);
      break;
  }
}
```

**Applicability**: Our `LlmRequest` events will be more complex but the same pattern applies for handling different message types from the stream.

**Recommendation**: Adopt pattern. Design protobuf schema with `oneof` for different event types.

---

### Upsert Pattern for Idempotent Updates

The prototype uses upsert (insert or update) to handle both fresh events and replayed history on reconnect.

**Pattern**: Check existence before deciding to add or update.

```typescript
upsertProposal(proposal: Proposal): void {
  const exists = this._proposals().some(p => p.proposalId === proposal.proposalId);
  if (exists) {
    this.updateProposal(proposal);
  } else {
    this.addProposal(proposal);
  }
}
```

**Applicability**: Important for handling reconnection scenarios where the server may replay recent history.

**Recommendation**: Adopt for any stateful collections. Consider whether `LlmRequest` needs this (spec says stateless visualization of current request only, so may not apply).

---

### Component Composition

The prototype uses clear component boundaries with smart container / dumb presentational separation.

| Component | Role | Responsibility |
|-----------|------|----------------|
| `SessionComponent` | Container | Lifecycle, subscription, routing |
| `HistoryPanelComponent` | Presentational | Renders proposal history list |
| `DecisionPanelComponent` | Mixed | Renders pending + handles submission |
| `ConnectionStatusComponent` | Presentational | Status indicator |

**Layout Structure**:
```
SessionComponent
├── Toolbar (session ID, connection status, leave button)
└── Content
    ├── HistoryPanel (left)
    └── DecisionPanel (right)
```

**Applicability**: Maps directly to our spec layout (FR-005):
- `HistoryPanel` → **Event Stream** (left/center)
- `DecisionPanel` → **Control Panel** (right sidebar)

**Recommendation**: Adopt structure. Our components will be more complex:
- Event Stream needs: EventBlock rendering, Data Tree, SmartBlob toggles
- Control Panel needs: Tool Catalog, Dynamic Form Generator, Final Response form

---

### Session Validation on Navigation

The `JoinSessionComponent` validates session existence before navigation.

**Pattern**: Call `getSession()` RPC, handle errors, then navigate.

```typescript
async onSubmit(): Promise<void> {
  try {
    await this.approvalService.getSession(sessionId);
    await this.router.navigate(['/session', sessionId]);
  } catch (error) {
    this.errorMessage.set('Session not found. Please check the ID and try again.');
  }
}
```

**Applicability**: Addresses FR-004 (invalid session handling).

**Recommendation**: Adopt. Also need to handle the case where user navigates directly to `/session/:id` with invalid ID (use route guard or component-level validation).

---

## Mapping Prototype → Real Application

| Prototype Concept | Spec Requirement | Real Application Equivalent |
|-------------------|------------------|----------------------------|
| `Proposal` | FR-006 | `LlmRequest` with `contents`, `tools`, `output_schema` |
| `proposalHistory` | FR-007 | `EventBlock[]` (conversation history) |
| `pendingProposal` | FR-006 | Current `LlmRequest` awaiting response |
| `HistoryPanel` | FR-005, FR-007-015 | **Event Stream** pane |
| `DecisionPanel` | FR-005, FR-016-019 | **Control Panel** pane |
| Approve/Reject buttons | FR-017-019 | Dynamic forms for tool invocation / final response |
| `ProposalStatus` | - | Response submission state |
| `ConnectionStatus` | FR-023 | Connection indicator (same) |

---

## Gaps to Address

The prototype validates the streaming architecture but does not cover:

### Data Visualization (FR-008 through FR-014)
- **Data Tree component**: Hierarchical tree with collapsible nodes, thread lines, syntax coloring
- **SmartBlob handling**: JSON detection, Markdown detection, toggle rendering modes

### Dynamic Form Generation (FR-017, FR-018)
- **JSON Schema → Form**: Generate Angular forms from tool input schemas
- **Nested object support**: Handle arbitrarily nested schemas
- **Array support**: Dynamic add/remove for array fields

### Tool Catalog (FR-016)
- **Tool listing**: Display available tools with metadata
- **Schema preview**: Collapsible view of input schema
- **Selection flow**: Tool selection → form generation

### Session List (FR-002, FR-003)
- **Session browsing**: List all active sessions
- **Session metadata**: Display ID, creation time, status

### Request Queue (FR-024)
- **FIFO presentation**: Handle multiple queued requests from parallel agents

---

## Recommendations Summary

| Category | Recommendation | Confidence |
|----------|---------------|------------|
| State Management | Adopt Signal-based `SessionStateService` pattern | High |
| gRPC Communication | Adopt Connect-ES v2 async iterator pattern | High |
| Auto-Reconnect | Adopt with exponential backoff enhancement | High |
| Component Structure | Adopt container/presentational separation | High |
| Session Validation | Adopt, add route guard for direct navigation | High |
| Data Tree | New component needed - research libraries or build custom | Research needed |
| Dynamic Forms | New capability needed - research JSON Schema form libraries | Research needed |
| SmartBlob | New component needed - design toggle behavior | Design needed |

---

## Next Research Topics

1. **Angular JSON Schema Form Libraries** - Evaluate options for FR-017/FR-018
2. **Tree Visualization Libraries** - Evaluate options for FR-008 through FR-011
3. **Markdown Rendering** - Evaluate options for FR-013
4. **Existing ADK Protobuf Definitions** - Understand `LlmRequest` structure from 001-server-plugin-core
