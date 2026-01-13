---
title: ADK Simulator - Product Requirements
type: prd
---

# ADK Simulator - Product Requirements Document

## Related Documents

- [Technical Design](tdd.md) - System architecture and implementation approach

## Table of Contents

- [Related Documents](#related-documents)
- [Problem Statement](#problem-statement)
- [Product Vision](#product-vision)
- [Goals](#goals)
- [Non-Goals](#non-goals)
- [User Scenarios](#user-scenarios)
  - [The "Impossible Task" Test (Feasibility Check)](#the-impossible-task-test-feasibility-check)
  - [Sub-Agent Verification](#sub-agent-verification)
  - [Orchestrator Design Test (Hybrid Simulation)](#orchestrator-design-test-hybrid-simulation)
- [Features](#features)
  - [Simulator Server (Backend)](#simulator-server-backend)
    - [Simulator Server Requirements](#simulator-server-requirements)
  - [ADK Plugin (Client)](#adk-plugin-client)
    - [ADK Plugin Requirements](#adk-plugin-requirements)
  - [Web UI (Frontend)](#web-ui-frontend)
    - [General Layout & Navigation Requirements](#general-layout-navigation-requirements)
    - [Context Inspection Requirements](#context-inspection-requirements)
    - [Response Construction Requirements](#response-construction-requirements)
- [Future Improvements](#future-improvements)

## Problem Statement

Developers often overestimate the cognitive capabilities of LLMs. They design agents with ambiguous contexts, "literally impossible" instructions, and overly complex tool interfaces (e.g., 2000-line generated API schemas), resulting in poor agent performance.

The root cause of most agent failures is poor **"LLM UX"**—the quality of the interface and task definition provided to the model. Developers lack a feedback loop to realize when they have assigned an agent a task that is cognitively unmanageable.

## Product Vision

The **ADK Agent Simulator** is a **Design Verification Tool** that forces developers to "dogfood" the agent experience.

By substituting the LLM with a human developer via a "Remote Brain" protocol, the tool validates the feasibility of a workflow. It answers the question: *"Given this specific context and this set of tools, can a reasonably intelligent entity figure out what to do?"*

This drives a design methodology where complex, impossible tasks are identified early, broken down into sub-agents, and validated layer-by-layer—ensuring that tools are usable and contexts are digestible before a real model is ever blamed for failure.

## Goals

1. **Developer Velocity**: Enable rapid iteration on agent behavior
2. **Cost Reduction**: Eliminate LLM API costs during development
3. **Reproducibility**: Create deterministic test scenarios
4. **Observability**: Provide visibility into agent-LLM interactions
5. **Design Validation**: Identify cognitively impossible tasks before blaming the model

## Non-Goals

- Production traffic handling
- Multi-tenant deployment
- LLM response generation (we simulate, not generate)
- Multimodal inputs (images/audio/video) - text only for MVP
- Golden trace export (handled by separate plugins)
- Raw JSON editing (users must use generated forms to validate schema UX)
- Mobile support (desktop-first design)

## User Scenarios

### The "Impossible Task" Test (Feasibility Check)

**As a Developer**, I want to step into the role of a leaf-node agent to see if its task is actually doable.

- **Context:** I have an agent with raw API docs and a complex schema.
- **Action:** I run the simulator targeting this agent.
- **Outcome:** I am presented with the massive context window via the Web UI. Using the DevTools-style inspector, I analyze the history and available tools. I realize the tool parameters are ambiguous.
- **Result:** I recognize the "LLM UX" is bad. I refactor the tools to be more distinct before trying to prompt-engineer the model.

### Sub-Agent Verification

**As a Developer**, I want to verify that my refactored sub-agents have manageable scopes.

- **Context:** I have broken the previous large agent into smaller, specialized agents.
- **Action:** I run the simulator targeting a specific sub-agent.
- **Outcome:** The context is focused. I select a tool from the Tool Catalog, fill out the form, and submit.
- **Result:** The sub-agent design is validated as "human-solvable."

### Orchestrator Design Test (Hybrid Simulation)

**As a Developer**, I want to act as the Orchestrator Agent while allowing sub-agents to use real LLMs, so I can verify coordination logic.

- **Context:** My sub-agents are validated. I want to see if the high-level router provides them with the right info.
- **Action:** I configure the simulator to **only intercept** the Orchestrator Agent.
- **Outcome:**
  1. I (as Orchestrator) see a user query.
  2. I decide to call the "Billing Sub-Agent."
  3. The **Real LLM** powers the Billing Sub-Agent and returns a result.
  4. Control returns to me (Orchestrator) with that result displayed in the history.
- **Result:** I confirm that the Orchestrator's "User Experience" is good—the sub-agents return useful data, and I can formulate the final answer.

## Features

### Simulator Server (Backend)

#### Simulator Server Requirements

- **Persistent Session Management:** The server MUST persist session metadata and state to durable storage. If the server restarts, it MUST recognize existing Session IDs and allow plugins/clients to reconnect.
- **Event Streaming:** The server MUST support bidirectional streaming to allow real-time exchange of requests and responses.
- **Sequential Queueing:** The server MUST queue incoming LLM requests for a session. If multiple agents (e.g., parallel agents) trigger requests simultaneously, they MUST be presented to the user sequentially (FIFO) to maintain cognitive focus.

See [Session Management TDD](tdd.md#session-management) for technical details.

### ADK Plugin (Client)

#### ADK Plugin Requirements

- **Conditional Interception:** The plugin MUST be configurable to intercept **all** agents OR a specific **subset** of agents (by name). If an agent is *not* in the target list, the plugin MUST allow the request to proceed to the real LLM.
- **Context Serialization:** The plugin MUST extract the `LlmRequest` data—specifically `contents` (history/inputs), `system_instruction` (from config), `tools`, and `output_schema`—and transmit them to the server.
- **Handshake:** Upon initialization, the plugin MUST register a new session (or reconnect to an existing one) and output a clickable URL to `stdout` (e.g., `http://localhost:4200/session/<uuid>`).

See [Plugin Integration TDD](tdd.md#plugin-integration) for technical details.

### Web UI (Frontend)

#### General Layout & Navigation Requirements

- **Session Landing:** The UI MUST allow joining a session via a specific ID (URL param) or browsing a list of active sessions stored on the server.
- **Split Layout:** The Simulation Interface MUST use a split-pane layout:
  - **Left/Center:** The "Event Stream" (Context Inspection).
  - **Right Sidebar:** The "Control Panel" (Tool Selection & Response Input).
- **Stateless Visualization:** The UI MUST render the state of the *current request* only. It does not need to maintain its own local history, as the incoming `LlmRequest` contains the authoritative conversation history.

#### Context Inspection Requirements

- **Structured Event Stream:** The history contained in the request (`contents`) MUST be rendered as a structured stream of distinct blocks (User Input, Agent Response, Tool Execution), not a conversational chat bubble interface.
- **DevTools-Style Data Tree:** Complex data structures (JSON objects, tool arguments, tool outputs) MUST be rendered as a compact, hierarchical tree with collapsible nodes, similar to browser DevTools.
  - **Defaults:** All nodes MUST be expanded by default to minimize clicking ("Accordion Fatigue").
  - **Guidelines:** Thread lines MUST connect parent nodes to children for visual clarity.
  - **Typography:** Monospace fonts with syntax coloring for keys and values.
- **Smart Blob Detection - JSON:** String fields detected as valid JSON MUST display a truncated preview with a `[JSON]` toggle. Clicking it parses and renders the string inline as a Data Tree.
- **Smart Blob Detection - Markdown:** String fields detected as Markdown MUST display a truncated preview with an `[MD]` toggle. Clicking it renders the string as formatted HTML.
- **Raw Toggle:** All smart blobs MUST provide a `[RAW]` toggle to view the unprocessed string content (preserving whitespace/newlines).
- **System Instructions:** The `system_instruction` extracted from the request config MUST be accessible via a collapsible header/accordion at the top of the Event Stream.

#### Response Construction Requirements

- **Tool Catalog View:** When selecting a tool, the UI MUST display a **Catalog View** (not a simple dropdown). This view MUST show:
  - Tool Name
  - Description
  - Input Schema (Collapsible)
- **Dynamic Forms:** Upon selecting a tool, the UI MUST generate a form based on the tool's input schema.
- **Structured Output Forms:** If the agent has an `output_schema` defined, the "Final Response" interface MUST render a dynamic form matching that schema to enforce the structure.
- **Free Text Output:** If no `output_schema` is present, the "Final Response" interface MUST provide a text area for the response.

See [Frontend TDD](frontend/frontend-tdd.md) for technical details.

## Future Improvements

- **Visualizing Parallelism:** UI support for seeing the backlog of queued requests from parallel agents.
- **Multimodal Rendering:** Rendering PDF/Image assets sent to the agent.
- **Read-Only History:** Browsing past turns in the UI even after the request is processed.
- **Raw JSON Mode:** "Escape hatch" for advanced users to craft edge-case payloads.
