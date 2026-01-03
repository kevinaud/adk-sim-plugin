# Python Plugin Public Interface Specification

**Component:** `adk-agent-sim` Python Plugin  
**Version:** 1.1  
**Status:** Approved  

## 1. Overview

The `SimulatorPlugin` is the client-side integration point for the ADK Agent Simulator. It adheres to the standard `google.adk.plugins.BasePlugin` interface.

Developers add this plugin to their ADK application to enable the "Remote Brain" protocol, allowing a human to intercept and provide responses for LLM requests via the Simulator Web UI.

## 2. Integration Pattern

The plugin is designed to be added to the `Runner` configuration. It requires no changes to the Agent definitions or business logic.

```python
from google.adk import Agent
from google.adk.runners import InMemoryRunner
from adk_agent_sim.plugin import SimulatorPlugin

# 1. Define agents (Leaf -> Root)
researcher = Agent(name="research_agent", model="gemini-1.5-flash")
router = Agent(name="router_agent", model="gemini-1.5-pro", tools=[researcher])
orchestrator = Agent(name="orchestrator", model="gemini-1.5-pro", tools=[router])

async def main():
    runner = InMemoryRunner(
        agent=orchestrator,
        app_name="my_agent_app",
        plugins=[
            # Register the simulator
            SimulatorPlugin(
                # Use .name property for refactoring safety
                target_agents=[orchestrator.name, router.name],
                session_description="Debugging the payment flow"
            )
        ]
    )
    
    # ... Run logic ...
```

## 3. Configuration API

The `SimulatorPlugin` class accepts configuration via its constructor to control connection settings and interception scope.

### `__init__` Signature

```python
class SimulatorPlugin(BasePlugin):
    def __init__(
        self, 
        server_url: Optional[str] = None,
        target_agents: Optional[List[str]] = None,
        session_description: Optional[str] = None
    )
```

### Parameters

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `server_url` | `str` | `None` | The gRPC endpoint of the Simulator Server.<br><br>If `None`, it falls back to the `ADK_SIM_SERVER_URL` environment variable.<br>If that is unset, it defaults to `localhost:50051`. |
| `target_agents` | `List[str]` | `None` | A list of Agent **names** to intercept.<br><br>If `None` (or empty list), **ALL** LLM-powered agents in the application are intercepted.<br>If populated, only agents matching these names are intercepted; others proceed to call the real LLM. |
| `session_description` | `str` | `None` | A human-readable label for this run (e.g., "Fixing Bug #123"). This text is displayed in the Web UI's Session List to help developers identify specific test runs. |

## 4. Environment Variables

Configuration can also be supplied via environment variables. Constructor arguments take precedence over environment variables.

| Variable | Description | Example |
| :--- | :--- | :--- |
| `ADK_SIM_SERVER_URL` | The gRPC endpoint of the server. | `host.docker.internal:50051` |
| `ADK_SIM_TARGET_AGENTS` | Comma-separated list of agent names to intercept. | `router,researcher` |

## 5. Runtime Behavior

### 5.1 Startup Output
When the `Runner` initializes and the plugin starts, it MUST print the session connection URL to standard output (`stdout`) immediately.

```text
================================================================
[ADK Simulator] Session Started
View and Control at: http://localhost:4200/session/550e8400-e29b-41d4-a716-446655440000
================================================================
```

### 5.2 Blocking Execution
When an intercepted agent reaches the `before_model_callback` hook:
1.  The application execution **PAUSES**.
2.  No timeout is enforced by the plugin. The app will wait indefinitely for the Simulator Server to return a response (driven by the human via Web UI).
3.  Standard logging will indicate the pause: `[ADK Simulator] Waiting for human input for agent: 'orchestrator'...`

### 5.3 Agent Scoping Rules
The plugin determines whether to intercept a request based on the `agent.name` property available in the callback context.

*   **Rule 1:** If `target_agents` is `None` or empty, **intercept**.
*   **Rule 2:** If `target_agents` contains `"foo"` and the current agent name is `"foo"`, **intercept**.
*   **Rule 3:** If `target_agents` contains `"foo"` and the current agent name is `"bar"`, **do not intercept** (execute real LLM call).

## 6. Example Configurations

### Scenario A: Local Debugging (Intercept Everything)
```python
SimulatorPlugin()
```
*   Connects to `localhost:50051`.
*   Intercepts every agent call.

### Scenario B: Hybrid Simulation (Orchestrator Only)
```python
SimulatorPlugin(
    target_agents=["orchestrator_agent"]
)
```
*   The `orchestrator_agent` pauses for human input.
*   Sub-agents (e.g., `research_agent`) called by the orchestrator run automatically using the real LLM.

### Scenario C: Docker Compose Environment
```python
# In docker-compose.yaml, ADK app service:
# environment:
#   - ADK_SIM_SERVER_URL=simulator-backend:50051

SimulatorPlugin() 
```
*   Automatically picks up the env var to connect to the backend container.