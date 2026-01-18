# Sprint 5: Control Panel and Response Construction


## Table of Contents

- [Sprint Goal](#sprint-goal)
- [Selected Scope](#selected-scope)
  - [Tasks from TDD](#tasks-from-tdd)
- [Research Summary](#research-summary)
  - [Relevant Findings](#relevant-findings)
    - [JSONForms Angular Material Integration](#jsonforms-angular-material-integration)
    - [Schema Conversion Pipeline](#schema-conversion-pipeline)
    - [SimulationStore State Management](#simulationstore-state-management)
    - [Split-Pane Layout Pattern](#split-pane-layout-pattern)
    - [Tool Invocation Flow](#tool-invocation-flow)
    - [Final Response Patterns](#final-response-patterns)
  - [Key Decisions Already Made](#key-decisions-already-made)
  - [Open Questions for This Sprint](#open-questions-for-this-sprint)
- [Pull Request Plan](#pull-request-plan)
  - [S5PR1: Add JSONForms dependencies and module setup](#s5pr1-add-jsonforms-dependencies-and-module-setup)
  - [S5PR2: Add genaiSchemaToJsonSchema converter](#s5pr2-add-genaischematojsonschema-converter)
  - [S5PR3: Create ToolFormService for schema conversion](#s5pr3-create-toolformservice-for-schema-conversion)
  - [S5PR4: Create SimulationStore with request queue](#s5pr4-create-simulationstore-with-request-queue)
  - [S5PR5: Create SplitPaneComponent layout primitive](#s5pr5-create-splitpanecomponent-layout-primitive)
  - [S5PR6: Create ToolCatalogComponent](#s5pr6-create-toolcatalogcomponent)
  - [S5PR7: Create ToolFormComponent with JSONForms](#s5pr7-create-toolformcomponent-with-jsonforms)
  - [S5PR8: Create FinalResponseComponent](#s5pr8-create-finalresponsecomponent)
  - [S5PR9: Create ControlPanelComponent container](#s5pr9-create-controlpanelcomponent-container)
  - [S5PR10: Integrate ControlPanel into SessionComponent](#s5pr10-integrate-controlpanel-into-sessioncomponent)
- [Implementation Notes](#implementation-notes)
  - [Patterns to Follow](#patterns-to-follow)
  - [Gotchas to Avoid](#gotchas-to-avoid)
- [Definition of Done](#definition-of-done)
- [Retrospective Notes](#retrospective-notes)

## Sprint Goal

This sprint implements the Control Panel feature for response construction, completing the core simulation interaction loop. By sprint end, users will be able to:

1. **View available tools** in a catalog with expandable schema previews
2. **Invoke tools** via dynamically generated forms based on tool input schemas
3. **Submit final responses** via text area or schema-driven form (when `output_schema` is defined)
4. **Use a split-pane layout** with Event Stream on the left and Control Panel on the right

This completes all Phase 4 requirements from the TDD and enables the full human-in-the-loop simulation workflow.

---

## Selected Scope

### Tasks from TDD

| Task | FR | Phase | Notes |
|------|----|-------|-------|
| `ControlPanelComponent` | FR-005 | Phase 4 | Right sidebar container |
| `ToolCatalogComponent` | FR-016 | Phase 4 | Tool listing with schema preview |
| `ToolFormComponent` + JSONForms | FR-017 | Phase 4 | Schema-driven tool invocation forms |
| `ToolFormService` | FR-017 | Phase 4 | Schema conversion (genai -> JSON Schema) |
| `FinalResponseComponent` | FR-018, FR-019 | Phase 4 | Text area or schema form |
| `SimulationStore` | FR-024 | Phase 4 | Request queue management |
| Split-pane layout | FR-005 | Phase 4 | Layout primitive |

---

## Research Summary

### Relevant Findings

#### JSONForms Angular Material Integration

**Source**: [JSONForms Research - Executive Summary](../research/jsonforms-research.md#executive-summary)

JSONForms v3.7.0 supports Angular 21 and provides full Angular Material integration. The library generates forms dynamically from JSON Schema definitions and includes built-in AJV validation. We can use `generateDefaultUISchema()` to automatically create UI layouts from data schemas, avoiding manual UI schema maintenance.

#### Schema Conversion Pipeline

**Source**: [JSONForms Research - Schema Conversion Challenge](../research/jsonforms-research.md#schema-conversion-challenge)

JSONForms requires standard JSON Schema, but our tools use proto `Schema` types. The conversion pipeline is:

```
Proto Schema -> Genai Schema -> JSON Schema (for JSONForms)
```

The `@adk-sim/converters` package already provides `protoSchemaToGenaiSchema()`. We need to add a `genaiSchemaToJsonSchema()` function to complete the pipeline. Key mappings:

| Genai Schema | JSON Schema |
|--------------|-------------|
| `type: Type.STRING` | `type: 'string'` |
| `type: Type.INTEGER` | `type: 'integer'` |
| `minItems: '5'` (string) | `minItems: 5` (number) |
| `nullable: true` | `oneOf: [{type: 'string'}, {type: 'null'}]` |

#### SimulationStore State Management

**Source**: [TDD - SimulationStore (Feature-Scoped)](../frontend-tdd.md#simulationstore-feature-scoped)

The SimulationStore uses `@ngrx/signals` SignalStore to manage:
- `currentRequest`: The active LLM request being handled
- `requestQueue`: FIFO queue for concurrent agent requests (FR-024)
- `selectedTool`: Currently selected tool for invocation

Key computed signals expose `availableTools` (flattened from `currentRequest.config.tools`) and `contents` for the event stream.

#### Split-Pane Layout Pattern

**Source**: [Frontend Spec - US-4 Split-Pane Interface Layout](../frontend-spec.md#us-4-split-pane-interface-layout)

The simulation interface requires a split-pane layout with:
- **Left/Center**: Event Stream (context inspection)
- **Right Sidebar**: Control Panel (response construction)

Both panes must remain visible and functional simultaneously. We will implement a simple CSS-based split layout using Tailwind flexbox utilities rather than a third-party library.

#### Tool Invocation Flow

**Source**: [JSONForms Research - Use Case: Tool Invocation Forms](../research/jsonforms-research.md#use-case-tool-invocation-forms)

The tool invocation flow is:

```
FunctionDeclaration.parameters (proto)
  -> genai Schema (via protoSchemaToGenaiSchema)
  -> JSON Schema (via genaiSchemaToJsonSchema)
  -> JSONForms renders dynamic form
  -> User fills form and submits
  -> { toolName, args } emitted to parent
```

#### Final Response Patterns

**Source**: [JSONForms Research - Use Case: Final Response Forms](../research/jsonforms-research.md#use-case-final-response-forms)

Two patterns for final responses:

1. **No output_schema**: Simple `<textarea>` with Material styling
2. **With output_schema**: JSONForms-generated form using `config.responseSchema`

The `FinalResponseComponent` conditionally renders based on whether `outputSchema` is defined.

### Key Decisions Already Made

| Decision | Choice | Source |
|----------|--------|--------|
| Dynamic Forms Library | JSONForms + Angular Material v3.7.0 | [JSONForms Research](../research/jsonforms-research.md#executive-summary) |
| State Management | SignalStore (feature-scoped) | [TDD - SimulationStore](../frontend-tdd.md#simulationstore-feature-scoped) |
| Schema Conversion Location | `@adk-sim/converters` package | [Converter Research](../research/converter-research.md#adding-adk-converters-ts) |
| UI Schema Strategy | Auto-generated via `generateDefaultUISchema()` | [JSONForms Research](../research/jsonforms-research.md#ui-schema-generation-strategy) |
| Split-Pane Implementation | Tailwind CSS flexbox (no third-party lib) | Team decision - simplicity |

### Open Questions for This Sprint

- [x] ~~Should tool schema preview in ToolCatalog reuse DataTreeComponent from event-stream, or use a simpler JSON display?~~ **RESOLVED**: Mocks show a **structured parameter display**, not raw JSON. Each parameter shows: `propertyName*: TYPE_BADGE` with description below. Type badges (STRING, INTEGER, OBJECT) are styled as colored chips. Required fields marked with asterisk. See `mocks/components/ToolCatalog_Default_default.png` and `mocks/tool-selection.png`.
- [ ] What responsive breakpoint should collapse the split-pane to stacked layout? **Can defer - implement desktop-first.**

### UI Details from Mocks

The following UI patterns are established in the mocks and should be followed during implementation:

#### Control Panel States

| State | Panel Title | Mock Reference |
|-------|-------------|----------------|
| Tool Selection | "Choose Action" | `mocks/tool-selection.png` |
| Tool Form | "Execute: {tool_name}" | `mocks/tool-form.png` |
| Session Complete | "Session Completed" | `mocks/session-complete.png` |
| Query Input | "Enter User Query" | `mocks/query-input.png` |

#### Tab Navigation

The Control Panel uses a **tab-based navigation** with two primary actions:
- **CALL TOOL** tab (wrench icon) - Shows tool catalog for selection
- **FINAL RESPONSE** tab (arrow icon) - Shows response input form

See `mocks/components/ActionPanel_Default_default.png` for the tab layout.

#### Tool Card Layout

Each tool in the catalog displays:
1. **Header row**: Tool icon + tool name (blue text) + radio button (right-aligned)
2. **Description**: Full tool description text
3. **Parameters section** (collapsible):
   - `{} Parameters` header with collapse toggle
   - For each parameter: `propertyName*: TYPE_BADGE` (asterisk for required)
   - Property description indented below
4. **Footer**: `* required` label

Type badges use colored chips: STRING (blue), INTEGER (blue), OBJECT (blue)

See `mocks/components/ToolCatalog_Default_default.png`.

#### Tool Form Layout

When a tool is selected:
1. **Back link**: "BACK TO ACTIONS" (blue text, left-aligned)
2. **Header**: "Execute: {tool_name}"
3. **Description**: Tool description
4. **Parameters heading**: "Parameters"
5. **Form fields**: Material Design inputs with labels (required fields show asterisk)
6. **Footer**: Timer display (left) + "EXECUTE" button (right, filled blue)

See `mocks/tool-form.png`.

#### Session Complete State

When simulation completes:
1. Large green checkmark icon (centered)
2. "Session Completed" heading
3. Helper text: "Export the Golden Trace to save this simulation."
4. "EXPORT GOLDEN TRACE" button (filled green with download icon)

See `mocks/session-complete.png`.

---

## Pull Request Plan

### S5PR1: Add JSONForms dependencies and module setup

**Estimated Lines**: ~50 lines
**Depends On**: -

**Goal**: Install JSONForms packages and configure Angular Material renderers for the frontend.

**Files to Create/Modify**:
- `frontend/package.json` - Add JSONForms dependencies
- `frontend/src/app/ui/control-panel/jsonforms.config.ts` - Centralized renderer configuration

**Background Reading**:
- [JSONForms Implementation Recommendations](../research/jsonforms-research.md#implementation-recommendations) - Package installation and module setup
- [JSONForms Angular Integration](../research/jsonforms-research.md#angular-integration) - Basic usage pattern

**Acceptance Criteria**:
- [ ] `@jsonforms/core`, `@jsonforms/angular`, `@jsonforms/angular-material` added to package.json
- [ ] Dependencies install without conflicts (`npm install` succeeds)
- [ ] `jsonforms.config.ts` exports `angularMaterialRenderers` for reuse
- [ ] Presubmit passes

---

### S5PR2: Add genaiSchemaToJsonSchema converter

**Estimated Lines**: ~150 lines
**Depends On**: S5PR1

**Goal**: Add a converter function to transform genai Schema types to JSON Schema format for JSONForms.

**Files to Create/Modify**:
- `packages/adk-converters-ts/src/json-schema-converter.ts` - New converter implementation
- `packages/adk-converters-ts/src/json-schema-converter.spec.ts` - Unit tests
- `packages/adk-converters-ts/src/index.ts` - Export new functions

**Background Reading**:
- [Schema Conversion Challenge](../research/jsonforms-research.md#schema-conversion-challenge) - Type mappings and conversion function
- [Proto Type Enum -> JSON Schema Type](../research/jsonforms-research.md#proto-type-enum-json-schema-type) - Enum mapping table
- [Existing tool-converter.ts](../../../packages/adk-converters-ts/src/tool-converter.ts) - Pattern for schema conversion

**Acceptance Criteria**:
- [ ] `genaiSchemaToJsonSchema(schema: Schema): JsonSchema7` function implemented
- [ ] Type enum correctly maps: STRING->string, INTEGER->integer, NUMBER->number, BOOLEAN->boolean, ARRAY->array, OBJECT->object
- [ ] Handles nested `properties` and `items` recursively
- [ ] BigInt string fields (`minItems`, `maxItems`) converted to numbers
- [ ] `nullable: true` produces `oneOf` with null type
- [ ] `enum`, `required`, `minimum`, `maximum`, `pattern`, `format` fields preserved
- [ ] Unit tests cover all type mappings and edge cases
- [ ] Package builds successfully (`npm run build` in converters package)
- [ ] Presubmit passes

---

### S5PR3: Create ToolFormService for schema conversion

**Estimated Lines**: ~100 lines
**Depends On**: S5PR2

**Goal**: Create a service that converts FunctionDeclaration to JSONForms configuration.

**Completes TDD Task**: `ToolFormService` (Phase 4)

**Files to Create/Modify**:
- `frontend/src/app/data-access/tool-form/tool-form.service.ts` - Service implementation
- `frontend/src/app/data-access/tool-form/tool-form.service.spec.ts` - Unit tests
- `frontend/src/app/data-access/tool-form/tool-form.types.ts` - ToolFormConfig interface
- `frontend/src/app/data-access/tool-form/index.ts` - Public exports
- `frontend/src/app/data-access/index.ts` - Add tool-form export

**Background Reading**:
- [ToolFormService Design](../frontend-tdd.md#toolformservice-schema-conversion) - Interface and implementation
- [JSONForms Tool Invocation Implementation](../research/jsonforms-research.md#implementation) - Service pattern

**Acceptance Criteria**:
- [x] `ToolFormService` is `providedIn: 'root'`
- [x] `createFormConfig(tool: FunctionDeclaration): ToolFormConfig` implemented
- [x] Handles `parametersJsonSchema` field directly (no conversion needed)
- [x] Converts `parameters` field via genaiSchemaToJsonSchema when present
- [x] Falls back to empty object schema when no parameters
- [x] Uses `generateDefaultUISchema()` for UI schema generation
- [x] Unit tests cover all three parameter scenarios
- [x] Presubmit passes

---

### S5PR4: Create SimulationStore with request queue

**Estimated Lines**: ~120 lines
**Depends On**: -

**Goal**: Implement the feature-scoped SignalStore for managing simulation state including the request queue.

**Completes TDD Task**: `SimulationStore` (Phase 4)

**Files to Create/Modify**:
- `frontend/src/app/features/session/simulation.store.ts` - Store implementation
- `frontend/src/app/features/session/simulation.store.spec.ts` - Unit tests
- `frontend/src/app/features/session/index.ts` - Export store

**Background Reading**:
- [SimulationStore Design](../frontend-tdd.md#simulationstore-feature-scoped) - State interface and methods
- [Signal-Based State Management](../research/prototype-findings.md#signal-based-state-management) - Signal patterns

**Acceptance Criteria**:
- [x] Store implements `SimulationState` interface with `currentRequest`, `requestQueue`, `selectedTool`
- [x] `receiveRequest(request)` queues request if busy, sets current if idle
- [x] `advanceQueue()` moves to next request in FIFO order
- [x] `selectTool(tool)` and `clearSelection()` manage tool selection
- [x] Computed `hasRequest`, `queueLength`, `availableTools`, `contents`, `systemInstruction` implemented
- [x] `availableTools` flattens `functionDeclarations` from all tools
- [x] Unit tests cover queue behavior (add when idle, add when busy, advance)
- [x] Presubmit passes

---

### S5PR5: Create SplitPaneComponent layout primitive

**Estimated Lines**: ~80 lines
**Depends On**: -

**Goal**: Create a reusable split-pane layout component using Tailwind CSS flexbox.

**Completes TDD Task**: Split-pane layout (Phase 4)

**Files to Create/Modify**:
- `frontend/src/app/ui/shared/split-pane/split-pane.component.ts` - Component implementation
- `frontend/src/app/ui/shared/split-pane/split-pane.component.spec.ts` - Unit tests
- `frontend/src/app/ui/shared/split-pane/index.ts` - Public exports
- `frontend/src/app/ui/shared/index.ts` - Add split-pane export

**Background Reading**:
- [FR-005 Layout Requirement](../frontend-spec.md#fr-layout-and-navigation) - Split-pane specification
- [US-4 Acceptance Scenarios](../frontend-spec.md#us-4-acceptance-scenarios) - Layout behavior

**Acceptance Criteria**:
- [x] Component uses content projection with named slots: `main` and `sidebar`
- [x] Layout uses Tailwind: `flex` with `main` taking remaining space, `sidebar` fixed width
- [x] Sidebar width configurable via input (default: 400px)
- [x] Both panes scroll independently (overflow-auto)
- [x] Renders correctly in both light and dark modes
- [x] Unit tests verify slot content projection
- [x] Presubmit passes

---

### S5PR6: Create ToolCatalogComponent

**Estimated Lines**: ~180 lines
**Depends On**: S5PR4

**Goal**: Create a component that displays available tools with expandable parameter previews following the mock design.

**Completes TDD Task**: `ToolCatalogComponent` (Phase 4)

**Files to Create/Modify**:
- `frontend/src/app/ui/control-panel/tool-catalog/tool-catalog.component.ts` - Component implementation
- `frontend/src/app/ui/control-panel/tool-catalog/tool-catalog.component.spec.ts` - Unit tests
- `frontend/src/app/ui/control-panel/tool-catalog/index.ts` - Public exports
- `frontend/src/app/ui/control-panel/index.ts` - Create with exports

**Mock References**:
- `mocks/components/ToolCatalog_Default_default.png` - Tool card layout with parameter display
- `mocks/tool-selection.png` - Full-page context showing tool catalog in sidebar
- `mocks/components/ActionPanel_Default_default.png` - Tab navigation and "SELECT TOOL" button

**Background Reading**:
- [ToolCatalogComponent Design](../frontend-tdd.md#toolcatalogcomponent) - Component interface and template
- [FR-016 Tool Display](../frontend-spec.md#fr-response-construction) - Catalog view requirements

**Acceptance Criteria**:
- [x] Component accepts `tools` input signal of `FunctionDeclaration[]`
- [x] Component accepts optional `selectedTool` input for highlighting
- [x] Component emits `selectTool` output with selected `FunctionDeclaration`
- [x] Displays header: "Tools ({count})" with collapse toggle
- [x] Each tool card shows: tool icon, name (blue), radio button, description
- [x] Collapsible "Parameters" section per tool (collapsed by default)
- [x] Parameters display: `propertyName*: TYPE_BADGE` format with description below
- [x] Type badges: STRING, INTEGER, OBJECT as colored chips (blue background)
- [x] Asterisk (*) suffix for required parameters
- [x] "* required" footer text when required parameters exist
- [x] Selected tool has visual highlight (radio button selected)
- [x] "SELECT TOOL" button at bottom (disabled if no selection)
- [x] Uses Tailwind for layout, Material for radio buttons
- [x] Unit tests verify tool rendering, selection, and parameter expansion
- [x] **Playwright component tests** in `frontend/tests/component/tool-catalog.spec.ts`:
  - [x] Screenshot: empty state (no tools)
  - [x] Screenshot: single tool with parameters collapsed
  - [x] Screenshot: single tool with parameters expanded
  - [x] Screenshot: multiple tools with one selected
  - [x] Screenshot: tool with many parameters (scrolling behavior)
  - [x] Screenshot: tool with long name/description (text wrapping)
  - [x] Screenshot: all parameter types displayed (STRING, INTEGER, OBJECT badges)
  - [x] All screenshots captured in both light and dark themes
- [x] Presubmit passes

---

### S5PR7: Create ToolFormComponent with JSONForms

**Estimated Lines**: ~140 lines
**Depends On**: S5PR1, S5PR3

**Goal**: Create a component that renders dynamic forms for tool invocation using JSONForms, following the mock design.

**Completes TDD Task**: `ToolFormComponent` + JSONForms (Phase 4)

**Files to Create/Modify**:
- `frontend/src/app/ui/control-panel/tool-form/tool-form.component.ts` - Component implementation
- `frontend/src/app/ui/control-panel/tool-form/tool-form.component.spec.ts` - Unit tests
- `frontend/src/app/ui/control-panel/tool-form/index.ts` - Public exports
- `frontend/src/app/ui/control-panel/index.ts` - Add tool-form export

**Mock References**:
- `mocks/tool-form.png` - Tool form layout with back link, header, form fields, and execute button
- `mocks/tool-result.png` - Context showing form submission result in event stream

**Background Reading**:
- [ToolFormComponent Design](../frontend-tdd.md#toolformcomponent-jsonforms) - Component interface
- [JSONForms Tool Invocation Component](../research/jsonforms-research.md#component) - Implementation pattern

**Acceptance Criteria**:
- [ ] Component accepts `config` input of type `ToolFormConfig`
- [ ] Component emits `back` output when back link clicked
- [ ] Component emits `invokeOutput` with `{ toolName: string, args: unknown }`
- [ ] Back link: "BACK TO ACTIONS" (blue text, left arrow icon)
- [ ] Header: "Execute: {toolName}" format
- [ ] Tool description displayed below header
- [ ] "Parameters" section heading above form
- [ ] Uses `<jsonforms>` with Angular Material renderers
- [ ] Form data managed via signal (`formData`)
- [ ] Validation errors tracked via signal (`errors`)
- [ ] Footer layout: timer display (left) + "EXECUTE" button (right)
- [ ] "EXECUTE" button: filled blue with play icon, disabled when validation errors
- [ ] Timer shows elapsed time since form opened (format: "0.00s")
- [ ] Unit tests verify form rendering, back navigation, and submission
- [ ] **Playwright component tests** in `frontend/tests/component/tool-form.spec.ts`:
  - [ ] Screenshot: default/empty state
  - [ ] Screenshot: filled state with valid data
  - [ ] Screenshot: validation errors (required fields empty)
  - [ ] Screenshot: all primitive types (string, number, integer, boolean)
  - [ ] Screenshot: enum fields with selection
  - [ ] Screenshot: array fields (empty and with items)
  - [ ] Screenshot: nested object fields
  - [ ] Screenshot: long tool name (header wrapping)
  - [ ] Screenshot: no tool description
  - [ ] Screenshot: many fields (scrolling behavior)
  - [ ] Screenshot: complex real-world schema (e.g., http_request)
  - [ ] All screenshots captured in both light and dark themes
- [ ] Presubmit passes

---

### S5PR8: Create FinalResponseComponent

**Estimated Lines**: ~120 lines
**Depends On**: S5PR1, S5PR3

**Goal**: Create a component for submitting final responses, supporting both free-text and schema-driven forms.

**Completes TDD Task**: `FinalResponseComponent` (Phase 4)

**Files to Create/Modify**:
- `frontend/src/app/ui/control-panel/final-response/final-response.component.ts` - Component implementation
- `frontend/src/app/ui/control-panel/final-response/final-response.component.spec.ts` - Unit tests
- `frontend/src/app/ui/control-panel/final-response/index.ts` - Public exports
- `frontend/src/app/ui/control-panel/index.ts` - Add final-response export

**Mock References**:
- `mocks/components/ActionPanel_Default_default.png` - Tab navigation showing "FINAL RESPONSE" tab
- `mocks/session-complete.png` - Final response displayed in event stream (purple "Final Response" badge)
- `mocks/components/EventBlock_FinalResponse_default.png` - Final response event block with RAW/MD toggle

**Background Reading**:
- [Final Response Patterns](../research/jsonforms-research.md#use-case-final-response-forms) - Implementation pattern
- [FR-018 and FR-019](../frontend-spec.md#fr-response-construction) - Schema vs text requirements

**Acceptance Criteria**:
- [x] Component accepts optional `outputSchema` input (JSON Schema or null)
- [x] When `outputSchema` is null: renders Material textarea with "Final Response" label
- [x] When `outputSchema` is defined: renders JSONForms with schema
- [x] Component emits `submitText` output for free-text responses
- [x] Component emits `submitStructured` output for schema-validated responses
- [x] "Submit Response" button present for both modes (styled like EXECUTE button)
- [x] Free-text mode: button enabled when textarea is non-empty
- [x] Schema mode: button disabled when validation errors exist
- [x] Unit tests cover both modes and submission
- [x] **Playwright component tests** in `frontend/tests/component/final-response.spec.ts`:
  - [x] Screenshot: free-text mode empty state
  - [x] Screenshot: free-text mode with text entered
  - [x] Screenshot: schema mode empty state
  - [x] Screenshot: schema mode with valid data
  - [x] Screenshot: schema mode with validation errors
  - [x] Screenshot: long response text (textarea behavior)
  - [x] All screenshots captured in both light and dark themes
- [x] Presubmit passes

---

### S5PR9: Create ControlPanelComponent container

**Estimated Lines**: ~180 lines
**Depends On**: S5PR4, S5PR6, S5PR7, S5PR8

**Goal**: Create the container component that orchestrates tool catalog, tool form, and final response with tab navigation.

**Completes TDD Task**: `ControlPanelComponent` (Phase 4)

**Files to Create/Modify**:
- `frontend/src/app/ui/control-panel/control-panel/control-panel.component.ts` - Component implementation
- `frontend/src/app/ui/control-panel/control-panel/control-panel.component.spec.ts` - Unit tests
- `frontend/src/app/ui/control-panel/control-panel/index.ts` - Public exports
- `frontend/src/app/ui/control-panel/index.ts` - Add control-panel export
- `frontend/src/app/ui/index.ts` - Add control-panel module export

**Mock References**:
- `mocks/components/ActionPanel_Default_default.png` - Full control panel with tab navigation
- `mocks/tool-selection.png` - "CALL TOOL" tab active, showing tool catalog
- `mocks/tool-form.png` - Tool form view after selection (replaces catalog)
- `mocks/session-complete.png` - Session completed state

**Background Reading**:
- [Control Panel Components](../frontend-tdd.md#control-panel-components) - Component hierarchy
- [US-3 Tool Selection](../frontend-spec.md#us-3-tool-selection-and-response-construction) - User flow

**Acceptance Criteria**:
- [x] Component accepts `tools` input (from SimulationStore.availableTools)
- [x] Component accepts optional `outputSchema` input (from request config)
- [x] Component accepts `sessionStatus` input for completed state handling
- [x] Component emits `toolInvoke` output with tool invocation data
- [x] Component emits `finalResponse` output with text or structured response
- [x] Header: "Choose Action" title
- [x] Tab navigation: "CALL TOOL" (wrench icon) and "FINAL RESPONSE" (arrow icon)
- [x] Tabs have underline indicator for active state
- [x] CALL TOOL tab content: "Select a tool:" label + ToolCatalog
- [x] FINAL RESPONSE tab content: FinalResponseComponent
- [x] When tool selected: shows ToolFormComponent (replaces catalog view)
- [x] Back navigation from tool form returns to catalog view
- [x] Session completed state: shows checkmark, "Session Completed" message, export button
- [x] Accepts `formConfigCreator` function for schema conversion (injected via FORM_CONFIG_CREATOR token in tests)
- [x] Manages internal state: `activeTab`, `selectedTool`, `showToolForm`
- [x] Uses Tailwind for layout, Material for tabs
- [x] Unit tests deferred to Playwright CT (JSONForms ESM/CJS compatibility)
- [x] **Playwright component tests** in `frontend/tests/component/control-panel.spec.ts`:
  - [x] Screenshot: CALL TOOL tab active with tool catalog
  - [x] Screenshot: FINAL RESPONSE tab active
  - [x] Screenshot: tool selected, showing tool form
  - [x] Screenshot: session completed state (checkmark, export button)
  - [x] Screenshot: no tools available state
  - [x] Screenshot: FINAL RESPONSE tab with schema form
  - [x] All screenshots captured in both light and dark themes
- [x] Presubmit passes

---

### S5PR10: Integrate ControlPanel into SessionComponent

**Estimated Lines**: ~150 lines
**Depends On**: S5PR4, S5PR5, S5PR9

**Goal**: Wire up the ControlPanelComponent into the SessionComponent with the split-pane layout.

**Files to Create/Modify**:
- `frontend/src/app/features/session/session.component.ts` - Add split-pane and control panel
- `frontend/src/app/features/session/session.component.spec.ts` - Update tests

**Mock References**:
- `mocks/tool-selection.png` - Full page layout: header, system instructions, split pane with event stream (left) and control panel (right)
- `mocks/tool-form.png` - Same layout during tool form interaction
- `mocks/tool-result.png` - Layout after tool execution with result in event stream
- `mocks/session-complete.png` - Layout when session is completed
- `mocks/query-input.png` - Initial state with "Enter User Query" panel

**Background Reading**:
- [SessionComponent Current State](../../../frontend/src/app/features/session/session.component.ts) - Scaffold to extend
- [US-4 Split-Pane Layout](../frontend-spec.md#us-4-split-pane-interface-layout) - Layout requirements

**Acceptance Criteria**:
- [ ] SessionComponent uses `SplitPaneComponent` for layout
- [ ] Header bar: "Simulating: {agentName}" (blue background) with status badge (right)
- [ ] Status badge states: "Awaiting Query" (yellow), "Active" (green outline), "Completed" (green fill)
- [ ] Collapsible "System Instructions" section below header
- [ ] Left pane: "Event Stream" header with expand/collapse icons, placeholder content
- [ ] Right sidebar: `ControlPanelComponent` (approx 400px width)
- [ ] SimulationStore provided at component level
- [ ] Control panel receives `tools` from store's `availableTools` computed
- [ ] Control panel receives `outputSchema` from request config
- [ ] Tool invocation and final response events logged to console (actual submission in future PR)
- [ ] Layout renders correctly at 1280px width
- [ ] Unit tests verify component composition
- [ ] **Playwright e2e tests** in `frontend/tests/e2e/session.spec.ts`:
  - [ ] Screenshot: initial state with "Awaiting Query" status
  - [ ] Screenshot: active state with split-pane layout visible
  - [ ] Screenshot: tool selection flow (catalog -> form -> execution)
  - [ ] Screenshot: final response submission flow
  - [ ] Screenshot: session completed state
  - [ ] Screenshot: system instructions collapsed/expanded
  - [ ] All screenshots captured in both light and dark themes
- [ ] Presubmit passes

---

## Implementation Notes

### Patterns to Follow

1. **Schema Conversion Pipeline**: Always use the full pipeline: proto -> genai -> JSON Schema. The genai intermediate step allows reuse of existing converters.

2. **Signal-Based Forms**: Use signals for form state (`formData`, `errors`) rather than reactive forms. This aligns with our signals-first architecture.

3. **Dumb Component Contract**: ToolCatalog, ToolForm, and FinalResponse are dumb UI components - they receive data via inputs and emit events via outputs. No direct service injection except ToolFormService for schema conversion.

4. **Tailwind for Layout**: Use Tailwind utilities for layout, spacing, and colors. Material components for interactive elements (buttons, inputs).

5. **JSONForms Renderer Reuse**: Import renderers from the centralized `jsonforms.config.ts` to ensure consistency.

6. **Mock-Driven Implementation**: Each PR includes mock references - use these as the source of truth for visual design. The mocks are located in `mddocs/frontend/sprints/mocks/` with component-level mocks in `mocks/components/`.

7. **UI Component Testing (src/app/ui/)**: All UI components MUST have comprehensive Playwright component tests with screenshot coverage of all interesting UI variations:
   - **Test location**: `frontend/tests/component/{component-name}.spec.ts`
   - **Snapshot location**: `frontend/tests/component/__snapshots__/{theme}/{test-file}-snapshots/`
   - **Theme variants**: All screenshots must be captured in both light and dark themes using the theme fixture
   - **Required screenshot coverage**:
     - Empty/default state
     - Filled/populated state
     - Validation error states (when applicable)
     - Edge cases: long text, many items, missing optional data
     - Different schema/input types (for dynamic forms)
   - **Reference implementation**: See `frontend/tests/component/tool-form.spec.ts` for comprehensive test patterns

8. **Feature Component Testing (src/app/features/)**: All feature components MUST have Playwright e2e tests with screenshot coverage:
   - **Test location**: `frontend/tests/e2e/{feature-name}.spec.ts`
   - **Screenshot coverage**: Key user flows and integration states
   - **Theme variants**: Light and dark mode screenshots where applicable

### Gotchas to Avoid

- **JSONForms Angular Import**: Import `JsonFormsModule` in component imports, not in providers. The module handles renderer registration.

- **BigInt in JSON Schema**: genai Schema uses string for numeric constraints (`minItems: '5'`). Convert to number for JSON Schema (`minItems: 5`).

- **Nullable Handling**: JSON Schema 7 represents nullable via `oneOf: [{type: 'string'}, {type: 'null'}]`. Don't forget this when converting.

- **SignalStore Scope**: SimulationStore is feature-scoped, not root. Provide it in the SessionComponent's providers array.

- **Form Validation Timing**: JSONForms validation runs on every change. Debounce or use validation state signal to avoid excessive updates.

---

## Definition of Done

- [ ] All 10 PRs merged to main
- [ ] JSONForms dependencies installed and configured
- [ ] `genaiSchemaToJsonSchema` converter implemented with full test coverage
- [ ] `ToolFormService` converts FunctionDeclarations to JSONForms config
- [ ] `SimulationStore` manages request queue with FIFO behavior
- [ ] `SplitPaneComponent` provides reusable layout primitive
- [ ] `ToolCatalogComponent` displays tools with structured parameter preview (matching mock)
- [ ] `ToolFormComponent` generates forms from tool schemas with timer and execute button
- [ ] `FinalResponseComponent` supports both text and schema modes
- [ ] `ControlPanelComponent` orchestrates all control panel UI with tab navigation
- [ ] `SessionComponent` uses split-pane layout with header, status badge, and control panel
- [ ] All TDD Phase 4 tasks checked off
- [ ] Presubmit passes on all PRs
- [ ] Manual smoke test: navigate to session, view tool catalog, expand parameters, switch tabs
- [ ] Visual comparison: UI matches mocks in `mddocs/frontend/sprints/mocks/`

### Testing Requirements

- [ ] **All UI components** (`src/app/ui/`) have Playwright component tests:
  - [ ] `ToolCatalogComponent` - component tests with comprehensive screenshot coverage
  - [ ] `ToolFormComponent` - component tests with comprehensive screenshot coverage
  - [ ] `FinalResponseComponent` - component tests with comprehensive screenshot coverage
  - [ ] `ControlPanelComponent` - component tests with comprehensive screenshot coverage
- [ ] **All feature components** (`src/app/features/`) have Playwright e2e tests:
  - [ ] `SessionComponent` integration - e2e tests with screenshot coverage
- [ ] **Screenshot coverage includes**:
  - [ ] All potentially interesting UI variations (empty, filled, error states)
  - [ ] Edge cases (long names, many items, different schema types)
  - [ ] Both light and dark theme variants for all screenshots
- [ ] **Test infrastructure**:
  - [ ] Component tests located in `frontend/tests/component/`
  - [ ] E2E tests located in `frontend/tests/e2e/`
  - [ ] Snapshots use `__snapshots__/{theme}/` directory structure
  - [ ] Theme fixture applied consistently across all visual tests

---

## Retrospective Notes

*(To be filled after sprint completion)*

---

USER FEEDBACK:

# S5PR1
---

# S5PR2
---

# S5PR3
---

# S5PR4
---

# S5PR5
---

# S5PR6
---

# S5PR7

## Open Questions

### additionalProperties Rendering

JSONForms Angular Material doesn't have a built-in renderer for `additionalProperties` key-value editing. When a schema includes `additionalProperties: { type: 'string' }`, the form renders an empty box with no way to add key-value pairs.

**Options to resolve:**

1. **Create a custom renderer** — Build a key-value pair editor component that registers with JSONForms for `additionalProperties` schemas
2. **Change schema pattern** — Use `array` of `{key: string, value: string}` objects instead (workaround that changes the data structure)
3. **Accept limitation** — Document as known limitation and defer to a future sprint

**Status**: Awaiting decision

### Field Descriptions Behavior

Field descriptions (via `showUnfocusedDescription: true`) only display when the field is **valid**. When a field has validation errors, the `mat-error` element replaces the `mat-hint` where descriptions appear. This is expected Material Design behavior but may be surprising to users.

**Status**: Documented, no action needed

---

# S5PR8
---

# S5PR9
---

# S5PR10
---
