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
| US1: Basic Agent Interception | P1 | Phase 2 (ph2f1-ph2f10), Phase 2b (ph2bf1-ph2bf3), Phase 3 (ph3f1-ph3f11) |
| US2: Selective Agent Interception | P1 | ph3f10 (target_agents filtering) |
| US3: Session Persistence | P2 | Phase 1 (ph1f1-ph1f8 data layer), ph2bf2 (E2E persistence test), ph3f11 (reconnect) |
| US4: Sequential Request Queueing | P2 | ph2f3, ph2f4, ph2f7, ph2bf3 (E2E FIFO test) |
| US5: Environment Configuration | P3 | ph3f1 |

---

## Phase 1: Foundation & Data Layer

---

## ph1f1: Database Schema (~80 lines)

**Branch**: `git town hack phase/1/feat/1/db-schema`
**Depends on**: -
**Goal**: SQLAlchemy Core schema definitions for sessions and events tables
**User Stories**: US3 (Session Persistence)

- [ ] T001 [ph1f1] Create `adk_agent_sim/persistence/__init__.py` with module exports
- [ ] T002 [ph1f1] Define `sessions` table with promoted fields (id, created_at, status, proto_blob) in `adk_agent_sim/persistence/schema.py`
- [ ] T003 [ph1f1] Define `events` table with promoted fields (event_id, session_id, timestamp, turn_id, payload_type, proto_blob) in `adk_agent_sim/persistence/schema.py`
- [ ] T004 [ph1f1] Add composite indexes for session timeline and turn_id queries in `adk_agent_sim/persistence/schema.py`

---

## ph1f2: Database Connection (~100 lines)

**Branch**: `git town append phase/1/feat/2/db-connection`
**Depends on**: ph1f1
**Goal**: Async database connection manager using `databases` library
**User Stories**: US3 (Session Persistence)

- [ ] T005 [ph1f2] Create `Database` connection class with `connect()` and `disconnect()` in `adk_agent_sim/persistence/database.py`
- [ ] T006 [ph1f2] Implement `create_tables()` using SQLAlchemy metadata in `adk_agent_sim/persistence/database.py`
- [ ] T007 [ph1f2] Add database URL configuration (default: `sqlite:///./simulator.db`) in `adk_agent_sim/persistence/database.py`
- [ ] T008 [ph1f2] Add database connection tests in `tests/unit/persistence/test_database.py`

---

## ph1f3: SessionRepository.create() (~150 lines)

**Branch**: `git town append phase/1/feat/3/session-repo-create`
**Depends on**: ph1f2
**Goal**: Create sessions with Promoted Field pattern
**User Stories**: US3 (Session Persistence)

- [ ] T009 [ph1f3] Create `SessionRepository` class with `__init__(database)` in `adk_agent_sim/persistence/session_repo.py`
- [ ] T010 [ph1f3] Implement `create(session: SimulatorSession, status: str = "active")` with proto blob serialization in `adk_agent_sim/persistence/session_repo.py`
- [ ] T011 [ph1f3] Add `create()` tests verifying proto serialization and promoted field extraction in `tests/unit/persistence/test_session_repo.py`

---

## ph1f4: SessionRepository.get_by_id() (~100 lines)

**Branch**: `git town append phase/1/feat/4/session-repo-get`
**Depends on**: ph1f3
**Goal**: Retrieve sessions by ID with proto deserialization
**User Stories**: US3 (Session Persistence)

- [ ] T012 [ph1f4] Implement `get_by_id(session_id: str) -> SimulatorSession | None` in `adk_agent_sim/persistence/session_repo.py`
- [ ] T013 [ph1f4] Add proto blob deserialization using `SimulatorSession().parse()` in `adk_agent_sim/persistence/session_repo.py`
- [ ] T014 [ph1f4] Add `get_by_id()` tests for existing and non-existent sessions in `tests/unit/persistence/test_session_repo.py`

---

## ph1f5: SessionRepository.list_all() (~120 lines)

**Branch**: `git town append phase/1/feat/5/session-repo-list`
**Depends on**: ph1f4
**Goal**: List sessions with pagination support
**User Stories**: US3 (Session Persistence)

