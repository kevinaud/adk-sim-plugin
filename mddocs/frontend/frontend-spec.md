---
title: Web UI Feature Specification
type: spec
parent: ../prd.md
related:
  - ../tdd.md
  - ./research/prototype-findings.md
---

# Web UI Feature Specification

**Feature Branch**: `002-web-ui`  
**Created**: January 10, 2026  
**Status**: Draft  
**Input**: User description: "Web UI for ADK Agent Simulator - Extract UX requirements from PRD for the frontend application"

## Related Documents

- [Main PRD](../prd.md) - Overall product requirements
- [Main TDD](../tdd.md) - System technical design
- [Prototype Research](./research/prototype-findings.md) - Architecture patterns from streaming prototype

---

## Clarifications

### Session 2026-01-10

- Q: What should happen when a user navigates to an invalid or expired session ID? → A: Redirect to session list with message stating session could not be found
- Q: How should the UI handle rendering large context windows (100K+ tokens)? → A: Out of scope for this version
- Q: What should happen when the streaming connection to the server is interrupted? → A: Auto-reconnect with visual indicator showing connection state
- Q: How should the UI handle strings that appear to be JSON but fail to parse? → A: Treat as plain text (no JSON toggle) - only show toggle for valid parseable JSON
- Q: What is the maximum nesting depth for dynamically generated tool forms? → A: No limit; render all nesting levels (address if it becomes an issue)

---

## User Stories

### US-1 Session Access and Navigation

**Priority**: P1

A developer wants to join a simulation session to validate their agent's design. They either click a link output by the ADK plugin (containing a session ID) or browse available active sessions from the server.

**Why this priority**: Without session access, no other functionality is usable. This is the entry point to the entire application.

**Independent Test**: Can be fully tested by navigating to a session URL and verifying the simulation interface loads with the correct session context.

#### US-1 Acceptance Scenarios

1. **Given** a developer has a session URL with a session ID, **When** they navigate to that URL, **Then** they see the simulation interface for that specific session
2. **Given** a developer opens the application without a session ID, **When** they view the session list, **Then** they see all active sessions stored on the server with identifying information
3. **Given** a session is selected from the list, **When** the developer clicks on it, **Then** they are navigated to that session's simulation interface

---

### US-2 Context Inspection via Event Stream

**Priority**: P1

A developer needs to understand what information the agent has access to—the conversation history, inputs, and context—to evaluate whether the agent's task is feasible ("LLM UX" assessment).

**Why this priority**: This is the core value proposition—allowing developers to "dogfood" the agent experience by seeing exactly what the LLM would see.

**Independent Test**: Can be fully tested by loading a session with an active request and verifying all context elements (history, system instructions) are rendered in a structured, inspectable format.

#### US-2 Acceptance Scenarios

1. **Given** an LLM request is received for a session, **When** the developer views the Event Stream, **Then** the conversation history (`contents`) is displayed as distinct blocks for User Input, Agent Response, and Tool Execution
2. **Given** a request contains complex JSON data in any field, **When** the developer inspects that data, **Then** it is rendered as a collapsible hierarchical tree with all nodes expanded by default
3. **Given** the request includes system instructions, **When** the developer looks at the Event Stream, **Then** the system instruction is accessible via a collapsible header at the top
4. **Given** a string field contains valid JSON, **When** the developer views that field, **Then** a `[JSON]` toggle is available to parse and render it inline as a Data Tree
5. **Given** a string field contains Markdown content, **When** the developer views that field, **Then** an `[MD]` toggle is available to render it as formatted HTML
6. **Given** any smart blob (JSON or Markdown), **When** the developer wants to see the original content, **Then** a `[RAW]` toggle shows the unprocessed string preserving whitespace and newlines

---

### US-3 Tool Selection and Response Construction

**Priority**: P1

A developer acting as the "human brain" for an agent needs to select tools from the available catalog and construct responses—either by invoking a tool with parameters or providing a final response.

**Why this priority**: This completes the simulation loop. Without response construction, the developer cannot interact with the agent workflow.

**Independent Test**: Can be fully tested by selecting a tool from the catalog, filling out its parameter form, and submitting a response back to the server.

#### US-3 Acceptance Scenarios

1. **Given** an LLM request contains available tools, **When** the developer opens the Control Panel, **Then** they see a Tool Catalog displaying each tool's name, description, and input schema
2. **Given** the developer selects a tool from the catalog, **When** the selection is made, **Then** a dynamic form is generated based on that tool's input schema
3. **Given** the agent has a defined `output_schema`, **When** the developer chooses to submit a final response, **Then** a dynamic form matching that schema is rendered
4. **Given** the agent has no `output_schema` defined, **When** the developer chooses to submit a final response, **Then** a free-form text area is provided
5. **Given** the developer completes a form (tool invocation or final response), **When** they submit, **Then** the response is sent to the server and the interface updates accordingly

---

### US-4 Split-Pane Interface Layout

**Priority**: P2

A developer needs to simultaneously view the agent's context (Event Stream) while constructing their response (Control Panel) without switching between views.

**Why this priority**: Essential for usability during simulation, but technically dependent on Stories 2 and 3 being functional.

**Independent Test**: Can be fully tested by loading a session and verifying both the Event Stream (left/center) and Control Panel (right sidebar) are visible and functional simultaneously.

#### US-4 Acceptance Scenarios

1. **Given** the developer is on the simulation interface, **When** the page loads, **Then** the layout displays a split-pane with Event Stream on left/center and Control Panel on right sidebar
2. **Given** the split-pane layout is rendered, **When** the developer interacts with either pane, **Then** both panes remain visible and functional

