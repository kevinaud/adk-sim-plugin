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

## Retrospective Notes

*(To be filled after sprint completion)*
