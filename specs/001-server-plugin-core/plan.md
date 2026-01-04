# Implementation Plan: ADK Agent Simulator Server & Python Plugin

**Branch**: `001-server-plugin-core` | **Date**: January 3, 2026 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-server-plugin-core/spec.md`

## Summary

Implement the Simulator Server (gRPC backend with SQLite persistence) and Python Plugin (ADK integration using `before_model_callback`) to enable human-in-the-loop validation of agent workflows via the "Remote Brain" protocol.

## Technical Context

**Language/Version**: Python 3.14  
**Primary Dependencies**: grpclib (async gRPC), betterproto (proto codegen), databases + SQLAlchemy Core (persistence)  
**Storage**: SQLite via `databases` library with "Promoted Field" pattern  
**Testing**: pytest with pytest-asyncio  
**Target Platform**: Linux (dev container), cross-platform Python  
**Project Type**: Single project (backend library + server)  
**Performance Goals**: <500ms request submission latency (SC-003)  
**Constraints**: Indefinite blocking wait for human response, no timeout  
**Scale/Scope**: Single developer simulation sessions, FIFO queueing

### Design Decisions

**Proto as Single Source of Truth**: Use betterproto-generated classes directly (`SimulatorSession`, `SessionEvent`, etc.) instead of defining redundant Python model classes. This avoids maintenance toil and keeps the proto definition authoritative.

**Promoted Field Pattern**: Persistence stores full proto objects as BLOBs, with only queryable fields (IDs, timestamps, status) promoted to dedicated SQL columns.

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

**Target PR Count**: ~34 PRs (feature is focused on server + plugin only)

### Phase 1: Foundation & Data Layer

| PR # | Branch Name | Description | Est. Lines | Depends On |
|------|-------------|-------------|------------|------------|
| ph1f1 | `phase/1/feat/1/db-schema` | SQLAlchemy Core schema definitions (sessions, events tables) | ~80 | - |
| ph1f2 | `phase/1/feat/2/db-connection` | Database connection manager using `databases` library | ~100 | ph1f1 |
| ph1f3 | `phase/1/feat/3/session-repo-create` | SessionRepository.create() with Promoted Field pattern + tests | ~150 | ph1f2 |
| ph1f4 | `phase/1/feat/4/session-repo-get` | SessionRepository.get_by_id() + tests | ~100 | ph1f3 |
| ph1f5 | `phase/1/feat/5/session-repo-list` | SessionRepository.list_all() with pagination + tests | ~120 | ph1f4 |
| ph1f6 | `phase/1/feat/6/event-repo-insert` | EventRepository.insert() with proto blob serialization + tests | ~120 | ph1f2 |
| ph1f7 | `phase/1/feat/7/event-repo-query` | EventRepository.get_by_session() + tests | ~120 | ph1f6 |
| ph1f8 | `phase/1/feat/8/fake-repos` | FakeSessionRepository, FakeEventRepository for testing | ~150 | ph1f7 |

### Phase 2: Server Core

| PR # | Branch Name | Description | Est. Lines | Depends On |
|------|-------------|-------------|------------|------------|
| ph2f1 | `phase/2/feat/1/session-manager` | SessionManager class shell + create_session() | ~120 | ph1f8 |
| ph2f2 | `phase/2/feat/2/session-manager-get` | SessionManager.get_session() + reconnection logic | ~100 | ph2f1 |
| ph2f3 | `phase/2/feat/3/request-queue` | RequestQueue (FIFO per session) implementation | ~150 | ph1f8 |
| ph2f4 | `phase/2/feat/4/event-broadcaster` | EventBroadcaster for streaming to subscribers | ~120 | ph2f3 |
| ph2f5 | `phase/2/feat/5/grpc-create-session` | SimulatorService.create_session() RPC | ~120 | ph2f2 |
| ph2f6 | `phase/2/feat/6/grpc-list-sessions` | SimulatorService.list_sessions() RPC | ~100 | ph2f5 |
| ph2f7 | `phase/2/feat/7/grpc-submit-request` | SimulatorService.submit_request() RPC | ~150 | ph2f4 |
| ph2f8 | `phase/2/feat/8/grpc-submit-decision` | SimulatorService.submit_decision() RPC | ~120 | ph2f7 |
| ph2f9 | `phase/2/feat/9/grpc-subscribe` | SimulatorService.subscribe() with replay | ~180 | ph2f8 |
| ph2f10 | `phase/2/feat/10/server-entrypoint` | Server main entrypoint with graceful shutdown | ~100 | ph2f9 |

### Phase 3: Plugin Core

| PR # | Branch Name | Description | Est. Lines | Depends On |
|------|-------------|-------------|------------|------------|
| ph3f1 | `phase/3/feat/1/plugin-config` | PluginConfig dataclass with env var parsing | ~100 | - |
| ph3f2 | `phase/3/feat/2/proto-converter` | ADKProtoConverter for LlmRequest ↔ GenerateContentRequest | ~180 | - |
| ph3f3 | `phase/3/feat/3/grpc-client` | SimulatorClient gRPC wrapper (connect, close) | ~120 | ph3f1 |
| ph3f4 | `phase/3/feat/4/client-create-session` | SimulatorClient.create_session() | ~80 | ph3f3 |
| ph3f5 | `phase/3/feat/5/client-submit-request` | SimulatorClient.submit_request() | ~100 | ph3f4 |
| ph3f6 | `phase/3/feat/6/client-subscribe` | SimulatorClient.subscribe() async iterator | ~120 | ph3f5 |
| ph3f7 | `phase/3/feat/7/future-registry` | PendingFutureRegistry (turn_id -> Future map) | ~100 | ph3f6 |
| ph3f8 | `phase/3/feat/8/listen-loop` | Plugin._listen_loop() background task | ~150 | ph3f7 |
| ph3f9 | `phase/3/feat/9/plugin-initialize` | Plugin.initialize() with URL output | ~120 | ph3f8 |
| ph3f10 | `phase/3/feat/10/plugin-intercept` | Plugin.before_model_callback() full flow | ~180 | ph3f2, ph3f9 |
| ph3f11 | `phase/3/feat/11/plugin-reconnect` | Reconnection logic on connection loss | ~150 | ph3f10 |

### Phase 4: Integration & Polish

| PR # | Branch Name | Description | Est. Lines | Depends On |
|------|-------------|-------------|------------|------------|
| ph4f1 | `phase/4/feat/1/integration-basic` | Basic integration test: single agent round-trip | ~150 | ph3f11 |
| ph4f2 | `phase/4/feat/2/integration-selective` | Integration test: selective agent interception | ~120 | ph4f1 |
| ph4f3 | `phase/4/feat/3/integration-queue` | Integration test: FIFO queueing of parallel requests | ~150 | ph4f2 |
| ph4f4 | `phase/4/feat/4/integration-persist` | Integration test: session persistence across restart | ~120 | ph4f3 |
| ph4f5 | `phase/4/feat/5/docker-compose` | Docker compose configuration for server | ~80 | ph4f4 |

**PR Planning Rules Applied**:
- Each PR is 100-200 lines max ✓
- Each PR includes tests for the code it introduces ✓
- PRs are single-purpose ✓
- Use `git town append` to create dependent branches ✓
- Large components (SessionManager, Plugin) built incrementally across multiple PRs ✓
- **No redundant model classes** - uses betterproto-generated protos directly ✓

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
├── generated/              # Proto-generated code (betterproto) - SOURCE OF TRUTH
│   ├── adksim/v1/          # SimulatorSession, SessionEvent, etc.
│   └── google/ai/generativelanguage/v1beta/  # GenerateContentRequest/Response
├── persistence/            # NEW: Data access layer (databases + SQLAlchemy Core)
│   ├── __init__.py
│   ├── schema.py           # SQLAlchemy Core table definitions
│   ├── database.py         # Connection manager using `databases` library
│   ├── session_repo.py     # SessionRepository (Promoted Field pattern)
│   └── event_repo.py       # EventRepository (Promoted Field pattern)
├── plugin/
│   ├── __init__.py
│   ├── core.py             # SimulatorPlugin (enhanced)
│   ├── config.py           # NEW: PluginConfig
│   ├── converter.py        # NEW: ADKProtoConverter (LlmRequest ↔ Proto)
│   ├── client.py           # NEW: SimulatorClient (gRPC wrapper)
│   └── futures.py          # NEW: PendingFutureRegistry
└── server/
    ├── __init__.py
    ├── logging.py
    ├── main.py             # Server entrypoint (enhanced)
    ├── session_manager.py  # NEW: SessionManager
    ├── broadcaster.py      # NEW: EventBroadcaster
    ├── queue.py            # NEW: RequestQueue
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

**Structure Decision**: Single project structure maintained. Proto-generated classes used directly (no `models/` directory). New `persistence/` layer uses `databases` + SQLAlchemy Core with Promoted Field pattern.

## Data Model

**Source of Truth**: Proto definitions in `protos/adksim/v1/` and `protos/google/ai/generativelanguage/v1beta/`

### SimulatorSession (`adksim.v1.SimulatorSession`)

```
SimulatorSession (betterproto.Message)
├── id: str (UUID, primary key)
├── created_at: datetime (Timestamp)
└── description: str (optional)
```

### SessionEvent (`adksim.v1.SessionEvent`)

```
SessionEvent (betterproto.Message)
├── event_id: str (UUID)
├── session_id: str (FK)
├── timestamp: datetime
├── turn_id: str (correlation ID)
├── agent_name: str
├── llm_request: GenerateContentRequest (oneof payload)
└── llm_response: GenerateContentResponse (oneof payload)
```

### LLM Types (`google.ai.generativelanguage.v1beta`)

```
GenerateContentRequest (betterproto.Message)
├── model: str
├── contents: list[Content]
├── system_instruction: Content
├── tools: list[Tool]
└── generation_config: GenerationConfig

