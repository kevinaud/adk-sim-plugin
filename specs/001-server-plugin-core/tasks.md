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

## User Story Coverage

| User Story | Priority | PRs |
|------------|----------|-----|
| US1: Basic Agent Interception | P1 | PR 21-30, PR 31 |
| US2: Selective Agent Interception | P1 | PR 29, PR 32 |
| US3: Session Persistence | P2 | PR 3-9, PR 34 |
| US4: Sequential Request Queueing | P2 | PR 13-14, PR 33 |
| US5: Environment Configuration | P3 | PR 21 |

---

## Phase 1: Foundation & Data Layer (PRs 1-10)

---

## PR 1: SimulatorSession Model (~80 lines)

**Branch**: `git town hack feature/001-session-model`
**Depends on**: -
**Goal**: Define SimulatorSession dataclass with validation

- [ ] T001 [PR1] Create models package with `__init__.py` in `adk_agent_sim/models/__init__.py`
- [ ] T002 [PR1] Define SimulatorSession dataclass with id, created_at, description, status fields in `adk_agent_sim/models/session.py`
- [ ] T003 [PR1] Add validation for status transitions (active → completed only) in `adk_agent_sim/models/session.py`
- [ ] T004 [PR1] Add SimulatorSession tests in `tests/unit/models/test_session.py`

---

## PR 2: Event Types (~120 lines)

**Branch**: `git town append feature/002-event-types`
**Depends on**: PR 1
**Goal**: Define SessionEvent, SimulatedLlmRequest, HumanResponse dataclasses

- [ ] T005 [PR2] Define SessionEvent dataclass with event_id, session_id, timestamp, turn_id, agent_name, payload in `adk_agent_sim/models/events.py`
- [ ] T006 [PR2] Define SimulatedLlmRequest dataclass with contents, system_instruction, tools fields in `adk_agent_sim/models/events.py`
- [ ] T007 [PR2] Define HumanResponse dataclass with candidates field in `adk_agent_sim/models/events.py`
- [ ] T008 [PR2] Add event type tests in `tests/unit/models/test_events.py`

---

## PR 3: SQLite Schema (~100 lines)

**Branch**: `git town append feature/003-db-schema`
**Depends on**: PR 1
**Goal**: Define SQLite schema for sessions and events tables

- [ ] T009 [PR3] Create persistence package with `__init__.py` in `adk_agent_sim/persistence/__init__.py`
- [ ] T010 [PR3] Define schema SQL constants (CREATE TABLE sessions, events) in `adk_agent_sim/persistence/schema.py`
- [ ] T011 [PR3] Add indexes for session_id and turn_id lookups in `adk_agent_sim/persistence/schema.py`
- [ ] T012 [PR3] Add schema validation tests in `tests/unit/persistence/test_schema.py`

---

## PR 4: Database Connection Manager (~120 lines)

**Branch**: `git town append feature/004-db-connection`
**Depends on**: PR 3
**Goal**: Async SQLite connection manager using aiosqlite

- [ ] T013 [PR4] Implement DatabaseManager class with async context manager in `adk_agent_sim/persistence/database.py`
- [ ] T014 [PR4] Add connect(), close(), execute() methods in `adk_agent_sim/persistence/database.py`
- [ ] T015 [PR4] Add schema initialization on first connect in `adk_agent_sim/persistence/database.py`
- [ ] T016 [PR4] Add DatabaseManager tests with real SQLite (in-memory) in `tests/unit/persistence/test_database.py`

---

## PR 5: SessionRepository.create() (~150 lines)

**Branch**: `git town append feature/005-session-repo-create`
**Depends on**: PR 4
**Goal**: Implement session creation in repository

