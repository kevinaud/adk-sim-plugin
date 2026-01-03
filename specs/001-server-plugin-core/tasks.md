# Tasks: ADK Agent Simulator Server & Python Plugin

**Input**: Design documents from `/specs/001-server-plugin-core/`
**Prerequisites**: plan.md ✓, spec.md ✓, data-model.md ✓, quickstart.md ✓

**Tests**: Implementation and tests MUST be submitted together in the same PR (per Constitution V.).

**Organization**: Tasks are grouped by Pull Request to enable small, focused submissions (100-200 LOC max).

## Constitutional Requirements

- **PR Size**: Each PR MUST be 100-200 lines max - tasks are grouped to fit this constraint
- **Tests Included**: Every implementation task includes its corresponding tests in the same PR
- **Git Town**: Use `git town append` to create dependent PR branches
- **Presubmit Gate**: Run `./scripts/presubmit.sh` before every `git push`
- **No Mocks**: Unit tests MUST use real implementations or fakes; mocks require explicit user permission

## Format: `[ID] [PR#] [P?] Description`

- **[PR#]**: Which Pull Request this task belongs to (e.g., PR1, PR2, PR3)
- **[P]**: Can run in parallel within the same PR (different files, no dependencies)
- Include exact file paths in descriptions
- Each PR groups related tasks that fit within 100-200 LOC

## User Story → PR Mapping

| User Story | Priority | PRs |
|------------|----------|-----|
| US1: Basic Agent Interception | P1 | PR 9-18, PR 19-29 |
| US2: Selective Agent Interception | P1 | PR 28 (target_agents filtering) |
| US3: Session Persistence | P2 | PR 1-8 (data layer), PR 29 (reconnect) |
| US4: Sequential Request Queueing | P2 | PR 11, PR 12, PR 15 |
| US5: Environment Configuration | P3 | PR 19 |

---

## Phase 1: Foundation & Data Layer

---

## PR 1: Database Schema (~80 lines)

**Branch**: `git town hack feature/001-db-schema`
**Depends on**: -
**Goal**: SQLAlchemy Core schema definitions for sessions and events tables
**User Stories**: US3 (Session Persistence)

- [ ] T001 [PR1] Create `adk_agent_sim/persistence/__init__.py` with module exports
- [ ] T002 [PR1] Define `sessions` table with promoted fields (id, created_at, status, proto_blob) in `adk_agent_sim/persistence/schema.py`
- [ ] T003 [PR1] Define `events` table with promoted fields (event_id, session_id, timestamp, turn_id, payload_type, proto_blob) in `adk_agent_sim/persistence/schema.py`
- [ ] T004 [PR1] Add composite indexes for session timeline and turn_id queries in `adk_agent_sim/persistence/schema.py`

---

## PR 2: Database Connection (~100 lines)

**Branch**: `git town append feature/002-db-connection`
**Depends on**: PR 1
**Goal**: Async database connection manager using `databases` library
**User Stories**: US3 (Session Persistence)

- [ ] T005 [PR2] Create `Database` connection class with `connect()` and `disconnect()` in `adk_agent_sim/persistence/database.py`
- [ ] T006 [PR2] Implement `create_tables()` using SQLAlchemy metadata in `adk_agent_sim/persistence/database.py`
- [ ] T007 [PR2] Add database URL configuration (default: `sqlite:///./simulator.db`) in `adk_agent_sim/persistence/database.py`
- [ ] T008 [PR2] Add database connection tests in `tests/unit/persistence/test_database.py`

---

## PR 3: SessionRepository.create() (~150 lines)

**Branch**: `git town append feature/003-session-repo-create`
**Depends on**: PR 2
**Goal**: Create sessions with Promoted Field pattern
**User Stories**: US3 (Session Persistence)

- [ ] T009 [PR3] Create `SessionRepository` class with `__init__(database)` in `adk_agent_sim/persistence/session_repo.py`
- [ ] T010 [PR3] Implement `create(session: SimulatorSession, status: str = "active")` with proto blob serialization in `adk_agent_sim/persistence/session_repo.py`
- [ ] T011 [PR3] Add `create()` tests verifying proto serialization and promoted field extraction in `tests/unit/persistence/test_session_repo.py`

---

## PR 4: SessionRepository.get_by_id() (~100 lines)

**Branch**: `git town append feature/004-session-repo-get`
**Depends on**: PR 3
**Goal**: Retrieve sessions by ID with proto deserialization
**User Stories**: US3 (Session Persistence)

- [ ] T012 [PR4] Implement `get_by_id(session_id: str) -> SimulatorSession | None` in `adk_agent_sim/persistence/session_repo.py`
- [ ] T013 [PR4] Add proto blob deserialization using `SimulatorSession().parse()` in `adk_agent_sim/persistence/session_repo.py`
- [ ] T014 [PR4] Add `get_by_id()` tests for existing and non-existent sessions in `tests/unit/persistence/test_session_repo.py`

---

## PR 5: SessionRepository.list_all() (~120 lines)

**Branch**: `git town append feature/005-session-repo-list`
**Depends on**: PR 4
**Goal**: List sessions with pagination support
**User Stories**: US3 (Session Persistence)

- [ ] T015 [PR5] Implement `list_all(page_size: int, page_token: str | None)` in `adk_agent_sim/persistence/session_repo.py`
- [ ] T016 [PR5] Add pagination using `created_at` cursor-based approach in `adk_agent_sim/persistence/session_repo.py`
- [ ] T017 [PR5] Implement `update_status(session_id: str, status: str)` for session lifecycle in `adk_agent_sim/persistence/session_repo.py`
- [ ] T018 [PR5] Add `list_all()` and `update_status()` tests in `tests/unit/persistence/test_session_repo.py`

---

## PR 6: EventRepository.insert() (~120 lines)

**Branch**: `git town append feature/006-event-repo-insert`
**Depends on**: PR 2
**Goal**: Insert events with proto blob serialization
**User Stories**: US3 (Session Persistence)

- [ ] T019 [PR6] Create `EventRepository` class with `__init__(database)` in `adk_agent_sim/persistence/event_repo.py`
- [ ] T020 [PR6] Implement `insert(event: SessionEvent)` with promoted field extraction in `adk_agent_sim/persistence/event_repo.py`
- [ ] T021 [PR6] Determine `payload_type` from oneof field (`llm_request` vs `llm_response`) in `adk_agent_sim/persistence/event_repo.py`
- [ ] T022 [PR6] Add `insert()` tests for request and response events in `tests/unit/persistence/test_event_repo.py`

---

## PR 7: EventRepository.get_by_session() (~120 lines)

**Branch**: `git town append feature/007-event-repo-query`
**Depends on**: PR 6
**Goal**: Query events by session for replay
**User Stories**: US3 (Session Persistence)

- [ ] T023 [PR7] Implement `get_by_session(session_id: str) -> list[SessionEvent]` ordered by timestamp in `adk_agent_sim/persistence/event_repo.py`
- [ ] T024 [PR7] Implement `get_by_turn_id(turn_id: str) -> list[SessionEvent]` for correlation lookup in `adk_agent_sim/persistence/event_repo.py`
- [ ] T025 [PR7] Add `get_by_session()` and `get_by_turn_id()` tests in `tests/unit/persistence/test_event_repo.py`

---

## PR 8: Fake Repositories (~150 lines)

**Branch**: `git town append feature/008-fake-repos`
**Depends on**: PR 7
**Goal**: In-memory fakes for unit testing (no mocks per Constitution)
**User Stories**: All (testing infrastructure)

- [ ] T026 [PR8] Create `FakeSessionRepository` with in-memory dict storage in `tests/fixtures/fake_session_repo.py`
- [ ] T027 [PR8] [P] Create `FakeEventRepository` with in-memory list storage in `tests/fixtures/fake_event_repo.py`
- [ ] T028 [PR8] Create `tests/fixtures/__init__.py` exporting both fakes
- [ ] T029 [PR8] Add fake repository tests verifying same interface as real repos in `tests/unit/fixtures/test_fakes.py`

---

## Phase 2: Server Core

---

## PR 9: SessionManager Shell + create_session() (~120 lines)

**Branch**: `git town append feature/009-session-manager`
**Depends on**: PR 8
**Goal**: Session lifecycle management - creation
**User Stories**: US1 (Basic Interception)

- [ ] T030 [PR9] Create `SessionManager` class with `__init__(session_repo, event_repo)` in `adk_agent_sim/server/session_manager.py`
- [ ] T031 [PR9] Implement `create_session(description: str | None) -> SimulatorSession` generating UUID and timestamp in `adk_agent_sim/server/session_manager.py`
- [ ] T032 [PR9] Store active sessions in memory dict for fast lookup in `adk_agent_sim/server/session_manager.py`
- [ ] T033 [PR9] Add `create_session()` tests using `FakeSessionRepository` in `tests/unit/server/test_session_manager.py`

---

## PR 10: SessionManager.get_session() + Reconnection (~100 lines)

**Branch**: `git town append feature/010-session-manager-get`
**Depends on**: PR 9
**Goal**: Session retrieval with reconnection support
**User Stories**: US1 (Basic Interception), US3 (Persistence)

- [ ] T034 [PR10] Implement `get_session(session_id: str) -> SimulatorSession | None` checking memory then DB in `adk_agent_sim/server/session_manager.py`
- [ ] T035 [PR10] Load session into memory cache on reconnection in `adk_agent_sim/server/session_manager.py`
- [ ] T036 [PR10] Add `get_session()` tests for cache hit, cache miss + DB hit, and not found in `tests/unit/server/test_session_manager.py`

---

## PR 11: RequestQueue (~150 lines)

**Branch**: `git town append feature/011-request-queue`
**Depends on**: PR 8
**Goal**: FIFO queue per session for sequential request handling
**User Stories**: US4 (Sequential Queueing)

- [ ] T037 [PR11] Create `RequestQueue` class with `asyncio.Queue` per session in `adk_agent_sim/server/queue.py`
- [ ] T038 [PR11] Implement `enqueue(event: SessionEvent)` adding to session queue in `adk_agent_sim/server/queue.py`
- [ ] T039 [PR11] Implement `dequeue(session_id: str) -> SessionEvent` with await in `adk_agent_sim/server/queue.py`
- [ ] T040 [PR11] Implement `get_current(session_id: str) -> SessionEvent | None` returning head without removal in `adk_agent_sim/server/queue.py`
- [ ] T041 [PR11] Add `RequestQueue` tests verifying FIFO order and per-session isolation in `tests/unit/server/test_queue.py`

---

## PR 12: EventBroadcaster (~120 lines)

**Branch**: `git town append feature/012-event-broadcaster`
**Depends on**: PR 11
**Goal**: Broadcast events to all subscribers for a session
**User Stories**: US4 (Sequential Queueing), US1 (Basic Interception)

- [ ] T042 [PR12] Create `EventBroadcaster` class managing subscriber sets per session in `adk_agent_sim/server/broadcaster.py`
- [ ] T043 [PR12] Implement `subscribe(session_id: str) -> AsyncIterator[SessionEvent]` using asyncio.Queue per subscriber in `adk_agent_sim/server/broadcaster.py`
- [ ] T044 [PR12] Implement `broadcast(session_id: str, event: SessionEvent)` pushing to all subscriber queues in `adk_agent_sim/server/broadcaster.py`
- [ ] T045 [PR12] Add `EventBroadcaster` tests for multi-subscriber scenarios in `tests/unit/server/test_broadcaster.py`

---

## PR 13: SimulatorService.create_session() RPC (~120 lines)

**Branch**: `git town append feature/013-grpc-create-session`
**Depends on**: PR 10
**Goal**: gRPC endpoint for session creation
**User Stories**: US1 (Basic Interception)

- [ ] T046 [PR13] Enhance `SimulatorService` with `SessionManager` dependency injection in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T047 [PR13] Implement `create_session(request: CreateSessionRequest) -> CreateSessionResponse` delegating to SessionManager in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T048 [PR13] Add `create_session()` RPC tests using fake repos in `tests/unit/server/test_simulator_service.py`

---

## PR 14: SimulatorService.list_sessions() RPC (~100 lines)

**Branch**: `git town append feature/014-grpc-list-sessions`
**Depends on**: PR 13
**Goal**: gRPC endpoint for listing sessions
**User Stories**: US1 (Basic Interception)

- [ ] T049 [PR14] Implement `list_sessions(request: ListSessionsRequest) -> ListSessionsResponse` with pagination in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T050 [PR14] Add `list_sessions()` RPC tests verifying pagination in `tests/unit/server/test_simulator_service.py`

---

## PR 15: SimulatorService.submit_request() RPC (~150 lines)

**Branch**: `git town append feature/015-grpc-submit-request`
**Depends on**: PR 12
**Goal**: gRPC endpoint for plugin to submit intercepted requests
**User Stories**: US1 (Basic Interception), US4 (Sequential Queueing)

- [ ] T051 [PR15] Implement `submit_request(request: SubmitRequestRequest) -> SubmitRequestResponse` in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T052 [PR15] Create `SessionEvent` with `llm_request` payload and persist to EventRepository in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T053 [PR15] Enqueue event in RequestQueue and broadcast to subscribers in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T054 [PR15] Add `submit_request()` RPC tests in `tests/unit/server/test_simulator_service.py`

---

## PR 16: SimulatorService.submit_decision() RPC (~120 lines)

**Branch**: `git town append feature/016-grpc-submit-decision`
**Depends on**: PR 15
**Goal**: gRPC endpoint for human to submit response
**User Stories**: US1 (Basic Interception)

- [ ] T055 [PR16] Implement `submit_decision(request: SubmitDecisionRequest) -> SubmitDecisionResponse` in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T056 [PR16] Create `SessionEvent` with `llm_response` payload linked by `turn_id` in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T057 [PR16] Dequeue from RequestQueue and broadcast response event in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T058 [PR16] Add `submit_decision()` RPC tests in `tests/unit/server/test_simulator_service.py`

---

## PR 17: SimulatorService.subscribe() with Replay (~180 lines)

**Branch**: `git town append feature/017-grpc-subscribe`
**Depends on**: PR 16
**Goal**: gRPC streaming endpoint with historical event replay
**User Stories**: US1 (Basic Interception), US3 (Persistence)

- [ ] T059 [PR17] Implement `subscribe(request: SubscribeRequest) -> AsyncIterator[SubscribeResponse]` in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T060 [PR17] Load historical events from EventRepository and stream first in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T061 [PR17] Switch to live mode using EventBroadcaster subscription in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T062 [PR17] Handle subscriber disconnection gracefully in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T063 [PR17] Add `subscribe()` RPC tests for replay and live streaming in `tests/unit/server/test_simulator_service.py`

---

## PR 18: Server Entrypoint (~100 lines)

**Branch**: `git town append feature/018-server-entrypoint`
**Depends on**: PR 17
**Goal**: Main server startup with graceful shutdown
**User Stories**: US1 (Basic Interception)

- [ ] T064 [PR18] Enhance `main.py` with database initialization on startup in `adk_agent_sim/server/main.py`
- [ ] T065 [PR18] Wire up `SessionManager`, `EventBroadcaster`, `RequestQueue` dependencies in `adk_agent_sim/server/main.py`
- [ ] T066 [PR18] Implement graceful shutdown closing database connection in `adk_agent_sim/server/main.py`
- [ ] T067 [PR18] Add server startup tests verifying dependency wiring in `tests/unit/server/test_main.py`

---

## Phase 3: Plugin Core

---

## PR 19: PluginConfig (~100 lines)

**Branch**: `git town append feature/019-plugin-config`
**Depends on**: -
**Goal**: Configuration dataclass with environment variable support
**User Stories**: US5 (Environment Configuration)

- [ ] T068 [PR19] Create `PluginConfig` dataclass with `server_url`, `target_agents`, `session_description` in `adk_agent_sim/plugin/config.py`
- [ ] T069 [PR19] Implement `from_env()` class method reading `ADK_SIM_SERVER_URL`, `ADK_SIM_TARGET_AGENTS` in `adk_agent_sim/plugin/config.py`
- [ ] T070 [PR19] Implement `merge(constructor_args, env_config)` with constructor precedence in `adk_agent_sim/plugin/config.py`
- [ ] T071 [PR19] Add `PluginConfig` tests for env parsing and merge precedence in `tests/unit/plugin/test_config.py`

---

## PR 20: ADKProtoConverter (~180 lines)

**Branch**: `git town append feature/020-proto-converter`
**Depends on**: -
**Goal**: Converter class for ADK/Pydantic ↔ Google/Protobuf transformations
**User Stories**: US1 (Basic Interception)
**Reference**: See plan.md § ADKProtoConverter Reference Implementation for complete code

- [ ] T072 [PR20] Create `ADKProtoConverter` class with docstring in `adk_agent_sim/plugin/converter.py`
- [ ] T073 [PR20] Implement `llm_request_to_proto(adk_request: LlmRequest) -> GenerateContentRequest` with model name mapping in `adk_agent_sim/plugin/converter.py`
- [ ] T074 [PR20] Implement contents serialization (Pydantic → Proto via `json_format.ParseDict`) in `adk_agent_sim/plugin/converter.py`
- [ ] T075 [PR20] Implement config unpacking: system_instruction, tools, safety_settings → separate Proto fields in `adk_agent_sim/plugin/converter.py`
- [ ] T076 [PR20] Implement GenerationConfig mapping (temperature, top_p, max_output_tokens, etc.) in `adk_agent_sim/plugin/converter.py`
- [ ] T077 [PR20] Implement `proto_to_llm_response(proto_response: GenerateContentResponse) -> LlmResponse` using `LlmResponse.create()` factory in `adk_agent_sim/plugin/converter.py`
- [ ] T078 [PR20] Add comprehensive converter tests in `tests/unit/plugin/test_converter.py`

---

## PR 21: SimulatorClient Shell (~120 lines)

**Branch**: `git town append feature/021-grpc-client`
**Depends on**: PR 19
**Goal**: gRPC client wrapper for server communication
**User Stories**: US1 (Basic Interception)

- [ ] T079 [PR21] Create `SimulatorClient` class with `__init__(config: PluginConfig)` in `adk_agent_sim/plugin/client.py`
- [ ] T080 [PR21] Implement `connect()` establishing gRPC channel using `grpclib` in `adk_agent_sim/plugin/client.py`
- [ ] T081 [PR21] Implement `close()` for clean channel shutdown in `adk_agent_sim/plugin/client.py`
- [ ] T082 [PR21] Add `SimulatorClient` connection tests in `tests/unit/plugin/test_client.py`

---

## PR 22: SimulatorClient.create_session() (~80 lines)

**Branch**: `git town append feature/022-client-create-session`
**Depends on**: PR 21
**Goal**: Client method for session creation
**User Stories**: US1 (Basic Interception)

- [ ] T083 [PR22] Implement `create_session(description: str | None) -> SimulatorSession` calling server RPC in `adk_agent_sim/plugin/client.py`
- [ ] T084 [PR22] Store returned `session_id` for subsequent calls in `adk_agent_sim/plugin/client.py`
- [ ] T085 [PR22] Add `create_session()` tests in `tests/unit/plugin/test_client.py`

---

## PR 23: SimulatorClient.submit_request() (~100 lines)

**Branch**: `git town append feature/023-client-submit-request`
**Depends on**: PR 22
**Goal**: Client method to submit intercepted LLM requests
**User Stories**: US1 (Basic Interception)

- [ ] T086 [PR23] Implement `submit_request(turn_id: str, agent_name: str, request: GenerateContentRequest) -> str` in `adk_agent_sim/plugin/client.py`
- [ ] T087 [PR23] Return `event_id` from server response in `adk_agent_sim/plugin/client.py`
- [ ] T088 [PR23] Add `submit_request()` tests in `tests/unit/plugin/test_client.py`

---

## PR 24: SimulatorClient.subscribe() (~120 lines)

**Branch**: `git town append feature/024-client-subscribe`
**Depends on**: PR 23
**Goal**: Client method for event stream subscription
**User Stories**: US1 (Basic Interception)

- [ ] T089 [PR24] Implement `subscribe() -> AsyncIterator[SessionEvent]` as async generator in `adk_agent_sim/plugin/client.py`
- [ ] T090 [PR24] Yield events from server stream in `adk_agent_sim/plugin/client.py`
- [ ] T091 [PR24] Add `subscribe()` tests in `tests/unit/plugin/test_client.py`

---

## PR 25: PendingFutureRegistry (~100 lines)

**Branch**: `git town append feature/025-future-registry`
**Depends on**: PR 24
**Goal**: Map turn_id to Future for blocking await
**User Stories**: US1 (Basic Interception)

- [ ] T092 [PR25] Create `PendingFutureRegistry` class with `dict[str, asyncio.Future]` in `adk_agent_sim/plugin/futures.py`
- [ ] T093 [PR25] Implement `create(turn_id: str) -> asyncio.Future` creating and storing future in `adk_agent_sim/plugin/futures.py`
- [ ] T094 [PR25] Implement `resolve(turn_id: str, response: GenerateContentResponse)` setting future result in `adk_agent_sim/plugin/futures.py`
- [ ] T095 [PR25] Implement `cancel_all()` for shutdown cleanup in `adk_agent_sim/plugin/futures.py`
- [ ] T096 [PR25] Add `PendingFutureRegistry` tests in `tests/unit/plugin/test_futures.py`

---

## PR 26: Plugin._listen_loop() (~150 lines)

**Branch**: `git town append feature/026-listen-loop`
**Depends on**: PR 25
**Goal**: Background task processing server events
**User Stories**: US1 (Basic Interception)

- [ ] T097 [PR26] Implement `_listen_loop()` as background asyncio task in `adk_agent_sim/plugin/core.py`
- [ ] T098 [PR26] Subscribe to server stream via `SimulatorClient.subscribe()` in `adk_agent_sim/plugin/core.py`
- [ ] T099 [PR26] On `llm_response` event, resolve corresponding Future via `PendingFutureRegistry` in `adk_agent_sim/plugin/core.py`
- [ ] T100 [PR26] Ignore events for already-resolved turn_ids (idempotency) in `adk_agent_sim/plugin/core.py`
- [ ] T101 [PR26] Add `_listen_loop()` tests in `tests/unit/plugin/test_plugin.py`

---

## PR 27: Plugin.initialize() (~120 lines)

**Branch**: `git town append feature/027-plugin-initialize`
**Depends on**: PR 26
**Goal**: Plugin initialization with session creation and URL output
**User Stories**: US1 (Basic Interception)

- [ ] T102 [PR27] Implement `initialize()` connecting to server and creating session in `adk_agent_sim/plugin/core.py`
- [ ] T103 [PR27] Start `_listen_loop()` background task in `adk_agent_sim/plugin/core.py`
- [ ] T104 [PR27] Print session URL with decorated banner format to stdout in `adk_agent_sim/plugin/core.py`:
  ```
  ================================================================
  [ADK Simulator] Session Started
  View and Control at: http://localhost:4200/session/<uuid>
  ================================================================
  ```
- [ ] T105 [PR27] Add `initialize()` tests verifying banner format and URL output in `tests/unit/plugin/test_plugin.py`

---

## PR 28: Plugin.before_model_callback() (~180 lines)

**Branch**: `git town append feature/028-plugin-intercept`
**Depends on**: PR 20, PR 27
**Goal**: Core interception logic with selective filtering
**User Stories**: US1 (Basic Interception), US2 (Selective Interception)

- [ ] T106 [PR28] Implement `before_model_callback(callback_context, llm_request)` in `adk_agent_sim/plugin/core.py`
- [ ] T107 [PR28] Check `target_agents` filter (None or empty = intercept all) - return `None` to proceed to real LLM if not targeted in `adk_agent_sim/plugin/core.py`
- [ ] T108 [PR28] Generate `turn_id` UUID and create Future via `PendingFutureRegistry` in `adk_agent_sim/plugin/core.py`
- [ ] T109 [PR28] Use `ADKProtoConverter.llm_request_to_proto()` to transform `LlmRequest` → `GenerateContentRequest` proto in `adk_agent_sim/plugin/core.py` (see plan.md § ADKProtoConverter Reference Implementation)
- [ ] T110 [PR28] Submit request via `SimulatorClient.submit_request()` in `adk_agent_sim/plugin/core.py`
- [ ] T111 [PR28] Log waiting state: `[ADK Simulator] Waiting for human input for agent: '<agent_name>'...` in `adk_agent_sim/plugin/core.py`
- [ ] T112 [PR28] Await Future (blocks indefinitely until response) in `adk_agent_sim/plugin/core.py`
- [ ] T113 [PR28] Use `ADKProtoConverter.proto_to_llm_response()` to transform `GenerateContentResponse` proto → `LlmResponse` in `adk_agent_sim/plugin/core.py` (see plan.md § ADKProtoConverter Reference Implementation)
- [ ] T114 [PR28] Add `before_model_callback()` tests for interception and bypass scenarios in `tests/unit/plugin/test_plugin.py`

---

## PR 29: Plugin Reconnection (~150 lines)

**Branch**: `git town append feature/029-plugin-reconnect`
**Depends on**: PR 28
**Goal**: Handle connection loss and reconnect to existing session
**User Stories**: US3 (Session Persistence)

- [ ] T115 [PR29] Detect connection loss in `_listen_loop()` via gRPC exceptions in `adk_agent_sim/plugin/core.py`
- [ ] T116 [PR29] Implement exponential backoff retry logic in `adk_agent_sim/plugin/core.py`
- [ ] T117 [PR29] Reconnect using stored `session_id` instead of creating new session in `adk_agent_sim/plugin/core.py`
- [ ] T118 [PR29] Filter replayed events - ignore already-resolved turn_ids in `adk_agent_sim/plugin/core.py`
- [ ] T119 [PR29] Add reconnection tests simulating server restart in `tests/unit/plugin/test_plugin.py`

---

## Phase 4: Integration & Polish

---

## PR 30: Integration Test - Basic Round-Trip (~150 lines)

**Branch**: `git town append feature/030-integration-basic`
**Depends on**: PR 29
**Goal**: End-to-end test of single agent interception
**User Stories**: US1 (Basic Interception)

- [ ] T120 [PR30] Create `tests/integration/test_round_trip.py` with pytest-asyncio fixtures
- [ ] T121 [PR30] Implement fixture starting embedded server with in-memory SQLite
- [ ] T122 [PR30] Test: Plugin intercepts agent, server receives request, human responds, agent continues
- [ ] T123 [PR30] Verify session URL printed to stdout

---

## PR 31: Integration Test - Selective Interception (~120 lines)

**Branch**: `git town append feature/031-integration-selective`
**Depends on**: PR 30
**Goal**: Test hybrid simulation with targeted agents
**User Stories**: US2 (Selective Interception)

- [ ] T124 [PR31] Create `tests/integration/test_selective_intercept.py`
- [ ] T125 [PR31] Test: `target_agents=["orchestrator"]` only intercepts orchestrator
- [ ] T126 [PR31] Test: Non-targeted agent proceeds to real LLM (mocked for test)
- [ ] T127 [PR31] Verify orchestrator waits while sub-agent completes

---

## PR 32: Integration Test - FIFO Queueing (~150 lines)

**Branch**: `git town append feature/032-integration-queue`
**Depends on**: PR 31
**Goal**: Test sequential presentation of parallel requests
**User Stories**: US4 (Sequential Queueing)

- [ ] T128 [PR32] Create `tests/integration/test_fifo_queue.py`
- [ ] T129 [PR32] Test: Three agents submit simultaneously, requests queued FIFO
- [ ] T130 [PR32] Test: Responding to first request presents second immediately
- [ ] T131 [PR32] Verify no request loss or duplication

---

## PR 33: Integration Test - Persistence (~120 lines)

**Branch**: `git town append feature/033-integration-persist`
**Depends on**: PR 32
**Goal**: Test session survival across server restart
**User Stories**: US3 (Session Persistence)

- [ ] T132 [PR33] Create `tests/integration/test_persistence.py`
- [ ] T133 [PR33] Test: Start session, stop server, restart, reconnect succeeds
- [ ] T134 [PR33] Test: Events replayed on reconnection
- [ ] T135 [PR33] Test: Pending request resolved after reconnect

---

## PR 34: Docker Compose Configuration (~80 lines)

**Branch**: `git town append feature/034-docker-compose`
**Depends on**: PR 33
**Goal**: Production-ready container configuration
**User Stories**: US5 (Environment Configuration)

- [ ] T136 [PR34] Update `docker/backend.Dockerfile` with persistence volume
- [ ] T137 [PR34] Update `docker-compose.yaml` with volume mounts for SQLite
- [ ] T138 [PR34] Add environment variable configuration examples
- [ ] T139 [PR34] Document container deployment in quickstart.md

---

## Dependencies & Execution Order

### PR Chain (Managed by Git Town)

```
main
 └── PR 1: DB schema
      └── PR 2: DB connection
           ├── PR 3: Session repo create
           │    └── PR 4: Session repo get
           │         └── PR 5: Session repo list
           └── PR 6: Event repo insert
                └── PR 7: Event repo query
                     └── PR 8: Fake repos
                          ├── PR 9: Session manager
                          │    └── PR 10: Session manager get
                          │         └── PR 13: gRPC create session
                          │              └── PR 14: gRPC list sessions
                          └── PR 11: Request queue
                               └── PR 12: Event broadcaster
                                    └── PR 15: gRPC submit request
                                         └── PR 16: gRPC submit decision
                                              └── PR 17: gRPC subscribe
                                                   └── PR 18: Server entrypoint
                                                        └── (Plugin chain joins here)

PR 19: Plugin config (independent start)
 └── PR 21: gRPC client
      └── PR 22: Client create session
           └── PR 23: Client submit request
                └── PR 24: Client subscribe
                     └── PR 25: Future registry
                          └── PR 26: Listen loop
                               └── PR 27: Plugin initialize
                                    └── PR 28: Plugin intercept ←── PR 20: Proto converter (joins here)
                                         └── PR 29: Plugin reconnect
                                              └── PR 30: Integration basic
                                                   └── PR 31: Integration selective
                                                        └── PR 32: Integration queue
                                                             └── PR 33: Integration persist
                                                                  └── PR 34: Docker compose

PR 20: Proto converter (independent, merges into PR 28)
```

### Git Town Commands

```bash
# Start feature - Phase 1
git town hack feature/001-db-schema

# Create stacked PRs for Phase 1
git town append feature/002-db-connection
git town append feature/003-session-repo-create
git town append feature/004-session-repo-get
git town append feature/005-session-repo-list
# PR 6 branches from PR 2
git checkout feature/002-db-connection
git town append feature/006-event-repo-insert
git town append feature/007-event-repo-query
git town append feature/008-fake-repos

# Continue with Phase 2...
git town append feature/009-session-manager
# ... continue for all PRs

# Sync with upstream
git town sync

# After PR merges, re-parent children
git town sync  # Automatically handles re-parenting
```

### Before Every Push

```bash
# MANDATORY: Run presubmit before any push
./scripts/presubmit.sh

# Only push if presubmit passes
git push
```

---

## Implementation Strategy

### Small PR Workflow

1. Complete all tasks for PR 1
2. Run `./scripts/presubmit.sh` - must pass
3. Push and create PR
4. `git town append feature/002-...` for next PR
5. Repeat for all 34 PRs

### Incremental Delivery

- Each PR adds a coherent slice of functionality
- Codebase remains functional after each merge
- Large classes built incrementally (methods across PRs)
- Tests always accompany implementation

### Line Count Validation

Before submitting any PR:
1. Check diff: `git diff --stat`
2. If >200 lines, split into smaller PRs
3. Each PR should be reviewable in ~10 minutes

---

## Testing Guidelines

### Tests MUST Be In Same PR As Implementation

❌ WRONG:
- PR 5: Implement SessionRepository.list_all()
- PR 6: Add SessionRepository.list_all() tests

✅ CORRECT:
- PR 5: Implement SessionRepository.list_all() + tests (~120 lines total)

### No Mocks Without Permission

Per Constitution IV., mocking requires explicit user permission.

Preference hierarchy:
1. Real implementations (in-memory SQLite for DB tests)
2. High-fidelity fakes in `tests/fixtures/`
3. Mocks (ONLY with explicit permission)

If you believe a mock is necessary:
1. STOP and document why
2. Ask user for permission
3. Only proceed if approved

---

## Summary

| Metric | Count |
|--------|-------|
| Total Tasks | 139 |
| Total PRs | 34 |
| Phase 1 (Data Layer) | 8 PRs, 29 tasks |
| Phase 2 (Server Core) | 10 PRs, 38 tasks |
| Phase 3 (Plugin Core) | 11 PRs, 52 tasks |
| Phase 4 (Integration) | 5 PRs, 20 tasks |
| Parallel Opportunities | 4 tasks marked [P] |
| Estimated Total LOC | ~4,080 lines |

---

## Notes

- [P] tasks = parallelizable within the same PR
- [PR#] label maps task to specific Pull Request
- Each PR MUST be 100-200 lines max (HARD LIMIT)
- Tests and implementation go in SAME PR
- Run `./scripts/presubmit.sh` before every push
- Use `git town append` for stacked PRs
