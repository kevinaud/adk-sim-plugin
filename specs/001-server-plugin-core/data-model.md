# Data Model: ADK Agent Simulator Server & Python Plugin

**Feature**: 001-server-plugin-core  
**Created**: January 3, 2026

## Design Philosophy: Proto as Single Source of Truth

This implementation uses **betterproto-generated classes directly** rather than defining redundant domain model classes. The generated classes from `adk_agent_sim.generated.adksim.v1` (e.g., `SimulatorSession`, `SessionEvent`) are high-quality Python dataclasses with proper typing, serialization, and validation.

**Rationale**:
- Avoids maintenance burden of keeping model classes in sync with protos
- Betterproto classes are already dataclasses with proper `__eq__`, `__repr__`
- State transitions and business rules are enforced at the service layer
- Persistence uses "Promoted Field" pattern (see SQLite Schema below)

## Entity Relationship Diagram

```
┌─────────────────────────────────┐
│        SimulatorSession         │  ← betterproto.Message
│        (adksim.v1 proto)        │
├─────────────────────────────────┤
│ id: str (PK)                    │
│ created_at: datetime            │
│ description: str                │
└──────────────┬──────────────────┘
               │ 1
               │
               │ *
┌──────────────┴──────────────────┐
│          SessionEvent           │  ← betterproto.Message
│        (adksim.v1 proto)        │
├─────────────────────────────────┤
│ event_id: str (PK)              │
│ session_id: str (FK)            │
│ timestamp: datetime             │
│ turn_id: str                    │
│ agent_name: str                 │
│ payload: oneof                  │
└─────────────────────────────────┘
               │
               │ (oneof group="payload")
    ┌──────────┴──────────┐
    ▼                     ▼
┌─────────────────┐  ┌─────────────────┐
│  llm_request    │  │  llm_response   │
│ (GenerateCon-   │  │ (GenerateCon-   │
│  tentRequest)   │  │  tentResponse)  │
├─────────────────┤  ├─────────────────┤
│google.ai.gen-   │  │google.ai.gen-   │
│erativelanguage  │  │erativelanguage  │
│.v1beta proto    │  │.v1beta proto    │
└─────────────────┘  └─────────────────┘
```

## Proto Definitions (Source of Truth)

All domain entities are defined in proto files and generated via betterproto. **No additional Python model classes are required.**

### SimulatorSession (`adksim.v1.SimulatorSession`)

**Source**: `protos/adksim/v1/simulator_session.proto`  
**Generated**: `adk_agent_sim.generated.adksim.v1.SimulatorSession`

| Field | Proto Type | Python Type | Description |
|-------|------------|-------------|-------------|
| `id` | `string` | `str` | Unique identifier for the session (UUID) |
| `created_at` | `google.protobuf.Timestamp` | `datetime` | When the session was created |
| `description` | `string` | `str` | Optional human-readable description/metadata |

**Note**: Session status (active/completed) is tracked via database column, not proto field.

### SessionEvent (`adksim.v1.SessionEvent`)

**Source**: `protos/adksim/v1/simulator_session.proto`  
**Generated**: `adk_agent_sim.generated.adksim.v1.SessionEvent`

| Field | Proto Type | Python Type | Description |
|-------|------------|-------------|-------------|
| `event_id` | `string` | `str` | Unique identifier for this event |
| `session_id` | `string` | `str` | The session this event belongs to |
| `timestamp` | `google.protobuf.Timestamp` | `datetime` | When this event occurred |
| `turn_id` | `string` | `str` | Correlation ID linking request to response |
| `agent_name` | `string` | `str` | Name of the agent that triggered this event |
| `llm_request` | `GenerateContentRequest` | `GenerateContentRequest` | LLM request (oneof payload) |
| `llm_response` | `GenerateContentResponse` | `GenerateContentResponse` | Human response (oneof payload) |

**Payload Oneof**: Exactly one of `llm_request` or `llm_response` is set per event.

### GenerateContentRequest/Response (`google.ai.generativelanguage.v1beta`)

**Source**: `protos/google/ai/generativelanguage/v1beta/generative_service.proto`  
**Generated**: `adk_agent_sim.generated.google.ai.generativelanguage.v1beta`

These are Google's standard Generative Language API types, vendored and generated via betterproto. Key nested types:

```
GenerateContentRequest
├── model: str
├── contents: list[Content]
├── system_instruction: Content
├── tools: list[Tool]
├── tool_config: ToolConfig
├── safety_settings: list[SafetySetting]
└── generation_config: GenerationConfig

GenerateContentResponse
├── candidates: list[Candidate]
├── prompt_feedback: PromptFeedback
└── usage_metadata: UsageMetadata

Content
├── role: str ("user" | "model")
└── parts: list[Part]

Part (oneof)
├── text: str
├── inline_data: Blob
├── function_call: FunctionCall
├── function_response: FunctionResponse
├── executable_code: ExecutableCode
└── code_execution_result: CodeExecutionResult
```

