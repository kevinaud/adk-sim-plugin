---
title: Angular Testing Strategy Analysis
type: research
parent: ../frontend-spec.md
related:
  - ../frontend-spec.md
  - ./prototype-findings.md
  - ./angular-architecture-analysis.md
---

# Angular Testing Strategy Analysis

**Source**: `docs/developers/angular/angular-testing-research.md`  
**Date**: January 11, 2026  
**Purpose**: Define testing strategy for the ADK Simulator Web UI based on Angular v21 best practices.

## Related Documents

- [Frontend Spec](../frontend-spec.md) - Feature specification this research supports
- [Prototype Findings](./prototype-findings.md) - Patterns from streaming prototype
- [Architecture Analysis](./angular-architecture-analysis.md) - Structural design decisions

---

## Overview

The testing research document establishes a modern Angular v21 testing strategy centered on:

1. **Zoneless execution** - Native async/await, no Zone.js patching
2. **Sociable testing** - Test with real dependencies, mock only at system boundaries
3. **MSW network mocking** - High-fidelity API fakes via Mock Service Worker
4. **Component Harnesses** - Abstraction layer for DOM interactions
5. **Visual Regression** - Dockerized Playwright for deterministic screenshots

This analysis examines how these principles impact our frontend design.

---

## Zoneless Testing Implications

### The Paradigm Shift

Angular v21 removes Zone.js. Change detection is now triggered explicitly by:
- Signal updates
- Event listeners
- Async pipe emissions
- Explicit `markForCheck()` calls

**Design Implication**: Our components must use Signals correctly. Any state change that should trigger UI updates must flow through a Signal.

### Synchronization Primitives

| Legacy (Zone.js) | Modern (Zoneless) |
|------------------|-------------------|
| `fakeAsync` + `tick()` | Native `async/await` |
| Auto change detection | Explicit `detectChanges()` |
| `flushEffects()` | `TestBed.tick()` |
| Zone-based stability | `fixture.whenStable()` via `PendingTasks` |

