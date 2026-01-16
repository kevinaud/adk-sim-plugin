# ADK Converter Trace Fixtures

This directory contains real API traces from ADK agent executions and their converter snapshots. These files document how raw Vertex AI API data is transformed by our converters.

## Files

### Source Data

- **`fomc_trace.vertex.json`** - Raw Vertex AI API request/response JSON captured from running the FOMC Research agent. This is the wire format data that our converters process.

### Generated Snapshots

- **`fomc_trace.vertex.md`** - Summary document with overview statistics and links to individual step files
- **`fomc_trace.vertex/step-XX.md`** - Detailed conversion results for each API call

## Understanding the Snapshots

### Conversion Flow

The snapshots document this conversion chain:

```
Vertex AI JSON (wire format)
       ↓
  vertexRequestToProto()      [fixtures/vertex-to-proto.ts]
       ↓
GenerateContentRequest (proto)
       ↓
  protoToLlmRequest()         [request-converter.ts]
       ↓
   LlmRequest (ADK format)
```

### What Each Step File Shows

Each `step-XX.md` file contains:

1. **Overview** - Model, agent name, status, token counts
2. **LlmRequest.model** - The converted model name (without `models/` prefix)
3. **LlmRequest.contents** - Conversation history in ADK format (`role` + `parts`)
4. **LlmRequest.config.systemInstruction** - System prompt in ADK format
5. **LlmRequest.config.tools** - Tool definitions in ADK format
6. **Response** - Raw Vertex AI response JSON (model output)
7. **Raw Input Data** - Collapsible sections with original request/response JSON

### Key Types

**LlmRequest** (ADK format):
```typescript
interface LlmRequest {
  model: string;              // e.g., "gemini-3-flash-preview"
  contents: Content[];        // Conversation history
  config: {
    systemInstruction?: Content;
    tools?: Tool[];
    safetySettings?: SafetySetting[];
    temperature?: number;
    // ... other generation config
  };
}
```

**Content** (ADK/GenAI format):
```typescript
interface Content {
  role: string;     // "user" | "model" | "function"
  parts: Part[];    // Array of text, functionCall, or functionResponse
}
```

## Regenerating Snapshots

Run the snapshot test to regenerate all files:

```bash
cd packages/adk-converters-ts
npm test -- --run src/vertex-snapshot.spec.ts
```

This will:
1. Load `fomc_trace.vertex.json`
2. Convert each step through the converter chain
3. Write `fomc_trace.vertex.md` and `fomc_trace.vertex/*.md`

## Use Cases

- **Debugging converters** - See exactly what input produces what output
- **Regression testing** - Compare snapshots before/after converter changes
- **Documentation** - Understand the data flow through the system
- **Development reference** - Real examples of LlmRequest structure for complex multi-agent scenarios