**Usage**: Import directly:
```python
from adk_agent_sim.generated.adksim.v1 import SimulatorSession, SessionEvent
from adk_agent_sim.generated.google.ai.generativelanguage.v1beta import (
    GenerateContentRequest,
    GenerateContentResponse,
    Content,
    Part,
)
```

### RequestQueue (Runtime Only)

In-memory FIFO queue for pending requests within a session. Not persisted.

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | str | Parent session |
| `queue` | asyncio.Queue | Pending SessionEvent objects |

**Behavior**:
- Requests enqueued in arrival order
- Only head of queue is "active" for human response
- Dequeued when human submits decision via `submit_decision()`

## Persistence Layer

### Technology Stack

- **`databases`**: Async database access library
- **`SQLAlchemy Core`**: Schema definition and query building (NOT the ORM/Session layer)
- **SQLite**: Storage backend (via `aiosqlite` driver)

### Promoted Field Pattern

The persistence layer uses a **Promoted Field** pattern:

1. **Full proto serialized as BLOB**: The complete `SimulatorSession` or `SessionEvent` betterproto object is serialized to bytes and stored in a `proto_blob` column.

2. **Promoted columns for queries**: Only fields needed for filtering, indexing, or querying are "promoted" to dedicated SQL columns.

**Benefits**:
- Proto definition remains the single source of truth
- No need to map every proto field to a database column
- Schema changes only required when query patterns change
- Reading data deserializes the full proto from blob

### SQLAlchemy Core Schema

```python
# adk_agent_sim/persistence/schema.py
from sqlalchemy import (
    MetaData,
    Table,
    Column,
    String,
    Integer,
    LargeBinary,
    Index,
)

metadata = MetaData()

# Session table with promoted fields for querying
sessions = Table(
    "sessions",
    metadata,
    # Promoted fields (queryable)
    Column("id", String, primary_key=True),
    Column("created_at", Integer, nullable=False),  # Unix timestamp
    Column("status", String, nullable=False, default="active"),
    # Full proto blob
    Column("proto_blob", LargeBinary, nullable=False),
)

# Event table with promoted fields for querying
events = Table(
    "events",
    metadata,
    # Promoted fields (queryable)
    Column("event_id", String, primary_key=True),
    Column("session_id", String, nullable=False, index=True),
    Column("timestamp", Integer, nullable=False),  # Unix timestamp (ms)
    Column("turn_id", String, nullable=False),
    Column("payload_type", String, nullable=False),  # "request" | "response"
    # Full proto blob
    Column("proto_blob", LargeBinary, nullable=False),
    # Composite index for session timeline queries
    Index("idx_events_session_time", "session_id", "timestamp"),
    Index("idx_events_turn", "turn_id"),
)
```

### Database Connection

```python
# adk_agent_sim/persistence/database.py
from databases import Database
from .schema import metadata

async def create_database(url: str = "sqlite:///./simulator.db") -> Database:
    """Create and initialize the database connection."""
    database = Database(url)
    await database.connect()
    
    # Create tables using SQLAlchemy's DDL
    from sqlalchemy import create_engine
    engine = create_engine(url.replace("sqlite", "sqlite+aiosqlite", 1))
    metadata.create_all(engine)
    
    return database
```

### Repository Pattern

```python
# Example: SessionRepository using Promoted Field pattern
class SessionRepository:
    def __init__(self, database: Database):
        self._db = database

    async def create(self, session: SimulatorSession, status: str = "active") -> None:
        """Persist a new session."""
        await self._db.execute(
            sessions.insert().values(
                id=session.id,
                created_at=session.created_at,
                status=status,
                proto_blob=bytes(session),  # betterproto serialization
            )
        )

    async def get_by_id(self, session_id: str) -> SimulatorSession | None:
        """Retrieve a session by ID."""
        row = await self._db.fetch_one(
            sessions.select().where(sessions.c.id == session_id)
        )
        if row is None:
            return None
        return SimulatorSession().parse(row["proto_blob"])  # betterproto deserialization

    async def list_active(self) -> list[SimulatorSession]:
        """List all active sessions."""
        rows = await self._db.fetch_all(
            sessions.select()
                .where(sessions.c.status == "active")
                .order_by(sessions.c.created_at.desc())
        )
        return [SimulatorSession().parse(row["proto_blob"]) for row in rows]
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

Validation is enforced at the **service layer**, not in the proto/model definitions.

### SimulatorSession
- `id` must be valid UUIDv4 format (validated on creation)
- `description` max 500 characters (truncate if longer)
- `status` column values: `"active"` or `"completed"` (enforced at service layer)

### SessionEvent
- `session_id` must reference existing session (FK check at service layer)
- `turn_id` must be valid UUIDv4 format
- `agent_name` must not be empty, max 100 characters
- Exactly one of `llm_request` or `llm_response` must be set (proto oneof enforced)

### Business Rules (Service Layer)
- Each `turn_id` should have exactly one request event and at most one response event
- Events must be ordered by `timestamp` within a session
- Session status only transitions: `active` → `completed` (no reverse)
- `GenerateContentResponse.candidates` should have at least one element for valid human responses