**Design Implication**: The [prototype](./prototype-findings.md#signal-based-state-management) already uses Zoneless Angular 21. Our test patterns must follow suit:

```typescript
// Correct pattern for our tests
it('should update connection status', async () => {
  await component.connect();
  await fixture.whenStable();
  fixture.detectChanges();
  
  expect(screen.getByText('Connected')).toBeVisible();
});
```

### Effect Synchronization

Signal `effect()` runs asynchronously on the microtask queue. Tests must use `TestBed.tick()` after setting signals that drive effects.

**Design Implication**: If we use `effect()` for side effects (e.g., logging, navigation), tests need explicit synchronization:

```typescript
// After setting a signal that triggers an effect
sessionState.setConnectionStatus('error');
TestBed.tick(); // Process effects
fixture.detectChanges();
```

---

## Sociable Testing Philosophy

### The "No-Mock" Imperative

The testing guide strongly advocates **Sociable (Classicist) Testing**:

> "We verify the Unit of Work, not the Unit of Code. A 'Unit' is defined as the Component plus its tree of internal dependencies."

**What we mock** (System Boundaries):
- Network (HTTP requests)
- Browser APIs (localStorage, window.location)
- Time (Date.now)

**What we do NOT mock**:
- Services
- Facades
- Pipes
- Shared components

### Impact on Architecture Design

This philosophy reinforces the [Facade Pattern recommendation](./angular-architecture-analysis.md#critical-improvement-the-facade-pattern). The Facade becomes the natural boundary for tests:

| Mockist (Banned) | Sociable (Required) |
|------------------|---------------------|
| Mock `SessionStateService` | Use real `SessionStateService` |
| Mock `SessionFacade` | Use real `SessionFacade` |
| Spy on internal methods | Assert on DOM state |
| `expect(spy).toHaveBeenCalled()` | `expect(screen.getByText(...)).toBeVisible()` |

**Design Implication**: Our [library structure](./angular-architecture-analysis.md#proposed-library-structure-for-adk-simulator) must ensure:
- Services in `data-access/` are instantiable without TestBed
- UI components in `ui/` receive data via Signal inputs (testable via harnesses)
- Only the `SessionGateway` port (network boundary) gets mocked

### The "Humble Component" Test Pattern

Per the testing guide, components should be "humble" - minimal logic, just binding signals to templates:

```typescript
// Test the system behavior, not implementation
it('should disable submit when form is invalid', async () => {
  await render(ToolInvocationFormComponent, {
    providers: [provideHttpClient()] // Real services!
  });
  
  // Don't spy on form.valid() - assert DOM state
  expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  
  await userEvent.type(screen.getByLabelText(/tool name/i), 'read_file');
  await fixture.whenStable();
  
  expect(screen.getByRole('button', { name: /submit/i })).toBeEnabled();
});
```

---

## MSW Network Mocking Strategy

### High-Fidelity Fakes at the Network Boundary

Mock Service Worker intercepts `fetch`/XHR at the network level, allowing real Angular services to execute their actual HTTP logic.

**Design Implication**: Our `GrpcSessionGateway` (the [Hexagonal adapter](./angular-architecture-analysis.md#abstract-ports-for-infrastructure-testing)) will make real gRPC-Web requests. MSW can intercept these.

### gRPC-Web with MSW

MSW supports intercepting gRPC-Web requests (which are HTTP/2 under the hood). For our Connect-ES client:

```typescript
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  // Intercept gRPC-Web request
  http.post('http://localhost:8080/adksim.v1.SimulatorService/Subscribe', () => {
    // Return encoded protobuf response
    return new HttpResponse(encodedProtoResponse, {
      headers: { 'content-type': 'application/grpc-web+proto' }
    });
  })
);
```

**Challenge**: gRPC-Web streaming requires encoding protobuf messages. This is more complex than REST mocking.

**Alternative**: Use the [Abstract Port pattern](./angular-architecture-analysis.md#abstract-ports-for-infrastructure-testing) with a `MockSessionGateway` for unit tests, reserve MSW for integration/E2E tests.

### Zero-Drift with Protobuf

The testing guide promotes Orval + OpenAPI for "Zero Drift" between API contracts and mocks. For our protobuf-based API:

| REST (Orval) | gRPC (Our Approach) |
|--------------|---------------------|
| OpenAPI spec | `.proto` files |
| Orval generates types + mocks | `buf generate` produces TS types |
| MSW handlers from spec | Manual handlers or `MockSessionGateway` |

**Design Implication**: Our `.proto` files in `protos/adksim/v1/` are the source of truth. Generated TypeScript types from `@bufbuild/protobuf` ensure type safety. Mock handlers should use these same types.

**Proposed Strategy**:

```typescript
// data-access/session/mock-session.gateway.ts
@Injectable()
export class MockSessionGateway extends SessionGateway {
  private readonly events = signal<LlmRequest[]>([]);
  
  async *subscribe(sessionId: string): AsyncIterable<SessionEvent> {
    // Emit mock events for testing
    for (const request of this.events()) {
      yield { event: { case: 'llmRequest', value: request } };
    }
  }
  
  // Test helper to inject events
  pushEvent(request: LlmRequest): void {
    this.events.update(e => [...e, request]);
  }
}
```

---

## Component Harness Strategy

### Why Harnesses Matter

The testing guide emphasizes Component Harnesses (from `@angular/cdk/testing`) for DOM abstraction:

> "If a test selects a button via `button.save`, and the developer changes the class name, the test breaks. If the test uses a harness, the test is resilient."

**Design Implication**: For complex UI components defined in our spec, we should create custom harnesses.

### Harnesses for Spec Components

Per [FR-008 through FR-014](../frontend-spec.md#fr-context-inspection), we need rich UI components. Each should have a harness:

| Component | Harness Methods |
|-----------|-----------------|
| `DataTreeComponent` | `getNodes()`, `expandNode(path)`, `collapseNode(path)`, `getNodeValue(path)` |
| `SmartBlobComponent` | `getRawText()`, `toggleJson()`, `toggleMarkdown()`, `getCurrentMode()` |
| `ToolCatalogComponent` | `getTools()`, `selectTool(name)`, `getSelectedTool()` |
| `DynamicFormComponent` | `fillField(name, value)`, `submit()`, `getErrors()` |
| `EventBlockComponent` | `getBlockType()`, `getContent()`, `expand()`, `collapse()` |

**Example Harness**:

```typescript
// ui/event-stream/smart-blob/smart-blob.harness.ts
import { ComponentHarness } from '@angular/cdk/testing';

export class SmartBlobHarness extends ComponentHarness {
  static hostSelector = 'app-smart-blob';

  private getJsonToggle = this.locatorForOptional('[data-testid="json-toggle"]');
  private getMdToggle = this.locatorForOptional('[data-testid="md-toggle"]');
  private getRawToggle = this.locatorFor('[data-testid="raw-toggle"]');
  private getContent = this.locatorFor('.content');

  async isJsonAvailable(): Promise<boolean> {
    return (await this.getJsonToggle()) !== null;
  }

  async toggleJson(): Promise<void> {
    const toggle = await this.getJsonToggle();
    if (!toggle) throw new Error('JSON toggle not available');
    await toggle.click();
  }

  async getCurrentContent(): Promise<string> {
    return (await this.getContent()).text();
  }
}
```

### Testing with Harnesses

```typescript
it('should toggle between JSON and RAW views (FR-012, FR-014)', async () => {
  const { fixture } = await render(SmartBlobComponent, {
    inputs: { content: '{"key": "value"}' }
  });
  
  const harness = await TestbedHarnessEnvironment
    .loader(fixture)
    .getHarness(SmartBlobHarness);

  // JSON should be detected and toggle available
  expect(await harness.isJsonAvailable()).toBe(true);
  
  // Toggle to JSON view
  await harness.toggleJson();
  expect(await harness.getCurrentContent()).toContain('key');
  
  // Toggle back to RAW
  await harness.toggleRaw();
  expect(await harness.getCurrentContent()).toBe('{"key": "value"}');
});
```

---

## Signal Forms Testing

### New Form Primitive

Angular v21 introduces Signal Forms (`@angular/forms/signals`), replacing Reactive Forms with a Signal-based model.

**Design Implication**: Our [dynamic form generation](../frontend-spec.md#fr-response-construction) (FR-017, FR-018) should use Signal Forms for:
- Tool invocation parameter forms
- Final response forms (when `output_schema` is defined)

### Testing Signal Forms

Per the testing guide, we test forms via DOM interaction, not internal state inspection:

```typescript
// Don't do this
expect(component.form.email.valid()).toBe(false);

// Do this instead
expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
expect(screen.getByText(/required field/i)).toBeVisible();
```

**Design Implication**: Our `DynamicFormComponent` harness should expose:
- `fillField(name, value)` - interact with input
- `getFieldErrors(name)` - read visible error messages
- `isSubmitEnabled()` - check button state
- `submit()` - click submit button

### Schema-to-Form Validation

The testing guide promotes using Zod schemas derived from OpenAPI for form validation. For our protobuf-based API:

| REST + OpenAPI | gRPC + Protobuf |
|----------------|-----------------|
| Zod from OpenAPI | Validation from JSON Schema (tool input schemas) |
| `zodValidator(schema)` | `jsonSchemaValidator(schema)` |

**Design Implication**: Tools in `LlmRequest` have `input_schema` as JSON Schema. We need a utility to convert JSON Schema to Angular validators:

```typescript
// util/schema-utils/json-schema-validator.ts
export function jsonSchemaValidators(schema: JsonSchema): ValidatorFn[] {
  const validators: ValidatorFn[] = [];
  
  if (schema.required) {
    validators.push(Validators.required);
  }
  if (schema.type === 'string' && schema.minLength) {
    validators.push(Validators.minLength(schema.minLength));
  }
  // ... more schema-to-validator mappings
  
  return validators;
}
```

---

## Visual Regression Testing Strategy

### Deterministic VRT via Docker

The testing guide mandates Dockerized Playwright for Visual Regression:

> "All VRT must run in a containerized Linux environment with pinned font binaries."

**Design Implication**: We need VRT for visually complex components:

| Component | VRT Priority | Reason |
|-----------|--------------|--------|
| `DataTreeComponent` | High | Thread lines, syntax coloring (FR-010, FR-011) |
| `SmartBlobComponent` | High | JSON tree vs Markdown vs RAW rendering |
| `EventBlockComponent` | Medium | Block type styling consistency |
| `ConnectionStatusComponent` | Low | Simple, mostly functional |
| `ToolCatalogComponent` | Medium | Schema preview rendering |

### Storybook for VRT

Each UI component should have Storybook stories covering visual states:

```typescript
// ui/event-stream/data-tree/data-tree.stories.ts
import type { Meta, StoryObj } from '@storybook/angular';
import { DataTreeComponent } from './data-tree.component';

const meta: Meta<DataTreeComponent> = {
  component: DataTreeComponent,
  title: 'UI/EventStream/DataTree',
};
export default meta;

export const SimpleObject: StoryObj = {
  args: {
    data: { name: 'John', age: 30 },
    expanded: true,
  },
};

export const NestedObject: StoryObj = {
  args: {
    data: {
      user: { name: 'John', address: { city: 'NYC' } },
      tags: ['admin', 'user'],
    },
    expanded: true,
  },
};

export const CollapsedState: StoryObj = {
  args: {
    data: { name: 'John', nested: { deep: { value: 42 } } },
    expanded: false,
  },
};
```

### Docker VRT Configuration

```dockerfile
# Dockerfile.vrt
FROM mcr.microsoft.com/playwright:v1.49.0-jammy

RUN apt-get update && apt-get install -y \
    fonts-liberation \
    fonts-noto-color-emoji \
    && apt-get clean

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

RUN npm run build-storybook
CMD ["npx", "playwright", "test", "--config=playwright.vrt.config.ts"]
```

---

## Test Layer Mapping

### Aligning Tests with Architecture Layers

| Layer | Test Type | Tools | Mock Strategy |
|-------|-----------|-------|---------------|
| `util/*` | Unit | Vitest (no TestBed) | None - pure functions |
| `data-access/*` | Unit + Integration | Vitest + MSW | Network only (MSW) |
| `ui/*` | Component | Testing Library + Harnesses | None - real rendering |
| `features/*` | Integration | Testing Library + MSW | Network only |
| Visual | VRT | Playwright + Storybook | None |

### Example Test Distribution for `SmartBlob`

```
ui/event-stream/smart-blob/
├── smart-blob.component.ts
├── smart-blob.component.spec.ts    # Component test with harness
├── smart-blob.harness.ts           # DOM abstraction
├── smart-blob.stories.ts           # Storybook for VRT
└── smart-blob.component.scss

util/json-detection/
├── json-detection.service.ts
├── json-detection.service.spec.ts  # Pure unit test (no TestBed)
└── index.ts
```

**SmartBlob Component Test** (Sociable):
```typescript
it('should detect JSON and show toggle', async () => {
  // Uses REAL JsonDetectionService
  const { fixture } = await render(SmartBlobComponent, {
    inputs: { content: '{"valid": "json"}' }
  });
  
  const harness = await loader.getHarness(SmartBlobHarness);
  expect(await harness.isJsonAvailable()).toBe(true);
});
```

**JsonDetectionService Test** (Pure Unit):
```typescript
// No TestBed, no Angular
describe('JsonDetectionService', () => {
  const service = new JsonDetectionService();
  
  it('detects valid JSON', () => {
    expect(service.isJson('{"key": "value"}')).toBe(true);
  });
  
  it('rejects invalid JSON', () => {
    expect(service.isJson('{key: value}')).toBe(false);
  });
});
```

---

## Recommendations Summary

| Category | Recommendation | Impact on Design |
|----------|---------------|------------------|
| Async Handling | Use native `async/await` + `fixture.whenStable()` | All tests follow Zoneless patterns |
| Mocking | Mock only at network boundary (MSW or `MockGateway`) | Facade + Gateway architecture validated |
| Forms | Use Signal Forms + DOM-based testing | `DynamicFormComponent` uses `@angular/forms/signals` |
| Harnesses | Create harnesses for complex UI components | Every `ui/*` component gets a `.harness.ts` |
| VRT | Dockerized Playwright + Storybook | Build VRT pipeline early for visual components |
| Test Structure | Logic in `util/` = no TestBed; UI in `ui/` = harnesses | Reinforces [library taxonomy](./angular-architecture-analysis.md#library-type-taxonomy) |

---

## Open Questions for Technical Design

1. **gRPC-Web Mocking**: Should we use MSW for gRPC-Web interception (complex encoding) or rely on `MockSessionGateway` for unit tests and reserve E2E for real gRPC?

2. **Signal Forms Availability**: Is `@angular/forms/signals` stable in Angular 21, or should we use traditional Reactive Forms with Signal wrappers?

3. **Harness Generation**: Can we auto-generate harnesses from component metadata, or must they be hand-written?

4. **VRT Baseline Management**: How do we handle golden image updates in CI? Git LFS? Artifact storage?

5. **Streaming Test Patterns**: What's the best pattern for testing `AsyncIterable` streams from `SessionGateway.subscribe()`?
