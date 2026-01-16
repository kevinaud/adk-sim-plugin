/**
 * Vertex AI Debug Trace Converter Snapshot
 *
 * Takes real Vertex AI API traces and runs them through our converters,
 * documenting what each conversion produces. This creates a human-readable
 * record of converter behavior for review and regression tracking.
 *
 * Output structure:
 * - fomc_trace.vertex.md (summary with links to steps)
 * - fomc_trace.vertex/step-01.md, step-02.md, ... (full details per step)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import nunjucks from 'nunjucks';

import {
  extractVertexSteps,
  getVertexTraceMetadata,
  getUniqueTools,
  type VertexDebugTrace,
  type VertexLlmStep,
} from './fixtures/vertex-adapter.js';
import { vertexRequestToProto, vertexResponseToProto } from './fixtures/vertex-to-proto.js';
import { protoToLlmRequest, type LlmRequest } from './request-converter.js';

// ============================================================================
// Test Setup
// ============================================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const tracePath = join(__dirname, 'fixtures', 'traces', 'fomc_trace.vertex.json');
const outputDir = join(__dirname, 'fixtures', 'traces', 'fomc_trace.vertex');
const summaryPath = join(__dirname, 'fixtures', 'traces', 'fomc_trace.vertex.md');

// Configure nunjucks
const env = nunjucks.configure({ autoescape: false });

env.addFilter('json', (obj: unknown) => JSON.stringify(obj, null, 2));
env.addFilter('jsonStrip', (obj: unknown) => JSON.stringify(stripThoughtSignatures(obj), null, 2));
env.addFilter('toLocaleString', (num: number) => num.toLocaleString());
env.addFilter('padStart', (num: number, len: number) => String(num).padStart(len, '0'));

function loadTrace(): VertexDebugTrace {
  const raw = readFileSync(tracePath, 'utf-8');
  return JSON.parse(raw) as VertexDebugTrace;
}

// ============================================================================
// Helper Functions
// ============================================================================

function stripThoughtSignatures<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(stripThoughtSignatures) as T;
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'thought_signature' || key === 'thoughtSignature') continue;
      result[key] = stripThoughtSignatures(value);
    }
    return result as T;
  }
  return obj;
}

interface ConvertedStep {
  step: VertexLlmStep;
  llmRequest: LlmRequest;
  finishReason: string;
  usage: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number } | undefined;
  toolCount: number;
  tools: Array<{ name: string; description?: string }>;
  systemInstructionText: string;
  candidateContent: unknown;
}

function convertStep(step: VertexLlmStep): ConvertedStep {
  const requestProto = vertexRequestToProto(step.request, `models/${step.model}`);
  const llmRequest = protoToLlmRequest(requestProto);

  const candidate = step.response.candidates[0];
  const usage = step.response.usageMetadata;
  const tools = step.request.tools?.flatMap((t) => t.functionDeclarations ?? []) ?? [];

  return {
    step,
    llmRequest,
    finishReason: candidate?.finishReason ?? 'N/A',
    usage,
    toolCount: tools.length,
    tools: tools.map((t) => ({ name: t.name, description: t.description })),
    systemInstructionText: step.request.systemInstruction?.parts[0]?.text ?? '',
    candidateContent: candidate?.content,
  };
}

// ============================================================================
// Templates
// ============================================================================

const SUMMARY_TEMPLATE = `# FOMC Research Agent: Converter Snapshot

> This document shows how our converters transform real Vertex AI API data.
> Each step links to a detailed file showing the full conversion.

## Trace Overview

| Property | Value |
|----------|-------|
| Total API Calls | {{ metadata.totalCalls }} |
| Unique Models | {{ metadata.uniqueModels | join(", ") }} |
| Unique Agents | {{ metadata.uniqueAgents | join(", ") }} |
| Total Prompt Tokens | {{ metadata.totalPromptTokens | toLocaleString }} |
| Total Completion Tokens | {{ metadata.totalCompletionTokens | toLocaleString }} |

## Conversion Flow

\`\`\`
Vertex AI JSON (wire format)
       ↓
  vertexRequestToProto()
       ↓
GenerateContentRequest (proto)
       ↓
  protoToLlmRequest()
       ↓
   LlmRequest (ADK format)
\`\`\`

## API Calls

| # | Agent | Contents | Tools | Tokens | Details |
|---|-------|----------|-------|--------|---------|
{% for s in stepSummaries %}| {{ s.stepNumber }} | {{ s.agentName }} | {{ s.contentCount }} | {{ s.toolCount }} | {{ s.promptTokens }}→{{ s.completionTokens }} | [step-{{ s.stepNumber | padStart(2) }}.md](fomc_trace.vertex/step-{{ s.stepNumber | padStart(2) }}.md) |
{% endfor %}

## Tools Available

{% for tool in tools %}- \`{{ tool }}\`
{% endfor %}
`;

const STEP_TEMPLATE = `# Step {{ converted.step.stepNumber }}: {{ converted.step.agentName }}

[← Back to Summary](../fomc_trace.vertex.md)

## Overview

| Property | Value |
|----------|-------|
| Model | \`{{ converted.step.model }}\` |
| Agent | \`{{ converted.step.agentName }}\` |
| Status | {{ converted.step.statusCode }} |
| Finish Reason | {{ converted.finishReason }} |
{% if converted.usage %}| Tokens | prompt: {{ converted.usage.promptTokenCount }}, completion: {{ converted.usage.candidatesTokenCount }}, total: {{ converted.usage.totalTokenCount }} |
{% endif %}

---

## Conversion Result: LlmRequest

### model

\`\`\`
{{ converted.llmRequest.model }}
\`\`\`

### contents

\`\`\`json
{{ converted.llmRequest.contents | json }}
\`\`\`

{% if converted.llmRequest.config.systemInstruction %}
### config.systemInstruction

\`\`\`json
{{ converted.llmRequest.config.systemInstruction | json }}
\`\`\`

{% endif %}
{% if converted.llmRequest.config.tools %}
### config.tools

\`\`\`json
{{ converted.llmRequest.config.tools | json }}
\`\`\`

{% endif %}

---

## Response (Raw Vertex JSON)

\`\`\`json
{{ converted.candidateContent | jsonStrip }}
\`\`\`

---

## Raw Input Data

<details>
<summary>Full Raw Request JSON</summary>

\`\`\`json
{{ converted.step.request | jsonStrip }}
\`\`\`

</details>

<details>
<summary>Full Raw Response JSON</summary>

\`\`\`json
{{ converted.step.response | jsonStrip }}
\`\`\`

</details>
`;

// ============================================================================
// Document Generation
// ============================================================================

function generateStepFile(converted: ConvertedStep): string {
  return env.renderString(STEP_TEMPLATE, { converted });
}

function generateSummaryFile(
  metadata: ReturnType<typeof getVertexTraceMetadata>,
  stepSummaries: Array<{
    stepNumber: number;
    agentName: string;
    contentCount: number;
    toolCount: number;
    promptTokens: number;
    completionTokens: number;
  }>,
  tools: string[],
): string {
  return env.renderString(SUMMARY_TEMPLATE, { metadata, stepSummaries, tools });
}

function generateAllFiles(trace: VertexDebugTrace): { summarySize: number; stepCount: number } {
  const metadata = getVertexTraceMetadata(trace);
  const steps = extractVertexSteps(trace);
  const tools = getUniqueTools(trace);

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Convert all steps
  const convertedSteps = steps.map(convertStep);

  // Write individual step files (ensure exactly one trailing newline)
  convertedSteps.forEach((converted) => {
    const stepNum = String(converted.step.stepNumber).padStart(2, '0');
    const stepPath = join(outputDir, `step-${stepNum}.md`);
    const content = generateStepFile(converted).trimEnd() + '\n';
    writeFileSync(stepPath, content, 'utf-8');
  });

  // Build summaries for main file
  const stepSummaries = convertedSteps.map((c) => ({
    stepNumber: c.step.stepNumber,
    agentName: c.step.agentName,
    contentCount: c.llmRequest.contents.length,
    toolCount: c.toolCount,
    promptTokens: c.usage?.promptTokenCount ?? 0,
    completionTokens: c.usage?.candidatesTokenCount ?? 0,
  }));

  // Write summary file (ensure exactly one trailing newline)
  const summary = generateSummaryFile(metadata, stepSummaries, tools).trimEnd() + '\n';
  writeFileSync(summaryPath, summary, 'utf-8');

  return { summarySize: summary.length, stepCount: steps.length };
}

// ============================================================================
// Tests
// ============================================================================

describe('Vertex AI Converter Snapshot', () => {
  const trace = loadTrace();

  it('should load the Vertex debug trace', () => {
    expect(Array.isArray(trace)).toBe(true);
    expect(trace.length).toBeGreaterThan(0);
  });

  it('should convert Vertex JSON to Proto to LlmRequest', () => {
    const steps = extractVertexSteps(trace);
    const firstStep = steps[0];

    const requestProto = vertexRequestToProto(firstStep.request, `models/${firstStep.model}`);
    const llmRequest = protoToLlmRequest(requestProto);

    expect(llmRequest.model).toBe(firstStep.model);
    expect(llmRequest.contents.length).toBe(firstStep.request.contents.length);

    if (firstStep.request.systemInstruction) {
      expect(llmRequest.config.systemInstruction).toBeDefined();
    }

    const expectedToolCount = firstStep.request.tools?.flatMap((t) => t.functionDeclarations ?? []).length ?? 0;
    const actualToolCount = llmRequest.config.tools?.flatMap((t) =>
      'functionDeclarations' in t ? t.functionDeclarations ?? [] : []
    ).length ?? 0;
    expect(actualToolCount).toBe(expectedToolCount);

    console.log(`\nStep 1 conversion:`);
    console.log(`  Model: ${llmRequest.model}`);
    console.log(`  Contents: ${llmRequest.contents.length} message(s)`);
    console.log(`  Tools: ${actualToolCount} function(s)`);
    console.log(`  System Instruction: ${llmRequest.config.systemInstruction ? 'Yes' : 'No'}`);
  });

  it('should generate converter snapshot files', () => {
    const { summarySize, stepCount } = generateAllFiles(trace);

    // Verify summary file
    expect(existsSync(summaryPath)).toBe(true);
    const summary = readFileSync(summaryPath, 'utf-8');
    expect(summary).toContain('# FOMC Research Agent: Converter Snapshot');
    expect(summary).toContain('protoToLlmRequest()');

    // Verify step files exist
    for (let i = 1; i <= stepCount; i++) {
      const stepPath = join(outputDir, `step-${String(i).padStart(2, '0')}.md`);
      expect(existsSync(stepPath)).toBe(true);
    }

    console.log(`\n✅ Generated:`);
    console.log(`   ${summaryPath} (${summarySize} chars)`);
    console.log(`   ${outputDir}/ (${stepCount} step files)`);
  });

  it('should preserve data through conversion chain', () => {
    const steps = extractVertexSteps(trace);

    steps.forEach((step) => {
      const requestProto = vertexRequestToProto(step.request, `models/${step.model}`);
      const llmRequest = protoToLlmRequest(requestProto);

      expect(llmRequest.contents.length).toBe(step.request.contents.length);

      step.request.contents.forEach((content, i) => {
        expect(llmRequest.contents[i].role).toBe(content.role);
      });
    });
  });
});