- [ ] T017 [PR5] Create SessionRepository class skeleton in `adk_agent_sim/persistence/session_repo.py`
- [ ] T018 [PR5] Implement SessionRepository.create(description) method in `adk_agent_sim/persistence/session_repo.py`
- [ ] T019 [PR5] Add UUID generation and timestamp handling in `adk_agent_sim/persistence/session_repo.py`
- [ ] T020 [PR5] Add SessionRepository.create() tests in `tests/unit/persistence/test_session_repo.py`

---

## PR 6: SessionRepository.get_by_id() (~100 lines)

**Branch**: `git town append feature/006-session-repo-get`
**Depends on**: PR 5
**Goal**: Implement session retrieval by ID

- [ ] T021 [PR6] Implement SessionRepository.get_by_id(session_id) method in `adk_agent_sim/persistence/session_repo.py`
- [ ] T022 [PR6] Add row-to-model mapping helper in `adk_agent_sim/persistence/session_repo.py`
- [ ] T023 [PR6] Add get_by_id tests (found, not found cases) in `tests/unit/persistence/test_session_repo.py`

---

## PR 7: SessionRepository.list_all() (~120 lines)

**Branch**: `git town append feature/007-session-repo-list`
**Depends on**: PR 6
**Goal**: Implement session listing with pagination

- [ ] T024 [PR7] Implement SessionRepository.list_all(limit, offset) method in `adk_agent_sim/persistence/session_repo.py`
- [ ] T025 [PR7] Add order by created_at DESC in `adk_agent_sim/persistence/session_repo.py`
- [ ] T026 [PR7] Add list_all tests (empty, pagination, ordering) in `tests/unit/persistence/test_session_repo.py`

---

## PR 8: EventRepository.insert() (~100 lines)

**Branch**: `git town append feature/008-event-repo-insert`
**Depends on**: PR 4
**Goal**: Implement event insertion

- [ ] T027 [PR8] Create EventRepository class skeleton in `adk_agent_sim/persistence/event_repo.py`
- [ ] T028 [PR8] Implement EventRepository.insert(event) method with proto serialization in `adk_agent_sim/persistence/event_repo.py`
- [ ] T029 [PR8] Add EventRepository.insert() tests in `tests/unit/persistence/test_event_repo.py`

---

## PR 9: EventRepository.get_by_session() (~120 lines)

**Branch**: `git town append feature/009-event-repo-query`
**Depends on**: PR 8
**Goal**: Implement event retrieval by session

- [ ] T030 [PR9] Implement EventRepository.get_by_session(session_id) method in `adk_agent_sim/persistence/event_repo.py`
- [ ] T031 [PR9] Add proto deserialization for payload reconstruction in `adk_agent_sim/persistence/event_repo.py`
- [ ] T032 [PR9] Add get_by_session tests (multiple events, ordering) in `tests/unit/persistence/test_event_repo.py`

---

## PR 10: Fake Repositories (~150 lines)

**Branch**: `git town append feature/010-fake-repos`
**Depends on**: PR 9
**Goal**: Create in-memory fake implementations for testing

- [ ] T033 [PR10] Create test fixtures package in `tests/fixtures/__init__.py`
- [ ] T034 [PR10] [P] Implement FakeSessionRepository in `tests/fixtures/fake_session_repo.py`
- [ ] T035 [PR10] [P] Implement FakeEventRepository in `tests/fixtures/fake_event_repo.py`
- [ ] T036 [PR10] Add fake repository tests verifying behavior parity in `tests/fixtures/test_fakes.py`

---

## Phase 2: Server Core (PRs 11-20)

---

## PR 11: SessionManager Shell + create_session() (~120 lines)

**Branch**: `git town append feature/011-session-manager`
**Depends on**: PR 10
**Goal**: SessionManager class with session creation

- [ ] T037 [PR11] Create SessionManager class with repository injection in `adk_agent_sim/server/session_manager.py`
- [ ] T038 [PR11] Implement SessionManager.create_session(description) method in `adk_agent_sim/server/session_manager.py`
- [ ] T039 [PR11] Add SessionManager.create_session() tests using FakeSessionRepository in `tests/unit/server/test_session_manager.py`

