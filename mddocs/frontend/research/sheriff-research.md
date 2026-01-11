---
title: Sheriff Dependency Enforcement Research
type: research
parent: ../frontend-tdd.md
related:
  - ../frontend-spec.md
  - ./angular-architecture-analysis.md
---

# Sheriff Dependency Enforcement Research

**Date**: January 11, 2026  
**Purpose**: Define Sheriff configuration for enforcing module boundaries in the ADK Simulator Web UI.

## Table of Contents

- [Executive Summary](#executive-summary)
  - [Key Benefits](#key-benefits)
- [Part 1: Sheriff Overview](#part-1-sheriff-overview)
  - [What is Sheriff?](#what-is-sheriff)
  - [Module Types](#module-types)
- [Part 2: Installation & Setup](#part-2-installation-setup)
  - [Installation](#installation)
  - [ESLint Integration (Flat Config)](#eslint-integration-flat-config)
  - [CI Integration](#ci-integration)
- [Part 3: Configuration for ADK Simulator](#part-3-configuration-for-adk-simulator)
  - [Proposed Folder Structure](#proposed-folder-structure)
  - [Sheriff Configuration](#sheriff-configuration)
  - [Dependency Flow Diagram](#dependency-flow-diagram)
  - [What Gets Blocked](#what-gets-blocked)
- [Part 4: Incremental Adoption Strategy](#part-4-incremental-adoption-strategy)
  - [Phase 1: Module Boundaries Only (Week 1)](#phase-1-module-boundaries-only-week-1)
  - [Phase 2: Type Tags (Week 2)](#phase-2-type-tags-week-2)
  - [Phase 3: Domain Tags (Week 3+)](#phase-3-domain-tags-week-3)
- [Part 5: Developer Experience](#part-5-developer-experience)
  - [IDE Feedback](#ide-feedback)
  - [CLI Commands](#cli-commands)
  - [Debugging Configuration](#debugging-configuration)
- [Part 6: Generated Code Handling](#part-6-generated-code-handling)
  - [Approach: Exclude from ESLint](#approach-exclude-from-eslint)
  - [Importing Generated Code](#importing-generated-code)
- [Part 7: Presubmit Script Verification](#part-7-presubmit-script-verification)
  - [Current State](#current-state)
  - [No Changes Required](#no-changes-required)
- [Part 8: Migration Checklist](#part-8-migration-checklist)
  - [Pre-Installation Checklist](#pre-installation-checklist)
  - [Installation Steps](#installation-steps)
  - [Post-Installation Verification](#post-installation-verification)
- [Open Questions](#open-questions)
- [References](#references)

## Executive Summary

**Recommendation**: Adopt Sheriff with barrel-less modules for dependency enforcement.

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Module Style | Barrel-less (`enableBarrelLess: true`) | Better tree-shaking; explicit encapsulation via `internal/` folders |
| Tagging Strategy | Two-dimensional: `type:` + `domain:` | Matches architecture analysis; enables layered + domain isolation |
| Integration | ESLint plugin (flat config) | Runs with existing `npm run lint` command |
| CI Impact | None required | Sheriff rules run via existing ESLint step in `check_quality.sh` |

### Key Benefits

1. **Compile-time enforcement** - Violations caught during development, not code review
2. **Zero runtime overhead** - Static analysis only
3. **Incremental adoption** - Start with `noTag`, gradually add rules
4. **ESLint integration** - No new CI scripts needed

---

## Part 1: Sheriff Overview

### What is Sheriff?

Sheriff is a lightweight TypeScript tool that enforces module boundaries and dependency rules. It:

- Detects modules via `index.ts` files (barrel) or configuration (barrel-less)
- Assigns tags to modules for grouping
- Enforces dependency rules between tags
- Integrates with ESLint for IDE feedback

### Module Types

| Type | Detection | Encapsulation | Tree-Shaking |
|------|-----------|---------------|--------------|
| **Barrel** | `index.ts` in folder | Unexported files are private | Limited (barrel re-exports all) |
| **Barrel-less** | Configuration | `internal/` folder is private | Optimal (direct imports) |

**Recommendation**: Use barrel-less modules. They provide better tree-shaking and explicit encapsulation boundaries.

---

## Part 2: Installation & Setup

### Installation

```bash
cd frontend
npm install -D @softarc/sheriff-core @softarc/eslint-plugin-sheriff
npx sheriff init
```

This creates `sheriff.config.ts` with a permissive default configuration.

### ESLint Integration (Flat Config)

Update `eslint.config.js` to include Sheriff:

```javascript
// eslint.config.js
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const unicorn = require('eslint-plugin-unicorn');
const simpleImportSort = require('eslint-plugin-simple-import-sort');
const eslintConfigPrettier = require('eslint-config-prettier');
const sheriff = require('@softarc/eslint-plugin-sheriff'); // <-- Add this

module.exports = tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      '.angular',
      'coverage',
      'src/app/generated/**',
      '**/*.spec.ts',
    ],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      ...angular.configs.tsRecommended,
      unicorn.default.configs['flat/recommended'],
      sheriff.configs.all, // <-- Add this
    ],
    // ... rest of config
  },
  // ... HTML config
  eslintConfigPrettier
);
```

### CI Integration

**No changes required to `check_quality.sh`!**

Sheriff runs as part of ESLint. The existing script already runs:

```bash
echo "Running ESLint..."
npm run lint
```

Sheriff violations will fail the lint step automatically.

---

## Part 3: Configuration for ADK Simulator

### Proposed Folder Structure

Based on the [Angular Architecture Analysis](./angular-architecture-analysis.md#proposed-library-structure-for-adk-simulator):

```
frontend/src/app/
├── features/                    # type:feature
│   ├── session-list/
│   │   ├── internal/           # Private implementation
│   │   └── *.ts                # Public exports
│   ├── session/
│   └── join-session/
│
├── ui/                         # type:ui
│   ├── event-stream/
│   │   ├── event-block/
│   │   ├── data-tree/
│   │   │   ├── internal/      # Private helpers
│   │   │   └── *.ts           # Public component
│   │   └── smart-blob/
│   └── control-panel/
│       ├── tool-catalog/
│       └── tool-form/
│
├── data-access/                # type:data-access
│   └── session/
│       ├── internal/          # Private implementation
│       ├── session.facade.ts
│       ├── session.store.ts
│       └── session.gateway.ts
│
├── util/                       # type:util
│   ├── json-detection/
│   └── formatting/
│
├── shared/                     # type:shared (cross-cutting)
│   ├── models/
│   └── constants/
│
└── generated/                  # Excluded from Sheriff
    └── ...
```

### Sheriff Configuration

```typescript
// sheriff.config.ts
import { noDependencies, sameTag, SheriffConfig } from '@softarc/sheriff-core';

export const config: SheriffConfig = {
  version: 1,
  
  // Use barrel-less modules with internal/ encapsulation
  enableBarrelLess: true,
  
  // Entry point for traversal
  entryFile: './src/main.ts',
  
  // Module tagging
  modules: {
    'src/app': {
      // Feature modules - one per feature
      'features/<feature>': 'type:feature',
      
      // UI components - nested by domain
      'ui/event-stream/<component>': ['type:ui', 'domain:event-stream'],
      'ui/control-panel/<component>': ['type:ui', 'domain:control-panel'],
      
      // Data access layer
      'data-access/<domain>': 'type:data-access',
      
      // Utilities - no domain, just type
      'util/<lib>': 'type:util',
      
      // Shared code accessible by all
      'shared/<lib>': 'type:shared',
    },
  },
  
  // Dependency rules - enforce layered architecture
  depRules: {
    // Root (main.ts, app.ts, app.routes.ts) can access features
    root: ['type:feature', 'type:shared'],
    
    // Features can access UI, data-access, util, and shared
    'type:feature': ['type:ui', 'type:data-access', 'type:util', 'type:shared'],
    
    // UI can only access util and shared (no data-access!)
    'type:ui': ['type:util', 'type:shared'],
    
    // Data-access can only access util and shared
    'type:data-access': ['type:util', 'type:shared'],
    
    // Util has no dependencies (leaf layer)
    'type:util': noDependencies,
    
    // Shared can access util only
    'type:shared': 'type:util',
    
    // Domain isolation: UI components can only access same domain or none
    'domain:event-stream': sameTag,
    'domain:control-panel': sameTag,
  },
};
```

### Dependency Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         root                                 │
│            (main.ts, app.ts, app.routes.ts)                 │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    type:feature                              │
│         (session-list, session, join-session)               │
└───────┬─────────────────┬─────────────────┬─────────────────┘
        │                 │                 │
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│   type:ui     │ │type:data-access│ │  type:shared  │
│(presentational)│ │   (facade,    │ │  (models,     │
│               │ │    store)     │ │   constants)  │
└───────┬───────┘ └───────┬───────┘ └───────┬───────┘
        │                 │                 │
        └────────┬────────┴────────┬────────┘
                 │                 │
                 ▼                 ▼
         ┌───────────────┐ ┌───────────────┐
         │   type:util   │ │   type:util   │
         │  (pure logic) │ │  (pure logic) │
         └───────────────┘ └───────────────┘
```

### What Gets Blocked

| Violation | Example | Why Blocked |
|-----------|---------|-------------|
| UI → Data-Access | `DataTreeComponent` imports `SessionFacade` | UI must be dumb; features inject data |
| Util → UI | `JsonDetectionService` imports component | Utilities are leaf nodes |
| Cross-domain UI | `EventBlockComponent` imports `ToolFormComponent` | Domain boundaries enforced |
| Feature → Feature | `SessionListComponent` imports `SessionComponent` | Features should use shared state |

---

## Part 4: Incremental Adoption Strategy

### Phase 1: Module Boundaries Only (Week 1)

Start with automatic tagging and permissive rules to enforce encapsulation:

```typescript
// sheriff.config.ts (Phase 1)
export const config: SheriffConfig = {
  version: 1,
  enableBarrelLess: true,
  entryFile: './src/main.ts',
  
  // Auto-detect modules, no manual tagging yet
  depRules: {
    root: 'noTag',
    noTag: ['noTag', 'root'],
  },
};
```

**What this enforces**:
- Files in `internal/` folders are private
- Must import from module root, not deep paths

### Phase 2: Type Tags (Week 2)

Add type tags to enforce layered architecture:

```typescript
// sheriff.config.ts (Phase 2)
export const config: SheriffConfig = {
  version: 1,
  enableBarrelLess: true,
  entryFile: './src/main.ts',
  
  modules: {
    'src/app': {
      'features/<feature>': 'type:feature',
      'ui/<domain>/<component>': 'type:ui',
      'data-access/<domain>': 'type:data-access',
      'util/<lib>': 'type:util',
      'shared/<lib>': 'type:shared',
    },
  },
  
  depRules: {
    root: ['type:feature', 'type:shared', 'noTag'],
    'type:feature': ['type:ui', 'type:data-access', 'type:util', 'type:shared', 'noTag'],
    'type:ui': ['type:util', 'type:shared', 'noTag'],
    'type:data-access': ['type:util', 'type:shared', 'noTag'],
    'type:util': ['noTag'],
    'type:shared': ['type:util', 'noTag'],
    noTag: ['noTag', 'root'],
  },
};
```

**Note**: `noTag` allows gradual migration of untagged modules.

### Phase 3: Domain Tags (Week 3+)

Add domain isolation for stricter boundaries:

```typescript
// sheriff.config.ts (Phase 3)
// Full configuration as shown in Part 3
```

---

## Part 5: Developer Experience

### IDE Feedback

With ESLint integration, violations appear immediately in VS Code:

```typescript
// session-list.component.ts (type:feature)
import { SessionStore } from '@app/data-access/session/session.store'; // ✅ OK
import { DataTreeComponent } from '@app/ui/event-stream/data-tree';    // ✅ OK
```

```typescript
// data-tree.component.ts (type:ui)
import { SessionFacade } from '@app/data-access/session/session.facade';
// ❌ ERROR: Module 'type:ui' is not allowed to access 'type:data-access'
```

### CLI Commands

```bash
# List all modules and their tags
npx sheriff list

# Verify rules without ESLint
npx sheriff verify

# Export dependency graph as JSON
npx sheriff export > deps.json
```

### Debugging Configuration

```typescript
// sheriff.config.ts
export const config: SheriffConfig = {
  log: true, // Enable verbose logging
  // ...
};
```

Then run:
```bash
npx sheriff list  # See how modules are detected and tagged
```

---

## Part 6: Generated Code Handling

The `generated/` folder contains protobuf-generated code that should be:
1. Excluded from Sheriff analysis (it's external)
2. Accessible by any module that needs it

### Approach: Exclude from ESLint

Already handled in our ESLint config:

```javascript
{
  ignores: [
    'src/app/generated/**',
    // ...
  ],
}
```

Since Sheriff runs via ESLint, ignored files are not analyzed.

### Importing Generated Code

Generated code lives outside the module system. Any module can import it:

```typescript
// Any file can import generated protos
import { LlmRequest } from '@app/generated/adksim/v1/sim_pb';
```

---

## Part 7: Presubmit Script Verification

### Current State

The `scripts/check_quality.sh` already runs ESLint:

```bash
# ============================================================
# Angular Frontend Checks
# ============================================================
echo ""
echo "----------------------------------------"
echo "  Angular Frontend"
echo "----------------------------------------"

cd "$PROJECT_ROOT/frontend"

echo "Running Angular build (AOT strict template verification)..."
CI=true npm run ng -- build --configuration production --no-progress

echo "Running ESLint..."
npm run lint   # <-- Sheriff runs here

echo "Running Prettier (format check)..."
npm run format:check

echo "✅ Angular checks passed!"
```

### No Changes Required

Sheriff violations will:
1. Fail `npm run lint`
2. Exit the script (due to `set -e`)
3. Fail the CI job

**The existing CI pipeline automatically enforces Sheriff rules.**

---

## Part 8: Migration Checklist

### Pre-Installation Checklist

- [ ] Ensure `npm run lint` passes without Sheriff
- [ ] Review proposed folder structure with team
- [ ] Agree on tagging strategy

### Installation Steps

```bash
# 1. Install packages
cd frontend
npm install -D @softarc/sheriff-core @softarc/eslint-plugin-sheriff

# 2. Generate initial config
npx sheriff init

# 3. Update eslint.config.js to include sheriff.configs.all

# 4. Run lint to verify setup
npm run lint

# 5. Iteratively tighten rules per adoption phases
```

### Post-Installation Verification

```bash
# Verify Sheriff detects modules
npx sheriff list

# Verify rules are enforced
npx sheriff verify

# Run full presubmit
./scripts/presubmit.sh
```

---

## Open Questions

1. **Shared UI Components**: Should there be a `type:ui-shared` for truly reusable UI components (buttons, icons)?

2. **Generated Code Tag**: Should generated code have its own tag (`type:generated`) for explicit dep rules?

3. **Test File Rules**: Should spec files have different dependency rules than production code?

---

## References

- [Sheriff Documentation](https://softarc-consulting.github.io/sheriff/)
- [GitHub: softarc-consulting/sheriff](https://github.com/softarc-consulting/sheriff)
- [Angular Architecture Analysis](./angular-architecture-analysis.md)
- [Frontend TDD](../frontend-tdd.md)
