---
title: ADK Simulator - Technical Design
type: tdd
parent: prd.md
---

# ADK Simulator - Technical Design Document

## Related Documents

- [Product Requirements](prd.md) - Goals, user stories, and success metrics
- [Plugin Specification](plugins/adk-sim-python-plugin-spec.md) - Python plugin details

## Table of Contents

- [Related Documents](#related-documents)
- [Overview](#overview)
- [Design Goals](#design-goals)
- [Architecture](#architecture)
- [Components](#components)
  - [Simulator Server](#simulator-server)
    - [Simulator Server Responsibilities](#simulator-server-responsibilities)
  - [Plugin Layer](#plugin-layer)
    - [Plugin Layer Responsibilities](#plugin-layer-responsibilities)
  - [Frontend](#frontend)
    - [Frontend Responsibilities](#frontend-responsibilities)
- [Session Management](#session-management)
  - [Data Model](#data-model)
  - [API Design](#api-design)
- [Conversation Simulation](#conversation-simulation)
  - [Request Flow](#request-flow)
  - [Streaming Support](#streaming-support)
- [Plugin Integration](#plugin-integration)
  - [Python Plugin](#python-plugin)
- [Alternatives Considered](#alternatives-considered)
  - [HTTP Instead of gRPC](#http-instead-of-grpc)
  - [In-Process Simulation](#in-process-simulation)
- [Open Questions](#open-questions)

## Overview

This document describes the technical architecture for the ADK Simulator, addressing the requirements defined in the [PRD](prd.md#product-vision).

## Design Goals

1. **Low Latency**: Minimize overhead on agent execution
2. **Extensibility**: Support multiple agent frameworks via plugins
3. **Simplicity**: Easy to set up and integrate

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Agent Code    │────▶│  Plugin (gRPC)   │────▶│   Simulator     │
│   (ADK/etc)     │◀────│                  │◀────│   Server        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
                                                 ┌─────────────────┐
                                                 │   Frontend UI   │
                                                 │   (Angular)     │
                                                 └─────────────────┘
```

## Components

### Simulator Server

Python-based gRPC server that manages simulation sessions.

#### Simulator Server Responsibilities

- Session lifecycle management
- Conversation state tracking
- Event persistence
- Real-time updates via WebSocket

### Plugin Layer

Framework-specific plugins that intercept LLM calls.

#### Plugin Layer Responsibilities

- Intercept outgoing LLM requests
- Forward to simulator server
- Return simulated responses to agent

### Frontend

Angular-based UI for session management and observation.

#### Frontend Responsibilities

- Session creation and management
- Real-time conversation display
- Response editing interface

## Session Management

Addresses [Simulator Server requirements](prd.md#simulator-server-requirements).

### Data Model

```python
@dataclass
class Session:
    id: str
    created_at: datetime
    status: SessionStatus  # ACTIVE, PAUSED, COMPLETED
    config: SessionConfig

@dataclass
class Event:
    id: str
    session_id: str
    timestamp: datetime
    event_type: EventType  # REQUEST, RESPONSE, TOOL_CALL
    payload: dict
```

### API Design

```protobuf
service SimulatorService {
    rpc CreateSession(CreateSessionRequest) returns (Session);
    rpc GetSession(GetSessionRequest) returns (Session);
    rpc ListSessions(ListSessionsRequest) returns (ListSessionsResponse);
    rpc SendMessage(SendMessageRequest) returns (stream SendMessageResponse);
}
```

## Conversation Simulation

Addresses the streaming and real-time requirements in [Simulator Server requirements](prd.md#simulator-server-requirements).

### Request Flow

1. Agent initiates LLM call
2. Plugin intercepts and forwards to simulator
3. Simulator queues request for human/scripted response
4. Response returned to plugin
5. Plugin returns response to agent

### Streaming Support

For streaming responses, the simulator:
1. Accepts the full response content
2. Chunks it according to configured parameters
3. Streams chunks back with realistic timing

## Plugin Integration

Addresses [ADK Plugin requirements](prd.md#adk-plugin-requirements).

### Python Plugin

See [Python Plugin Specification](plugins/adk-sim-python-plugin-spec.md) for implementation details.

The plugin:
1. Patches the `google.generativeai` client
2. Redirects `generate_content` calls to simulator
3. Handles both sync and async execution

## Alternatives Considered

### HTTP Instead of gRPC

**Rejected**: gRPC provides better streaming support and type safety via protobufs.

### In-Process Simulation

**Rejected**: Requires framework-specific implementations. Server-based approach is more universal.

## Open Questions

1. How do we handle multi-turn conversations with branching?
2. Should we support recording and replaying production conversations?