---

## PR 12: SessionManager.get_session() (~100 lines)

**Branch**: `git town append feature/012-session-manager-get`
**Depends on**: PR 11
**Goal**: Session retrieval with reconnection support

- [ ] T040 [PR12] Implement SessionManager.get_session(session_id) method in `adk_agent_sim/server/session_manager.py`
- [ ] T041 [PR12] Add session validation (exists, active status) in `adk_agent_sim/server/session_manager.py`
- [ ] T042 [PR12] Add get_session tests (found, not found, completed) in `tests/unit/server/test_session_manager.py`

---

## PR 13: RequestQueue Implementation (~150 lines)

**Branch**: `git town append feature/013-request-queue`
**Depends on**: PR 2
**Goal**: FIFO request queue per session (FR-004, US4)

- [ ] T043 [PR13] Define RequestQueue class using asyncio.Queue in `adk_agent_sim/models/queue.py`
- [ ] T044 [PR13] Implement enqueue(request_event) method in `adk_agent_sim/models/queue.py`
- [ ] T045 [PR13] Implement dequeue(), peek(), is_empty() methods in `adk_agent_sim/models/queue.py`
- [ ] T046 [PR13] Add RequestQueue tests (FIFO ordering, concurrent enqueue) in `tests/unit/models/test_queue.py`

---

## PR 14: EventBroadcaster (~120 lines)

**Branch**: `git town append feature/014-event-broadcaster`
**Depends on**: PR 13
**Goal**: Broadcast events to connected subscribers

- [ ] T047 [PR14] Create EventBroadcaster class in `adk_agent_sim/server/broadcaster.py`
- [ ] T048 [PR14] Implement subscribe(session_id) -> AsyncIterator in `adk_agent_sim/server/broadcaster.py`
- [ ] T049 [PR14] Implement broadcast(session_id, event) method in `adk_agent_sim/server/broadcaster.py`
- [ ] T050 [PR14] Add EventBroadcaster tests in `tests/unit/server/test_broadcaster.py`

---

## PR 15: gRPC create_session() RPC (~120 lines)

**Branch**: `git town append feature/015-grpc-create-session`
**Depends on**: PR 12
**Goal**: Implement CreateSession RPC endpoint (FR-005, FR-006)

- [ ] T051 [PR15] Add SessionManager dependency to SimulatorService in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T052 [PR15] Implement create_session() RPC with description parameter in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T053 [PR15] Add create_session RPC tests in `tests/unit/server/test_simulator_service.py`

---

## PR 16: gRPC list_sessions() RPC (~100 lines)

**Branch**: `git town append feature/016-grpc-list-sessions`
**Depends on**: PR 15
**Goal**: Implement ListSessions RPC endpoint (FR-007)

- [ ] T054 [PR16] Implement list_sessions() RPC with pagination in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T055 [PR16] Add proto response mapping in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T056 [PR16] Add list_sessions RPC tests in `tests/unit/server/test_simulator_service.py`

---

## PR 17: gRPC submit_request() RPC (~150 lines)

**Branch**: `git town append feature/017-grpc-submit-request`
**Depends on**: PR 14
**Goal**: Implement SubmitRequest RPC for agent requests (FR-001)

- [ ] T057 [PR17] Implement submit_request() RPC in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T058 [PR17] Add event creation and persistence in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T059 [PR17] Add request queueing via RequestQueue in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T060 [PR17] Add submit_request RPC tests in `tests/unit/server/test_simulator_service.py`

---

## PR 18: gRPC submit_decision() RPC (~120 lines)

**Branch**: `git town append feature/018-grpc-submit-decision`
**Depends on**: PR 17
**Goal**: Implement SubmitDecision RPC for human responses

- [ ] T061 [PR18] Implement submit_decision() RPC with turn_id correlation in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T062 [PR18] Add response event creation and persistence in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T063 [PR18] Add queue dequeue and broadcast in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T064 [PR18] Add submit_decision RPC tests in `tests/unit/server/test_simulator_service.py`

