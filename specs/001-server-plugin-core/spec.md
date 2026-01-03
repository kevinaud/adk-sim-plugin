# Feature Specification: ADK Agent Simulator Server & Python Plugin

**Feature Branch**: `001-server-plugin-core`  
**Created**: January 3, 2026  
**Status**: Draft  
**Input**: Simulator Server and Python Plugin Core Implementation

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Agent Interception (Priority: P1)

A developer wants to intercept ALL LLM calls in their ADK application to manually step through each agent's decision-making process. They add the SimulatorPlugin to their Runner configuration with no target filtering, run their application, and every agent that would normally call an LLM instead waits for human input via the simulator.

**Why this priority**: This is the foundational capability—without basic interception, no other features work. It delivers immediate value by allowing developers to "dogfood" the agent experience.

**Independent Test**: Can be fully tested by running a single-agent ADK app with the plugin and verifying the application pauses until a response is provided through the server.

**Acceptance Scenarios**:

1. **Given** an ADK application with SimulatorPlugin configured with no target_agents, **When** any agent attempts to call the LLM, **Then** the application pauses and waits for a response from the Simulator Server.

2. **Given** the plugin is initialized, **When** the Runner starts, **Then** a clickable session URL is printed to stdout in the format `http://localhost:4200/session/<uuid>`.

3. **Given** an intercepted agent is waiting, **When** a human provides a response via the server, **Then** the application continues execution using that response.

---

### User Story 2 - Selective Agent Interception (Priority: P1)

A developer wants to act as the Orchestrator Agent while allowing sub-agents to use real LLMs. They configure the SimulatorPlugin with `target_agents=["orchestrator"]`, and only the orchestrator pauses for human input—sub-agents execute normally with the real model.

**Why this priority**: This enables "Hybrid Simulation" which is critical for testing coordination logic in multi-agent systems without having to manually respond to every sub-agent call.

**Independent Test**: Can be fully tested by running a multi-agent ADK app and verifying only the targeted agent is intercepted while others proceed to the real LLM.

**Acceptance Scenarios**:

1. **Given** SimulatorPlugin configured with `target_agents=["orchestrator"]`, **When** the orchestrator agent attempts an LLM call, **Then** the call is intercepted and waits for human input.

2. **Given** SimulatorPlugin configured with `target_agents=["orchestrator"]`, **When** a sub-agent named "researcher" attempts an LLM call, **Then** the call proceeds to the real LLM without interception.

3. **Given** the orchestrator receives a result from a sub-agent's real LLM call, **When** control returns to the orchestrator, **Then** the orchestrator's next LLM call is again intercepted for human input.

---

### User Story 3 - Session Persistence Across Restarts (Priority: P2)

A developer is in the middle of a simulation session when the server unexpectedly restarts. When the server comes back online, the plugin automatically reconnects to the existing session and the developer can continue where they left off.

**Why this priority**: Server reliability is important for real debugging sessions which can be long-running. However, basic interception must work first.

**Independent Test**: Can be fully tested by starting a session, stopping the server, restarting it, and verifying the plugin reconnects to the same session ID.

**Acceptance Scenarios**:

1. **Given** an active simulation session with a known Session ID, **When** the server restarts, **Then** the server recognizes the existing Session ID and accepts reconnection.

2. **Given** a plugin connected to a session, **When** the server connection is lost, **Then** the plugin attempts to reconnect using the same Session ID.

3. **Given** a reconnected session, **When** the developer provides a response, **Then** the waiting agent receives it and continues execution.

---

### User Story 4 - Sequential Request Queueing (Priority: P2)

A developer's application has parallel agents that may trigger LLM requests simultaneously. The server presents these requests one at a time (FIFO) so the human can focus on one decision without being overwhelmed.

**Why this priority**: Important for complex multi-agent scenarios, but most initial usage involves sequential agent calls.

**Independent Test**: Can be fully tested by triggering multiple simultaneous agent requests and verifying they are presented sequentially.

**Acceptance Scenarios**:

1. **Given** three agents trigger LLM requests simultaneously, **When** the server receives all three, **Then** they are queued and presented to the human one at a time in FIFO order.

2. **Given** two requests are queued, **When** the human responds to the first request, **Then** the second request is immediately presented.

3. **Given** a queued request, **When** the human has not yet responded to the current request, **Then** the queued request remains waiting without interrupting.

---

### User Story 5 - Environment-Based Configuration (Priority: P3)

A developer deploys their ADK application in a Docker Compose environment. They configure the simulator connection via environment variables rather than code changes, making it easy to enable/disable simulation across environments.

**Why this priority**: Useful for deployment flexibility but developers can work with constructor arguments initially.

**Independent Test**: Can be fully tested by setting environment variables and verifying the plugin uses them when constructor arguments are not provided.

**Acceptance Scenarios**:

1. **Given** `ADK_SIM_SERVER_URL=simulator-backend:50051` is set, **When** SimulatorPlugin is instantiated with no server_url argument, **Then** the plugin connects to `simulator-backend:50051`.

2. **Given** `ADK_SIM_TARGET_AGENTS=router,researcher` is set, **When** SimulatorPlugin is instantiated with no target_agents argument, **Then** only agents named "router" and "researcher" are intercepted.

3. **Given** both an environment variable and constructor argument are provided, **When** they conflict, **Then** the constructor argument takes precedence.

---

### Edge Cases

- What happens when the server is unreachable at startup? The plugin should fail gracefully with a clear error message indicating the server URL that was attempted.
- What happens when an agent name in target_agents doesn't match any actual agent? The configuration should be accepted but no interception occurs for non-existent agents.
- What happens when a response from the human is malformed? The server should validate responses and return appropriate errors.
- What happens when the plugin is added but no agents exist in the application? The plugin initializes but no interception occurs.
- What happens during a very long wait (hours)? The plugin should not timeout—it waits indefinitely for human input.

## Requirements *(mandatory)*

### Functional Requirements

#### Simulator Server (Backend)

- **FR-001**: The server MUST support bidirectional gRPC streaming to exchange LLM requests and human responses in real-time.
- **FR-002**: The server MUST persist session metadata and state to durable file-based storage (e.g., SQLite).
- **FR-003**: The server MUST recognize existing Session IDs after a restart and allow plugins to reconnect.
- **FR-004**: The server MUST queue incoming LLM requests per session and present them sequentially (FIFO) to maintain cognitive focus.
- **FR-005**: The server MUST generate unique Session IDs (UUIDs) for new sessions.
- **FR-006**: The server MUST accept and store a human-readable session description for identification.
- **FR-007**: The server MUST provide an endpoint to list all active sessions with their metadata.

#### Python Plugin (Client)

- **FR-008**: The plugin MUST implement the `google.adk.plugins.BasePlugin` interface using the `before_model_callback` hook.
- **FR-009**: The plugin MUST extract and serialize the following from `LlmRequest`: `contents` (history/inputs), `system_instruction`, `tools`, and `output_schema`.
- **FR-010**: The plugin MUST transmit serialized request data to the Simulator Server via gRPC.
- **FR-011**: The plugin MUST block application execution while waiting for a human response—no timeout enforced.
- **FR-012**: The plugin MUST print a clickable session URL to stdout upon initialization in the format: `http://localhost:4200/session/<uuid>`.
- **FR-013**: The plugin MUST support conditional interception based on agent names via the `target_agents` parameter.
- **FR-014**: The plugin MUST allow the request to proceed to the real LLM if the agent is not in the target list.
- **FR-015**: The plugin MUST fall back to environment variables (`ADK_SIM_SERVER_URL`, `ADK_SIM_TARGET_AGENTS`) when constructor arguments are not provided.
- **FR-016**: The plugin MUST log the current wait state: `[ADK Simulator] Waiting for human input for agent: '<agent_name>'...`
- **FR-017**: Constructor arguments MUST take precedence over environment variables when both are provided.

### Key Entities

- **SimulatorSession**: Represents a simulation run. Contains a unique ID (UUID), creation timestamp, optional description, current state (active/completed), and associated request queue.
- **SimulatedLlmRequest**: The serialized data sent from plugin to server containing conversation history, system instructions, available tools, and expected output schema.
- **HumanResponse**: The response provided by the human via the server, containing either a tool call selection with arguments or a final text/structured response.
- **RequestQueue**: A FIFO queue per session holding pending LLM requests from potentially parallel agents.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developers can add the SimulatorPlugin to any ADK Runner configuration in under 5 lines of code.
- **SC-002**: The session URL is displayed within 2 seconds of Runner initialization.
- **SC-003**: Intercepted agent requests appear on the server within 500ms of the agent's LLM call attempt.
- **SC-004**: Sessions persist and remain accessible after server restart with zero data loss.
- **SC-005**: 100% of targeted agents are correctly intercepted while 100% of non-targeted agents proceed to the real LLM.
- **SC-006**: Queued parallel requests are presented sequentially with no request loss or duplication.
- **SC-007**: Plugin operates indefinitely without timeout until human provides a response.

## Assumptions

- The ADK application is using `google.adk.plugins.BasePlugin` interface which provides `before_model_callback` hook.
- The server will run on `localhost:50051` as the default endpoint unless otherwise configured.
- The Web UI will be served at `localhost:4200` (handled by a separate component outside this spec's scope).
- File-based storage (SQLite) provides sufficient durability for the simulator's session persistence needs.
- Developers have basic familiarity with Python and ADK Runner configuration patterns.

## Out of Scope

- Web UI frontend implementation (covered in separate specification)
- Multimodal input support (images, audio, video)
- Golden trace export functionality
- Mobile support
- Authentication/authorization for the simulator server