- [ ] T015 [ph1f5] Implement `list_all(page_size: int, page_token: str | None)` in `adk_agent_sim/persistence/session_repo.py`
- [ ] T016 [ph1f5] Add pagination using `created_at` cursor-based approach in `adk_agent_sim/persistence/session_repo.py`
- [ ] T017 [ph1f5] Implement `update_status(session_id: str, status: str)` for session lifecycle in `adk_agent_sim/persistence/session_repo.py`
- [ ] T018 [ph1f5] Add `list_all()` and `update_status()` tests in `tests/unit/persistence/test_session_repo.py`

---

## ph1f6: EventRepository.insert() (~120 lines)

**Branch**: `git town append phase/1/feat/6/event-repo-insert`
**Depends on**: ph1f2
**Goal**: Insert events with proto blob serialization
**User Stories**: US3 (Session Persistence)

- [ ] T019 [ph1f6] Create `EventRepository` class with `__init__(database)` in `adk_agent_sim/persistence/event_repo.py`
- [ ] T020 [ph1f6] Implement `insert(event: SessionEvent)` with promoted field extraction in `adk_agent_sim/persistence/event_repo.py`
- [ ] T021 [ph1f6] Determine `payload_type` from oneof field (`llm_request` vs `llm_response`) in `adk_agent_sim/persistence/event_repo.py`
- [ ] T022 [ph1f6] Add `insert()` tests for request and response events in `tests/unit/persistence/test_event_repo.py`

---

## ph1f7: EventRepository.get_by_session() (~120 lines)

**Branch**: `git town append phase/1/feat/7/event-repo-query`
**Depends on**: ph1f6
**Goal**: Query events by session for replay
**User Stories**: US3 (Session Persistence)

- [ ] T023 [ph1f7] Implement `get_by_session(session_id: str) -> list[SessionEvent]` ordered by timestamp in `adk_agent_sim/persistence/event_repo.py`
- [ ] T024 [ph1f7] Implement `get_by_turn_id(turn_id: str) -> list[SessionEvent]` for correlation lookup in `adk_agent_sim/persistence/event_repo.py`
- [ ] T025 [ph1f7] Add `get_by_session()` and `get_by_turn_id()` tests in `tests/unit/persistence/test_event_repo.py`

---

## ph1f8: Fake Repositories (~150 lines)

**Branch**: `git town append phase/1/feat/8/fake-repos`
**Depends on**: ph1f7
**Goal**: In-memory fakes for unit testing (no mocks per Constitution)
**User Stories**: All (testing infrastructure)

- [ ] T026 [ph1f8] Create `FakeSessionRepository` with in-memory dict storage in `tests/fixtures/fake_session_repo.py`
- [ ] T027 [ph1f8] [P] Create `FakeEventRepository` with in-memory list storage in `tests/fixtures/fake_event_repo.py`
- [ ] T028 [ph1f8] Create `tests/fixtures/__init__.py` exporting both fakes
- [ ] T029 [ph1f8] Add fake repository tests verifying same interface as real repos in `tests/unit/fixtures/test_fakes.py`

---

## Phase 2: Server Core

---

## ph2f1: SessionManager Shell + create_session() (~120 lines)

**Branch**: `git town append phase/2/feat/1/session-manager`
**Depends on**: ph1f8
**Goal**: Session lifecycle management - creation
**User Stories**: US1 (Basic Interception)

- [ ] T001 [ph2f1] Create `SessionManager` class with `__init__(session_repo, event_repo)` in `adk_agent_sim/server/session_manager.py`
- [ ] T002 [ph2f1] Implement `create_session(description: str | None) -> SimulatorSession` generating UUID and timestamp in `adk_agent_sim/server/session_manager.py`
- [ ] T003 [ph2f1] Store active sessions in memory dict for fast lookup in `adk_agent_sim/server/session_manager.py`
- [ ] T004 [ph2f1] Add `create_session()` tests using `FakeSessionRepository` in `tests/unit/server/test_session_manager.py`

---

## ph2f2: SessionManager.get_session() + Reconnection (~100 lines)

**Branch**: `git town append phase/2/feat/2/session-manager-get`
**Depends on**: ph2f1
**Goal**: Session retrieval with reconnection support
**User Stories**: US1 (Basic Interception), US3 (Persistence)

- [ ] T005 [ph2f2] Implement `get_session(session_id: str) -> SimulatorSession | None` checking memory then DB in `adk_agent_sim/server/session_manager.py`
- [ ] T006 [ph2f2] Load session into memory cache on reconnection in `adk_agent_sim/server/session_manager.py`
- [ ] T007 [ph2f2] Add `get_session()` tests for cache hit, cache miss + DB hit, and not found in `tests/unit/server/test_session_manager.py`