---

## PR 19: gRPC subscribe() with Replay (~180 lines)

**Branch**: `git town append feature/019-grpc-subscribe`
**Depends on**: PR 18
**Goal**: Implement Subscribe streaming RPC with event replay (FR-001, FR-003)

- [ ] T065 [PR19] Implement subscribe() streaming RPC in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T066 [PR19] Add historical event replay from EventRepository in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T067 [PR19] Add live event streaming via EventBroadcaster in `adk_agent_sim/server/services/simulator_service.py`
- [ ] T068 [PR19] Add subscribe RPC tests (replay + live) in `tests/unit/server/test_simulator_service.py`

---

## PR 20: Server Entrypoint (~100 lines)

**Branch**: `git town append feature/020-server-entrypoint`
**Depends on**: PR 19
**Goal**: Server main with graceful shutdown

- [ ] T069 [PR20] Enhance server main() with dependency wiring in `adk_agent_sim/server/main.py`
- [ ] T070 [PR20] Add graceful shutdown signal handling in `adk_agent_sim/server/main.py`
- [ ] T071 [PR20] Add server startup/shutdown tests in `tests/unit/server/test_main.py`

---

## Phase 3: Plugin Core (PRs 21-30)

---

## PR 21: PluginConfig (~100 lines)

**Branch**: `git town append feature/021-plugin-config`
**Depends on**: -
**Goal**: Configuration with env var fallback (FR-015, FR-017, US5)

- [ ] T072 [PR21] Create PluginConfig dataclass in `adk_agent_sim/plugin/config.py`
- [ ] T073 [PR21] Add server_url, target_agents, session_description fields in `adk_agent_sim/plugin/config.py`
- [ ] T074 [PR21] Implement env var parsing (ADK_SIM_SERVER_URL, ADK_SIM_TARGET_AGENTS) in `adk_agent_sim/plugin/config.py`
- [ ] T075 [PR21] Add PluginConfig tests (constructor precedence) in `tests/unit/plugin/test_config.py`

---

## PR 22: SimulatorClient Shell (~120 lines)

**Branch**: `git town append feature/022-grpc-client`
**Depends on**: PR 21
**Goal**: gRPC client wrapper with connect/close

- [ ] T076 [PR22] Create SimulatorClient class in `adk_agent_sim/plugin/client.py`
- [ ] T077 [PR22] Implement async connect() method in `adk_agent_sim/plugin/client.py`
- [ ] T078 [PR22] Implement close() method in `adk_agent_sim/plugin/client.py`
- [ ] T079 [PR22] Add SimulatorClient connect/close tests in `tests/unit/plugin/test_client.py`

---

## PR 23: Client create_session() (~80 lines)

**Branch**: `git town append feature/023-client-create-session`
**Depends on**: PR 22
**Goal**: Client method for session creation

- [ ] T080 [PR23] Implement SimulatorClient.create_session(description) in `adk_agent_sim/plugin/client.py`
- [ ] T081 [PR23] Add create_session tests in `tests/unit/plugin/test_client.py`

---

## PR 24: Client submit_request() (~100 lines)

**Branch**: `git town append feature/024-client-submit-request`
**Depends on**: PR 23
**Goal**: Client method for submitting LLM requests (FR-010)

- [ ] T082 [PR24] Implement SimulatorClient.submit_request(session_id, request) in `adk_agent_sim/plugin/client.py`
- [ ] T083 [PR24] Add request serialization from LlmRequest in `adk_agent_sim/plugin/client.py`
- [ ] T084 [PR24] Add submit_request tests in `tests/unit/plugin/test_client.py`

---

## PR 25: Client subscribe() (~120 lines)

**Branch**: `git town append feature/025-client-subscribe`
**Depends on**: PR 24
**Goal**: Client streaming subscription