---

## Edge Cases

- **Invalid/Expired Session**: When a session ID does not exist or has expired, the system redirects to the session list with a message stating the session could not be found
- ~~Large context windows~~ *(Deferred: out of scope for this version)*
- **Nested Tool Schemas**: No limit on nesting depth; render all levels (may revisit if performance issues arise)
- **Queued Requests (Parallel Agents)**: When multiple requests are queued, the UI presents them sequentially (FIFO); the current request is displayed while others wait in queue
- **Connection Interruption**: When the streaming connection is interrupted, system auto-reconnects with a visual indicator showing connection state (connecting, connected, disconnected)

---

## Functional Requirements

### FR Session Management

- **FR-001**: System MUST allow joining a session via a specific session ID provided in the URL path (e.g., `/session/<uuid>`)
- **FR-002**: System MUST display a browsable list of all active sessions stored on the server when no session ID is provided
- **FR-003**: Session list MUST display identifying information for each session (session ID, creation time, status)
- **FR-004**: When a session ID is invalid or expired, system MUST redirect to the session list and display a message indicating the session could not be found

### FR Layout and Navigation

- **FR-005**: Simulation interface MUST use a split-pane layout with Event Stream on left/center and Control Panel on right sidebar
- **FR-006**: System MUST render the state of the current request only (stateless visualization)

### FR Context Inspection

- **FR-007**: Conversation history (`contents`) MUST be rendered as a structured stream of distinct blocks (User Input, Agent Response, Tool Execution)
- **FR-008**: Complex data structures (JSON objects, tool arguments, tool outputs) MUST be rendered as hierarchical trees with collapsible nodes
- **FR-009**: All tree nodes MUST be expanded by default to minimize interaction required
- **FR-010**: Tree visualization MUST include thread lines connecting parent nodes to children for visual clarity
- **FR-011**: Data trees MUST use monospace fonts with syntax coloring for keys and values
- **FR-012**: String fields detected as valid JSON MUST display a truncated preview with a `[JSON]` toggle that parses and renders inline as a Data Tree
- **FR-013**: String fields detected as Markdown MUST display a truncated preview with an `[MD]` toggle that renders as formatted HTML
- **FR-014**: All smart blobs MUST provide a `[RAW]` toggle to view unprocessed string content preserving whitespace and newlines
- **FR-015**: System instruction from the request config MUST be accessible via a collapsible header/accordion at the top of the Event Stream

### FR Response Construction

- **FR-016**: When displaying tools, system MUST show a Catalog View with Tool Name, Description, and Input Schema (collapsible)
- **FR-017**: Upon tool selection, system MUST generate a dynamic form based on the tool's input schema
- **FR-018**: When an `output_schema` is defined, the Final Response interface MUST render a dynamic form matching that schema
- **FR-019**: When no `output_schema` is present, the Final Response interface MUST provide a text area for free-form response

### FR Communication

- **FR-020**: System MUST communicate with the server via gRPC-Web (via Envoy proxy) or JSON/HTTP bridge
- **FR-021**: System MUST support real-time bidirectional streaming for exchange of requests and responses
- **FR-022**: System MUST automatically attempt to reconnect when the streaming connection is interrupted
- **FR-023**: System MUST display a visual indicator showing connection state (connecting, connected, disconnected)
- **FR-024**: System MUST present queued requests sequentially (FIFO) when multiple agents trigger requests simultaneously

---

## Key Entities

### Session Entity

A simulation session containing metadata (ID, creation time, status) and representing a connection between the ADK plugin and the web UI.

### LlmRequest Entity

The request data from the ADK plugin containing:
- `contents` - conversation history
- `system_instruction` - system prompt
- `tools` - available tool definitions
- `output_schema` - optional schema for structured output

### EventBlock Entity

A discrete unit in the Event Stream representing one of:
- User Input
- Agent Response
- Tool Execution

### Tool Entity

A callable capability available to the agent, with:
- name
- description
- input schema (JSON Schema)

### SmartBlob Entity

A string field that can be rendered in multiple formats:
- JSON tree (parsed and visualized)
- Markdown HTML (rendered)
- Raw text (preserving whitespace)

---

## Success Criteria

- **SC-001**: Developers can access any active session within 3 seconds of clicking a session link
- **SC-002**: Context inspection allows developers to understand agent context without scrolling through more than 2 screens of unexpanded content
- **SC-003**: Developers can identify the purpose and parameters of any tool within 10 seconds using the Tool Catalog
- **SC-004**: 90% of developers can successfully construct and submit a tool invocation response on their first attempt
- **SC-005**: All form validations prevent invalid submissions, reducing server-side errors to near zero
- **SC-006**: Developers report the interface accurately represents what an LLM would "see" in at least 95% of use cases

---

## Assumptions

- The backend server (covered in spec 001) is operational and provides the gRPC/gRPC-Web endpoints
- The Envoy proxy is configured correctly for gRPC-Web translation
- Desktop browsers are the primary target (mobile support is out of scope for MVP)
- Users have modern browser capabilities (ES2020+, WebSocket support)
- Session persistence is handled by the server; the UI is stateless per the PRD

---

## Constraints

- **Text Only**: No support for multimodal inputs (images, audio, video) in MVP
- **No Raw JSON Editing**: Users must use generated forms to validate the UX of tool schemas
- **Desktop First**: Mobile responsive design is out of scope
- **No Local History**: UI does not maintain its own local history; the incoming `LlmRequest` is authoritative