---

## ph2f3: RequestQueue (~150 lines)

**Branch**: `git town append phase/2/feat/3/request-queue`
**Depends on**: ph1f8
**Goal**: FIFO queue per session for sequential request handling
**User Stories**: US4 (Sequential Queueing)

- [ ] T008 [ph2f3] Create `RequestQueue` class with `asyncio.Queue` per session in `adk_agent_sim/server/queue.py`
- [ ] T009 [ph2f3] Implement `enqueue(event: SessionEvent)` adding to session queue in `adk_agent_sim/server/queue.py`
- [ ] T010 [ph2f3] Implement `dequeue(session_id: str) -> SessionEvent` with await in `adk_agent_sim/server/queue.py`
- [ ] T011 [ph2f3] Implement `get_current(session_id: str) -> SessionEvent | None` returning head without removal in `adk_agent_sim/server/queue.py`
- [ ] T012 [ph2f3] Add `RequestQueue` tests verifying FIFO order and per-session isolation in `tests/unit/server/test_queue.py`

---

## ph2f4: EventBroadcaster (~120 lines)

**Branch**: `git town append phase/2/feat/4/event-broadcaster`
**Depends on**: ph2f3
**Goal**: Broadcast events to all subscribers for a session
**User Stories**: US4 (Sequential Queueing), US1 (Basic Interception)

- [ ] T013 [ph2f4] Create `EventBroadcaster` class managing subscriber sets per session in `adk_agent_sim/server/broadcaster.py`
- [ ] T014 [ph2f4] Implement `subscribe(session_id: str) -> AsyncIterator[SessionEvent]` using asyncio.Queue per subscriber in `adk_agent_sim/server/broadcaster.py`
- [ ] T015 [ph2f4] Implement `broadcast(session_id: str, event: SessionEvent)` pushing to all subscriber queues in `adk_agent_sim/server/broadcaster.py`
- [ ] T016 [ph2f4] Add `EventBroadcaster` tests for multi-subscriber scenarios in `tests/unit/server/test_broadcaster.py`

---

## ph2f5: SimulatorService.create_session() RPC (~120 lines)

**Branch**: `git town append phase/2/feat/5/grpc-create-session`
**Depends on**: ph2f2
**Goal**: gRPC endpoint for session creation
**User Stories**: US1 (Basic Interception)

- [ ] T017 [ph2f5] Enhance `SimulatorService` with `SessionManager` dependency injection in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T018 [ph2f5] Implement `create_session(request: CreateSessionRequest) -> CreateSessionResponse` delegating to SessionManager in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T019 [ph2f5] Add `create_session()` RPC tests using fake repos in `tests/unit/server/test_simulator_service.py`

---

## ph2f6: SimulatorService.list_sessions() RPC (~100 lines)

**Branch**: `git town append phase/2/feat/6/grpc-list-sessions`
**Depends on**: ph2f5
**Goal**: gRPC endpoint for listing sessions
**User Stories**: US1 (Basic Interception)

- [ ] T020 [ph2f6] Implement `list_sessions(request: ListSessionsRequest) -> ListSessionsResponse` with pagination in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T021 [ph2f6] Add `list_sessions()` RPC tests verifying pagination in `tests/unit/server/test_simulator_service.py`

---

## ph2f7: SimulatorService.submit_request() RPC (~150 lines)

**Branch**: `git town append phase/2/feat/7/grpc-submit-request`
**Depends on**: ph2f4
**Goal**: gRPC endpoint for plugin to submit intercepted requests
**User Stories**: US1 (Basic Interception), US4 (Sequential Queueing)

- [ ] T022 [ph2f7] Implement `submit_request(request: SubmitRequestRequest) -> SubmitRequestResponse` in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T023 [ph2f7] Create `SessionEvent` with `llm_request` payload and persist to EventRepository in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T024 [ph2f7] Enqueue event in RequestQueue and broadcast to subscribers in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T025 [ph2f7] Add `submit_request()` RPC tests in `tests/unit/server/test_simulator_service.py`

---

## ph2f8: SimulatorService.submit_decision() RPC (~120 lines)

**Branch**: `git town append phase/2/feat/8/grpc-submit-decision`
**Depends on**: ph2f7
**Goal**: gRPC endpoint for human to submit response
**User Stories**: US1 (Basic Interception)

