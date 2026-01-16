# Sprint 4: Tailwind CSS Integration, Dark Mode & Session List Refactoring


## Table of Contents

- [Sprint Goal](#sprint-goal)
- [Selected Scope](#selected-scope)
  - [Refactoring Focus Areas](#refactoring-focus-areas)
- [Research Summary](#research-summary)
  - [Relevant Findings](#relevant-findings)
    - [Tailwind v4 Angular Integration](#tailwind-v4-angular-integration)
    - [Preflight Conflict Resolution](#preflight-conflict-resolution)
    - [Theme Bridge Pattern](#theme-bridge-pattern)
    - [Dark Mode with Theme Bridge](#dark-mode-with-theme-bridge)
    - [UI vs Feature Component Split](#ui-vs-feature-component-split)
  - [Key Decisions Already Made](#key-decisions-already-made)
  - [Open Questions for This Sprint](#open-questions-for-this-sprint)
- [Pull Request Plan](#pull-request-plan)
  - [S4PR1: Install and configure Tailwind CSS](#s4pr1-install-and-configure-tailwind-css)
  - [S4PR2: Create Theme Bridge with Dark Mode Support](#s4pr2-create-theme-bridge-with-dark-mode-support)
  - [S4PR3: Create ThemeService for Dark Mode State](#s4pr3-create-themeservice-for-dark-mode-state)
  - [S4PR4: Create DarkModeToggleComponent](#s4pr4-create-darkmodetogglecomponent)
  - [S4PR5: Add Dark Mode Support to Component Testing](#s4pr5-add-dark-mode-support-to-component-testing)
  - [S4PR6: Create LoadingStateComponent](#s4pr6-create-loadingstatecomponent)
  - [S4PR7: Create EmptyStateComponent](#s4pr7-create-emptystatecomponent)
  - [S4PR8: Create ErrorStateComponent](#s4pr8-create-errorstatecomponent)
  - [S4PR9: Create SessionCardComponent](#s4pr9-create-sessioncardcomponent)
  - [S4PR10: Refactor SessionListComponent to use new UI components](#s4pr10-refactor-sessionlistcomponent-to-use-new-ui-components)
  - [S4PR11: Migrate session-list styling to Tailwind](#s4pr11-migrate-session-list-styling-to-tailwind)
  - [S4PR12: Migrate shared UI component styling to Tailwind](#s4pr12-migrate-shared-ui-component-styling-to-tailwind)
- [Implementation Notes](#implementation-notes)
  - [Patterns to Follow](#patterns-to-follow)
  - [Gotchas to Avoid](#gotchas-to-avoid)
- [Definition of Done](#definition-of-done)
- [Retrospective Notes](#retrospective-notes)

## Sprint Goal

This sprint focuses on technical debt reduction, improved maintainability, and user experience. We will:

1. **Integrate Tailwind CSS** with Angular Material using the "Theme Bridge" pattern, eliminating the need for heavy custom SCSS while maintaining design consistency
2. **Add dark mode support** with a user-facing toggle, leveraging the Theme Bridge to automatically sync colors across Material and Tailwind
3. **Refactor the session-list component** to properly separate feature logic (data fetching, navigation, state management) from UI presentation (loading states, cards, layouts)

By sprint end, we will have a Tailwind-enabled codebase with dark mode support, clear separation between feature and UI components, dramatically reduced custom CSS, and a pattern for future component development.

---

## Selected Scope

This sprint does not implement new features from the TDD. Instead, it addresses technical debt accumulated during sprints 1-3.

### Refactoring Focus Areas

| Area | Current State | Target State | Rationale |
|------|--------------|--------------|-----------|
| Styling approach | Heavy custom SCSS (~500+ lines) | Tailwind utilities + Material defaults | Reduce maintenance burden, improve consistency |
| Session list component | Mixed feature + UI logic, ~100 lines template, ~180 lines SCSS | Feature shell + dumb UI components | Clear separation of concerns, improved testability |
| Material customization | Heavy overrides of default styles | Minimal overrides, embrace defaults | Work *with* the component library |

---

## Research Summary

### Relevant Findings

#### Tailwind v4 Angular Integration

**Source**: [material-tailwind-research.md#angular-21-native-integration](../research/deep-research/material-tailwind-research.md)

Angular 21 provides native Tailwind CSS support via `ng add tailwindcss`. This command installs dependencies, creates PostCSS configuration, and injects the Tailwind import into styles.scss. For our monorepo, we must also configure `@source` directives to scan shared packages.

#### Preflight Conflict Resolution

**Source**: [material-tailwind-research.md#the-preflight-conflict-granular-import-strategy](../research/deep-research/material-tailwind-research.md)

Tailwind's Preflight (CSS reset) conflicts with Angular Material by removing margins and borders from elements. The solution is granular imports: skip `preflight.css` and manually add a "Material Safe" reset that only includes `box-sizing: border-box` and preserves heading styles. This ensures Material components render correctly while giving us access to Tailwind utilities.

#### Theme Bridge Pattern

**Source**: [material-tailwind-research.md#design-system-integration-the-theme-bridge](../research/deep-research/material-tailwind-research.md)

The Theme Bridge makes Angular Material the single source of truth for design tokens. Material emits CSS variables via `use-system-variables: true`, and Tailwind consumes these via `@theme` configuration. This means `bg-primary` in Tailwind uses the same color as `color="primary"` in Material, automatically syncing across light/dark themes.

#### Dark Mode with Theme Bridge

**Source**: [material-tailwind-research.md#dark-mode](../research/deep-research/material-tailwind-research.md)

Because Tailwind is mapped to Material's system variables, dark mode is automatic. When the `.dark-theme` class is added to the body (standard Material practice), the `--sys-surface`, `--sys-primary`, and other variables change values. Since Tailwind reads these variables via the Theme Bridge, all `bg-surface` and `text-on-surface` styled elements update instantly without requiring `dark:` variant classes.

#### UI vs Feature Component Split

**Source**: Project conventions and best practices

Feature components handle:
- Data fetching and caching
- Navigation and routing
- Complex state management
- Business logic orchestration

UI components handle:
- Visual presentation
- Simple input/output contracts
- No direct service dependencies
- Snapshot testing for visual regression

The session-list component currently mixes both responsibilities, with ~105 lines of template code handling loading states, error states, empty states, and session item rendering alongside data fetching logic.

### Key Decisions Already Made

| Decision | Choice | Source |
|----------|--------|--------|
| CSS framework | Tailwind CSS v4 + Angular Material | [material-tailwind-research.md](../research/deep-research/material-tailwind-research.md) |
| Integration pattern | Theme Bridge (Material as source of truth) | [material-tailwind-research.md#design-system-integration](../research/deep-research/material-tailwind-research.md) |
| Preflight handling | Granular imports, skip preflight | [material-tailwind-research.md#the-resolution-granular-imports](../research/deep-research/material-tailwind-research.md) |
| Migration strategy | Strangler Fig (incremental, no big bang) | [material-tailwind-research.md#the-strangler-fig-pattern](../research/deep-research/material-tailwind-research.md) |
| Component philosophy | "UI-Boring" - 90% standard Material components | [material-tailwind-research.md#the-ui-boring-philosophy](../research/deep-research/material-tailwind-research.md) |

### Open Questions for This Sprint

- [ ] Should the new UI components (LoadingState, EmptyState, etc.) use inline styles or Tailwind classes? Decision: Prefer Tailwind classes for layout, inline styles only for animations.
- [ ] Should we create a "card" wrapper component or just use `mat-card` with Tailwind layout utilities? Decision: Use `mat-card` directly with Tailwind; no wrapper needed.

---

## Pull Request Plan

### S4PR1: Install and configure Tailwind CSS

**Estimated Lines**: ~80 lines
**Depends On**: -

**Goal**: Set up Tailwind CSS v4 with Angular 21 native integration and monorepo source configuration.

**Files to Create/Modify**:
- `frontend/package.json` - Tailwind dependencies added via `ng add`
- `frontend/.postcssrc.json` - PostCSS configuration (auto-generated)
- `frontend/src/styles.scss` - Granular Tailwind imports with Material-safe reset
- `frontend/angular.json` - Verify Tailwind builder configuration

**Background Reading**:
- [Automated Installation](../research/deep-research/material-tailwind-research.md#automated-installation) - `ng add tailwindcss` process
- [Monorepo Source Configuration](../research/deep-research/material-tailwind-research.md#monorepo-source-configuration) - `@source` directives
- [Granular Import Strategy](../research/deep-research/material-tailwind-research.md#the-resolution-granular-imports) - Material-safe reset

**Acceptance Criteria**:
- [ ] `ng add tailwindcss` executed successfully in frontend/
- [ ] `styles.scss` uses granular imports (theme, utilities) skipping preflight
- [ ] Material-safe reset added with `box-sizing: border-box` and heading restoration
- [ ] `@source "./app"` and `@source "../../packages"` configured
- [ ] Tailwind classes (e.g., `class="p-4"`) work in templates
- [ ] Existing Material components render correctly (no visual regression)
- [ ] Presubmit passes

---

### S4PR2: Create Theme Bridge with Dark Mode Support

**Estimated Lines**: ~120 lines
**Depends On**: S4PR1

**Goal**: Connect Angular Material's design tokens to Tailwind via CSS variables, with both light and dark theme variants configured.

**Files to Create/Modify**:
- `frontend/src/theme.scss` - Enable `use-system-variables: true`, define light and dark theme variants
- `frontend/src/styles.scss` - Add `@theme` block mapping Material variables to Tailwind colors

**Background Reading**:
- [Emit Material System Variables](../research/deep-research/material-tailwind-research.md#step-1-emit-material-system-variables) - Theme configuration
- [Map to Tailwind v4](../research/deep-research/material-tailwind-research.md#step-2-map-to-tailwind-v4) - `@theme` configuration
- [Dark Mode](../research/deep-research/material-tailwind-research.md#dark-mode) - Automatic dark mode via system variables

**Acceptance Criteria**:
- [ ] `theme.scss` defines both light (`theme-type: light`) and dark (`theme-type: dark`) theme variants
- [ ] `theme.scss` includes `use-system-variables: true` in color and typography config
- [ ] Dark theme applied when `body` has `.dark-theme` class (standard Material pattern)
- [ ] `styles.scss` has `@theme` block mapping `--color-primary`, `--color-surface`, etc. to Material `--sys-*` variables
- [ ] Tailwind `bg-primary`, `text-on-primary`, `bg-surface` classes use correct Material colors
- [ ] Adding `.dark-theme` to body automatically updates all Tailwind-styled elements (no `dark:` variants needed)
- [ ] Presubmit passes

---

### S4PR3: Create ThemeService for Dark Mode State

**Estimated Lines**: ~80 lines
**Depends On**: S4PR2

**Goal**: Create a service to manage dark/light mode state with localStorage persistence and system preference detection.

**Files to Create/Modify**:
- `frontend/src/app/util/theme/theme.service.ts` - Theme state management service
- `frontend/src/app/util/theme/theme.service.spec.ts` - Unit tests
- `frontend/src/app/util/theme/index.ts` - Public exports
- `frontend/src/app/util/index.ts` - Add theme export
- `frontend/src/app/app.config.ts` - Provide ThemeService at root

**Background Reading**:
- [Dark Mode](../research/deep-research/material-tailwind-research.md#dark-mode) - Theme switching pattern

**Acceptance Criteria**:
- [ ] `ThemeService` is `providedIn: 'root'`
- [ ] Exposes `isDarkMode` signal (readonly)
- [ ] `toggleTheme()` method switches between light/dark
- [ ] `setTheme(mode: 'light' | 'dark' | 'system')` for explicit setting
- [ ] Persists preference to `localStorage` under key `theme-preference`
- [ ] On initialization, reads from localStorage or falls back to system preference (`prefers-color-scheme`)
- [ ] Applies/removes `.dark-theme` class on `document.body` reactively
- [ ] Unit tests cover toggle, persistence, and system preference fallback
- [ ] Presubmit passes

---

### S4PR4: Create DarkModeToggleComponent

**Estimated Lines**: ~70 lines
**Depends On**: S4PR3

**Goal**: Create a UI component for toggling dark mode, to be placed in the app header/toolbar.

**Files to Create/Modify**:
- `frontend/src/app/ui/shared/dark-mode-toggle/dark-mode-toggle.component.ts` - Toggle component
- `frontend/src/app/ui/shared/dark-mode-toggle/dark-mode-toggle.component.spec.ts` - Unit tests
- `frontend/src/app/ui/shared/dark-mode-toggle/index.ts` - Public exports
- `frontend/src/app/ui/shared/index.ts` - Add export
- `frontend/src/app/app.component.ts` - Add toggle to app shell/toolbar

**Background Reading**:
- `frontend/src/app/ui/shared/connection-status/connection-status.component.ts` - Similar small UI component pattern

**Acceptance Criteria**:
- [ ] Component injects `ThemeService` and reads `isDarkMode` signal
- [ ] Uses `mat-icon-button` with `mat-icon` (light_mode / dark_mode icons)
- [ ] Click toggles theme via `ThemeService.toggleTheme()`
- [ ] Has tooltip indicating current state ("Switch to dark mode" / "Switch to light mode")
- [ ] Uses Tailwind for any layout styling
- [ ] Accessible: proper `aria-label` describing the action
- [ ] Unit tests verify icon changes based on theme state
- [ ] Toggle added to app toolbar/header area
- [ ] Presubmit passes

---

### S4PR5: Add Dark Mode Support to Component Testing

**Estimated Lines**: ~100 lines
**Depends On**: S4PR2

**Goal**: Configure Playwright component tests to automatically capture screenshots in both light and dark modes without duplicating test code.

**Files to Create/Modify**:
- `frontend/playwright-ct.config.ts` - Add light/dark project variants with theme setup
- `frontend/tests/component/fixtures/theme.fixture.ts` - Create custom fixture for theme application
- `frontend/tests/component/connection-status.spec.ts` - Update existing test to use new fixture (verify it works)

**Background Reading**:
- `frontend/playwright-ct.config.ts` - Current Playwright component test configuration
- `frontend/tests/component/connection-status.spec.ts` - Existing component test with snapshots

**Acceptance Criteria**:
- [x] Playwright config defines two projects: `chromium-light` and `chromium-dark`
- [x] Dark project applies `.dark-theme` class to document body before each test via fixture
- [x] Light project ensures no `.dark-theme` class is present (clean state)
- [x] Running `npm run test:component` executes all tests in both themes automatically
- [x] Screenshot names include theme variant (e.g., `connection-status-connected-chromium-light.png`, `connection-status-connected-chromium-dark.png`)
- [x] Snapshot directory structure organizes by theme: `__snapshots__/light/` and `__snapshots__/dark/`
- [x] Existing connection-status tests pass and generate both light and dark snapshots
- [x] No changes required to individual test files - theme switching is automatic
- [x] Presubmit passes

---

### S4PR6: Create LoadingStateComponent

**Estimated Lines**: ~60 lines
**Depends On**: S4PR2, S4PR5

**Goal**: Extract the loading state UI from session-list into a reusable dumb component with Tailwind styling.

**Files to Create/Modify**:
- `frontend/src/app/ui/shared/loading-state/loading-state.component.ts` - New component
- `frontend/src/app/ui/shared/loading-state/loading-state.component.spec.ts` - Unit tests
- `frontend/src/app/ui/shared/loading-state/index.ts` - Public exports
- `frontend/src/app/ui/shared/index.ts` - Add export

**Background Reading**:
- `frontend/src/app/features/session-list/session-list.component.html` (lines 26-31) - Current loading state implementation
- [UI-Boring Philosophy](../research/deep-research/material-tailwind-research.md#the-ui-boring-philosophy) - Keep it simple

**Acceptance Criteria**:
- [x] Component accepts `message` input signal with default "Loading..."
- [x] Component accepts optional `diameter` input for spinner size (default 48)
- [x] Uses `mat-spinner` for the spinner (Material component)
- [x] Layout uses Tailwind utilities: `flex flex-col items-center justify-center gap-4 p-12`
- [x] Text styling uses Tailwind: `text-on-surface-variant` (from theme bridge)
- [x] Unit tests verify message display and spinner presence
- [x] Snapshot test captures visual appearance (both light and dark mode)
- [x] No custom SCSS file - all styling via Tailwind classes
- [x] Presubmit passes

---

### S4PR7: Create EmptyStateComponent

**Estimated Lines**: ~80 lines
**Depends On**: S4PR2, S4PR5

**Goal**: Extract the empty state UI from session-list into a reusable dumb component with configurable icon, message, and hint.

**Files to Create/Modify**:
- `frontend/src/app/ui/shared/empty-state/empty-state.component.ts` - New component
- `frontend/src/app/ui/shared/empty-state/empty-state.component.spec.ts` - Unit tests
- `frontend/src/app/ui/shared/empty-state/index.ts` - Public exports
- `frontend/src/app/ui/shared/index.ts` - Add export

**Background Reading**:
- `frontend/src/app/features/session-list/session-list.component.html` (lines 45-52) - Current empty state implementation

**Acceptance Criteria**:
- [x] Component accepts `icon` input (default: 'inbox')
- [x] Component accepts `message` input (required)
- [x] Component accepts optional `hint` input for secondary text
- [x] Uses `mat-icon` for the icon
- [x] Layout uses Tailwind utilities: `flex flex-col items-center justify-center gap-2 p-12`
- [x] Icon styling: large size (64px), muted color via Tailwind
- [x] Message styling: `text-lg text-on-surface-variant`
- [x] Hint styling: `text-sm text-on-surface-variant/70`
- [x] Unit tests verify all inputs render correctly
- [x] Snapshot test captures visual appearance
- [x] No custom SCSS file
- [x] Presubmit passes

---

### S4PR8: Create ErrorStateComponent

**Estimated Lines**: ~100 lines
**Depends On**: S4PR2, S4PR5

**Goal**: Extract the error state UI from session-list into a reusable dumb component with icon, message, and retry action.

**Files to Create/Modify**:
- `frontend/src/app/ui/shared/error-state/error-state.component.ts` - New component
- `frontend/src/app/ui/shared/error-state/error-state.component.spec.ts` - Unit tests
- `frontend/src/app/ui/shared/error-state/index.ts` - Public exports
- `frontend/src/app/ui/shared/index.ts` - Add export

**Background Reading**:
- `frontend/src/app/features/session-list/session-list.component.html` (lines 33-43) - Current error state implementation

**Acceptance Criteria**:
- [ ] Component accepts `message` input (required)
- [ ] Component accepts `icon` input (default: 'error_outline')
- [ ] Component emits `retry` output event when retry button clicked
- [ ] Component accepts optional `retryLabel` input (default: 'Retry')
- [ ] Uses `mat-icon` and `mat-raised-button` (Material components)
- [ ] Layout uses Tailwind utilities: `flex flex-col items-center justify-center gap-4 p-12`
- [ ] Error icon styling: large (48px), error color via theme bridge
- [ ] Error message styling: `text-error text-center`
- [ ] Unit tests verify message display, icon, and retry event emission
- [ ] Snapshot test captures visual appearance
- [ ] No custom SCSS file
- [ ] Presubmit passes

---

### S4PR9: Create SessionCardComponent

**Estimated Lines**: ~120 lines
**Depends On**: S4PR2, S4PR5

**Goal**: Extract the session list item presentation into a dumb component that displays session metadata.

**Files to Create/Modify**:
- `frontend/src/app/ui/session/session-card/session-card.component.ts` - New component
- `frontend/src/app/ui/session/session-card/session-card.component.spec.ts` - Unit tests
- `frontend/src/app/ui/session/session-card/index.ts` - Public exports
- `frontend/src/app/ui/session/index.ts` - Create with exports
- `frontend/src/app/ui/index.ts` - Add session module export

**Background Reading**:
- `frontend/src/app/features/session-list/session-list.component.html` (lines 56-92) - Current session item implementation
- `frontend/src/app/features/session-list/session-list.component.scss` (lines 107-171) - Current session item styles

**Acceptance Criteria**:
- [ ] Component accepts `session` input of type `Session`
- [ ] Component emits `selected` output with session ID when clicked
- [ ] Displays truncated session ID (first 8 chars) with full ID in title attribute
- [ ] Displays session description if available
- [ ] Displays formatted creation time using `DatePipe`
- [ ] Displays status indicator (active/inactive)
- [ ] Uses `mat-list-item` with Material list directives
- [ ] Interactive: keyboard accessible (Enter key triggers selection)
- [ ] Layout uses Tailwind utilities for gaps, spacing
- [ ] Unit tests verify all data displays correctly and click emits event
- [ ] Snapshot test captures visual appearance
- [ ] Minimal custom SCSS (only what Tailwind cannot handle)
- [ ] Presubmit passes

---

### S4PR10: Refactor SessionListComponent to use new UI components

**Estimated Lines**: ~150 lines (net reduction expected)
**Depends On**: S4PR6, S4PR7, S4PR8, S4PR9

**Goal**: Replace inline template code in SessionListComponent with the new dumb UI components, keeping only feature logic in the component.

**Files to Create/Modify**:
- `frontend/src/app/features/session-list/session-list.component.ts` - Update imports
- `frontend/src/app/features/session-list/session-list.component.html` - Replace inline states with components
- `frontend/src/app/features/session-list/session-list.component.spec.ts` - Update tests for new structure

**Background Reading**:
- `frontend/src/app/features/session-list/session-list.component.html` - Current 105-line template to refactor
- [UI-Boring Philosophy](../research/deep-research/material-tailwind-research.md#the-ui-boring-philosophy) - Standard components

**Acceptance Criteria**:
- [ ] Template uses `<app-loading-state>` instead of inline loading UI
- [ ] Template uses `<app-empty-state>` instead of inline empty UI
- [ ] Template uses `<app-error-state>` instead of inline error UI
- [ ] Template uses `<app-session-card>` in `@for` loop instead of inline `mat-list-item`
- [ ] SessionListComponent.ts only contains feature logic (data fetching, navigation, error handling)
- [ ] Template reduced to ~40 lines or less
- [ ] Helper methods (`getTruncatedId`, `getCreationTime`) moved to SessionCardComponent or removed
- [ ] All existing tests pass
- [ ] New integration tests verify component composition works
- [ ] Presubmit passes

---

### S4PR11: Migrate session-list styling to Tailwind

**Estimated Lines**: ~100 lines (mostly deletions)
**Depends On**: S4PR10

**Goal**: Replace the ~180 lines of custom SCSS in session-list with Tailwind utility classes.

**Files to Create/Modify**:
- `frontend/src/app/features/session-list/session-list.component.html` - Add Tailwind classes
- `frontend/src/app/features/session-list/session-list.component.scss` - Delete or minimize to essential-only
- `frontend/src/app/features/session-list/session-list.component.ts` - Update styleUrl if needed

**Background Reading**:
- [Layout Refactor Phase](../research/deep-research/material-tailwind-research.md#phase-2-layout-refactor) - Replace layout CSS with utilities
- [Forms Example](../research/deep-research/material-tailwind-research.md#forms) - Tailwind skeleton, Material muscles

**Acceptance Criteria**:
- [ ] Container styling uses Tailwind: `flex flex-col items-center p-6 min-h-screen bg-surface`
- [ ] Card max-width uses Tailwind: `w-full max-w-3xl`
- [ ] Route error banner margin uses Tailwind: `w-full max-w-3xl mb-4`
- [ ] `session-list.component.scss` reduced to <20 lines (only essential overrides if any)
- [ ] Visual appearance matches current design (no regression)
- [ ] Material components use default styling where possible
- [ ] Presubmit passes

---

### S4PR12: Migrate shared UI component styling to Tailwind

**Estimated Lines**: ~100 lines
**Depends On**: S4PR2

**Goal**: Convert existing shared UI components (connection-status, error-banner) from inline/custom CSS to Tailwind utilities.

**Files to Create/Modify**:
- `frontend/src/app/ui/shared/connection-status/connection-status.component.ts` - Replace inline styles with Tailwind
- `frontend/src/app/ui/shared/error-banner/error-banner.component.ts` - Replace inline styles with Tailwind

**Background Reading**:
- [Component Cleanup Phase](../research/deep-research/material-tailwind-research.md#phase-3-component-cleanup) - Evaluate overrides
- [Theme Bridge Colors](../research/deep-research/material-tailwind-research.md#the-result) - Consistent color usage

**Acceptance Criteria**:
- [ ] ConnectionStatusComponent uses Tailwind for layout (`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium`)
- [ ] ConnectionStatusComponent status colors use theme bridge variables (`text-success bg-success/10`, etc.)
- [ ] ErrorBannerComponent uses Tailwind for layout (`flex items-center gap-3 w-full p-3 rounded-lg border-l-4`)
- [ ] ErrorBannerComponent colors use theme bridge or standard warning palette
- [ ] Spinning animation kept as inline keyframes (Tailwind cannot replace)
- [ ] Visual appearance matches current design
- [ ] All existing tests pass
- [ ] Presubmit passes

---

## Implementation Notes

### Patterns to Follow

1. **Tailwind for Layout, Material for Behavior**: Use Tailwind utilities for spacing, flexbox, grid, and colors. Use Material components for interactive behavior (buttons, inputs, dialogs).

2. **Theme Bridge Colors**: Always use theme-bridged colors (`bg-primary`, `text-on-surface`) rather than raw hex codes. This ensures automatic dark mode support and design consistency.

3. **Dumb Component Contract**: UI components receive data via input signals, emit events via output(). No direct service injection. Keep business logic in feature components.

4. **Inline Template for Small Components**: For components under ~50 lines, use inline `template` and `styles` in the decorator. Only create separate files when complexity warrants it.

5. **Snapshot Testing for UI Components**: Every new dumb component should have a snapshot test capturing its visual appearance in various states.

### Gotchas to Avoid

- **Don't fight Preflight**: We skip Preflight entirely. If you see unexpected element resets, check that the granular imports are correct in styles.scss.

- **Don't duplicate color definitions**: Colors come from Material theme only. Never define colors in both places.

- **Don't over-customize Material components**: The sprint goal is to work *with* Material defaults. Before adding custom styling to a Material component, ask if the default is acceptable.

- **Watch for specificity issues**: Tailwind utilities have low specificity. If Material styles override Tailwind, use `!important` sparingly or adjust the CSS layer order.

- **Preserve accessibility**: When replacing inline styles, ensure focus indicators, ARIA labels, and keyboard navigation remain functional.

---

## Definition of Done

- [ ] All 12 PRs merged to feature branch
- [ ] Tailwind CSS installed and Theme Bridge operational
- [ ] Dark mode toggle functional with localStorage persistence
- [ ] Dark mode respects system preference on first visit
- [ ] Component test infrastructure automatically captures light and dark mode snapshots
- [ ] SessionListComponent template reduced from ~105 lines to ~40 lines
- [ ] SessionListComponent SCSS reduced from ~180 lines to ~20 lines or less
- [ ] 5 new reusable UI components created (LoadingState, EmptyState, ErrorState, SessionCard, DarkModeToggle)
- [ ] ThemeService provides centralized theme state management
- [ ] All new components have unit tests and snapshot tests (both light and dark variants)
- [ ] No visual regressions from existing UI in both light and dark modes
- [ ] Presubmit passes on all PRs
- [ ] Manual smoke test: session list page renders correctly with all states in both themes

---

## Retrospective Notes

*(To be filled after sprint completion)*

---

USER FEEDBACK:

# S4PR1
---

# S4PR2
---

# S4PR3
---

# S4PR4
---

# S4PR5
---

# S4PR6
---

# S4PR7
---

# S4PR8
---

# S4PR9
---

# S4PR10
---

# S4PR11
---

# S4PR12
---
