# Product Requirements Document: ADK Agent Simulator (v3.0)

**Version:** 3.0
**Date:** January 2, 2026
**Status:** Approved
**Project Name:** `adk-agent-sim`

## 1. Overview

### 1.1 Problem Statement
Developers often overestimate the cognitive capabilities of LLMs. They design agents with ambiguous contexts, "literally impossible" instructions, and overly complex tool interfaces (e.g., 2000-line generated API schemas), resulting in poor agent performance.

The root cause of most agent failures is poor **"LLM UX"**—the quality of the interface and task definition provided to the model. Developers lack a feedback loop to realize when they have assigned an agent a task that is cognitively unmanageable.

### 1.2 Product Vision
The **ADK Agent Simulator** is a **Design Verification Tool** that forces developers to "dogfood" the agent experience.

By substituting the LLM with a human developer via a "Remote Brain" protocol, the tool validates the feasibility of a workflow. It answers the question: *"Given this specific context and this set of tools, can a reasonably intelligent entity figure out what to do?"*

This drives a design methodology where complex, impossible tasks are identified early, broken down into sub-agents, and validated layer-by-layer—ensuring that tools are usable and contexts are digestible before a real model is ever blamed for failure.

## 2. Key User Scenarios

### 2.1 The "Impossible Task" Test (Feasibility Check)
**As a Developer**, I want to step into the role of a leaf-node agent to see if its task is actually doable.
*   **Context:** I have an agent with raw API docs and a complex schema.
*   **Action:** I run the simulator targeting this agent.
*   **Outcome:** I am presented with the massive context window via the Web UI. Using the DevTools-style inspector, I analyze the history and available tools. I realize the tool parameters are ambiguous.
*   **Result:** I recognize the "LLM UX" is bad. I refactor the tools to be more distinct before trying to prompt-engineer the model.

### 2.2 The Sub-Agent Verification
**As a Developer**, I want to verify that my refactored sub-agents have manageable scopes.
*   **Context:** I have broken the previous large agent into smaller, specialized agents.
*   **Action:** I run the simulator targeting a specific sub-agent.
*   **Outcome:** The context is focused. I select a tool from the Tool Catalog, fill out the form, and submit.
*   **Result:** The sub-agent design is validated as "human-solvable."

### 2.3 The Orchestrator Design Test (Hybrid Simulation)
**As a Developer**, I want to act as the Orchestrator Agent while allowing sub-agents to use real LLMs, so I can verify coordination logic.
*   **Context:** My sub-agents are validated. I want to see if the high-level router provides them with the right info.
*   **Action:** I configure the simulator to **only intercept** the Orchestrator Agent.
*   **Outcome:**
    1.  I (as Orchestrator) see a user query.
    2.  I decide to call the "Billing Sub-Agent."
    3.  The **Real LLM** powers the Billing Sub-Agent and returns a result.
    4.  Control returns to me (Orchestrator) with that result displayed in the history.
*   **Result:** I confirm that the Orchestrator's "User Experience" is good—the sub-agents return useful data, and I can formulate the final answer.

## 3. Functional Requirements

### 3.1 The Simulator Server (Backend)
*   **FR-01 (Persistent Session Management):** The server MUST persist session metadata and state to durable storage (e.g., SQLite/File). If the server restarts, it MUST recognize existing Session IDs and allow plugins/clients to reconnect.
*   **FR-02 (Event Streaming):** The server MUST support bidirectional streaming to allow real-time exchange of requests and responses.
*   **FR-03 (Sequential Queueing):** The server MUST queue incoming LLM requests for a session. If multiple agents (e.g., parallel agents) trigger requests simultaneously, they MUST be presented to the user sequentially (FIFO) to maintain cognitive focus.

### 3.2 The ADK Plugin (Client)
*   **FR-04 (Conditional Interception):** The plugin MUST be configurable to intercept **all** agents OR a specific **subset** of agents (by name).
    *   If an agent is *not* in the target list, the plugin MUST allow the request to proceed to the real LLM.
*   **FR-05 (Context Serialization):** The plugin MUST extract the `LlmRequest` data—specifically `contents` (history/inputs), `system_instruction` (from config), `tools`, and `output_schema`—and transmit them to the server.
*   **FR-06 (Handshake):** Upon initialization, the plugin MUST register a new session (or reconnect to an existing one) and output a clickable URL to `stdout` (e.g., `http://localhost:4200/session/<uuid>`).