- [ ] T026 [ph2f8] Implement `submit_decision(request: SubmitDecisionRequest) -> SubmitDecisionResponse` in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T027 [ph2f8] Create `SessionEvent` with `llm_response` payload linked by `turn_id` in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T028 [ph2f8] Dequeue from RequestQueue and broadcast response event in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T029 [ph2f8] Add `submit_decision()` RPC tests in `tests/unit/server/test_simulator_service.py`

---

## ph2f9: SimulatorService.subscribe() with Replay (~180 lines)

**Branch**: `git town append phase/2/feat/9/grpc-subscribe`
**Depends on**: ph2f8
**Goal**: gRPC streaming endpoint with historical event replay
**User Stories**: US1 (Basic Interception), US3 (Persistence)

- [ ] T030 [ph2f9] Implement `subscribe(request: SubscribeRequest) -> AsyncIterator[SubscribeResponse]` in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T031 [ph2f9] Load historical events from EventRepository and stream first in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T032 [ph2f9] Switch to live mode using EventBroadcaster subscription in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T033 [ph2f9] Handle subscriber disconnection gracefully in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T034 [ph2f9] Add `subscribe()` RPC tests for replay and live streaming in `tests/unit/server/test_simulator_service.py`

---

## ph2f10: Server Entrypoint (~100 lines)

**Branch**: `git town append phase/2/feat/10/server-entrypoint`
**Depends on**: ph2f9
**Goal**: Main server startup with graceful shutdown
**User Stories**: US1 (Basic Interception)

- [ ] T035 [ph2f10] Enhance `main.py` with database initialization on startup in `adk_agent_sim/server/main.py`
- [ ] T036 [ph2f10] Wire up `SessionManager`, `EventBroadcaster`, `RequestQueue` dependencies in `adk_agent_sim/server/main.py`
- [ ] T037 [ph2f10] Implement graceful shutdown closing database connection in `adk_agent_sim/server/main.py`
- [ ] T038 [ph2f10] Add server startup tests verifying dependency wiring in `tests/unit/server/test_main.py`

---

## Phase 2b: E2E Server Tests

---

## ph2bf1: E2E Test Infrastructure (~150 lines)

**Branch**: `git town append phase/2b/feat/1/e2e-infra`
**Depends on**: ph2f10
**Goal**: pytest-docker setup with docker-compose.test.yaml and shared fixtures
**User Stories**: US1 (Basic Interception - E2E validation)

- [x] T039 [ph2bf1] Create `docker-compose.test.yaml` with backend service for E2E tests in project root
- [x] T040 [ph2bf1] Add `pytest-docker` and `grpclib` to dev dependencies in `pyproject.toml`
- [x] T041 [ph2bf1] Create `tests/e2e/__init__.py` and `tests/e2e/conftest.py` with `docker_compose_file` fixture
- [x] T042 [ph2bf1] Implement `simulator_server` fixture using `docker_services.wait_until_responsive()` in `tests/e2e/conftest.py`
- [x] T043 [ph2bf1] Implement `grpc_channel` fixture returning connected `Channel` to server in `tests/e2e/conftest.py`

---

## ph2bf2: E2E Session Tests (~120 lines)

**Branch**: `git town append phase/2b/feat/2/e2e-session-tests`
**Depends on**: ph2bf1
**Goal**: E2E tests for session management RPCs
**User Stories**: US1 (Basic Interception), US3 (Session Persistence)

- [x] T044 [ph2bf2] [P] Create `test_create_session_e2e()` verifying session creation via gRPC in `tests/e2e/test_session_e2e.py`
- [x] T045 [ph2bf2] [P] Create `test_list_sessions_e2e()` verifying created sessions are listed in `tests/e2e/test_session_e2e.py`
- [x] T046 [ph2bf2] Create `test_session_persists_across_restart()` stopping/starting container in `tests/e2e/test_session_e2e.py`

---

## ph2bf3: E2E Request Flow Tests (~180 lines)

**Branch**: `git town append phase/2b/feat/3/e2e-flow-tests`
**Depends on**: ph2bf2
**Goal**: E2E tests for full request/decision/subscribe flow
**User Stories**: US1 (Basic Interception), US4 (Sequential Queueing)