- [ ] T085 [PR25] Implement SimulatorClient.subscribe(session_id) -> AsyncIterator in `adk_agent_sim/plugin/client.py`
- [ ] T086 [PR25] Add event deserialization in `adk_agent_sim/plugin/client.py`
- [ ] T087 [PR25] Add subscribe tests in `tests/unit/plugin/test_client.py`

---

## PR 26: PendingFutureRegistry (~100 lines)

**Branch**: `git town append feature/026-future-registry`
**Depends on**: PR 25
**Goal**: Turn ID to Future mapping for blocking waits

- [ ] T088 [PR26] Create PendingFutureRegistry class in `adk_agent_sim/plugin/futures.py`
- [ ] T089 [PR26] Implement register(turn_id) -> Future in `adk_agent_sim/plugin/futures.py`
- [ ] T090 [PR26] Implement resolve(turn_id, response), cancel(turn_id) in `adk_agent_sim/plugin/futures.py`
- [ ] T091 [PR26] Add PendingFutureRegistry tests in `tests/unit/plugin/test_futures.py`

---

## PR 27: Plugin Listen Loop (~150 lines)

**Branch**: `git town append feature/027-listen-loop`
**Depends on**: PR 26
**Goal**: Background task processing server events

- [ ] T092 [PR27] Implement SimulatorPlugin._listen_loop() background task in `adk_agent_sim/plugin/core.py`
- [ ] T093 [PR27] Add response event handling (resolve Future by turn_id) in `adk_agent_sim/plugin/core.py`
- [ ] T094 [PR27] Add error handling for connection loss in `adk_agent_sim/plugin/core.py`
- [ ] T095 [PR27] Add _listen_loop tests in `tests/unit/plugin/test_plugin.py`

---

## PR 28: Plugin Initialize (~120 lines)

**Branch**: `git town append feature/028-plugin-initialize`
**Depends on**: PR 27
**Goal**: Plugin initialization with URL output (FR-012)

- [ ] T096 [PR28] Implement SimulatorPlugin.initialize() method in `adk_agent_sim/plugin/core.py`
- [ ] T097 [PR28] Add session creation and URL printing in `adk_agent_sim/plugin/core.py`
- [ ] T098 [PR28] Start _listen_loop background task in `adk_agent_sim/plugin/core.py`
- [ ] T099 [PR28] Add initialize() tests in `tests/unit/plugin/test_plugin.py`

---

## PR 29: Plugin before_model_callback (~180 lines)

**Branch**: `git town append feature/029-plugin-intercept`
**Depends on**: PR 28
**Goal**: Full interception flow (FR-008, FR-009, FR-011, FR-013, FR-014, FR-016, US1, US2)

- [ ] T100 [PR29] Implement SimulatorPlugin.before_model_callback() in `adk_agent_sim/plugin/core.py`
- [ ] T101 [PR29] Add target_agents filtering (skip if not in list) in `adk_agent_sim/plugin/core.py`
- [ ] T102 [PR29] Add LlmRequest extraction (contents, system_instruction, tools) in `adk_agent_sim/plugin/core.py`
- [ ] T103 [PR29] Add Future creation, request submission, and blocking await in `adk_agent_sim/plugin/core.py`
- [ ] T104 [PR29] Add wait state logging in `adk_agent_sim/plugin/core.py`
- [ ] T105 [PR29] Add before_model_callback tests (intercept, skip, response) in `tests/unit/plugin/test_plugin.py`

---

## PR 30: Plugin Reconnection (~150 lines)

**Branch**: `git town append feature/030-plugin-reconnect`
**Depends on**: PR 29
**Goal**: Reconnection on connection loss (US3)

- [ ] T106 [PR30] Add reconnection logic on connection loss in `adk_agent_sim/plugin/core.py`
- [ ] T107 [PR30] Store session_id for reconnection in `adk_agent_sim/plugin/core.py`
- [ ] T108 [PR30] Add duplicate event filtering (ignore completed turn_ids) in `adk_agent_sim/plugin/core.py`
- [ ] T109 [PR30] Add reconnection tests in `tests/unit/plugin/test_plugin.py`

