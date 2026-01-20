# Sprint 7: JSON Tree Component

## Table of Contents

- [Sprint Goal](#sprint-goal)
- [Selected Scope](#selected-scope)
  - [Tasks from TDD](#tasks-from-tdd)
- [Research Summary](#research-summary)
  - [Relevant Findings](#relevant-findings)
    - [Data Tree Component Design from TDD](#data-tree-component-design-from-tdd)
    - [Functional Requirements for Data Tree](#functional-requirements-for-data-tree)
    - [SmartBlobComponent Integration Pattern](#smartblobcomponent-integration-pattern)
    - [Playwright Visual Testing Pattern](#playwright-visual-testing-pattern)
    - [Event Block Current Implementation](#event-block-current-implementation)
  - [Key Decisions Already Made](#key-decisions-already-made)
  - [Open Questions for This Sprint](#open-questions-for-this-sprint)
- [Pull Request Plan](#pull-request-plan)
  - [S7PR1: Create TreeNode types and tree flattening utility](#s7pr1-create-treenode-types-and-tree-flattening-utility)
  - [S7PR2: Create DataTreeComponent with basic rendering](#s7pr2-create-datatreecomponent-with-basic-rendering)
  - [S7PR3: Add expand/collapse functionality to DataTreeComponent](#s7pr3-add-expandcollapse-functionality-to-datatreecomponent)
  - [S7PR4: Add thread lines and syntax coloring to DataTreeComponent](#s7pr4-add-thread-lines-and-syntax-coloring-to-datatreecomponent)
  - [S7PR5: Add expand all/collapse all buttons to DataTreeComponent](#s7pr5-add-expand-allcollapse-all-buttons-to-datatreecomponent)
  - [S7PR6: Create comprehensive DataTreeComponent screenshot tests](#s7pr6-create-comprehensive-datatreecomponent-screenshot-tests)
  - [S7PR7: Integrate DataTreeComponent into SmartBlobComponent](#s7pr7-integrate-datatreecomponent-into-smartblobcomponent)
  - [S7PR8: Integrate DataTreeComponent into EventBlockComponent](#s7pr8-integrate-datatreecomponent-into-eventblockcomponent)
- [Implementation Notes](#implementation-notes)
  - [Patterns to Follow](#patterns-to-follow)
  - [Gotchas to Avoid](#gotchas-to-avoid)
- [Definition of Done](#definition-of-done)
- [Retrospective Notes](#retrospective-notes)

## Sprint Goal

This sprint implements the DataTreeComponent for visualizing complex JSON data structures in the Event Stream. By sprint end:

1. **DataTreeComponent is fully functional** - Hierarchical tree with collapsible nodes, thread lines, syntax coloring
2. **All nodes expanded by default** - FR-009 compliance for minimal interaction required
3. **Expand all/collapse all buttons** - Object-level controls for quick navigation
4. **Integrated into SmartBlob and EventBlock** - JSON content renders as interactive trees
5. **Comprehensive visual test coverage** - Screenshot tests flexing all edge cases

This completes the `DataTreeComponent` task from TDD Phase 3 (FR-008 through FR-011).

---

## Selected Scope

### Tasks from TDD

| Task | FR | Phase | Notes |
|------|----|-------|-------|
| `DataTreeComponent` | FR-008-011 | Phase 3 | JSON tree with thread lines, collapsible nodes, syntax coloring |

**Related integration work** (not explicitly in TDD but required for completion):

| Integration | Related FR | Notes |
|-------------|------------|-------|
| SmartBlob JSON mode | FR-012 | Replace formatted `<pre>` with DataTree |
| EventBlock function args | FR-007 | Replace JSON.stringify with DataTree |

---

## Research Summary

### Relevant Findings

#### Data Tree Component Design from TDD

**Source**: [frontend-tdd.md - DataTreeComponent](../frontend/frontend-tdd.md#datatreecomponent)

The TDD provides a skeleton design using a "flat nodes" approach where nested data is flattened into an array of `TreeNode` objects for template iteration. Each node tracks:
- `path`: Unique identifier for expansion state
- `depth`: Indentation level
- `key`: Property name or array index
- `displayValue`: Formatted value for primitives
- `valueType`: Type classification for syntax coloring
- `expandable`: Whether node has children
- `expanded`: Current expansion state

The flat approach simplifies Angular's `@for` loop rendering vs recursive component nesting.

#### Functional Requirements for Data Tree

**Source**: [frontend-spec.md - FR Context Inspection](../frontend/frontend-spec.md#fr-context-inspection)

Four requirements govern the data tree:
- **FR-008**: Complex data MUST render as hierarchical trees with collapsible nodes
- **FR-009**: All nodes MUST be expanded by default (minimize interaction)
- **FR-010**: Thread lines MUST connect parent nodes to children for visual clarity
- **FR-011**: Monospace fonts with syntax coloring for keys and values

The "expanded by default" requirement is critical for UX - developers should see all data immediately without clicking to expand.

#### SmartBlobComponent Integration Pattern

**Source**: [SmartBlobComponent](../../frontend/src/app/ui/shared/smart-blob/smart-blob.component.ts)

The current SmartBlobComponent renders JSON in a `<pre>` block with `JSON.stringify(parsed, null, 2)`. The JSON mode needs to be updated to use DataTreeComponent instead:

```typescript
// Current (to be replaced)
@case ('json') {
  <pre class="json-content">{{ formattedJson() }}</pre>
}

// Target integration
@case ('json') {
  <app-data-tree [data]="parsedJson()" />
}
```

The component already has `parsedJson()` computed signal returning the parsed object, so integration is straightforward.

#### Playwright Visual Testing Pattern

**Source**: [event-block.spec.ts and smart-blob.spec.ts](../../frontend/tests/component/)

Existing component tests demonstrate the pattern:
1. Import `test, expect` from theme fixture for light/dark mode coverage
2. Mount component with test data via `props`
3. Use `toHaveScreenshot()` for visual regression
4. Test both functional behavior and visual appearance separately

Key insight: Some visual regression tests are skipped due to screenshot size differences between local Docker and CI Docker. This sprint's tests should account for this by using appropriate thresholds where needed.

#### Event Block Current Implementation

**Source**: [event-block.component.ts](../../frontend/src/app/ui/event-stream/event-block/event-block.component.ts)

EventBlockComponent currently uses `formatArgs()` method that calls `JSON.stringify(args, null, 2)` to display function call arguments and function response data in `<pre>` blocks. These need to be replaced with DataTreeComponent for proper hierarchical visualization.

### Key Decisions Already Made

| Decision | Choice | Source |
|----------|--------|--------|
| Flat nodes vs recursive | Flat array with depth tracking | [TDD DataTreeComponent](../frontend/frontend-tdd.md#datatreecomponent) |
| Default expansion state | All expanded (FR-009) | [Spec FR-009](../frontend/frontend-spec.md#fr-context-inspection) |
| Visual testing approach | Playwright CT with theme fixture | [Sprint 6 tests](../frontend/sprints/sprint6.md#s6pr4-create-smartblobcomponent-with-markdown-rendering) |
| Syntax coloring strategy | CSS classes per value type | [TDD template example](../frontend/frontend-tdd.md#datatreecomponent) |

### Open Questions for This Sprint

- [x] Should expand all/collapse all be per-tree or global? **Decision**: Per-tree - controls are rendered within each DataTreeComponent instance
- [ ] Should deeply nested objects (>5 levels) be collapsed by default? **Recommendation**: No - stick with FR-009 (all expanded), add visual scroll indicator if content overflows
- [ ] Maximum depth limit? **Recommendation**: No limit per clarification in spec, but add `data-depth` attribute for potential future styling of deep nesting

---

## Pull Request Plan

### S7PR1: Create TreeNode types and tree flattening utility

**Estimated Lines**: ~80 lines
**Depends On**: -

**Goal**: Define the TreeNode interface and create a pure utility function that flattens nested objects/arrays into a flat array of TreeNode objects for rendering.

**Files to Create/Modify**:
- `frontend/src/app/ui/event-stream/data-tree/tree-node.types.ts` - TreeNode interface and value type enum
- `frontend/src/app/ui/event-stream/data-tree/flatten-tree.util.ts` - Pure function to flatten objects
- `frontend/src/app/ui/event-stream/data-tree/flatten-tree.util.spec.ts` - Unit tests

**Background Reading**:
- [TDD DataTreeComponent skeleton](../frontend/frontend-tdd.md#datatreecomponent) - Shows TreeNode interface usage
- [FR-009 Expansion default](../frontend/frontend-spec.md#fr-context-inspection) - All nodes expanded by default

**Acceptance Criteria**:
- [ ] `TreeNode` interface defined with: path, depth, key, displayValue, valueType, expandable, expanded
- [ ] `ValueType` enum defined: string, number, boolean, null, object, array
- [ ] `flattenTree()` utility function handles objects, arrays, and primitives recursively
- [ ] Function produces correct depth values for nested structures
- [ ] Function marks object/array nodes as `expandable: true`
- [ ] Function sets `expanded: true` for all nodes by default (FR-009)
- [ ] Unit tests cover: empty object, nested object, array of objects, mixed types, deeply nested (5+ levels)
- [ ] Presubmit passes

---

### S7PR2: Create DataTreeComponent with basic rendering

**Estimated Lines**: ~120 lines
**Depends On**: S7PR1

**Goal**: Create the DataTreeComponent shell with basic template that renders the flattened nodes with proper indentation.

**Files to Create/Modify**:
- `frontend/src/app/ui/event-stream/data-tree/data-tree.component.ts` - Component implementation
- `frontend/src/app/ui/event-stream/data-tree/data-tree.component.spec.ts` - Unit tests
- `frontend/src/app/ui/event-stream/data-tree/index.ts` - Public exports
- `frontend/src/app/ui/event-stream/index.ts` - Add data-tree export

**Background Reading**:
- [TDD DataTreeComponent template](../frontend/frontend-tdd.md#datatreecomponent) - Template structure
- [Angular signal patterns](../../frontend/CLAUDE.md) - Required patterns for signals

**Acceptance Criteria**:
- [ ] Component accepts `data` input signal (required, type `unknown`)
- [ ] Component accepts `expanded` input signal (default `true` per FR-009)
- [ ] Component accepts `showThreadLines` input signal (default `true` per FR-010)
- [ ] Template uses `@for` to render flat nodes from `flatNodes()` computed signal
- [ ] Each node rendered with `padding-left` based on depth for indentation
- [ ] Keys displayed with `:` suffix, primitive values displayed inline
- [ ] Basic unit tests verify rendering of simple object
- [ ] Presubmit passes

---

### S7PR3: Add expand/collapse functionality to DataTreeComponent

**Estimated Lines**: ~100 lines
**Depends On**: S7PR2

**Goal**: Add the ability to expand and collapse object/array nodes by clicking toggle buttons.

**Files to Create/Modify**:
- `frontend/src/app/ui/event-stream/data-tree/data-tree.component.ts` - Add toggle logic
- `frontend/src/app/ui/event-stream/data-tree/data-tree.component.spec.ts` - Add toggle tests

**Background Reading**:
- [TDD toggleNode method](../frontend/frontend-tdd.md#datatreecomponent) - Toggle implementation pattern
- [FR-008 Collapsible nodes](../frontend/frontend-spec.md#fr-context-inspection) - Requirement for collapsibility

**Acceptance Criteria**:
- [ ] Toggle button rendered for expandable nodes (objects and arrays)
- [ ] Toggle icon changes: `expand_more` when expanded, `chevron_right` when collapsed
- [ ] Clicking toggle updates `expandedPaths` signal
- [ ] Collapsed nodes hide their children in the rendered output
- [ ] `flatNodes()` computed respects expansion state
- [ ] Unit tests verify expand/collapse behavior
- [ ] Unit tests verify children visibility changes with parent collapse
- [ ] Presubmit passes

---

### S7PR4: Add thread lines and syntax coloring to DataTreeComponent

**Estimated Lines**: ~100 lines
**Depends On**: S7PR3

**Goal**: Add CSS for thread lines connecting parents to children (FR-010) and syntax coloring for different value types (FR-011).

**Files to Create/Modify**:
- `frontend/src/app/ui/event-stream/data-tree/data-tree.component.ts` - Add styles

**Background Reading**:
- [FR-010 Thread lines](../frontend/frontend-spec.md#fr-context-inspection) - Visual clarity requirement
- [FR-011 Syntax coloring](../frontend/frontend-spec.md#fr-context-inspection) - Monospace + coloring requirement

**Acceptance Criteria**:
- [ ] Thread lines rendered when `showThreadLines` is true (default)
- [ ] Thread lines use CSS borders/pseudo-elements connecting parent indent to children
- [ ] Monospace font applied to entire tree (`Roboto Mono`)
- [ ] Key names styled distinctly (e.g., bold or different color)
- [ ] String values styled with string color (e.g., green)
- [ ] Number values styled with number color (e.g., blue)
- [ ] Boolean values styled with boolean color (e.g., purple)
- [ ] Null values styled with null color (e.g., gray italic)
- [ ] All colors work in both light and dark themes (use CSS variables)
- [ ] Presubmit passes

---

### S7PR5: Add expand all/collapse all buttons to DataTreeComponent

**Estimated Lines**: ~80 lines
**Depends On**: S7PR4

**Goal**: Add object-level expand all and collapse all buttons to allow quick navigation through large JSON structures.

**Files to Create/Modify**:
- `frontend/src/app/ui/event-stream/data-tree/data-tree.component.ts` - Add buttons and methods
- `frontend/src/app/ui/event-stream/data-tree/data-tree.component.spec.ts` - Add button tests

**Background Reading**:
- [Session component expand/collapse buttons](../../frontend/src/app/features/session/session.component.ts) - Shows button placement pattern

**Acceptance Criteria**:
- [ ] "Expand All" button (`unfold_more` icon) in tree header
- [ ] "Collapse All" button (`unfold_less` icon) in tree header
- [ ] Clicking "Expand All" sets all expandable nodes to expanded state
- [ ] Clicking "Collapse All" sets all expandable nodes to collapsed state
- [ ] Buttons only shown when tree has expandable nodes
- [ ] Buttons are visually subtle (icon buttons, not prominent)
- [ ] Unit tests verify expand all/collapse all functionality
- [ ] Presubmit passes

**Completes TDD Task**: `DataTreeComponent` (Phase 3)

---

### S7PR6: Create comprehensive DataTreeComponent screenshot tests

**Estimated Lines**: ~200 lines
**Depends On**: S7PR5

**Goal**: Create extensive Playwright component tests with screenshots covering all visual states and edge cases.

**Files to Create/Modify**:
- `frontend/tests/component/data-tree.spec.ts` - Comprehensive component tests

**Background Reading**:
- [Playwright visual testing research](../frontend/research/playwright-testing-research.md#visual-regression-test-with-states) - Test patterns
- [Theme fixture](../../frontend/tests/component/fixtures/theme.fixture.ts) - Light/dark mode testing
- [Existing component tests](../../frontend/tests/component/event-block.spec.ts) - Pattern examples

**Acceptance Criteria**:
- [ ] Test: Simple flat object (3-4 keys) - screenshot
- [ ] Test: Nested object (2-3 levels) - screenshot
- [ ] Test: Array of primitives - screenshot
- [ ] Test: Array of objects - screenshot
- [ ] Test: Mixed types (string, number, boolean, null, object, array) - screenshot
- [ ] Test: Empty object `{}` - screenshot
- [ ] Test: Empty array `[]` - screenshot
- [ ] Test: Deeply nested object (5+ levels) - screenshot
- [ ] Test: Large array (10+ items) - screenshot
- [ ] Test: Long string values (truncation behavior) - screenshot
- [ ] Test: Collapsed state (parent collapsed, children hidden) - screenshot
- [ ] Test: Partially collapsed (some nodes expanded, some collapsed) - screenshot
- [ ] Test: Expand all behavior - functional test
- [ ] Test: Collapse all behavior - functional test
- [ ] Test: Thread lines visible - screenshot
- [ ] Test: Thread lines disabled (`showThreadLines=false`) - screenshot
- [ ] Test: Unicode keys and values - screenshot
- [ ] Test: Special characters in strings (quotes, backslashes) - screenshot
- [ ] All tests run in both light and dark themes via fixture
- [ ] Presubmit passes

---

### S7PR7: Integrate DataTreeComponent into SmartBlobComponent

**Estimated Lines**: ~60 lines
**Depends On**: S7PR5

**Goal**: Replace the `<pre>` JSON display in SmartBlobComponent with DataTreeComponent for interactive tree visualization.

**Files to Create/Modify**:
- `frontend/src/app/ui/shared/smart-blob/smart-blob.component.ts` - Update JSON mode rendering
- `frontend/src/app/ui/shared/smart-blob/smart-blob.component.spec.ts` - Update tests
- `frontend/tests/component/smart-blob.spec.ts` - Update visual tests

**Background Reading**:
- [SmartBlobComponent current implementation](../../frontend/src/app/ui/shared/smart-blob/smart-blob.component.ts) - Current JSON rendering
- [FR-012 JSON toggle requirement](../frontend/frontend-spec.md#fr-context-inspection) - JSON rendered as Data Tree

**Acceptance Criteria**:
- [ ] JSON mode renders `<app-data-tree>` instead of `<pre>` with formatted JSON
- [ ] DataTreeComponent receives `parsedJson()` as data input
- [ ] Existing JSON detection and toggle behavior unchanged
- [ ] Unit tests updated to verify DataTree rendered in JSON mode
- [ ] Visual tests updated with DataTree appearance
- [ ] Presubmit passes

---

### S7PR8: Integrate DataTreeComponent into EventBlockComponent

**Estimated Lines**: ~80 lines
**Depends On**: S7PR5

**Goal**: Replace JSON.stringify output for function call arguments and function response data with DataTreeComponent.

**Files to Create/Modify**:
- `frontend/src/app/ui/event-stream/event-block/event-block.component.ts` - Update template
- `frontend/src/app/ui/event-stream/event-block/event-block.component.spec.ts` - Update tests
- `frontend/tests/component/event-block.spec.ts` - Update visual tests

**Background Reading**:
- [EventBlockComponent current implementation](../../frontend/src/app/ui/event-stream/event-block/event-block.component.ts) - Current formatArgs usage
- [FR-008 Complex data as trees](../frontend/frontend-spec.md#fr-context-inspection) - Tool arguments as hierarchical trees

**Acceptance Criteria**:
- [ ] Function call arguments (`part.functionCall.args`) rendered via DataTreeComponent
- [ ] Function response data (`part.functionResponse.response`) rendered via DataTreeComponent
- [ ] Remove `formatArgs()` method (no longer needed)
- [ ] DataTreeComponent integrated with appropriate container styling
- [ ] Unit tests updated to verify DataTree rendered for function parts
- [ ] Visual tests updated with DataTree appearance in event blocks
- [ ] Presubmit passes

---

## Implementation Notes

### Patterns to Follow

1. **Flat Node Architecture**: Use the flat array approach from TDD rather than recursive component nesting. This simplifies:
   - Template rendering with single `@for` loop
   - Expansion state management with path-based Set
   - Performance (no component tree overhead)

2. **Signal-Based State**: Use signals for all state per Angular patterns:
   ```typescript
   private readonly _expandedPaths = signal<Set<string>>(new Set());
   readonly expandedPaths = this._expandedPaths.asReadonly();
   ```

3. **Theme-Aware Colors**: Use CSS variables from the design system for all syntax colors:
   ```css
   .value-string { color: var(--color-syntax-string); }
   .value-number { color: var(--color-syntax-number); }
   ```
   Define fallbacks if variables don't exist yet.

4. **Screenshot Test Organization**: Group tests logically:
   - Functional behavior tests (expand/collapse)
   - Visual regression tests (screenshots)
   - Edge case tests (empty, large, unicode)

5. **Component Test IDs**: Use consistent `data-testid` attributes:
   - `data-testid="data-tree"` on container
   - `data-testid="tree-node"` on each node
   - `data-testid="expand-toggle"` on toggle buttons
   - `data-testid="expand-all"` and `data-testid="collapse-all"` on action buttons

### Gotchas to Avoid

- **Circular References**: The flattening utility should detect and handle circular references in objects to avoid infinite recursion. Consider adding a `maxDepth` safety limit (e.g., 100 levels).

- **Large Arrays**: Arrays with many items can make the tree very tall. Consider if there should be a "show more" pattern for arrays with >50 items (out of scope for this sprint, but note the risk).

- **Screenshot Stability**: Per existing tests, some screenshots have size differences between local Docker and CI Docker. Use `maxDiffPixelRatio` threshold where appropriate, or use fixed container sizes to normalize dimensions.

- **Performance with Deep Nesting**: The computed `flatNodes()` recalculates on every expansion change. For very large objects, this could be slow. The current approach should be fine for typical LLM request data, but monitor for issues.

- **CSS Specificity**: Thread lines use pseudo-elements which can be tricky. Test carefully in both themes and with various nesting levels.

- **Empty State**: Handle edge cases where `data` is `undefined`, `null`, or empty `{}` / `[]` gracefully without errors.

---

## Definition of Done

- [ ] All 8 PRs merged to main
- [ ] DataTreeComponent renders hierarchical JSON with collapsible nodes (FR-008)
- [ ] All nodes expanded by default (FR-009)
- [ ] Thread lines connect parent to children (FR-010)
- [ ] Monospace font with syntax coloring (FR-011)
- [ ] Expand all / collapse all buttons work correctly
- [ ] Comprehensive screenshot tests covering all edge cases
- [ ] SmartBlobComponent JSON mode uses DataTree
- [ ] EventBlockComponent function args/response use DataTree
- [ ] All Playwright tests pass (component and e2e)
- [ ] Visual regression snapshots updated
- [ ] Presubmit passes on all PRs
- [ ] TDD Phase 3 `DataTreeComponent` task marked complete

---

## Visual Fidelity Checklist

This checklist captures the **exact visual requirements** from the UI mock (`EventBlock_ToolOutput_Complex_default.png`). The DataTreeComponent implementation MUST meet ALL of these criteria to be considered complete.

### 1. JSON Syntax Format (CRITICAL)

The mock shows **standard JSON syntax**, NOT YAML-style. Every detail matters:

- [x] **Keys MUST be wrapped in double quotes**: `"status"` not `status`
- [x] **Colon separator with space**: `"key": value` (colon immediately after closing quote, then space, then value)
- [x] **String values MUST be wrapped in double quotes**: `"success"` not `success`
- [x] **Number values MUST NOT have quotes**: `1240` not `"1240"`
- [x] **Boolean values MUST be lowercase without quotes**: `true` / `false`
- [x] **Null values MUST be lowercase without quotes**: `null`

**Example of CORRECT format (from mock)**:
```
"status": "success"
"total_duration": 1240
"execution_trace": [
```

**Example of INCORRECT format (current implementation)**:
```
status: "success"
total_duration: 1240
execution_trace: [3]
```

### 2. No Artificial "root" Wrapper (CRITICAL)

The DataTree MUST render the data's own structure directly, WITHOUT adding an artificial "root" wrapper.

- [ ] **NO "root" key** - The tree should NOT wrap the input data in a `"root": { ... }` structure
- [ ] **Direct rendering** - If the input is `{ "status": "success" }`, the tree starts with `˅ {` followed by `"status": "success"`, NOT `˅ "root": {`
- [ ] **Top-level object** - For object input, the first line should be the opening brace `{` (expandable)
- [ ] **Top-level array** - For array input, the first line should be the opening bracket `[` (expandable)
- [ ] **Top-level primitive** - For primitive input (string, number, etc.), render just the value

**Example of CORRECT format (from mock)**:
```
˅ {
    "status": "success",
    "total_duration": 1240,
```

**Example of INCORRECT format (current implementation)**:
```
˅ "root": {          ← THIS IS WRONG - no "root" in the actual data
    "status": "success",
```

### 3. Structural Elements (Braces, Brackets, Commas)

The mock shows **explicit JSON structural characters**:

- [x] **Opening brace `{`** appears on its own line (or after `: ` for nested objects)
- [ ] **Closing brace `}`** appears on its own line at the appropriate indentation (deferred - requires closing brace nodes)
- [x] **Opening bracket `[`** appears after the key for arrays
- [ ] **Closing bracket `]`** appears on its own line at the appropriate indentation (deferred - requires closing brace nodes)
- [ ] **Commas** appear after values when there are more siblings (standard JSON) (deferred - adds complexity)
- [x] **NO count badges** like `{2}` or `[3]` - the mock does NOT show these

**Example of CORRECT format (from mock)**:
```
˅ {
    "status": "success",
    "total_duration": 1240,
  ˅ "execution_trace": [
    ˅ [0]: {
        "step_id": "init_01",
```

### 4. Expand/Collapse Indicators

- [x] **Chevron icon `˅`** for expanded nodes (pointing down)
- [x] **Chevron icon `>`** for collapsed nodes (pointing right)
- [x] Chevron appears **to the left** of the opening brace/bracket or key
- [x] Chevron is **clickable** to toggle expansion state
- [x] Chevron ONLY appears for expandable nodes (objects and arrays)
- [x] Primitive values (strings, numbers, booleans, null) have NO chevron

### 5. Color Coding (MUST Match Mock)

The mock uses a specific color scheme that MUST be replicated:

- [x] **Keys**: Purple/magenta color (e.g., `"status"`, `"total_duration"`)
- [x] **String values**: Green color (e.g., `"success"`, `"init_01"`)
- [x] **Number values**: Teal/cyan color (e.g., `1240`, `0.7`)
- [x] **Structural characters**: Default text color (braces, brackets, commas, colons)
- [x] **Expand/collapse chevrons**: Subtle/muted color (not prominent)

### 6. Array Index Display

The mock shows array indices in a specific format:

- [x] Array indices displayed as `[0]`, `[1]`, `[2]`, etc.
- [x] Index appears **before** the colon, like a key: `[0]: {`
- [x] Indices use the **same color as keys** (purple/magenta)
- [x] Indices are **expandable** when the array element is an object or array

### 7. Thread Lines (Indentation Guides)

- [ ] Vertical lines connect parent nodes to their children
- [ ] Thread lines are **subtle** (thin, low-contrast color)
- [ ] Thread lines appear at each indentation level
- [ ] Lines should use a **left border or pseudo-element** approach
- [ ] Thread lines respect the hierarchical structure
- [ ] Thread lines can be **toggled off** via `showThreadLines` input

### 8. Smart Blob Integration (CRITICAL)

The DataTree must detect string values that contain markdown or JSON and render inline toggle buttons with rendered content below. This is NOT about using SmartBlobComponent as a wrapper - it's about embedding smart blob detection and rendering directly into the tree's node rendering.

#### 8.1 Smart Blob Detection

- [ ] **Detect markdown-like strings**: Strings containing markdown indicators (headings `#`, lists `- ` or `* `, code blocks, etc.)
- [ ] **Detect JSON-like strings**: Strings that parse as valid JSON objects or arrays
- [ ] **Detection happens per-node**: Each string value node independently checks if it's smart-blob-eligible
- [ ] **Reuse existing detection logic**: Use the same heuristics as SmartBlobComponent (`looksLikeMarkdown()`, `tryParseJson()`)

#### 8.2 Inline Toggle Buttons

- [ ] **Toggle buttons appear inline** on the same line as the key-value pair, after the string value
- [ ] **RAW/MD buttons** for markdown-detected strings
- [ ] **RAW/JSON buttons** for JSON-detected strings
- [ ] **Button styling**: Small pill-shaped toggles (rounded rectangles)
- [ ] **Active state**: Filled background (highlighted)
- [ ] **Inactive state**: Outlined/border only
- [ ] **Default mode**: RAW mode by default (show the raw string value in quotes)
- [ ] **Per-node state**: Each node tracks its own toggle state independently

#### 8.3 Rendered Content Display

When toggled to MD or JSON mode:

- [ ] **Content appears BELOW the key-value line**, not replacing it
- [ ] **Indented** to align with the tree's hierarchy
- [ ] **Left border indicator** for markdown content (blockquote-style vertical line)
- [ ] **For JSON mode**: Render a **nested DataTree** (recursive!) with full expand/collapse capability
- [ ] **For MD mode**: Render formatted markdown (headings, lists, code blocks, etc.)

#### 8.4 Implementation Approach

The DataTree node template should:
1. Check if the node is a string primitive
2. If so, run smart blob detection
3. If detected, render toggle buttons inline after the value
4. Track toggle state per-node (e.g., `Map<string, 'raw' | 'md' | 'json'>`)
5. When toggled, render the appropriate content below the node

**Example of expected output**:
```
˅ {
    "status": "success",
    "total_duration": 1240,
  ˅ "execution_trace": [
    ˅ [0]: {
        "step_id": "init_01",
        "console_log": "Connecting to..." [RAW] [MD]    ← INLINE TOGGLES
            │ Connecting to subsystem... Connection established.  ← RENDERED BELOW (when MD active)

      ˅ "remote_config": "{\"model\":...}" [RAW] [JSON]  ← INLINE TOGGLES
          ˅ {                                              ← NESTED DATATREE (when JSON active)
              "model": "gemini-1.5-pro",
              "temperature": 0.7
            }

        "chain_of_thought": "# Reasoning\n..." [RAW] [MD]
            # Reasoning                                    ← RENDERED MARKDOWN
            • The system successfully initialized...
```

### 9. Inline Rendered Content Layout

When a smart blob is in rendered mode (MD or JSON):

- [ ] Rendered content appears **indented below** the key-value line
- [ ] Rendered content has a **left border/quote indicator** (visible in mock for markdown)
- [ ] Markdown headings render at appropriate sizes
- [ ] Markdown bullet points render as proper list items
- [ ] Markdown blockquotes render with left border styling
- [ ] Nested JSON renders as a fully functional DataTree (with its own expand/collapse)
- [ ] Rendered content is **contained within** the parent tree's visual hierarchy

### 10. Typography

- [ ] **Monospace font** for all tree content (`Roboto Mono` or similar)
- [ ] **Consistent font size** across keys, values, and structural characters
- [ ] **Proper line height** for readability
- [ ] **No word wrapping** - long lines should either truncate or scroll horizontally

### 11. Spacing and Indentation

- [ ] **Consistent indentation** per nesting level (appears to be ~20-24px in mock)
- [ ] **No extra vertical spacing** between sibling nodes
- [ ] **Compact vertical layout** - nodes should be close together
- [ ] Proper alignment of values across different key lengths

### 12. Empty States

- [ ] Empty object `{}` displays as `{}`  on a single line (no expansion needed)
- [ ] Empty array `[]` displays as `[]` on a single line (no expansion needed)
- [ ] `null` value displays as `null` with appropriate styling
- [ ] `undefined` values (if possible) handled gracefully

### 13. Expand All / Collapse All Controls

- [ ] Located in a **subtle header area** above the tree
- [ ] Uses **icon-only buttons** (unfold_more / unfold_less)
- [ ] **Only visible** when the tree has expandable nodes
- [ ] Buttons are **not prominent** - secondary/ghost button style
- [ ] Expand All expands **all** nested levels (not just top level)
- [ ] Collapse All collapses **all** nested levels (not just top level)

### 14. Integration Points

#### SmartBlobComponent Integration:
- [ ] JSON mode in SmartBlob renders DataTreeComponent (not `<pre>` with formatted JSON)
- [ ] DataTreeComponent receives parsed JSON object as input
- [ ] Toggle between RAW and JSON modes still works
- [ ] Visual appearance matches the standalone DataTree tests

#### EventBlockComponent Integration:
- [ ] Function call arguments render via DataTreeComponent with smart blob support
- [ ] Function response data renders via DataTreeComponent with smart blob support
- [ ] The DataTree appears within the "Result" accordion section
- [ ] Proper container styling (padding, borders) around the tree

### 15. Theme Support

- [ ] All colors work correctly in **light theme**
- [ ] All colors work correctly in **dark theme**
- [ ] Thread lines visible in both themes
- [ ] Smart blob toggle buttons styled appropriately in both themes
- [ ] Rendered markdown content styled appropriately in both themes

### 16. Interactive Behavior

- [ ] Clicking a chevron **toggles only that node** (not siblings or children)
- [ ] Clicking a smart blob toggle **switches the render mode** for that value only
- [ ] Expansion state is **preserved** when parent components re-render
- [ ] No flickering or layout shifts when expanding/collapsing
- [ ] Smooth transitions (optional, but nice to have)

---

### Summary of Critical Gaps in Current Implementation

Based on comparing the mock to current screenshot tests, these are the **highest priority fixes**:

1. ~~**JSON syntax format** - Switch from YAML-style (`key: value`) to JSON-style (`"key": value`)~~ **DONE**
2. ~~**Remove count badges** - Delete the `{2}`, `[3]` indicators; show actual braces/brackets~~ **DONE**
3. ~~**Color scheme** - Change keys to purple/magenta, strings to green, numbers to teal/cyan~~ **DONE**
4. **Remove "root" wrapper** - The tree currently wraps all data in an artificial `"root": { }` which is NOT in the mock - **MUST FIX**
5. **Smart blob integration** - Add inline RAW/MD/JSON toggles within the tree for string values that contain markdown or JSON - **MUST FIX**
6. **Inline rendered content** - When smart blob is toggled to MD/JSON mode, render the formatted content below the key-value line - **MUST FIX**

---

## Retrospective Notes

*(To be filled after sprint completion)*
