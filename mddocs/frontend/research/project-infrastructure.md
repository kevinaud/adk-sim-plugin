---
title: Current Project Infrastructure Analysis
type: research
parent: ../frontend-spec.md
related:
  - ../frontend-spec.md
  - ./prototype-findings.md
  - ./angular-architecture-analysis.md
---

# Current Project Infrastructure Analysis

**Source**: Project codebase exploration  
**Date**: January 11, 2026  
**Purpose**: Document existing frontend infrastructure, server communication patterns, and deployment model.

## Related Documents

- [Frontend Spec](../frontend-spec.md) - Feature specification
- [Prototype Findings](./prototype-findings.md) - Streaming architecture patterns
- [Architecture Analysis](./angular-architecture-analysis.md) - Structural design decisions

---

## Overview

The ADK Simulator frontend exists but is largely a skeleton. The server infrastructure is mature, with gRPC and gRPC-Web already working. Understanding this existing setup is critical for designing the frontend architecture.

---

## Current Frontend State

### Folder Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── app.ts              # Root component (empty shell)
│   │   ├── app.routes.ts       # Empty routes array
│   │   ├── app.config.ts       # Basic config (router only)
│   │   └── generated/          # Protobuf types from @adk-sim/protos
│   │       ├── adksim/v1/      # SimulatorService, SessionEvent, etc.
│   │       └── google/ai/...   # GenerateContentRequest/Response
│   ├── environments/
│   │   ├── environment.ts      # Dev: grpcWebUrl = 'http://localhost:8080'
│   │   └── environment.prod.ts # Prod: grpcWebUrl = '' (same origin)
│   └── main.ts
├── angular.json
└── package.json
```

### Current Dependencies

Already installed and ready to use:

| Package | Purpose | Status |
|---------|---------|--------|
| `@adk-sim/protos` | Generated protobuf types (workspace link) | ✅ Available |
| `@bufbuild/protobuf` | Protobuf runtime | ✅ Installed |
| `@connectrpc/connect` | Connect RPC client | ✅ Installed |
| `@connectrpc/connect-web` | gRPC-Web transport | ✅ Installed |
| `@angular/material` | UI components | ✅ Installed |
| `@angular/cdk` | Component Dev Kit (harnesses, etc.) | ✅ Installed |
| `vitest` | Test runner | ✅ Installed |

### Generated Protobuf Types

The `generated/` folder contains TypeScript types from `@adk-sim/protos`:

**Service Definition** (`simulator_service_pb.ts`):
```typescript
export const SimulatorService: GenService<{
  createSession: { methodKind: 'unary'; ... };
  subscribe: { methodKind: 'server_streaming'; ... };
  submitRequest: { methodKind: 'unary'; ... };
  submitDecision: { methodKind: 'unary'; ... };
  listSessions: { methodKind: 'unary'; ... };
}>
```

**Key Types**:
- `SubscribeRequest` / `SubscribeResponse` - Streaming subscription
- `SessionEvent` - Wraps `llm_request` or `llm_response` via `oneof payload`
- `GenerateContentRequest` - The actual LLM request (from Google AI protos)
- `GenerateContentResponse` - The LLM response structure

### What Needs to Be Built

The current frontend is an empty shell. **Everything** in the spec needs implementation:

- [ ] Session list view (FR-002, FR-003)
- [ ] Session join via URL (FR-001, FR-004)
- [ ] Split-pane layout (FR-005)
- [ ] Event Stream pane (FR-007 through FR-015)
- [ ] Control Panel pane (FR-016 through FR-019)
- [ ] gRPC-Web service layer (FR-020, FR-021)
- [ ] Auto-reconnect logic (FR-022, FR-023)
- [ ] Request queue handling (FR-024)

---

## Server Communication Architecture

### Two-Server Model

The ADK Simulator runs **two servers** concurrently:

| Server | Port | Protocol | Purpose |
|--------|------|----------|---------|
| gRPC Server | 50051 | Native gRPC (HTTP/2) | ADK Plugin communication |
| Web Server | 8080 | HTTP/1.1 + gRPC-Web | Browser UI communication |

Both servers share the **same `SimulatorService` instance** in-memory, ensuring state consistency.

### gRPC-Web Gateway (No Envoy!)

**Critical Discovery**: The project does **NOT** use Envoy proxy for gRPC-Web translation. Instead, the Python server implements a custom gRPC-Web gateway:

```python
# server/src/adk_sim_server/web.py