---

## Phase 4: Integration & Polish (PRs 31-35)

---

## PR 31: Integration Test - Basic Round-Trip (~150 lines)

**Branch**: `git town append feature/031-integration-basic`
**Depends on**: PR 30
**Goal**: End-to-end single agent test (US1)

- [ ] T110 [PR31] Create integration test helpers in `tests/integration/helpers.py`
- [ ] T111 [PR31] Implement test_single_agent_round_trip in `tests/integration/test_round_trip.py`
- [ ] T112 [PR31] Verify session URL output, request submission, response handling in `tests/integration/test_round_trip.py`

---

## PR 32: Integration Test - Selective Interception (~120 lines)

**Branch**: `git town append feature/032-integration-selective`
**Depends on**: PR 31
**Goal**: Hybrid simulation test (US2)

- [ ] T113 [PR32] Implement test_selective_interception in `tests/integration/test_selective_intercept.py`
- [ ] T114 [PR32] Verify targeted agent intercepted, non-targeted passes through in `tests/integration/test_selective_intercept.py`
- [ ] T115 [PR32] Verify orchestrator re-intercept after sub-agent return in `tests/integration/test_selective_intercept.py`

---

## PR 33: Integration Test - FIFO Queue (~150 lines)

**Branch**: `git town append feature/033-integration-queue`
**Depends on**: PR 32
**Goal**: Parallel request queueing test (US4)

- [ ] T116 [PR33] Implement test_fifo_queue_ordering in `tests/integration/test_fifo_queue.py`
- [ ] T117 [PR33] Trigger three simultaneous agent requests in `tests/integration/test_fifo_queue.py`
- [ ] T118 [PR33] Verify FIFO ordering, sequential presentation in `tests/integration/test_fifo_queue.py`

---

## PR 34: Integration Test - Persistence (~120 lines)

**Branch**: `git town append feature/034-integration-persist`
**Depends on**: PR 33
**Goal**: Session persistence across restart test (US3, FR-002, FR-003)

- [ ] T119 [PR34] Implement test_session_persistence in `tests/integration/test_persistence.py`
- [ ] T120 [PR34] Start session, stop server, restart, verify reconnection in `tests/integration/test_persistence.py`
- [ ] T121 [PR34] Verify event replay and continuation in `tests/integration/test_persistence.py`

---

## PR 35: Docker Compose Configuration (~80 lines)

**Branch**: `git town append feature/035-docker-compose`
**Depends on**: PR 34
**Goal**: Production deployment configuration

- [ ] T122 [PR35] Update docker-compose.yaml with volume mounts for SQLite in `docker-compose.yaml`
- [ ] T123 [PR35] Update backend.Dockerfile with aiosqlite dependency in `docker/backend.Dockerfile`
- [ ] T124 [PR35] Add docker-compose smoke test in `tests/integration/test_docker.py`

---

## Dependencies & Execution Order

### PR Chain (Managed by Git Town)

