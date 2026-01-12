# @adk-sim/converters

Conversion utilities between ADK SDK types and Simulator proto types.

## Installation

```bash
npm install @adk-sim/converters
```

## Usage

```typescript
import { protoToLlmRequest, llmResponseToProto } from '@adk-sim/converters';

// Convert incoming proto request to LlmRequest format for display
const request = protoToLlmRequest(protoMessage);

// Convert LlmResponse to proto format for submission
const { proto, warnings } = llmResponseToProto(response);
```

## Purpose

This package provides the **inverse** conversion operations compared to the Python plugin:

| Python Plugin | Frontend (this package) |
|---------------|------------------------|
| `LlmRequest → Proto` | `Proto → LlmRequest` |
| `Proto → LlmResponse` | `LlmResponse → Proto` |

The Python plugin converts *outgoing* requests and *incoming* responses.
The frontend needs to *display* incoming requests and *submit* responses.

## Status

⚠️ **Scaffold only** - Full conversion logic is not yet implemented.