- [x] T047 [ph2bf3] Create `test_submit_request_e2e()` verifying request submission and pending state in `tests/e2e/test_flow_e2e.py`
- [x] T048 [ph2bf3] Create `test_submit_decision_e2e()` verifying decision resolves pending request in `tests/e2e/test_flow_e2e.py`
- [x] T049 [ph2bf3] Create `test_subscribe_receives_events_e2e()` verifying streaming events via Subscribe in `tests/e2e/test_flow_e2e.py`
- [x] T050 [ph2bf3] Create `test_full_round_trip_e2e()` verifying complete request→decision→event flow in `tests/e2e/test_flow_e2e.py`
- [x] T051 [ph2bf3] Create `test_fifo_ordering_e2e()` verifying parallel requests are queued in order in `tests/e2e/test_flow_e2e.py`

---

## Phase 3: Plugin Core

---

## ph3f1: PluginConfig (~100 lines)

**Branch**: `git town append phase/3/feat/1/plugin-config`
**Depends on**: -
**Goal**: Configuration dataclass with environment variable support
**User Stories**: US5 (Environment Configuration)

- [ ] T001 [ph3f1] Create `PluginConfig` dataclass with `server_url`, `target_agents`, `session_description` in `adk_agent_sim/plugin/config.py`
- [ ] T002 [ph3f1] Implement `from_env()` class method reading `ADK_SIM_SERVER_URL`, `ADK_SIM_TARGET_AGENTS` in `adk_agent_sim/plugin/config.py`
- [ ] T003 [ph3f1] Implement `merge(constructor_args, env_config)` with constructor precedence in `adk_agent_sim/plugin/config.py`
- [ ] T004 [ph3f1] Add `PluginConfig` tests for env parsing and merge precedence in `tests/unit/plugin/test_config.py`

---

## ph3f2: ADKProtoConverter (~180 lines)

**Branch**: `git town append phase/3/feat/2/proto-converter`
**Depends on**: -
**Goal**: Converter class for ADK/Pydantic ↔ Google/Protobuf transformations
**User Stories**: US1 (Basic Interception)
**Reference**: See plan.md § ADKProtoConverter Reference Implementation for complete code

- [x] T005 [ph3f2] Create `ADKProtoConverter` class with docstring in `adk_agent_sim/plugin/converter.py`
- [x] T006 [ph3f2] Implement `llm_request_to_proto(adk_request: LlmRequest) -> GenerateContentRequest` with model name mapping in `adk_agent_sim/plugin/converter.py`
- [x] T007 [ph3f2] Implement contents serialization (Pydantic → Proto via `json_format.ParseDict`) in `adk_agent_sim/plugin/converter.py`
- [x] T008 [ph3f2] Implement config unpacking: system_instruction, tools, safety_settings → separate Proto fields in `adk_agent_sim/plugin/converter.py`
- [x] T009 [ph3f2] Implement GenerationConfig mapping (temperature, top_p, max_output_tokens, etc.) in `adk_agent_sim/plugin/converter.py`
- [x] T010 [ph3f2] Implement `proto_to_llm_response(proto_response: GenerateContentResponse) -> LlmResponse` using `LlmResponse.create()` factory in `adk_agent_sim/plugin/converter.py`
- [x] T011 [ph3f2] Add comprehensive converter tests in `tests/unit/plugin/test_converter.py`

---

## ph3f3: SimulatorClient Shell (~120 lines)

**Branch**: `git town append phase/3/feat/3/grpc-client`
**Depends on**: ph3f1
**Goal**: gRPC client wrapper for server communication
**User Stories**: US1 (Basic Interception)

- [x] T012 [ph3f3] Create `SimulatorClient` class with `__init__(config: PluginConfig)` in `adk_agent_sim/plugin/client.py`
- [x] T013 [ph3f3] Implement `connect()` establishing gRPC channel using `grpclib` in `adk_agent_sim/plugin/client.py`
- [x] T014 [ph3f3] Implement `close()` for clean channel shutdown in `adk_agent_sim/plugin/client.py`
- [x] T015 [ph3f3] Add `SimulatorClient` connection tests in `tests/unit/plugin/test_client.py`

---

## ph3f4: SimulatorClient.create_session() (~80 lines)

**Branch**: `git town append phase/3/feat/4/client-create-session`
**Depends on**: ph3f3
**Goal**: Client method for session creation
**User Stories**: US1 (Basic Interception)

- [x] T016 [ph3f4] Implement `create_session(description: str | None) -> SimulatorSession` calling server RPC in `adk_agent_sim/plugin/client.py`
- [x] T017 [ph3f4] Store returned `session_id` for subsequent calls in `adk_agent_sim/plugin/client.py`
- [x] T018 [ph3f4] Add `create_session()` tests in `tests/unit/plugin/test_client.py`