async def grpc_web_handler(request: Request) -> Response:
    """Handle gRPC-Web requests by routing to SimulatorService methods."""
    method_name = path_parts[-1]  # e.g., "CreateSession"
    
    # Decode gRPC-Web payload (base64 or binary)
    message_bytes = _decode_grpc_web_payload(body, is_text)
    
    # Parse protobuf and call service method DIRECTLY (no loopback)
    request_message = request_class().parse(message_bytes)
    handler = getattr(service, handler_name)
    response_message = await handler(request_message)
    
    # Encode response as gRPC-Web
    return Response(content=_encode_grpc_web_response(response_message, is_text))
```

**Implications**:
1. **No Envoy configuration needed** - Simplifies deployment
2. **Single process** - gRPC and web server share memory
3. **Unary RPCs only** - The current gateway handles `CreateSession`, `ListSessions`, `SubmitRequest`, `SubmitDecision`
4. **Streaming not yet implemented** - `Subscribe` (server streaming) is NOT in `_METHOD_MAP`

### Supported Methods in Web Gateway

```python
_METHOD_MAP = {
    "CreateSession": (CreateSessionRequest, "create_session"),
    "ListSessions": (ListSessionsRequest, "list_sessions"),
    "SubmitRequest": (SubmitRequestRequest, "submit_request"),
    "SubmitDecision": (SubmitDecisionRequest, "submit_decision"),
}
# NOTE: Subscribe is MISSING - streaming not implemented
```

**Gap Identified**: The `Subscribe` RPC (server streaming) is not yet supported by the web gateway. This is critical for FR-021 (real-time streaming) and must be implemented.

### Frontend Serving (SPA)

The web server serves the Angular frontend as static files:

```python
STATIC_DIR = Path(__file__).parent / "static" / "browser"

async def spa_handler(request: Request) -> Response:
    """Serve static files or fall back to index.html for SPA routing."""
    path = request.path_params.get("path", "")
    
    # Try actual file (main.js, styles.css)
    if path:
        file_path = STATIC_DIR / path
        if file_path.exists():
            return FileResponse(file_path)
    
    # Fallback to index.html (Angular routing)
    return FileResponse(STATIC_DIR / "index.html")
