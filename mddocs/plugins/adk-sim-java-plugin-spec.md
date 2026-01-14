# Java Plugin Public Interface Specification

**Component:** `adk-agent-sim` Java Plugin
**Version:** 1.0
**Status:** Approved

## 1. Overview

The `SimulatorPlugin` is the client-side integration point for the ADK Agent Simulator in Java environments. It extends the standard `com.google.adk.plugins.BasePlugin` abstract class.

Developers add this plugin to their ADK application `Runner` to enable the "Remote Brain" protocol, allowing a human to intercept and provide responses for LLM requests via the Simulator Web UI.

## 2. Integration Pattern

The plugin is designed to be added to the `Runner` via the builder configuration. It requires no changes to the Agent definitions or business logic.

```java
import com.google.adk.models.LlmAgent;
import com.google.adk.runners.InMemoryRunner;
import com.google.adk.runners.Runner;
import com.google.adk.plugins.simulator.SimulatorPlugin;
import java.util.List;

// 1. Define agents (Leaf -> Root)
LlmAgent researcher = LlmAgent.builder()
    .name("research_agent")
    .model("gemini-1.5-flash")
    .build();

LlmAgent router = LlmAgent.builder()
    .name("router_agent")
    .model("gemini-1.5-pro")
    .tools(researcher)
    .build();

LlmAgent orchestrator = LlmAgent.builder()
    .name("orchestrator")
    .model("gemini-1.5-pro")
    .tools(router)
    .build();

public static void main(String[] args) {
    Runner runner = InMemoryRunner.builder()
        .agent(orchestrator)
        .appName("my_agent_app")
        // Register the simulator plugin
        .addPlugin(
            SimulatorPlugin.builder()
                // Use .name() accessor for refactoring safety
                .targetAgents(List.of(orchestrator.name(), router.name()))
                .sessionDescription("Debugging the payment flow")
                .build()
        )
        .build();

    // ... Run logic ...
}
```

## 3. Configuration API

The `SimulatorPlugin` utilizes the Builder pattern for configuration to control connection settings and interception scope.

### Builder Methods

```java
public class SimulatorPlugin extends BasePlugin {
    public static Builder builder();

    public static class Builder {
        public Builder serverUrl(String url);
        public Builder targetAgents(List<String> agentNames);
        public Builder sessionDescription(String description);
        public SimulatorPlugin build();
    }
}
```

### Parameters

| Method | Argument Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `serverUrl` | `String` | `null` | The gRPC endpoint of the Simulator Server.<br><br>If `null` (not called), it falls back to the `ADK_SIM_SERVER_URL` environment variable.<br>If that is unset, it defaults to `localhost:50051`. |
| `targetAgents` | `List<String>` | `null` | A list of Agent **names** to intercept.<br><br>If `null` or empty, **ALL** LLM-powered agents in the application are intercepted.<br>If populated, only agents matching these names are intercepted; others proceed to call the real LLM. |
| `sessionDescription` | `String` | `null` | A human-readable label for this run (e.g., "Fixing Bug #123"). This text is displayed in the Web UI's Session List to help developers identify specific test runs. |

## 4. Environment Variables

Configuration can also be supplied via environment variables. Builder methods take precedence over environment variables.

| Variable | Description | Example |
| :--- | :--- | :--- |
| `ADK_SIM_SERVER_URL` | The gRPC endpoint of the server. | `host.docker.internal:50051` |
| `ADK_SIM_TARGET_AGENTS` | Comma-separated list of agent names to intercept. | `router,researcher` |

## 5. Runtime Behavior

### 5.1 Startup Output
When the `Runner` initializes and the plugin starts (specifically on the `beforeRunCallback`), it MUST print the session connection URL to standard output (`System.out`) immediately.

```text
================================================================
[ADK Simulator] Session Started
View and Control at: http://localhost:4200/session/550e8400-e29b-41d4-a716-446655440000
================================================================
```

### 5.2 Blocking Execution
When an intercepted agent reaches the `beforeModelCallback` hook:
1.  The application execution **PAUSES** (the RxJava chain suspends).
2.  No timeout is enforced by the plugin. The app will wait indefinitely for the Simulator Server to return a response.
3.  Standard logging (SLF4J/System.out) will indicate the pause: `[ADK Simulator] Waiting for human input for agent: 'orchestrator'...`

### 5.3 Agent Scoping Rules
The plugin determines whether to intercept a request based on the `agent.name()` property available in the callback context.

*   **Rule 1:** If `targetAgents` is configured as empty/null, **intercept**.
*   **Rule 2:** If `targetAgents` contains `"foo"` and the current agent name is `"foo"`, **intercept**.
*   **Rule 3:** If `targetAgents` contains `"foo"` and the current agent name is `"bar"`, **do not intercept** (execute real LLM call).

## 6. Example Configurations

### Scenario A: Local Debugging (Intercept Everything)
```java
.addPlugin(SimulatorPlugin.builder().build())
```
*   Connects to `localhost:50051`.
*   Intercepts every agent call.

### Scenario B: Hybrid Simulation (Orchestrator Only)
```java
.addPlugin(
    SimulatorPlugin.builder()
        .targetAgents(List.of("orchestrator_agent"))
        .build()
)
```
*   The `orchestrator_agent` pauses for human input.
*   Sub-agents called by the orchestrator run automatically using the real LLM.

### Scenario C: Docker Compose Environment
```java
// In docker-compose.yaml, ADK app service:
// environment:
//   - ADK_SIM_SERVER_URL=simulator-backend:50051

.addPlugin(SimulatorPlugin.builder().build())
```
*   Automatically picks up the env var to connect to the backend container.