---

## ph3f5: SimulatorClient.submit_request() (~100 lines)

**Branch**: `git town append phase/3/feat/5/client-submit-request`
**Depends on**: ph3f4
**Goal**: Client method to submit intercepted LLM requests
**User Stories**: US1 (Basic Interception)

- [x] T019 [ph3f5] Implement `submit_request(turn_id: str, agent_name: str, request: GenerateContentRequest) -> str` in `adk_agent_sim/plugin/client.py`
- [x] T020 [ph3f5] Return `event_id` from server response in `adk_agent_sim/plugin/client.py`
- [x] T021 [ph3f5] Add `submit_request()` tests in `tests/unit/plugin/test_client.py`

---

## ph3f6: SimulatorClient.subscribe() (~120 lines)

**Branch**: `git town append phase/3/feat/6/client-subscribe`
**Depends on**: ph3f5
**Goal**: Client method for event stream subscription
**User Stories**: US1 (Basic Interception)

- [x] T022 [ph3f6] Implement `subscribe() -> AsyncIterator[SessionEvent]` as async generator in `adk_agent_sim/plugin/client.py`
- [x] T023 [ph3f6] Yield events from server stream in `adk_agent_sim/plugin/client.py`
- [x] T024 [ph3f6] Add `subscribe()` tests in `tests/unit/plugin/test_client.py`

---

## ph3f7: PendingFutureRegistry (~100 lines)

**Branch**: `git town append phase/3/feat/7/future-registry`
**Depends on**: ph3f6
**Goal**: Map turn_id to Future for blocking await
**User Stories**: US1 (Basic Interception)

- [x] T025 [ph3f7] Create `PendingFutureRegistry` class with `dict[str, asyncio.Future]` in `adk_agent_sim/plugin/futures.py`
- [x] T026 [ph3f7] Implement `create(turn_id: str) -> asyncio.Future` creating and storing future in `adk_agent_sim/plugin/futures.py`
- [x] T027 [ph3f7] Implement `resolve(turn_id: str, response: GenerateContentResponse)` setting future result in `adk_agent_sim/plugin/futures.py`
- [x] T028 [ph3f7] Implement `cancel_all()` for shutdown cleanup in `adk_agent_sim/plugin/futures.py`
- [x] T029 [ph3f7] Add `PendingFutureRegistry` tests in `tests/unit/plugin/test_futures.py`

---

## ph3f8: Plugin._listen_loop() (~150 lines)

**Branch**: `git town append phase/3/feat/8/listen-loop`
**Depends on**: ph3f7
**Goal**: Background task processing server events
**User Stories**: US1 (Basic Interception)

- [x] T030 [ph3f8] Implement `_listen_loop()` as background asyncio task in `adk_agent_sim/plugin/core.py`
- [x] T031 [ph3f8] Subscribe to server stream via `SimulatorClient.subscribe()` in `adk_agent_sim/plugin/core.py`
- [x] T032 [ph3f8] On `llm_response` event, resolve corresponding Future via `PendingFutureRegistry` in `adk_agent_sim/plugin/core.py`
- [x] T033 [ph3f8] Ignore events for already-resolved turn_ids (idempotency) in `adk_agent_sim/plugin/core.py`
- [x] T034 [ph3f8] Add `_listen_loop()` tests in `tests/unit/plugin/test_plugin.py`

---

## ph3f9: Plugin.initialize() (~120 lines)

**Branch**: `git town append phase/3/feat/9/plugin-initialize`
**Depends on**: ph3f8
**Goal**: Plugin initialization with session creation and URL output
**User Stories**: US1 (Basic Interception)

- [x] T035 [ph3f9] Implement `initialize()` connecting to server and creating session in `adk_agent_sim/plugin/core.py`
- [x] T036 [ph3f9] Start `_listen_loop()` background task in `adk_agent_sim/plugin/core.py`
- [x] T037 [ph3f9] Print session URL with decorated banner format to stdout in `adk_agent_sim/plugin/core.py`:
  ```
  ================================================================
  [ADK Simulator] Session Started
  View and Control at: http://localhost:4200/session/<uuid>
  ================================================================
  ```
- [x] T038 [ph3f9] Add `initialize()` tests verifying banner format and URL output in `tests/unit/plugin/test_plugin.py`