GenerateContentResponse (betterproto.Message)
├── candidates: list[Candidate]
├── prompt_feedback: PromptFeedback
└── usage_metadata: UsageMetadata
```

## Key Implementation Notes

### Architectural Overview: Server as Opaque Bridge

The Simulator Server acts as an **opaque bridge** between the Plugin and Frontend—it does not interpret or validate the contents of `GenerateContentRequest` or `GenerateContentResponse`. This design keeps the server simple and decoupled from LLM-specific logic.

**Data Flow**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ADK Application                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Agent declares: tools, system_instruction, output_schema                   │
│                         ↓                                                   │
│  ADK Runtime builds: LlmRequest (ADK's internal model)                      │
│                         ↓                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     SimulatorPlugin                                 │    │
│  │  1. Intercept LlmRequest in before_model_callback()                 │    │
│  │  2. Use ADK internals to convert: LlmRequest → GenerateContentReq   │    │
│  │  3. Submit GenerateContentRequest to server (opaque payload)        │    │
│  │  4. Block waiting for GenerateContentResponse                       │    │
│  │  5. Use ADK internals to convert: GenerateContentResponse → LlmResp │    │
│  │  6. Return LlmResponse to ADK Runtime                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                              ↕ gRPC (SessionEvent)
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Simulator Server                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  • Receives SessionEvent with llm_request payload (opaque blob)             │
│  • Persists event to SQLite                                                 │
│  • Broadcasts event to all subscribers                                      │
│  • Receives SessionEvent with llm_response payload (opaque blob)            │
│  • Does NOT parse or validate GenerateContentRequest/Response contents      │
└─────────────────────────────────────────────────────────────────────────────┘
                              ↕ gRPC (SessionEvent)
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Frontend (OUT OF SCOPE)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  • Subscribes to session events                                             │
│  • Parses GenerateContentRequest to render UI (tools, history, etc.)        │
│  • Collects user input and constructs GenerateContentResponse               │
│  • Publishes response event back to server                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Design Decisions**:

1. **ADK Conversion Utilities**: The plugin MUST use ADK's existing internal utilities for `LlmRequest ↔ GenerateContentRequest` and `GenerateContentResponse ↔ LlmResponse` conversions. This ensures compatibility with ADK's model structure and avoids reimplementing complex serialization logic.

2. **Server is Payload-Agnostic**: The server treats `GenerateContentRequest` and `GenerateContentResponse` as opaque proto blobs. It only inspects promoted fields (`session_id`, `turn_id`, `timestamp`, `payload_type`) for routing and persistence.

3. **Frontend Owns LLM Semantics**: The frontend (out of scope for this phase) is responsible for understanding and rendering `GenerateContentRequest` fields (contents, tools, system_instruction) and constructing valid `GenerateContentResponse` objects.

### ADKProtoConverter Reference Implementation

The plugin MUST use this converter class for `LlmRequest ↔ GenerateContentRequest` and `GenerateContentResponse ↔ LlmResponse` transformations. This implementation mirrors the google.genai SDK's serialization logic.

**File**: `adk_agent_sim/plugin/converter.py`

```python
from typing import Any, Dict