```
main
 └── PR 1: SimulatorSession Model
      └── PR 2: Event Types
      │    └── PR 13: RequestQueue
      │         └── PR 14: EventBroadcaster
      └── PR 3: SQLite Schema
           └── PR 4: Database Connection
                ├── PR 5: SessionRepository.create()
                │    └── PR 6: SessionRepository.get_by_id()
                │         └── PR 7: SessionRepository.list_all()
                └── PR 8: EventRepository.insert()
                     └── PR 9: EventRepository.get_by_session()
                          └── PR 10: Fake Repositories
                               └── PR 11: SessionManager Shell
                                    └── PR 12: SessionManager.get_session()
                                         └── PR 15: gRPC create_session()
                                              └── PR 16: gRPC list_sessions()
                                                   └── PR 17: gRPC submit_request()
                                                        └── PR 18: gRPC submit_decision()
                                                             └── PR 19: gRPC subscribe()
                                                                  └── PR 20: Server Entrypoint

PR 21: PluginConfig (independent start)
 └── PR 22: SimulatorClient Shell
      └── PR 23: Client create_session()
           └── PR 24: Client submit_request()
                └── PR 25: Client subscribe()
                     └── PR 26: PendingFutureRegistry
                          └── PR 27: Plugin Listen Loop
                               └── PR 28: Plugin Initialize
                                    └── PR 29: Plugin before_model_callback()
                                         └── PR 30: Plugin Reconnection
                                              └── PR 31: Integration - Basic
                                                   └── PR 32: Integration - Selective
                                                        └── PR 33: Integration - Queue
                                                             └── PR 34: Integration - Persistence
                                                                  └── PR 35: Docker Compose
```

### Git Town Commands

```bash
# Start feature (Phase 1)
git town hack feature/001-session-model

# Create stacked PRs
git town append feature/002-event-types
git town append feature/003-db-schema
git town append feature/004-db-connection
git town append feature/005-session-repo-create
git town append feature/006-session-repo-get
git town append feature/007-session-repo-list
git town append feature/008-event-repo-insert
git town append feature/009-event-repo-query
git town append feature/010-fake-repos

# Phase 2: Server Core
git town append feature/011-session-manager
git town append feature/012-session-manager-get
git town append feature/013-request-queue
git town append feature/014-event-broadcaster
git town append feature/015-grpc-create-session
git town append feature/016-grpc-list-sessions
git town append feature/017-grpc-submit-request
git town append feature/018-grpc-submit-decision
git town append feature/019-grpc-subscribe
git town append feature/020-server-entrypoint

# Phase 3: Plugin Core
git town append feature/021-plugin-config
git town append feature/022-grpc-client
git town append feature/023-client-create-session
git town append feature/024-client-submit-request
git town append feature/025-client-subscribe
git town append feature/026-future-registry
git town append feature/027-listen-loop
git town append feature/028-plugin-initialize
git town append feature/029-plugin-intercept
git town append feature/030-plugin-reconnect

# Phase 4: Integration
git town append feature/031-integration-basic
git town append feature/032-integration-selective
git town append feature/033-integration-queue
git town append feature/034-integration-persist
git town append feature/035-docker-compose

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

1. Complete all tasks for PR N
2. Run `./scripts/presubmit.sh` - must pass
3. Push and create PR
4. `git town append feature/0NN-...` for next PR
5. Repeat for all 35 PRs

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

✅ CORRECT:
- PR 5 adds `SessionRepository.create()` AND `test_session_repo.py::test_create()`

❌ WRONG:
- PR 5 adds `SessionRepository.create()`
- PR 6 adds tests for create() ← VIOLATION

### No Mocks Without Permission

✅ Use FakeSessionRepository (PR 10) for unit tests
✅ Use in-memory SQLite for persistence tests
❌ Do NOT use `unittest.mock.Mock` without explicit approval

### Test Naming Convention

```python
# tests/unit/{module}/test_{component}.py
def test_{method}_{scenario}_{expected_outcome}():
    ...

# Example
def test_create_session_with_description_returns_active_session():
    ...
```

---

## Summary

| Metric | Value |
|--------|-------|
| **Total Tasks** | 124 |
| **Total PRs** | 35 |
| **Avg Tasks per PR** | 3.5 |
| **Avg LOC per PR** | ~115 |
| **Max LOC (PR 19, 29)** | ~180 |
| **Parallel Opportunities** | T034/T035 (PR10) |
| **P1 User Stories Covered** | US1, US2 (PRs 21-32) |
| **P2 User Stories Covered** | US3, US4 (PRs 3-9, 13-14, 30, 33-34) |
| **P3 User Stories Covered** | US5 (PR 21) |