---

## ph3f10: Plugin.before_model_callback() (~180 lines)

**Branch**: `git town append phase/3/feat/10/plugin-intercept`
**Depends on**: ph3f2, ph3f9
**Goal**: Core interception logic with selective filtering
**User Stories**: US1 (Basic Interception), US2 (Selective Interception)

- [ ] T039 [ph3f10] Implement `before_model_callback(callback_context, llm_request)` in `adk_agent_sim/plugin/core.py`
- [ ] T040 [ph3f10] Check `target_agents` filter (None or empty = intercept all) - return `None` to proceed to real LLM if not targeted in `adk_agent_sim/plugin/core.py`
- [ ] T041 [ph3f10] Generate `turn_id` UUID and create Future via `PendingFutureRegistry` in `adk_agent_sim/plugin/core.py`
- [ ] T042 [ph3f10] Use `ADKProtoConverter.llm_request_to_proto()` to transform `LlmRequest` → `GenerateContentRequest` proto in `adk_agent_sim/plugin/core.py` (see plan.md § ADKProtoConverter Reference Implementation)
- [ ] T043 [ph3f10] Submit request via `SimulatorClient.submit_request()` in `adk_agent_sim/plugin/core.py`
- [ ] T044 [ph3f10] Log waiting state: `[ADK Simulator] Waiting for human input for agent: '<agent_name>'...` in `adk_agent_sim/plugin/core.py`
- [ ] T045 [ph3f10] Await Future (blocks indefinitely until response) in `adk_agent_sim/plugin/core.py`
- [ ] T046 [ph3f10] Use `ADKProtoConverter.proto_to_llm_response()` to transform `GenerateContentResponse` proto → `LlmResponse` in `adk_agent_sim/plugin/core.py` (see plan.md § ADKProtoConverter Reference Implementation)
- [ ] T047 [ph3f10] Add `before_model_callback()` tests for interception and bypass scenarios in `tests/unit/plugin/test_plugin.py`

---

## ph3f11: Plugin Reconnection (~150 lines)

**Branch**: `git town append phase/3/feat/11/plugin-reconnect`
**Depends on**: ph3f10
**Goal**: Handle connection loss and reconnect to existing session
**User Stories**: US3 (Session Persistence)

- [x] T048 [ph3f11] Detect connection loss in `_listen_loop()` via gRPC exceptions in `adk_agent_sim/plugin/core.py`
- [x] T049 [ph3f11] Implement exponential backoff retry logic in `adk_agent_sim/plugin/core.py`
- [x] T050 [ph3f11] Reconnect using stored `session_id` instead of creating new session in `adk_agent_sim/plugin/core.py`
- [x] T051 [ph3f11] Filter replayed events - ignore already-resolved turn_ids in `adk_agent_sim/plugin/core.py`
- [x] T052 [ph3f11] Add reconnection tests simulating server restart in `tests/unit/plugin/test_plugin.py`

---

## Phase 4: Integration & Polish

---

## ph4f1: Integration Test - Basic Round-Trip (~150 lines)

**Branch**: `git town append phase/4/feat/1/integration-basic`
**Depends on**: ph3f11
**Goal**: End-to-end test of single agent interception
**User Stories**: US1 (Basic Interception)

- [ ] T001 [ph4f1] Create `tests/integration/test_round_trip.py` with pytest-asyncio fixtures
- [ ] T002 [ph4f1] Implement fixture starting embedded server with in-memory SQLite
- [ ] T003 [ph4f1] Test: Plugin intercepts agent, server receives request, human responds, agent continues
- [ ] T004 [ph4f1] Verify session URL printed to stdout

---

## ph4f2: Integration Test - Selective Interception (~120 lines)

**Branch**: `git town append phase/4/feat/2/integration-selective`
**Depends on**: ph4f1
**Goal**: Test hybrid simulation with targeted agents
**User Stories**: US2 (Selective Interception)

- [ ] T005 [ph4f2] Create `tests/integration/test_selective_intercept.py`
- [ ] T006 [ph4f2] Test: `target_agents=["orchestrator"]` only intercepts orchestrator
- [ ] T007 [ph4f2] Test: Non-targeted agent proceeds to real LLM (mocked for test)
- [ ] T008 [ph4f2] Verify orchestrator waits while sub-agent completes

---

## ph4f3: Integration Test - FIFO Queueing (~150 lines)