### 3.3 The Web UI (Frontend)

#### 3.3.1 General Layout & Navigation
*   **FR-07 (Session Landing):** The UI MUST allow joining a session via a specific ID (URL param) or browsing a list of active sessions stored on the server.
*   **FR-08 (Split Layout):** The Simulation Interface MUST use a split-pane layout:
    *   **Left/Center:** The "Event Stream" (Context Inspection).
    *   **Right Sidebar:** The "Control Panel" (Tool Selection & Response Input).
*   **FR-09 (Stateless Visualization):** The UI MUST render the state of the *current request* only. It does not need to maintain its own local history, as the incoming `LlmRequest` contains the authoritative conversation history.

#### 3.3.2 Context Inspection (The "Brain" View)
*   **FR-10 (Structured Event Stream):** The history contained in the request (`contents`) MUST be rendered as a structured stream of distinct blocks (User Input, Agent Response, Tool Execution), not a conversational chat bubble interface.
*   **FR-11 (DevTools-Style Data Tree):** Complex data structures (JSON objects, tool arguments, tool outputs) MUST be rendered as a compact, hierarchical tree with collapsible nodes, similar to browser DevTools.
    *   **Defaults:** All nodes MUST be expanded by default to minimize clicking ("Accordion Fatigue").
    *   **Guidelines:** Thread lines MUST connect parent nodes to children for visual clarity.
    *   **Typography:** Monospace fonts with syntax coloring for keys and values.
*   **FR-12 (Smart Blob Detection - JSON):** String fields detected as valid JSON MUST display a truncated preview with a `[JSON]` toggle. Clicking it parses and renders the string inline as a Data Tree.
*   **FR-13 (Smart Blob Detection - Markdown):** String fields detected as Markdown MUST display a truncated preview with an `[MD]` toggle. Clicking it renders the string as formatted HTML.
*   **FR-14 (Raw Toggle):** All smart blobs MUST provide a `[RAW]` toggle to view the unprocessed string content (preserving whitespace/newlines).
*   **FR-15 (System Instructions):** The `system_instruction` extracted from the request config MUST be accessible via a collapsible header/accordion at the top of the Event Stream.

#### 3.3.3 Response Construction (The Control Panel)
*   **FR-16 (Tool Catalog View):** When selecting a tool, the UI MUST display a **Catalog View** (not a simple dropdown). This view MUST show:
    *   Tool Name
    *   Description
    *   Input Schema (Collapsible)
*   **FR-17 (Dynamic Forms):** Upon selecting a tool, the UI MUST generate a form based on the tool's input schema.
*   **FR-18 (Structured Output Forms):** If the agent has an `output_schema` defined, the "Final Response" interface MUST render a dynamic form matching that schema to enforce the structure.
*   **FR-19 (Free Text Output):** If no `output_schema` is present, the "Final Response" interface MUST provide a text area for the response.

## 4. Technical Constraints & Architecture

*   **Architecture:** gRPC-based "Remote Brain" protocol.
*   **Component Communication:**
    *   Plugin -> Server: gRPC (HTTP/2).
    *   Web UI -> Server: gRPC-Web (via Envoy proxy) or JSON/HTTP bridge.
*   **Deployment:** `docker-compose` for the Server, Envoy, and Web UI.
*   **Storage:** The Server MUST use a file-based database (e.g., SQLite) mounted via Docker Volume to ensure session persistence across container restarts.
*   **Configuration:**
    *   Server URL: Configurable via Env Var / Constructor.
    *   Target Agents: Configurable via Env Var / Constructor (e.g., `ADK_SIM_TARGETS="orchestrator,router"`).

## 5. Out of Scope (MVP)

*   **Multimodal Inputs:** Support for Images/Audio/Video in the UI (Text only for MVP).
*   **Golden Trace Export:** Evaluation artifacts are handled by separate plugins.
*   **Raw JSON Editing:** Users must use the generated forms (to validate the "UX" of the schema).
*   **Mobile Support:** Desktop-first design.

## 6. Future Improvements

*   **Visualizing Parallelism:** UI support for seeing the backlog of queued requests from parallel agents.
*   **Multimodal Rendering:** Rendering PDF/Image assets sent to the agent.
*   **Read-Only History:** Browsing past turns in the UI even after the request is processed.
*   **Raw JSON Mode:** "Escape hatch" for advanced users to craft edge-case payloads.