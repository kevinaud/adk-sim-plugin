# Quickstart: ADK Agent Simulator

**Feature**: 001-server-plugin-core  
**Created**: January 3, 2026

## Overview

The ADK Agent Simulator enables human-in-the-loop validation of agent workflows by intercepting LLM calls and routing them to a web UI for manual decision-making.

## Prerequisites

- Python 3.14+
- uv (Python package manager)
- Docker & Docker Compose (for server deployment)
- An ADK application with agents

## Installation

```bash
# Install the simulator plugin in your ADK project
uv add adk-agent-sim
```

## Quick Start (5 minutes)

### Step 1: Start the Simulator Server

```bash
# Option A: Docker Compose (recommended)
docker-compose up -d

# Option B: Direct execution
uv run adk-sim-server
```

The server starts on `localhost:50051`.

### Step 2: Add the Plugin to Your ADK Application

```python
from google.adk import Agent
from google.adk.runners import InMemoryRunner
from adk_agent_sim.plugin import SimulatorPlugin

# Your existing agent definitions
orchestrator = Agent(name="orchestrator", model="gemini-1.5-pro")

async def main():
    runner = InMemoryRunner(
        agent=orchestrator,
        app_name="my_app",
        plugins=[
            SimulatorPlugin()  # Intercepts ALL agents
        ]
    )
    
    async for response in runner.run("Hello"):
        print(response)
```

### Step 3: Run Your Application

```bash
uv run python your_app.py
```

You'll see output like:

```
================================================================
[ADK Simulator] Session Started
View and Control at: http://localhost:4200/session/550e8400-e29b-41d4-a716-446655440000
================================================================
[ADK Simulator] Waiting for human input for agent: 'orchestrator'...
```

### Step 4: Open the Web UI

Click the URL or open `http://localhost:4200/session/<uuid>` in your browser.

## Configuration Options

### Selective Agent Interception

Only intercept specific agents (hybrid simulation):

```python
SimulatorPlugin(
    target_agents=["orchestrator", "router"]  # Only these pause for input
)
```

Sub-agents not in the list will use the real LLM automatically.

### Custom Server URL

```python
SimulatorPlugin(
    server_url="my-server:50051"
)
```

### Session Description

Label your session for easy identification:

```python
SimulatorPlugin(
    session_description="Testing payment flow bug #123"
)
```

## Environment Variables

All settings can be configured via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `ADK_SIM_SERVER_URL` | gRPC server address | `localhost:50051` |
| `ADK_SIM_TARGET_AGENTS` | Comma-separated agent names | (all agents) |

Example:

```bash
export ADK_SIM_SERVER_URL=simulator-backend:50051
export ADK_SIM_TARGET_AGENTS=orchestrator,router

uv run python your_app.py
```

## Docker Compose Deployment

```yaml
# docker-compose.yaml
services:
  backend:
    image: adk-agent-sim:latest
    ports:
      - "50051:50051"
    volumes:
      - ./data:/app/data  # Persist sessions

  frontend:
    image: adk-agent-sim-ui:latest
    ports:
      - "4200:80"

  envoy:
    image: envoyproxy/envoy:v1.26
    volumes:
      - ./envoy.yaml:/etc/envoy/envoy.yaml
    ports:
      - "8080:8080"
    depends_on:
      - backend
```

## Common Patterns

### Pattern 1: Full Interception (Debug Everything)

```python
SimulatorPlugin()  # No arguments = intercept all
```

Use when: You want to step through every agent decision.

### Pattern 2: Orchestrator-Only (Hybrid)

```python
SimulatorPlugin(target_agents=["orchestrator"])
```

Use when: Sub-agents are validated, you're testing coordination logic.

### Pattern 3: Leaf Node Testing

```python
SimulatorPlugin(target_agents=["billing_agent", "search_agent"])
```

Use when: Testing specific leaf agents in isolation.

## Troubleshooting

### "Connection refused" on startup

The server isn't running. Start it with:

```bash
docker-compose up -d
# or
uv run adk-sim-server
```

### Application hangs indefinitely

This is expected behavior! The plugin waits for human input. Open the Web UI and provide a response.

### Session not found after restart

Sessions persist to SQLite. If you cleared the `./data` directory, previous sessions are lost.

## Next Steps

- **Web UI Guide**: Learn the context inspection and response interface
- **Advanced Configuration**: Custom port mapping, TLS, production deployment
- **API Reference**: Full plugin and server API documentation