```

**Key Points**:
- Angular app is bundled into `server/src/adk_sim_server/static/browser/`
- All unknown paths serve `index.html` (SPA routing)
- gRPC-Web requests to `/adksim.v1.SimulatorService/*` are intercepted first

---

## Environment Configuration

### Development Mode

```typescript
// environment.ts
export const ENVIRONMENT = {
  production: false,
  grpcWebUrl: 'http://localhost:8080',  // Web server
};
```

In dev, the Angular dev server (`ng serve`) runs separately from the Python server. The frontend makes cross-origin requests to `localhost:8080`.

**CORS is handled** by the web gateway:
```python
headers={
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-grpc-web, x-user-agent",
}
```

### Production Mode

```typescript
// environment.prod.ts
export const ENVIRONMENT = {
  production: true,
  grpcWebUrl: '',  // Same origin - relative paths
};
```

In production, the frontend is bundled into the server package. All requests go to the same origin (port 8080).

---

## Publishing and Bundling

### Build Pipeline (publish.yaml)

```yaml
- name: Bundle frontend into server
  run: |
    cd frontend && CI=TRUE npm run build && cd ..
    rm -rf server/src/adk_sim_server/static/*
    cp -r frontend/dist/frontend/* server/src/adk_sim_server/static/
```

**Process**:
1. Build Angular app (`ng build --configuration production`)
2. Copy output to `server/src/adk_sim_server/static/`
3. Build Python package (includes static files)
4. Publish `adk-sim-server` to PyPI

**Verification**:
```yaml
- name: Verify frontend is bundled and servable
  run: |
    RESPONSE=$(curl -s http://localhost:8080/)
    if echo "$RESPONSE" | grep -q "<app-root>"; then
      echo "✅ Frontend is properly bundled and served"
    fi
```

### Package Structure

When users install `adk-sim-server` from PyPI:

```
adk_sim_server/
├── static/
│   └── browser/
│       ├── index.html
│       ├── main.*.js
│       ├── polyfills.*.js
│       └── styles.*.css
├── web.py          # Serves static + gRPC-Web
├── cli.py          # Entry point (adk-sim command)
└── ...
```

---

## LlmRequest Data Model

Per the spec, the frontend must render `GenerateContentRequest`. Key fields:

### GenerateContentRequest Structure

```protobuf
message GenerateContentRequest {
  string model = 1;                           // e.g., "models/gemini-pro"
  optional Content system_instruction = 8;    // System prompt
  repeated Content contents = 2;              // Conversation history
  repeated Tool tools = 5;                    // Available tools
  optional GenerationConfig generation_config = 4;
}
```

### Content Structure (Conversation History)

```protobuf
message Content {
  repeated Part parts = 1;   // Multi-part message
  string role = 2;           // "user" or "model"
}

message Part {
  oneof data {
    string text = 2;
    FunctionCall function_call = 4;
    FunctionResponse function_response = 5;
    // ... other types (inline_data, file_data, etc.)
  }
}
```

### Tool Structure

```protobuf
message Tool {
  repeated FunctionDeclaration function_declarations = 1;
}

message FunctionDeclaration {
  string name = 1;
  string description = 2;
  Schema parameters = 3;  // JSON Schema for input
}
```

**Mapping to Spec Requirements**:

| Proto Field | Spec Requirement | UI Component |
|-------------|-----------------|--------------|
| `contents` | FR-007: Conversation history | Event Stream blocks |
| `contents[].parts[].text` | FR-012/13/14: SmartBlob | Text with JSON/MD/RAW toggle |
| `contents[].parts[].function_call` | FR-007: Tool Execution block | EventBlock (tool call) |
| `system_instruction` | FR-015: Collapsible header | Accordion at top |
| `tools[].function_declarations` | FR-016: Tool Catalog | Tool list in Control Panel |
| `tools[].function_declarations[].parameters` | FR-017: Dynamic form | Generated form |

---

## Implications for Frontend Design

### 1. gRPC-Web Client Configuration

Use Connect-ES with same-origin in production:

```typescript
const transport = createGrpcWebTransport({
  baseUrl: ENVIRONMENT.grpcWebUrl || window.location.origin,
});
const client = createClient(SimulatorService, transport);
```

### 2. Streaming Implementation Gap

The server's `Subscribe` RPC isn't exposed via gRPC-Web yet. Options:

**Option A**: Extend `web.py` to support server streaming
- Requires chunked transfer encoding
- Complex but keeps single-server model

**Option B**: Use native gRPC with grpc-web proxy (Envoy)
- Proven pattern from prototype
- Requires additional infrastructure

**Option C**: Fallback to polling for MVP
- Simplest but violates FR-021 (real-time)

**Recommendation**: Implement streaming in `web.py` to maintain the elegant single-server model.

### 3. Data Model Alignment

The spec's "EventBlock" maps to `Content` entries:

| Content Role | Part Type | EventBlock Type |
|--------------|-----------|-----------------|
| `user` | `text` | User Input |
| `model` | `text` | Agent Response |
| `model` | `function_call` | Tool Execution (call) |
| `user` | `function_response` | Tool Execution (result) |

### 4. No Envoy in Dev or Prod

Unlike the prototype (which used Envoy), this project has a custom gateway. This affects:
- **Dev setup**: Simpler (just start Python server + Angular dev server)
- **Testing**: Can test against real server easily
- **Deployment**: Single process serves everything

### 5. Type Safety via Generated Protos

The `@adk-sim/protos` package provides TypeScript types. Use them directly:

```typescript
import { 
  SimulatorService,
  SubscribeRequestSchema,
  SessionEvent 
} from '../generated/adksim/v1/simulator_service_pb';
import { GenerateContentRequest } from '../generated/google/ai/.../generative_service_pb';
```

---

## Recommendations Summary

| Category | Finding | Recommendation |
|----------|---------|----------------|
| gRPC-Web | Custom gateway exists, no Envoy | Extend `web.py` for streaming |
| Protos | Types already generated and available | Use `@adk-sim/protos` package directly |
| Environment | Dev/Prod configs ready | No changes needed |
| Bundling | Frontend bundled into Python package | Build process is established |
| State | Empty shell frontend | Start with session list (FR-002) as entry point |
| Streaming | `Subscribe` RPC not in web gateway | Must implement before FR-021 |

---

## Open Questions for Technical Design

1. **Streaming Implementation**: Should we extend `web.py` with chunked transfer encoding for streaming, or introduce Envoy for this single RPC?

2. **Generated Code Location**: Should `generated/` stay in `src/app/` or move to a shared location (`packages/adk-sim-protos-ts`)?

3. **Dev Server Proxy**: Should `ng serve` proxy gRPC-Web requests to avoid CORS, or keep direct cross-origin?

4. **Test Fixtures**: How do we generate realistic `GenerateContentRequest` fixtures for testing? Use actual proto schemas?
