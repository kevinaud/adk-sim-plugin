# Prior Art: DevTools-Style Event Stream Renderer

**Branch**: `002-web-ui` | **Date**: 2026-01-11 | **Type**: Prior Art Research

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
  - [The JSON Blindness Problem](#the-json-blindness-problem)
  - [Accordion Fatigue](#accordion-fatigue)
  - [User Story (from spec)](#user-story-from-spec)
- [Solution: DevTools-Style Tree](#solution-devtools-style-tree)
  - [Core Design Principles](#core-design-principles)
  - [Visual Reference](#visual-reference)
- [Architecture](#architecture)
  - [Component Hierarchy](#component-hierarchy)
  - [State Management](#state-management)
  - [State Resolution Logic](#state-resolution-logic)
- [Key Components](#key-components)
  - [1. DevToolsTree (`renderer.py`)](#1-devtoolstree-rendererpy)
  - [2. SmartBlobDetector (`smart_blob.py`)](#2-smartblobdetector-smartblobpy)
  - [3. SmartBlobRenderer (`smart_blob_renderer.py`)](#3-smartblobrenderer-smartblobrendererpy)
  - [4. BlobTogglePills (`blob_toggle_pills.py`)](#4-blobtogglepills-blobtogglepillspy)
- [Smart Blob Detection](#smart-blob-detection)
  - [Why This Matters](#why-this-matters)
  - [Detection Algorithm](#detection-algorithm)
  - [Edge Cases Handled](#edge-cases-handled)
- [Toggle Pills UX Pattern](#toggle-pills-ux-pattern)
  - [Design Rationale](#design-rationale)
  - [Styling Constants](#styling-constants)
  - [Default Mode Selection](#default-mode-selection)
- [Tool Catalog Design](#tool-catalog-design)
  - [Purpose](#purpose)
  - [Design Elements (from screenshot)](#design-elements-from-screenshot)
  - [Implementation Notes](#implementation-notes)
- [Visual Design System](#visual-design-system)
  - [Color Palette (DevTools Tree)](#color-palette-devtools-tree)
  - [Event Type Colors](#event-type-colors)
- [Key Learnings](#key-learnings)
  - [1. Clean-Room Implementation Was Necessary](#1-clean-room-implementation-was-necessary)
  - [2. Expansion State Design Matters](#2-expansion-state-design-matters)
  - [3. Detection Should Be Lazy](#3-detection-should-be-lazy)
  - [4. Default to the Richest View](#4-default-to-the-richest-view)
  - [5. Inline Expansion Preserves Context](#5-inline-expansion-preserves-context)
- [Applicability to Current Project](#applicability-to-current-project)
  - [What Can Be Directly Ported](#what-can-be-directly-ported)
  - [What Needs Adaptation](#what-needs-adaptation)
  - [Recommended Angular Implementation](#recommended-angular-implementation)
  - [Integration with Existing Research](#integration-with-existing-research)
- [References](#references)

## Overview

This document captures prior art from the `adk-agent-sim` project (first attempt at ADK Agent Simulator), specifically the work done under `specs/004-devtools-event-renderer/`. This feature branch produced a high-quality solution to one of the hardest UX challenges in agentic AI tooling: **rendering tool invocation responses**.

The implementation went through a full specification cycle with:
- Research document analyzing NiceGUI tree patterns
- Data model with entity definitions
- Implementation plan with 5 sequential PRs
- Task breakdown for execution

---

## Problem Statement

### The JSON Blindness Problem

Agentic LLM workflows produce **nested, complex JSON structures** that humans cannot visually parse efficiently:

| Problem | Example |
|---------|---------|
| **Deep nesting** | `{"execution_trace": [{"step_id": "init_01", "config": {...}}]}` |
| **Stringified JSON** | A JSON field containing a string that is itself JSON |
| **Markdown in JSON** | Search tools returning markdown documents wrapped in JSON response envelopes |
| **Double encoding** | `{"response": "{\"data\": \"value\"}"}`  |

### Accordion Fatigue

The original UI used Material Design accordions (`ui.expansion()`) which required:
- Multiple clicks to reveal nested data
- Loss of context when expanding one section (others collapsed)
- No clear visual hierarchy
- Heavy borders and icons that consumed screen real estate

### User Story (from spec)

> As a developer diagnosing agent behavior, I want to see the full execution trace immediately upon opening the event stream, so that I can quickly understand what happened without clicking through multiple layers of accordions.

---

## Solution: DevTools-Style Tree

The solution drew inspiration from **Chrome DevTools Network/Sources panel** and VSCode's JSON viewers:

### Core Design Principles

1. **Expanded by default** - All nodes visible immediately, no clicks required
2. **Compact typography** - Monospace, tight spacing, no heavy borders
3. **Thread lines** - Thin vertical guide lines connecting parent-child nodes
4. **Syntax coloring** - Keys, strings, numbers, booleans each have distinct colors
5. **Inline expansion** - Content expands in-place, no modals or side panels

### Visual Reference

The screenshots show the final implementation:

![Tool Output Block](../../../docs/screenshots/tool-output-devtools.png)

Key visual elements:
- Duration badge (1240ms)
- Checkmark success indicator
- Collapsible tree with chevron toggles
- RAW/JSON and RAW/MD toggle pills inline with values
- Rendered markdown for `chain_of_thought` field

---

## Architecture

### Component Hierarchy

```
EventStream
├── Global Controls (Expand All / Collapse All)
└── EventBlock[]
    └── DevToolsTree
        ├── TreeExpansionState (sparse storage)
        └── TreeNode[]
            └── SmartBlobRenderer (for string values)
                ├── BlobTogglePills ([RAW] [JSON] [MD])
                └── Content View (raw/json tree/markdown)
```

### State Management

```python
# Path-based addressing for expansion state
TreeExpansionState
├── global_mode: GlobalMode       # DEFAULT | ALL_EXPANDED | ALL_COLLAPSED
├── node_overrides: dict[str, bool]  # "root.trace.0.config" → True
└── default_expanded: bool        # True (spec requirement)

# View mode per-blob
BlobViewState
├── modes: dict[str, BlobType]    # "blob_123" → BlobType.JSON
└── defaults: dict[str, BlobType] # Auto-detected defaults
```

### State Resolution Logic

```python
def is_expanded(path: str) -> bool:
    if path in node_overrides:
        return node_overrides[path]
    if global_mode == ALL_EXPANDED:
        return True
    if global_mode == ALL_COLLAPSED:
        return False
    return default_expanded  # True by default
```

---

## Key Components

### 1. DevToolsTree (`renderer.py`)

**Purpose**: Recursively render JSON as a hierarchical tree with DevTools aesthetics.

**Key Implementation Details**:

```python
class DevToolsTree:
    def __init__(
        self,
        data: Any,
        tree_id: str,
        expansion_state: TreeExpansionState | None = None,
        blob_view_state: BlobViewState | None = None,
        enable_smart_blobs: bool = True,
    ) -> None: ...
```

**Rendering Strategy**:
1. Determine `ValueType` (OBJECT, ARRAY, STRING, NUMBER, BOOLEAN, NULL)
2. For containers: render toggle chevron + opening brace
3. For primitives: render value with syntax coloring
4. For strings: check if SmartBlob detection should be used
5. Recursive rendering with `depth` tracking for indentation

**CSS Thread Lines Pattern**:
```css
.tree-node::before {
    content: '';
    position: absolute;
    left: 8px;
    border-left: 1px solid #E0E0E0;
}
```

### 2. SmartBlobDetector (`smart_blob.py`)

**Purpose**: Detect structured content (JSON/Markdown) in string values.

**Detection Priority**:
1. **JSON first** - If string starts with `{` or `[` and parses successfully → `BlobType.JSON`
2. **Markdown second** - If contains Markdown patterns → `BlobType.MARKDOWN`
3. **Plain text default** - Everything else → `BlobType.PLAIN_TEXT`

**Markdown Detection (using markdown-it-py)**:
```python
markdown_indicators = {
    "heading_open",      # ## Header
    "fence",             # ```code```
    "blockquote_open",   # > quote
    "list_item_open",    # - item or 1. item
    "table_open",        # | table |
    "hr",                # ---
    "link_open",         # [link](url)
    "em_open",           # *italic*
    "strong_open",       # **bold**
}
```

### 3. SmartBlobRenderer (`smart_blob_renderer.py`)

**Purpose**: Render string values with appropriate view mode and toggles.

**View Modes**:
- **RAW**: Monospace with preserved whitespace (`white-space: pre-wrap`)
- **JSON**: Recursive `DevToolsTree` for parsed content
- **MARKDOWN**: NiceGUI's `ui.markdown()` component

**Error Handling**:
```python
def _render_json_view(self) -> None:
    parsed, error = SmartBlobDetector.try_parse_json(self.value)
    if error is not None:
        # Malformed JSON - show raw with error indicator
        self._render_raw_with_error(error)
        return
    # Render nested tree
    DevToolsTree(data=parsed, tree_id=f"{self.blob_id}_json", ...).render()
```

### 4. BlobTogglePills (`blob_toggle_pills.py`)

**Purpose**: Compact pill buttons for switching view modes.

**Design**:
- Pills: `[RAW]` `[JSON]` `[MD]`
- Active state: solid background (#1976D2 blue)
- Inactive state: transparent with border
- Gap: 4px between pills

**Availability Logic**:
```python
def get_available_modes(self) -> list[BlobType]:
    modes = [BlobType.PLAIN_TEXT]  # RAW always available
    if self.detected_type == BlobType.JSON:
        modes.append(BlobType.JSON)
    if self.detected_type == BlobType.MARKDOWN:
        modes.append(BlobType.MARKDOWN)
    return modes
```

---

## Smart Blob Detection

### Why This Matters

In agentic workflows, tool outputs frequently contain:

| Pattern | Example | Challenge |
|---------|---------|-----------|
| Stringified config | `"remote_config": "{\"model\": \"gemini-1.5-pro\"}"` | Double-encoded JSON |
| Reasoning traces | `"chain_of_thought": "## Analysis\n- Point 1\n- Point 2"` | Markdown in string |
| Nested responses | `{"result": {"data": [...]}}` | Deep object nesting |
| Error messages | `"error": "Failed to parse: {\"bad\": json}"` | JSON fragments in text |

### Detection Algorithm

```python
@staticmethod
def detect_type(value: str) -> BlobType:
    if not value or not value.strip():
        return BlobType.PLAIN_TEXT

    # Try JSON first (higher priority)
    parsed, _ = SmartBlobDetector.try_parse_json(value)
    if parsed is not None:
        return BlobType.JSON

    # Check for Markdown patterns
    if SmartBlobDetector.detect_markdown_patterns(value):
        return BlobType.MARKDOWN

    return BlobType.PLAIN_TEXT
```

### Edge Cases Handled

1. **Malformed JSON** → Fall back to RAW view, don't offer JSON toggle
2. **False positive Markdown** (string contains `*` but isn't formatting) → Toggle allows user to switch to RAW
3. **Double-encoded JSON** → Recursive detection offers nested toggles
4. **Very long strings (10KB+)** → Truncate preview, render expanded content progressively

---

## Toggle Pills UX Pattern

### Design Rationale

Traditional approaches (radio buttons, tabs, dropdowns) were rejected:

| Approach | Problem |
|----------|---------|
| Radio buttons | Too large, not inline with content |
| Tabs | Heavy UI overhead for inline use |
| Dropdowns | Requires extra click to see options |

**Pills** provide:
- Inline display alongside the value
- All options visible at once
- Single-click switching
- Minimal visual weight

### Styling Constants

```python
SMART_BLOB_STYLES = {
    "pill_padding": "2px 8px",
    "pill_border_radius": "4px",
    "pill_font_size": "11px",
    "pill_font_family": "ui-sans-serif, system-ui, sans-serif",
    # Active pill (selected mode)
    "active_bg": "#1976D2",
    "active_text": "#FFFFFF",
    "active_border": "#1976D2",
    # Inactive pill (unselected mode)
    "inactive_bg": "transparent",
    "inactive_text": "#616161",
    "inactive_border": "#BDBDBD",
}
```

### Default Mode Selection

Per the spec clarification:
- JSON blobs → default to parsed tree view (JSON toggle active)
- Markdown blobs → default to rendered Markdown (MD toggle active)
- Plain strings → default to RAW view

This means users see the "richest" representation immediately.

---

## Tool Catalog Design

### Purpose

Allow users to:
1. Browse all tools available to the selected agent
2. View tool descriptions and parameter schemas
3. Select a tool to invoke

### Design Elements (from screenshot)

```
┌─────────────────────────────────────────────┐
│ ✕ Tools (3)                            ∧    │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ 🔧 search_knowledge_base                │ │
│ │                                         │ │
│ │ Searches the internal knowledge base... │ │
│ │                                         │ │
│ │ {} Parameters                           │ │
│ │                                         │ │
│ │ query*:    [STRING]                     │ │
│ │   The search query string.              │ │
│ │                                         │ │
│ │ limit:     [INTEGER]                    │ │
│ │   Max number of results.                │ │
│ │                                         │ │
│ │ * required                              │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ 🔧 calculator                           │ │
│ │ ...                                     │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Implementation Notes

```python
class ToolCatalog:
    """Read-only view of all tools available to the selected agent."""

    def _render_tool_card(self, tool_info: ToolInfo) -> None:
        # Tool header with name
        ui.icon("build", size="sm").classes("text-blue-600")
        ui.label(tool_info["name"]).classes("font-medium text-blue-800")

        # Description
        ui.label(tool_info["description"]).classes("text-sm text-gray-600")

        # Parameter schema
        for param_name, param_info in display_params.items():
            is_required = param_name in required
            req_badge = "*" if is_required else ""
            ui.badge(param_type, color="gray-4").props("dense")
```

---

## Visual Design System

### Color Palette (DevTools Tree)

```python
DEVTOOLS_TREE_STYLES = {
    "font_family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    "font_size": "13px",
    "key_color": "#881391",      # Purple for keys (Chrome DevTools style)
    "string_color": "#C41A16",   # Red for strings
    "number_color": "#1C00CF",   # Blue for numbers
    "boolean_color": "#0D47A1",  # Dark blue for booleans
    "null_color": "#808080",     # Gray for null
    "bracket_color": "#000000",  # Black for brackets
}
```

### Event Type Colors

```python
HISTORY_COLORS = {
    "user_query": "#E3F2FD",    # Light blue
    "tool_call": "#FFF3E0",     # Light orange
    "tool_output": "#E8F5E9",   # Light green
    "tool_error": "#FFEBEE",    # Light red
    "final_response": "#F3E5F5", # Light purple
}

HISTORY_BORDER_COLORS = {
    "user_query": "#1976D2",    # Blue
    "tool_call": "#F57C00",     # Orange
    "tool_output": "#388E3C",   # Green
    "tool_error": "#D32F2F",    # Red
    "final_response": "#7B1FA2", # Purple
}
```

---

## Key Learnings

### 1. Clean-Room Implementation Was Necessary

The spec explicitly warned:

> ⚠️ **NO CODE REUSE**: The existing `json_tree.py` implementation has multiple bugs that have been difficult to diagnose. The new `DevToolsTree` component MUST be implemented from scratch.

**Lesson**: When a component has accumulated technical debt, sometimes starting fresh is faster than debugging.

### 2. Expansion State Design Matters

The sparse storage pattern with global override:

```python
if path in node_overrides:
    return node_overrides[path]
if global_mode == ALL_EXPANDED:
    return True
```

**Benefits**:
- Memory efficient (only stores exceptions)
- Fast bulk operations (expand all is O(1))
- Preserves user intent after bulk operations

### 3. Detection Should Be Lazy

JSON/Markdown detection happens at render time, not parse time:

**Why**: Large datasets don't need every string analyzed upfront. Detection only happens for strings that are actually visible.

### 4. Default to the Richest View

Users see parsed JSON trees and rendered Markdown by default. They can switch to RAW if needed.

**Why**: Most of the time, the structured view is what developers want. Raw access is for debugging edge cases.

### 5. Inline Expansion Preserves Context

Modals and side panels break the user's mental model. Inline expansion:
- Keeps the surrounding tree visible
- Shows where in the hierarchy the expanded content lives
- Allows comparison with sibling values

---

## Applicability to Current Project

### What Can Be Directly Ported

| Component | Portability | Notes |
|-----------|-------------|-------|
| Color palette | ✅ Direct | CSS values work in any framework |
| Detection algorithms | ✅ Direct | Heuristics are framework-agnostic |
| Toggle pills UX pattern | ✅ Direct | Concept translates to Angular buttons |
| Expansion state model | ✅ Direct | Same data structure in TypeScript |
| Tool catalog layout | ✅ Direct | Card-based design works in Angular |

### What Needs Adaptation

| Component | Adaptation Needed | Approach |
|-----------|-------------------|----------|
| DevToolsTree renderer | Major | Build Angular component with same UX |
| NiceGUI-specific bindings | Replace | Use Angular signals/change detection |
| CSS-in-Python patterns | Replace | Use SCSS/CSS modules |
| `ui.refreshable` | Replace | Angular `@Input()` change detection |

### Recommended Angular Implementation

```typescript
// Smart blob detection service (port directly)
@Injectable({ providedIn: 'root' })
export class SmartBlobDetector {
  detectType(value: string): BlobType { ... }
  tryParseJson(value: string): [unknown, string | null] { ... }
  detectMarkdownPatterns(value: string): boolean { ... }
}

// Toggle pills component (new implementation, same UX)
@Component({
  selector: 'app-blob-toggle-pills',
  template: `
    @for (mode of availableModes(); track mode) {
      <button
        [class.active]="currentMode() === mode"
        (click)="setMode(mode)"
      >{{ mode.label }}</button>
    }
  `
})
export class BlobTogglePillsComponent { ... }

// DevTools tree (new implementation, same UX)
@Component({
  selector: 'app-devtools-tree',
  template: `...recursive tree rendering...`
})
export class DevToolsTreeComponent {
  @Input() data: unknown;
  @Input() treeId: string;
  // ...
}
```

### Integration with Existing Research

This prior art complements:

- [JSONForms Research](jsonforms-research.md) - For tool parameter input forms
- [Converter Research](converter-research.md) - For event stream data handling
- [Frontend TDD](../frontend-tdd.md) - FR-003 (Event Stream) now has concrete prior art

---

## References

- Original spec: `/tmp/adk-agent-sim/specs/004-devtools-event-renderer/spec.md`
- Implementation: `/tmp/adk-agent-sim/adk_agent_sim/ui/components/devtools_tree/`
- Tool catalog: `/tmp/adk-agent-sim/adk_agent_sim/ui/components/tool_catalog.py`
