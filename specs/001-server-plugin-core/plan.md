# Implementation Plan: ADK Agent Simulator Server & Python Plugin

**Branch**: `001-server-plugin-core` | **Date**: January 3, 2026 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-server-plugin-core/spec.md`

## Summary

Implement the Simulator Server (gRPC backend with SQLite persistence) and Python Plugin (ADK integration using `before_model_callback`) to enable human-in-the-loop validation of agent workflows via the "Remote Brain" protocol.

## Technical Context

**Language/Version**: Python 3.14  
**Primary Dependencies**: grpclib (async gRPC), betterproto (proto codegen), SQLite (persistence)  
**Storage**: SQLite via aiosqlite for async session/event persistence  
**Testing**: pytest with pytest-asyncio  
**Target Platform**: Linux (dev container), cross-platform Python  
**Project Type**: Single project (backend library + server)  
**Performance Goals**: <500ms request submission latency (SC-003)  
**Constraints**: Indefinite blocking wait for human response, no timeout  
**Scale/Scope**: Single developer simulation sessions, FIFO queueing

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Required Gates** (from `.specify/memory/constitution.md`):

- [x] **Small PRs**: Feature decomposed into PRs of 100-200 LOC max
- [x] **Git Town**: All branches will be managed via `git-town` commands
- [x] **Presubmit**: `./scripts/presubmit.sh` must pass before any push
- [x] **No Mocks**: Unit tests use real implementations or fakes; mocks require explicit user permission
- [x] **Tests Included**: Each PR includes implementation AND corresponding tests

## Pull Request Sequence

*REQUIRED: Every plan MUST enumerate the specific PRs needed to implement this feature.*

**Target PR Count**: ~35 PRs (feature is focused on server + plugin only)

### Phase 1: Foundation & Data Layer (PRs 1-10)

| PR # | Branch Name | Description | Est. Lines | Depends On |
|------|-------------|-------------|------------|------------|
| 1 | `feature/001-session-model` | SimulatorSession dataclass + basic validation | ~80 | - |
| 2 | `feature/002-event-types` | SessionEvent, SimulatedLlmRequest, HumanResponse types | ~120 | PR 1 |
| 3 | `feature/003-db-schema` | SQLite schema definitions (sessions, events tables) | ~100 | PR 1 |
| 4 | `feature/004-db-connection` | Async SQLite connection manager using aiosqlite | ~120 | PR 3 |
| 5 | `feature/005-session-repo-create` | SessionRepository.create() + tests | ~150 | PR 4 |
| 6 | `feature/006-session-repo-get` | SessionRepository.get_by_id() + tests | ~100 | PR 5 |
| 7 | `feature/007-session-repo-list` | SessionRepository.list_all() with pagination + tests | ~120 | PR 6 |
| 8 | `feature/008-event-repo-insert` | EventRepository.insert() + tests | ~100 | PR 4 |
| 9 | `feature/009-event-repo-query` | EventRepository.get_by_session() + tests | ~120 | PR 8 |
| 10 | `feature/010-fake-repos` | FakeSessionRepository, FakeEventRepository for testing | ~150 | PR 9 |

### Phase 2: Server Core (PRs 11-20)

| PR # | Branch Name | Description | Est. Lines | Depends On |
|------|-------------|-------------|------------|------------|
| 11 | `feature/011-session-manager` | SessionManager class shell + create_session() | ~120 | PR 10 |
| 12 | `feature/012-session-manager-get` | SessionManager.get_session() + reconnection logic | ~100 | PR 11 |
| 13 | `feature/013-request-queue` | RequestQueue (FIFO per session) implementation | ~150 | PR 2 |
| 14 | `feature/014-event-broadcaster` | EventBroadcaster for streaming to subscribers | ~120 | PR 13 |
| 15 | `feature/015-grpc-create-session` | SimulatorService.create_session() RPC | ~120 | PR 12 |
| 16 | `feature/016-grpc-list-sessions` | SimulatorService.list_sessions() RPC | ~100 | PR 15 |
| 17 | `feature/017-grpc-submit-request` | SimulatorService.submit_request() RPC | ~150 | PR 14 |
| 18 | `feature/018-grpc-submit-decision` | SimulatorService.submit_decision() RPC | ~120 | PR 17 |
| 19 | `feature/019-grpc-subscribe` | SimulatorService.subscribe() with replay | ~180 | PR 18 |
| 20 | `feature/020-server-entrypoint` | Server main entrypoint with graceful shutdown | ~100 | PR 19 |

### Phase 3: Plugin Core (PRs 21-30)

| PR # | Branch Name | Description | Est. Lines | Depends On |
|------|-------------|-------------|------------|------------|
| 21 | `feature/021-plugin-config` | PluginConfig dataclass with env var parsing | ~100 | - |
| 22 | `feature/022-grpc-client` | SimulatorClient gRPC wrapper (connect, close) | ~120 | PR 21 |
| 23 | `feature/023-client-create-session` | SimulatorClient.create_session() | ~80 | PR 22 |
| 24 | `feature/024-client-submit-request` | SimulatorClient.submit_request() | ~100 | PR 23 |
| 25 | `feature/025-client-subscribe` | SimulatorClient.subscribe() async iterator | ~120 | PR 24 |
| 26 | `feature/026-future-registry` | PendingFutureRegistry (turn_id -> Future map) | ~100 | PR 25 |
| 27 | `feature/027-listen-loop` | Plugin._listen_loop() background task | ~150 | PR 26 |
| 28 | `feature/028-plugin-initialize` | Plugin.initialize() with URL output | ~120 | PR 27 |
| 29 | `feature/029-plugin-intercept` | Plugin.before_model_callback() full flow | ~180 | PR 28 |
| 30 | `feature/030-plugin-reconnect` | Reconnection logic on connection loss | ~150 | PR 29 |

### Phase 4: Integration & Polish (PRs 31-35)

| PR # | Branch Name | Description | Est. Lines | Depends On |
|------|-------------|-------------|------------|------------|
| 31 | `feature/031-integration-basic` | Basic integration test: single agent round-trip | ~150 | PR 30 |
| 32 | `feature/032-integration-selective` | Integration test: selective agent interception | ~120 | PR 31 |
| 33 | `feature/033-integration-queue` | Integration test: FIFO queueing of parallel requests | ~150 | PR 32 |
| 34 | `feature/034-integration-persist` | Integration test: session persistence across restart | ~120 | PR 33 |
| 35 | `feature/035-docker-compose` | Docker compose configuration for server | ~80 | PR 34 |

**PR Planning Rules Applied**:
- Each PR is 100-200 lines max ✓
- Each PR includes tests for the code it introduces ✓
- PRs are single-purpose ✓
- Use `git town append` to create dependent branches ✓
- Large components (SessionManager, Plugin) built incrementally across multiple PRs ✓

## Project Structure

### Documentation (this feature)

```text
specs/001-server-plugin-core/
├── plan.md              # This file
├── research.md          # Phase 0 output (N/A - TDD exists)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (protos already exist)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
adk_agent_sim/
├── __init__.py
├── settings.py
├── generated/              # Proto-generated code (betterproto)
│   └── adksim/v1/
├── models/                 # NEW: Domain models
│   ├── __init__.py
│   ├── session.py          # SimulatorSession
│   ├── events.py           # SessionEvent, SimulatedLlmRequest, HumanResponse
│   └── queue.py            # RequestQueue
├── persistence/            # NEW: Data access layer
│   ├── __init__.py
│   ├── database.py         # Connection manager
│   ├── session_repo.py     # SessionRepository
│   └── event_repo.py       # EventRepository
├── plugin/
│   ├── __init__.py
│   ├── core.py             # SimulatorPlugin (enhanced)
│   ├── config.py           # NEW: PluginConfig
│   ├── client.py           # NEW: SimulatorClient (gRPC wrapper)
│   └── futures.py          # NEW: PendingFutureRegistry
└── server/
    ├── __init__.py
    ├── logging.py
    ├── main.py             # Server entrypoint (enhanced)
    ├── session_manager.py  # NEW: SessionManager
    ├── broadcaster.py      # NEW: EventBroadcaster
    └── services/
        ├── __init__.py
        └── simulator_service.py  # Full implementation

