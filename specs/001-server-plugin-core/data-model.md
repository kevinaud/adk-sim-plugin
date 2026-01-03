# Data Model: ADK Agent Simulator Server & Python Plugin

**Feature**: 001-server-plugin-core  
**Created**: January 3, 2026

## Entity Relationship Diagram

```
┌─────────────────────────────────┐
│        SimulatorSession         │
├─────────────────────────────────┤
│ id: UUID (PK)                   │
│ created_at: datetime            │
│ description: Optional[str]      │
│ status: "active" | "completed"  │
└──────────────┬──────────────────┘
               │ 1
               │
               │ *
┌──────────────┴──────────────────┐
│          SessionEvent           │
├─────────────────────────────────┤
│ event_id: UUID (PK)             │
│ session_id: UUID (FK)           │
│ timestamp: datetime             │
│ turn_id: UUID                   │
│ agent_name: str                 │
│ payload: Request | Response     │
└─────────────────────────────────┘
               │
               │ (oneof)
    ┌──────────┴──────────┐
    ▼                     ▼
┌─────────────────┐  ┌─────────────────┐
│SimulatedLlmReq  │  │  HumanResponse  │
├─────────────────┤  ├─────────────────┤
│ contents: []    │  │ candidates: []  │
│ system_instr    │  └─────────────────┘
│ tools: []       │
└─────────────────┘
```

## Domain Entities

### SimulatorSession

Represents a single simulation run where a developer is stepping through agent decisions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Unique identifier for the session |
| `created_at` | datetime | NOT NULL | When the session was created |
| `description` | str | Optional, max 500 chars | Human-readable label for identification |
| `status` | Literal | "active" \| "completed" | Current lifecycle state |

**Invariants**:
- A session is created in "active" status
- Status transitions only from "active" → "completed" (no reverse)
- `id` is immutable after creation

### SessionEvent

The core event envelope that wraps all session activity. Links requests to responses via `turn_id`.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `event_id` | UUID | PK, auto-generated | Unique identifier for this event |
| `session_id` | UUID | FK → SimulatorSession.id | Parent session |
| `timestamp` | datetime | NOT NULL | When the event occurred |
| `turn_id` | UUID | NOT NULL | Correlation ID linking request ↔ response |
| `agent_name` | str | NOT NULL, max 100 chars | Name of the agent that triggered the event |
| `payload` | Union | NOT NULL | Either SimulatedLlmRequest or HumanResponse |

**Invariants**:
- Each `turn_id` has exactly one request event and at most one response event
- Events are ordered by `timestamp` within a session
- `payload` is exactly one of the two variants (enforced by proto oneof)

### SimulatedLlmRequest

The serialized LLM request data extracted from ADK's `LlmRequest` Pydantic model.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `contents` | list[Content] | NOT NULL | Conversation history and current input |
| `system_instruction` | str | Optional | System instructions for the agent |
| `tools` | list[Tool] | Optional | Available tools/functions |

**Nested Types**:

```
Content
├── role: "user" | "model" | "function"
└── parts: list[Part]

Part (oneof)
├── text: str
├── function_call: FunctionCall
└── function_response: FunctionResponse

FunctionCall
├── name: str
└── args: str (JSON-encoded)

FunctionResponse
├── name: str
└── response: str (JSON-encoded)

Tool
└── function_declarations: list[FunctionDeclaration]

FunctionDeclaration
├── name: str
├── description: str
└── parameters: str (JSON Schema)
```

### HumanResponse

The response provided by the human via the Web UI.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `candidates` | list[Content] | NOT NULL, min 1 | The generated content (text or function calls) |

**Invariants**:
- At least one candidate must be present
- Candidate content follows same `Content` structure as request

### RequestQueue (Runtime Only)

In-memory FIFO queue for pending requests within a session. Not persisted.

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | UUID | Parent session |
| `queue` | asyncio.Queue | Pending request events |

**Behavior**:
- Requests enqueued in arrival order
- Only head of queue is "active" for human response
- Dequeued when human submits decision

## SQLite Schema

```sql
-- Session metadata table
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,  -- Unix timestamp
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active'
);

-- Event log table
CREATE TABLE events (
    event_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    timestamp INTEGER NOT NULL,  -- Unix timestamp (ms precision)
    turn_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    payload_type TEXT NOT NULL,  -- 'request' or 'response'
    proto_blob BLOB NOT NULL,    -- Serialized protobuf
    UNIQUE(session_id, event_id)
);

-- Index for efficient session queries
CREATE INDEX idx_events_session ON events(session_id, timestamp);

-- Index for turn_id lookups
CREATE INDEX idx_events_turn ON events(turn_id);
```

## State Transitions

### Session Lifecycle

```
┌─────────┐  create_session()   ┌────────┐
│  (new)  │ ─────────────────→ │ active │
└─────────┘                     └────┬───┘
                                     │
                                     │ (future: explicit close)
                                     ▼
                               ┌───────────┐
                               │ completed │
                               └───────────┘
```

### Request-Response Flow

```
┌──────────────┐  submit_request()  ┌─────────┐
│ Agent waits  │ ─────────────────→ │ Pending │
└──────────────┘                    └────┬────┘
                                         │
                                         │ submit_decision()
                                         ▼
                                   ┌───────────┐
                                   │ Resolved  │
                                   └───────────┘
```

## Validation Rules

### SimulatorSession
- `id` must be valid UUIDv4
- `description` max 500 characters (truncate if longer)
- `status` must be one of defined literals

### SessionEvent
- `session_id` must reference existing session
- `turn_id` must be valid UUIDv4
- `agent_name` must not be empty, max 100 characters

### SimulatedLlmRequest
- `contents` list can be empty (rare but valid)
- JSON fields (`args`, `response`, `parameters`) must be valid JSON

### HumanResponse
- `candidates` must have at least one element
- Each candidate must have at least one part