**Branch**: `git town append phase/4/feat/3/integration-queue`
**Depends on**: ph4f2
**Goal**: Test sequential presentation of parallel requests
**User Stories**: US4 (Sequential Queueing)

- [ ] T009 [ph4f3] Create `tests/integration/test_fifo_queue.py`
- [ ] T010 [ph4f3] Test: Three agents submit simultaneously, requests queued FIFO
- [ ] T011 [ph4f3] Test: Responding to first request presents second immediately
- [ ] T012 [ph4f3] Verify no request loss or duplication

---

## ph4f4: Integration Test - Persistence (~120 lines)

**Branch**: `git town append phase/4/feat/4/integration-persist`
**Depends on**: ph4f3
**Goal**: Test session survival across server restart
**User Stories**: US3 (Session Persistence)

- [ ] T013 [ph4f4] Create `tests/integration/test_persistence.py`
- [ ] T014 [ph4f4] Test: Start session, stop server, restart, reconnect succeeds
- [ ] T015 [ph4f4] Test: Events replayed on reconnection
- [ ] T016 [ph4f4] Test: Pending request resolved after reconnect

---

## ph4f5: Docker Compose Configuration (~80 lines)

**Branch**: `git town append phase/4/feat/5/docker-compose`
**Depends on**: ph4f4
**Goal**: Production-ready container configuration
**User Stories**: US5 (Environment Configuration)

- [ ] T017 [ph4f5] Update `docker/backend.Dockerfile` with persistence volume
- [ ] T018 [ph4f5] Update `docker-compose.yaml` with volume mounts for SQLite
- [ ] T019 [ph4f5] Add environment variable configuration examples
- [ ] T020 [ph4f5] Document container deployment in quickstart.md

---

## Dependencies & Execution Order

### PR Chain (Managed by Git Town)

```
main
 └── ph1f1: DB schema
      └── ph1f2: DB connection
           ├── ph1f3: Session repo create
           │    └── ph1f4: Session repo get
           │         └── ph1f5: Session repo list
           └── ph1f6: Event repo insert
                └── ph1f7: Event repo query
                     └── ph1f8: Fake repos
                          ├── ph2f1: Session manager
                          │    └── ph2f2: Session manager get
                          │         └── ph2f5: gRPC create session
                          │              └── ph2f6: gRPC list sessions
                          └── ph2f3: Request queue
                               └── ph2f4: Event broadcaster
                                    └── ph2f7: gRPC submit request
                                         └── ph2f8: gRPC submit decision
                                              └── ph2f9: gRPC subscribe
                                                   └── ph2f10: Server entrypoint
                                                        └── (Plugin chain joins here)

ph3f1: Plugin config (independent start)
 └── ph3f3: gRPC client
      └── ph3f4: Client create session
           └── ph3f5: Client submit request
                └── ph3f6: Client subscribe
                     └── ph3f7: Future registry
                          └── ph3f8: Listen loop
                               └── ph3f9: Plugin initialize
                                    └── ph3f10: Plugin intercept ←── ph3f2: Proto converter (joins here)
                                         └── ph3f11: Plugin reconnect
                                              └── ph4f1: Integration basic
                                                   └── ph4f2: Integration selective
                                                        └── ph4f3: Integration queue
                                                             └── ph4f4: Integration persist
                                                                  └── ph4f5: Docker compose

ph3f2: Proto converter (independent, merges into ph3f10)
```

### Git Town Commands

```bash
# Start feature - Phase 1
git town hack phase/1/feat/1/db-schema

# Create stacked PRs for Phase 1
git town append phase/1/feat/2/db-connection
git town append phase/1/feat/3/session-repo-create
git town append phase/1/feat/4/session-repo-get
git town append phase/1/feat/5/session-repo-list
# PR 6 branches from PR 2
git checkout phase/1/feat/2/db-connection
git town append phase/1/feat/6/event-repo-insert
git town append phase/1/feat/7/event-repo-query
git town append phase/1/feat/8/fake-repos

# Continue with Phase 2...
git town append phase/2/feat/1/session-manager
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
4. `git town append phase/1/feat/2/...` for next PR
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
- [phNfM] label maps task to specific Pull Request (phase N, feature M)
- Each PR MUST be 100-200 lines max (HARD LIMIT)
- Tests and implementation go in SAME PR
- Run `./scripts/presubmit.sh` before every push
- Use `git town append` for stacked PRs