tests/
├── conftest.py
├── fixtures/               # NEW: Shared fakes
│   ├── __init__.py
│   ├── fake_session_repo.py
│   └── fake_event_repo.py
├── integration/
│   ├── __init__.py
│   ├── test_round_trip.py          # NEW
│   ├── test_selective_intercept.py # NEW
│   ├── test_fifo_queue.py          # NEW
│   └── test_persistence.py         # NEW
└── unit/
    ├── __init__.py
    ├── models/                      # NEW
    │   ├── test_session.py
    │   └── test_events.py
    ├── persistence/                 # NEW
    │   ├── test_session_repo.py
    │   └── test_event_repo.py
    ├── plugin/
    │   ├── test_plugin.py          # Enhanced
    │   ├── test_config.py          # NEW
    │   └── test_client.py          # NEW
    └── server/
        ├── test_simulator_service.py  # Enhanced
        └── test_session_manager.py    # NEW
```

**Structure Decision**: Single project structure maintained. New modules (`models/`, `persistence/`, `fixtures/`) added to organize domain logic, data access, and test infrastructure.

## Data Model

### SimulatorSession

```
SimulatorSession
├── id: UUID (primary key)
├── created_at: datetime
├── description: Optional[str]
└── status: Literal["active", "completed"]
```

### SessionEvent

```
SessionEvent
├── event_id: UUID
├── session_id: UUID (FK)
├── timestamp: datetime
├── turn_id: UUID (correlation)
├── agent_name: str
└── payload: SimulatedLlmRequest | HumanResponse
```

### SimulatedLlmRequest

```
SimulatedLlmRequest
├── contents: list[Content]
├── system_instruction: str
└── tools: list[Tool]
```

### HumanResponse

```
HumanResponse
└── candidates: list[Content]
```

## Key Implementation Notes

### Future Map Pattern (Plugin)

The plugin uses a concurrent dictionary mapping `turn_id -> Future`:

1. `before_model_callback()` creates a Future, stores it by turn_id
2. Submits request to server
3. Awaits the Future (blocks agent)
4. `_listen_loop()` receives response, resolves Future by turn_id
5. Response returned to agent

### FIFO Queueing (Server)

- Each session has a `RequestQueue` (asyncio.Queue)
- Requests are enqueued on arrival
- UI receives events in strict FIFO order via `EventBroadcaster`
- Human can only respond to the "current" request (head of queue)

### Event Replay (Server)

On `subscribe()`:
1. Load all events for session from SQLite
2. Stream historical events to subscriber
3. Switch to live mode (broadcast new events)

### Reconnection (Plugin)

- Plugin stores `session_id` after initial connection
- On connection loss, reconnect with same `session_id`
- Server replays events; plugin ignores completed turn_ids
- Eventually receives response for blocked turn_id

## Complexity Tracking

No constitution violations. All gates pass.

## Dependencies

**New Dependencies Required** (add to pyproject.toml):

- `aiosqlite>=0.20.0` - Async SQLite for persistence (FR-002, FR-003)

**Existing Dependencies Used**:

- `grpclib` - Async gRPC client/server
- `betterproto` - Proto codegen (already configured)
- `pytest-asyncio` - Async test support