import google.ai.generativelanguage as glm
from google.genai import types as genai_types
from google.protobuf import json_format
from google.adk.models import LlmRequest, LlmResponse

class ADKProtoConverter:
  """Handles conversion between ADK/Pydantic objects and Google/Protobuf objects.

  This class serves as a bridge for the Simulator "Remote Brain" protocol,
  translating internal ADK runtime objects into standard Google Generative AI
  protocol buffers for transmission over gRPC.
  """

  @staticmethod
  def llm_request_to_proto(adk_request: LlmRequest) -> glm.GenerateContentRequest:
    """Converts an ADK LlmRequest (Pydantic) into a GenerateContentRequest (Protobuf).

    This logic mirrors how the google.genai SDK unpacks the 'config' object
    into distinct protocol buffer fields.

    Args:
      adk_request: The ADK LlmRequest Pydantic object to convert.

    Returns:
      The corresponding Google Generative Language GenerateContentRequest protobuf.
    """
    proto_request = glm.GenerateContentRequest()

    # 1. Model Name
    if adk_request.model:
      proto_request.model = adk_request.model

    # 2. Contents
    # Serialize Pydantic contents to dicts, then parse into Proto
    if adk_request.contents:
      contents_data = [c.model_dump(mode='json', exclude_none=True) for c in adk_request.contents]
      for content_dict in contents_data:
        content_proto = glm.Content()
        json_format.ParseDict(content_dict, content_proto)
        proto_request.contents.append(content_proto)

    # 3. Unpack GenerateContentConfig
    # ADK bundles everything (tools, safety, generation params) into 'config'.
    # The Proto expects them in separate fields.
    if adk_request.config:
      config = adk_request.config

      # A. System Instruction
      if config.system_instruction:
        # ADK allows str or Content; normalize to Content for Proto
        if isinstance(config.system_instruction, str):
          si_content = glm.Content(parts=[glm.Part(text=config.system_instruction)])
          proto_request.system_instruction.CopyFrom(si_content)
        else:
          si_data = config.system_instruction.model_dump(mode='json', exclude_none=True)
          json_format.ParseDict(si_data, proto_request.system_instruction)

      # B. Tools
      if config.tools:
        for tool in config.tools:
          # ADK tools can be types.Tool or others.
          # We serialize the Tool object which contains function_declarations.
          if hasattr(tool, 'model_dump'):
            tool_data = tool.model_dump(mode='json', exclude_none=True)
            tool_proto = glm.Tool()
            json_format.ParseDict(tool_data, tool_proto)
            proto_request.tools.append(tool_proto)

      # C. Safety Settings
      if config.safety_settings:
        for setting in config.safety_settings:
          setting_data = setting.model_dump(mode='json', exclude_none=True)
          setting_proto = glm.SafetySetting()
          json_format.ParseDict(setting_data, setting_proto)
          proto_request.safety_settings.append(setting_proto)

      # D. Generation Config (Remaining fields)
      # Create a dict of just the generation params to parse into GenerationConfig proto
      gen_config_proto = glm.GenerationConfig()

      # Map specific fields that belong to GenerationConfig
      # Note: We skip 'tools', 'system_instruction', 'safety_settings' as they are handled above
      gen_config_map = {
          'temperature': config.temperature,
          'top_p': config.top_p,
          'top_k': config.top_k,
          'candidate_count': config.candidate_count,
          'max_output_tokens': config.max_output_tokens,
          'stop_sequences': config.stop_sequences,
          'presence_penalty': config.presence_penalty,
          'frequency_penalty': config.frequency_penalty,
          'response_mime_type': config.response_mime_type,
          # JSON Schema is handled specially in some versions, but usually part of gen_config
      }

      # Remove None values so we don't overwrite proto defaults
      gen_config_dict = {k: v for k, v in gen_config_map.items() if v is not None}

      if config.response_schema:
        gen_config_dict['response_schema'] = config.response_schema.model_dump(mode='json', exclude_none=True)

      if gen_config_dict:
        json_format.ParseDict(gen_config_dict, gen_config_proto)
        proto_request.generation_config.CopyFrom(gen_config_proto)

    return proto_request

  @staticmethod
  def proto_to_llm_response(proto_response: glm.GenerateContentResponse) -> LlmResponse:
    """Converts a GenerateContentResponse (Protobuf) into an ADK LlmResponse (Pydantic).

    This leverages the ADK's existing LlmResponse.create() factory method.

    Args:
      proto_response: The Google Generative Language GenerateContentResponse
        protobuf to convert.

    Returns:
      The corresponding ADK LlmResponse Pydantic object.
    """
    # 1. Convert Proto to Dict
    # preserving_proto_field_name=True ensures keys match the API schema expected by google.genai
    response_dict = json_format.MessageToDict(
        proto_response,
        preserving_proto_field_name=True,
        use_integers_for_enums=False
    )

    # 2. Convert Dict to google.genai.types.GenerateContentResponse
    # The SDK's Pydantic model can validate/parse the raw dictionary
    genai_response = genai_types.GenerateContentResponse.model_validate(response_dict)

    # 3. Create ADK LlmResponse
    # Use the logic in google_llm.py to map candidates/usage to LlmResponse
    return LlmResponse.create(genai_response)
```

**Key Implementation Notes**:

1. **Serialization Strategy**: Uses `json_format.ParseDict()` to convert Pydantic model dicts to Proto messages, avoiding manual field-by-field mapping.

2. **Config Unpacking**: ADK bundles tools, safety_settings, system_instruction, and generation params into a single `GenerateContentConfig`. This must be unpacked into separate Proto fields.

3. **Response Factory**: Uses `LlmResponse.create()` factory method which handles the candidates/usage mapping logic.

4. **Field Preservation**: `preserving_proto_field_name=True` ensures snake_case field names match the expected API schema.

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

- `databases[aiosqlite]>=0.9.0` - Async database access with SQLite driver
- `sqlalchemy>=2.0.0` - Schema definitions and query building (Core only, no ORM)

**Existing Dependencies Used**:

- `grpclib` - Async gRPC client/server
- `betterproto` - Proto codegen (already configured)
- `pytest-asyncio` - Async test support
