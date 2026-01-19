# Sprint 6: Polish and UX Improvements


## Table of Contents

- [Sprint Goal](#sprint-goal)
- [Selected Scope](#selected-scope)
  - [Tasks from TDD](#tasks-from-tdd)
- [Research Summary](#research-summary)
  - [Relevant Findings](#relevant-findings)
    - [Dark Mode Theme Configuration](#dark-mode-theme-configuration)
    - [Event Block Styling](#event-block-styling)
    - [System Instructions Current Implementation](#system-instructions-current-implementation)
    - [Split Pane Component Structure](#split-pane-component-structure)
    - [SmartBlobComponent Design](#smartblobcomponent-design)
    - [JSONForms Custom Renderers](#jsonforms-custom-renderers)
  - [Key Decisions Already Made](#key-decisions-already-made)
  - [Open Questions for This Sprint](#open-questions-for-this-sprint)
- [Pull Request Plan](#pull-request-plan)
  - [S6PR1: Fix dark mode background color extending to full viewport](#s6pr1-fix-dark-mode-background-color-extending-to-full-viewport)
  - [S6PR2: Fix User Input event block text contrast in dark mode](#s6pr2-fix-user-input-event-block-text-contrast-in-dark-mode)
  - [S6PR3: Move system instructions accordion into event stream column](#s6pr3-move-system-instructions-accordion-into-event-stream-column)
  - [S6PR4: Create SmartBlobComponent with markdown rendering](#s6pr4-create-smartblobcomponent-with-markdown-rendering)
  - [S6PR5: Integrate SmartBlobComponent for system instructions](#s6pr5-integrate-smartblobcomponent-for-system-instructions)
  - [S6PR6: Add resizable divider to SplitPaneComponent](#s6pr6-add-resizable-divider-to-splitpanecomponent)
  - [S6PR7: Create textarea custom renderer for JSONForms string fields](#s6pr7-create-textarea-custom-renderer-for-jsonforms-string-fields)
  - [S6PR8: Differentiate Tool Call vs Tool Response in event blocks](#s6pr8-differentiate-tool-call-vs-tool-response-in-event-blocks)
- [Implementation Notes](#implementation-notes)
  - [Patterns to Follow](#patterns-to-follow)
  - [Gotchas to Avoid](#gotchas-to-avoid)
- [Definition of Done](#definition-of-done)
- [Retrospective Notes](#retrospective-notes)

## Sprint Goal

This sprint focuses on polish and UX improvements for previously completed features. By sprint end:

1. **Dark mode styling issues are fixed** - Background extends properly, user input blocks are readable
2. **System instructions are more usable** - Moved to event stream column, rendered as markdown
3. **Split pane is resizable** - Users can drag the divider to adjust pane widths
4. **Tool forms handle long text better** - String inputs use expandable textareas
5. **Tool events are differentiated** - Clear distinction between tool calls and responses

This completes the remaining Phase 3 task (SmartBlobComponent) and addresses multiple Phase 5 polish items.

---

## Selected Scope

### Tasks from TDD

| Task | FR | Phase | Notes |
|------|----|-------|-------|
| `SmartBlobComponent` | FR-012-014 | Phase 3 | JSON/MD/RAW toggle for text content |
| Error handling | FR-004 | Phase 5 | Dark mode is a visual error state |
| Accessibility audit | - | Phase 5 | Text contrast issues are accessibility bugs |

**Additional UX improvements** (not explicitly in TDD but align with polish goals):

| Improvement | Related FR | Notes |
|-------------|------------|-------|
| Dark mode background fix | FR-005 | Layout should work correctly in both themes |
| System instructions layout | FR-015 | Better UX for referencing while working |
| Resizable split pane | FR-005 | Enhanced split-pane usability |
| Textarea for string inputs | FR-017 | Better UX for tool forms |
| Tool event differentiation | FR-007 | Clearer event stream visualization |

---

## Research Summary

### Relevant Findings

#### Dark Mode Theme Configuration

**Source**: [frontend/src/theme.scss](../../../frontend/src/theme.scss)

Dark mode is activated via `.dark-theme` class on the body element. The theme uses Angular Material's system-level colors which set CSS variables like `--sys-surface`, `--sys-on-surface`, etc. The issue is that when content doesn't fill the viewport, the `<main>` element's background doesn't extend - it uses the default (light) surface color from `html` instead of inheriting the dark theme colors.

The fix involves ensuring the root `html` element also receives dark theme colors, or making the app container extend to fill available space with the appropriate background.

#### Event Block Styling

**Source**: [frontend/src/app/ui/event-stream/event-block/event-block.component.ts](../../../frontend/src/app/ui/event-stream/event-block/event-block.component.ts)

Event blocks use `data-type` attribute for role-based styling:
- `user` type: Blue border (`#2196f3`), light blue background (`rgba(33, 150, 243, 0.05)`)
- `model` type: Green border (`#4caf50`), light green background
- `tool` type: Orange border (`#ff9800`), light orange background

The user block uses CSS variables for text (`--mat-sys-on-surface`) which should work in dark mode, but the hardcoded RGBA backgrounds with 5% opacity create very low contrast against dark surfaces. The text content uses `var(--mat-sys-on-surface)` which is correct, but the background needs theme-aware colors.

#### System Instructions Current Implementation

**Source**: [frontend/src/app/features/session/session.component.ts](../../../frontend/src/app/features/session/session.component.ts)

Currently, the system instructions accordion is positioned above the split pane in the DOM:
```html
<div class="session-container">
  <header>...</header>
  <div class="system-instructions">...</div>  <!-- Full width above split -->
  <app-split-pane>
    <div main>Event Stream</div>
    <div sidebar>Control Panel</div>
  </app-split-pane>
</div>
```

To fix the UX issue (expanded instructions hiding control panel), the accordion should move inside the main slot:
```html
<app-split-pane>
  <div main>
    <div class="system-instructions">...</div>  <!-- Inside main pane -->
    <div class="event-stream">...</div>
  </div>
  <div sidebar>Control Panel</div>
</app-split-pane>
```

The instruction text is currently rendered as `<pre>` with monospace font. This should be replaced with SmartBlobComponent to render markdown by default.

#### Split Pane Component Structure

**Source**: [frontend/src/app/ui/shared/split-pane/split-pane.component.ts](../../../frontend/src/app/ui/shared/split-pane/split-pane.component.ts)

The current SplitPaneComponent uses Tailwind flexbox with content projection:
- Main pane: `flex-1 overflow-auto`
- Sidebar: fixed width via `[style.width.px]`, `flex-shrink: 0`
- Divider: Just a `border-l` class on sidebar

For resizable behavior, we need:
1. A dedicated divider element between panes
2. Mouse event handlers for drag interaction
3. State to track the sidebar width during drag
4. CSS cursor changes on hover/drag

Options:
- **CSS `resize` property**: Simple but limited browser support and poor UX
- **JavaScript drag handling**: More control, better UX
- **Third-party library (angular-split)**: Feature-rich but adds dependency

Recommendation: JavaScript drag handling using pointer events for the best balance of control and simplicity.

#### SmartBlobComponent Design

**Source**: [frontend-tdd.md - SmartBlobComponent](../frontend-tdd.md#smartblobcomponent)

The TDD provides a complete design for SmartBlobComponent with:
- Auto-detection of JSON and Markdown content
- Mode toggle buttons: `[JSON]`, `[MD]`, `[RAW]`
- Computed signals for format detection
- Effect to auto-select best mode on content change

Dependencies needed:
- `JsonDetectionService` - detect valid JSON strings
- `MarkdownDetectionService` - detect markdown patterns
- `MarkdownPipe` or library for rendering

For markdown rendering, options include:
- `marked` library with a custom pipe
- `ngx-markdown` library (more features but larger)
- Native `markdown-it` with custom integration

Recommendation: Use `marked` library with a custom `MarkdownPipe` for simplicity.

#### JSONForms Custom Renderers

**Source**: [jsonforms-research.md - Custom Renderers](../research/jsonforms-research.md#custom-renderers)

Custom renderers extend `JsonFormsControl` and use:
- `rankWith()` to set priority (higher = more specific)
- Tester functions like `isStringControl`, `schemaMatches`, `scopeEndsWith`
- `this.jsonFormsService.updateCore(Actions.update(...))` to emit changes

For a textarea renderer:
- Target all string type schemas
- Use rank that's higher than default string renderer
- Render `<textarea>` with Material styling
- Single-line height by default, expandable

The existing `AnyObjectRenderer` provides a good template for implementation.

### Key Decisions Already Made

| Decision | Choice | Source |
|----------|--------|--------|
| Dark mode activation | `.dark-theme` class on body | [theme.scss](../../../frontend/src/theme.scss) |
| Theme CSS variables | Material's `--sys-*` convention | [styles.scss](../../../frontend/src/styles.scss) |
| Split pane implementation | Tailwind CSS (no third-party lib) | [Sprint 5 decisions](./sprint5.md#key-decisions-already-made) |
| SmartBlob modes | JSON, Markdown, Raw | [TDD SmartBlobComponent](../frontend-tdd.md#smartblobcomponent) |
| JSONForms custom renderer pattern | Extend JsonFormsControl | [AnyObjectRenderer](../../../frontend/src/app/ui/control-panel/renderers/any-object.renderer.ts) |

### Open Questions for This Sprint

- [ ] Should the resizable split pane have min/max width constraints? **Recommendation**: Yes - min 200px sidebar, max 50% of viewport
- [ ] Should markdown rendering in SmartBlob sanitize HTML? **Recommendation**: Yes - use DOMPurify or Angular's built-in sanitizer
- [ ] Should the textarea renderer have a character/line limit indicator? **Defer** - basic implementation first

---

## Pull Request Plan

### S6PR1: Fix dark mode background color extending to full viewport

**Estimated Lines**: ~30 lines
**Depends On**: -

**Goal**: Ensure the dark theme background color extends to fill the entire viewport even when content is short.

**Files to Create/Modify**:
- `frontend/src/styles.scss` - Add dark theme body background
- `frontend/src/app/app.scss` - Ensure host fills viewport with theme-aware background

**Background Reading**:
- [Theme Configuration](../../../frontend/src/theme.scss) - How dark theme is applied
- [Global Styles](../../../frontend/src/styles.scss) - Current body styling

**Acceptance Criteria**:
- [ ] In dark mode, entire viewport has dark background (no white rectangles)
- [ ] Works when session content doesn't fill the screen vertically
- [ ] Light mode continues to work correctly
- [ ] Tested with `ops docker up` at localhost:4200
- [ ] Presubmit passes

---

### S6PR2: Fix User Input event block text contrast in dark mode

**Estimated Lines**: ~50 lines
**Depends On**: -

**Goal**: Make user input event block text readable in dark mode by using theme-aware background colors.

**Files to Create/Modify**:
- `frontend/src/app/ui/event-stream/event-block/event-block.component.ts` - Update styles for dark mode compatibility

**Background Reading**:
- [EventBlockComponent Implementation](../../../frontend/src/app/ui/event-stream/event-block/event-block.component.ts) - Current styling with hardcoded RGBA
- [Material Theme Variables](../../../frontend/src/theme.scss) - Available CSS variables

**Acceptance Criteria**:
- [ ] User input block text is clearly readable in dark mode
- [ ] User input block maintains distinct visual identity (blue accent)
- [ ] Model and tool blocks also look good in dark mode (verify no regressions)
- [ ] Light mode appearance is unchanged or improved
- [ ] Playwright component tests pass (update snapshots if needed)
- [ ] Presubmit passes

---

### S6PR3: Move system instructions accordion into event stream column

**Estimated Lines**: ~80 lines
**Depends On**: -

**Goal**: Move the system instructions accordion from above the split pane to inside the left (event stream) column, so expanding it doesn't hide the control panel.

**Files to Create/Modify**:
- `frontend/src/app/features/session/session.component.ts` - Restructure template and styles

**Background Reading**:
- [SessionComponent Current State](../../../frontend/src/app/features/session/session.component.ts) - Current layout structure
- [FR-015 Requirement](../frontend-spec.md#fr-context-inspection) - System instruction accordion requirement

**Acceptance Criteria**:
- [ ] System instructions accordion is inside the left pane (same column as event stream)
- [ ] Expanding accordion only affects event stream area, control panel stays in place
- [ ] Accordion header styling is consistent with current design
- [ ] Event stream scrolls independently when instructions expanded
- [ ] Works correctly in both light and dark modes
- [ ] Presubmit passes

---

### S6PR4: Create SmartBlobComponent with markdown rendering

**Estimated Lines**: ~180 lines
**Depends On**: -

**Goal**: Implement the SmartBlobComponent for rendering text content with JSON/Markdown/Raw mode toggles.

**Completes TDD Task**: `SmartBlobComponent` (Phase 3)

**Files to Create/Modify**:
- `frontend/src/app/ui/shared/smart-blob/smart-blob.component.ts` - Component implementation
- `frontend/src/app/ui/shared/smart-blob/smart-blob.component.spec.ts` - Unit tests
- `frontend/src/app/ui/shared/smart-blob/markdown.pipe.ts` - Markdown rendering pipe
- `frontend/src/app/ui/shared/smart-blob/content-detection.service.ts` - JSON/MD detection
- `frontend/src/app/ui/shared/smart-blob/index.ts` - Public exports
- `frontend/src/app/ui/shared/index.ts` - Add smart-blob export
- `frontend/package.json` - Add `marked` dependency

**Background Reading**:
- [SmartBlobComponent Design](../frontend-tdd.md#smartblobcomponent) - Full component specification with code
- [FR-012 through FR-014](../frontend-spec.md#fr-context-inspection) - JSON/MD/RAW toggle requirements
- [SmartBlob Entity](../frontend-spec.md#smartblob-entity) - Entity definition

**Acceptance Criteria**:
- [ ] Component accepts `content` input signal (required string)
- [ ] Auto-detects JSON content and shows `[JSON]` toggle
- [ ] Auto-detects Markdown content and shows `[MD]` toggle
- [ ] Always shows `[RAW]` toggle
- [ ] JSON mode renders content using DataTreeComponent (or simple formatted view)
- [ ] Markdown mode renders HTML using marked library
- [ ] Raw mode displays preformatted text preserving whitespace
- [ ] Sanitizes rendered markdown HTML for security
- [ ] Unit tests cover detection logic and mode switching
- [ ] Playwright component tests with screenshots for each mode
- [ ] Presubmit passes

---

### S6PR5: Integrate SmartBlobComponent for system instructions

**Estimated Lines**: ~40 lines
**Depends On**: S6PR3, S6PR4

**Goal**: Replace the raw `<pre>` rendering of system instructions with SmartBlobComponent to enable markdown rendering.

**Files to Create/Modify**:
- `frontend/src/app/features/session/session.component.ts` - Use SmartBlobComponent for instructions

**Background Reading**:
- [SmartBlobComponent Design](../frontend-tdd.md#smartblobcomponent) - Component specification (created in S6PR4)
- [SessionComponent](../../../frontend/src/app/features/session/session.component.ts) - Where to integrate

**Acceptance Criteria**:
- [ ] System instructions render using SmartBlobComponent
- [ ] Markdown instructions display as formatted HTML by default
- [ ] Users can toggle to RAW view to see original text
- [ ] JSON-structured instructions (if any) can be viewed as tree
- [ ] Works in both light and dark modes
- [ ] Presubmit passes

---

### S6PR6: Add resizable divider to SplitPaneComponent

**Estimated Lines**: ~120 lines
**Depends On**: -

**Goal**: Allow users to drag the divider between panes to resize them.

**Files to Create/Modify**:
- `frontend/src/app/ui/shared/split-pane/split-pane.component.ts` - Add drag functionality
- `frontend/src/app/ui/shared/split-pane/split-pane.component.spec.ts` - Update tests

**Background Reading**:
- [SplitPaneComponent Current](../../../frontend/src/app/ui/shared/split-pane/split-pane.component.ts) - Current implementation
- [FR-005 Layout](../frontend-spec.md#fr-layout-and-navigation) - Split pane requirements

**Acceptance Criteria**:
- [x] Divider element is visible between panes (subtle vertical line)
- [x] Cursor changes to `col-resize` on hover over divider
- [x] Dragging divider adjusts sidebar width in real-time
- [x] Sidebar has minimum width constraint (200px)
- [x] Sidebar has maximum width constraint (50% of container)
- [x] Drag state properly cleaned up on mouse up (even outside component)
- [x] Works with touch events for mobile/tablet
- [x] Existing `sidebarWidth` input still works as initial value
- [x] Unit tests cover drag behavior
- [x] Presubmit passes

---

### S6PR7: Create textarea custom renderer for JSONForms string fields

**Estimated Lines**: ~100 lines
**Depends On**: -

**Goal**: Replace the default text input with a textarea for all string fields in JSONForms, with single-line default height.

**Files to Create/Modify**:
- `frontend/src/app/ui/control-panel/renderers/string-textarea.renderer.ts` - Custom renderer
- `frontend/src/app/ui/control-panel/renderers/index.ts` - Export new renderer
- `frontend/src/app/ui/control-panel/tool-form/tool-form.component.ts` - Register renderer

**Background Reading**:
- [JSONForms Custom Renderers](../research/jsonforms-research.md#custom-renderers) - How to create custom renderers
- [AnyObjectRenderer](../../../frontend/src/app/ui/control-panel/renderers/any-object.renderer.ts) - Existing custom renderer pattern
- [ToolFormComponent](../../../frontend/src/app/ui/control-panel/tool-form/tool-form.component.ts) - Where renderers are registered

**Acceptance Criteria**:
- [ ] All string type fields render as `<textarea>` instead of `<input type="text">`
- [ ] Textarea has single-line height by default (rows="1" or equivalent)
- [ ] Textarea expands vertically when user enters multiple lines
- [ ] Material Design styling matches other form fields
- [ ] Validation errors display correctly
- [ ] Works with required fields, patterns, and other string constraints
- [ ] Unit tests verify renderer registration and behavior
- [ ] Presubmit passes

---

### S6PR8: Differentiate Tool Call vs Tool Response in event blocks

**Estimated Lines**: ~80 lines
**Depends On**: -

**Goal**: Visually differentiate between tool calls (function invocation) and tool responses (function result) in the event stream.

**Files to Create/Modify**:
- `frontend/src/app/ui/event-stream/event-block/event-block.component.ts` - Add sub-type differentiation

**Background Reading**:
- [EventBlockComponent](../../../frontend/src/app/ui/event-stream/event-block/event-block.component.ts) - Current tool handling
- [FR-007 Event Blocks](../frontend-spec.md#fr-context-inspection) - Block type requirements

**Acceptance Criteria**:
- [ ] Tool Call blocks show distinct styling (e.g., "Tool Call" label, call icon)
- [ ] Tool Response blocks show distinct styling (e.g., "Tool Response" label, response icon)
- [ ] Both types maintain orange accent color for "tool" category
- [ ] Icon differentiation: `call_made` or `functions` for calls, `call_received` or `output` for responses
- [ ] Clear visual hierarchy between call and response
- [ ] Works correctly in both light and dark modes
- [ ] Playwright component tests with screenshots for both types
- [ ] Presubmit passes

---

## Implementation Notes

### Patterns to Follow

1. **Theme-Aware Colors**: Use CSS variables (`--sys-*`, `--mat-sys-*`) instead of hardcoded colors for dark mode compatibility.

2. **Signal-Based State**: For drag state in SplitPaneComponent, use signals (`isDragging`, `currentWidth`) rather than class properties.

3. **Cleanup with DestroyRef**: For pointer event listeners added to `document`, clean up in `destroyRef.onDestroy()`.

4. **Content Detection Services**: Keep detection logic in services (not pipes) so it can be tested independently and reused.

5. **Custom Renderer Priority**: Use rank 3-4 for the string textarea renderer (higher than default material renderer rank 2, lower than specialized renderers rank 5+).

6. **Markdown Security**: Always sanitize markdown HTML output. Use Angular's DomSanitizer or include DOMPurify.

### Gotchas to Avoid

- **Body Class Dark Mode**: The `.dark-theme` class is on `<body>`, not `:root`. Styles targeting `:root` won't work for dark mode overrides.

- **Pointer Events vs Mouse Events**: Use pointer events (`pointerdown`, `pointermove`, `pointerup`) for drag handling - they work for both mouse and touch.

- **Marked XSS**: The `marked` library doesn't sanitize by default. Always pass output through DomSanitizer or DOMPurify.

- **JSONForms Renderer Registration Order**: Renderers are checked in order of rank. Make sure the textarea renderer rank is appropriate to not override specialized renderers.

- **Component Test Dark Mode**: For Playwright component tests, the theme fixture needs to add `.dark-theme` to body. Verify existing fixtures handle this correctly.

---

## Definition of Done

- [ ] All 8 PRs merged to main
- [ ] Dark mode has no visual bugs (white rectangles, unreadable text)
- [ ] System instructions usable alongside control panel
- [ ] SmartBlobComponent available for reuse (completes TDD Phase 3 task)
- [ ] Split pane is resizable via drag
- [ ] String inputs in tool forms use expandable textareas
- [ ] Tool calls and responses are visually differentiated
- [ ] All Playwright tests pass (component and e2e)
- [ ] Visual regression snapshots updated where needed
- [ ] Presubmit passes on all PRs

---

## Retrospective Notes

*(To be filled after sprint completion)*
