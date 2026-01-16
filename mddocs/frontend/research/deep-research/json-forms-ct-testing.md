# Deep Research: JSONForms + Playwright Component Testing Compatibility

## Research Request

Investigate how to make JSONForms (@jsonforms/angular) work with Playwright Component Testing (@sand4rt/experimental-ct-angular) in an Angular 21 application. We have **partially solved** the problem but hit a second blocker.

---

## CRITICAL UPDATE: Two Separate Issues Identified

### Issue 1: "global is not defined" - SOLVED ✅

The first research round identified that Ajv (JSONForms' validation engine) throws `ReferenceError: global is not defined` because it expects Node.js globals in the browser.

**Solution applied:**
```typescript
ctViteConfig: {
  define: {
    global: {},
  },
}
```

This fix works - the Ajv error is gone.

### Issue 2: "Could not resolve component" - UNSOLVED ❌

After fixing Issue 1, a **completely different error** appears:

```
Error: Could not resolve component: _workspaces_adk_sim_plugin_frontend_src_app_ui_control_panel_tool_form_tool_form_component_ToolFormComponent
    at ImportRegistry.resolveImportRef (http://localhost:3100/assets/index-CnpWc5UY.js:70930:13)
```

This is the focus of this second research round.

---

## Problem Statement (Updated)

The ToolFormComponent **builds successfully** with Angular CLI but **cannot be mounted** in Playwright Component Tests. The component registry in `@sand4rt/experimental-ct-angular` fails to resolve the component.

**Key observation**: The component's build output chunk is essentially empty:
```
.cache/assets/tool-form.component-l0sNRNKZ.js    0.06 kB
```

Compare to working components:
```
.cache/assets/session-card.component-puTk1XHK.js   522.58 kB
.cache/assets/event-block.component-...js          ~15 kB
```

The component code is NOT being bundled into the test assets, causing the resolution failure.

---

## Technology Stack

### Core Framework
- **Angular 21.0.0** with **zoneless change detection** (no zone.js)
- **TypeScript 5.9.2**
- **Vite 7.3.1** as the build tool

### JSONForms Stack
- `@jsonforms/core`: ^3.7.0
- `@jsonforms/angular`: ^3.7.0
- `@jsonforms/angular-material`: ^3.7.0

### Playwright Component Testing Stack
- `@playwright/test`: ^1.52.0
- `@sand4rt/experimental-ct-angular`: ^1.52.0
- `@analogjs/vite-plugin-angular`: ^2.2.2

---

## Current Configuration (After Issue 1 Fix)

### playwright-ct.config.ts

```typescript
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig, devices } from '@sand4rt/experimental-ct-angular';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  testDir: 'tests/component',

  use: {
    ctViteConfig: {
      plugins: [
        tailwindcss(),
        angular({
          tsconfig: resolve('./tsconfig.spec.json'),
        }),
      ],
      build: {
        sourcemap: false,
        rollupOptions: {
          output: {
            manualChunks: undefined,  // Attempted fix - didn't help
          },
        },
      },
      resolve: {
        alias: {
          '@': resolve('./src'),
          '@app': resolve('./src/app'),
        },
      },
      // FIX FOR ISSUE 1: Polyfill Node.js globals for Ajv
      define: {
        global: {},
      },
      // Attempted fix for Issue 2 - didn't help
      ssr: {
        noExternal: [
          '@jsonforms/core',
          '@jsonforms/angular',
          '@jsonforms/angular-material',
          /tool-form/,
        ],
      },
      optimizeDeps: {
        force: true,
        include: [
          // Angular core
          '@angular/core',
          '@angular/common',
          '@angular/compiler',
          '@angular/platform-browser',
          '@angular/platform-browser-dynamic',
          '@angular/platform-browser-dynamic/testing',
          '@angular/core/testing',
          '@angular/animations',
          '@angular/platform-browser/animations',
          '@angular/platform-browser/animations/async',
          '@angular/material/icon',
          '@angular/material/tooltip',
          // JSONForms
          '@jsonforms/core',
          '@jsonforms/angular',
          '@jsonforms/angular-material',
          'ajv',
          'ajv-formats',
          'hammerjs',
          'lodash',
        ],
      },
    },
  },
});
```

### Component Under Test

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { JsonFormsModule } from '@jsonforms/angular';
import { angularMaterialRenderers } from '@jsonforms/angular-material';
import type { ErrorObject } from 'ajv';

@Component({
  selector: 'app-tool-form',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, JsonFormsModule],
  template: `
    <div class="tool-form" data-testid="tool-form">
      <jsonforms
        [data]="formData()"
        [schema]="config().schema"
        [uischema]="config().uischema"
        [renderers]="renderers"
        (dataChange)="onDataChange($event)"
        (errors)="onErrors($event)"
      />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolFormComponent {
  readonly config = input.required<ToolFormConfig>();
  readonly renderers = angularMaterialRenderers;
  readonly formData = signal<unknown>({});
  // ... rest of implementation
}
```

### Test File

```typescript
import { ToolFormComponent } from '../../src/app/ui/control-panel/tool-form/tool-form.component';

test('displays tool name in header', async ({ mount }) => {
  const config = { /* ... */ };

  // THIS FAILS with "Could not resolve component"
  const component = await mount(ToolFormComponent, {
    props: { config },
  });

  await expect(component.getByTestId('form-header')).toContainText('Execute: get_weather');
});
```

---

## What We've Tried (All Failed)

### 1. Adding JSONForms to `ssr.noExternal`
```typescript
ssr: {
  noExternal: ['@jsonforms/core', '@jsonforms/angular', '@jsonforms/angular-material'],
}
```
**Result**: No change - component still not resolved.

### 2. Disabling code splitting
```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: undefined,
    },
  },
}
```
**Result**: No change - component chunk still empty.

### 3. Pre-importing component in playwright/index.ts
```typescript
// playwright/index.ts
import '../src/app/ui/control-panel/tool-form/tool-form.component';
```
**Result**: No change - component still not registered.

### 4. Direct import (not barrel export)
```typescript
// Changed from:
import { ToolFormComponent } from '../../src/app/ui/control-panel/tool-form';
// To:
import { ToolFormComponent } from '../../src/app/ui/control-panel/tool-form/tool-form.component';
```
**Result**: No change - same error with slightly different mangled name.

### 5. Adding component path to `ssr.noExternal` regex
```typescript
ssr: {
  noExternal: [/tool-form/],
}
```
**Result**: No change.

---

## Working vs Non-Working Components

### Working Component (SessionCardComponent)
- Uses: `@angular/material/icon`, `@angular/common`
- Build output: `session-card.component-xxx.js` = 522.58 kB
- **Works perfectly** in Playwright CT

### Working Component (EventBlockComponent)
- Uses: `@angular/material/icon`, custom types
- Build output: `event-block.component-xxx.js` = ~15 kB
- **Works perfectly** in Playwright CT

### Non-Working Component (ToolFormComponent)
- Uses: `@jsonforms/angular`, `@jsonforms/angular-material`, `@angular/material/*`
- Build output: `tool-form.component-xxx.js` = **0.06 kB** (essentially empty!)
- **Fails** with "Could not resolve component"

**The key difference**: Only the component that imports `@jsonforms/angular` fails.

---

## Research Questions (Updated)

### Primary Question

**Why does importing `@jsonforms/angular` cause the component to not be bundled into Playwright CT's test assets?**

Specific areas to investigate:

1. **Vite bundling behavior with JSONForms**
   - Does JSONForms use any bundler-hostile patterns (dynamic imports, side effects)?
   - Are there circular dependencies in JSONForms that confuse Vite?
   - Does JSONForms use `eval()` or dynamic code generation that causes Vite to skip bundling?

2. **@sand4rt/experimental-ct-angular component registration**
   - How does the adapter discover and register components?
   - Does it rely on static analysis that fails with certain import patterns?
   - Is there a way to manually register components?

3. **@analogjs/vite-plugin-angular interactions**
   - Does the Angular Vite plugin have special handling for third-party modules?
   - Are there compatibility issues between analogjs and JSONForms?

### Secondary Questions

4. **Has anyone else encountered this specific error?**
   - Search: `"Could not resolve component" @sand4rt/experimental-ct-angular`
   - Search: `ImportRegistry.resolveImportRef playwright angular`

5. **Are there Vite plugins that force bundling of specific modules?**
   - Something like `vite-plugin-static-copy` or similar?

6. **Can we create a minimal wrapper that works?**
   - Would a component that lazy-loads JSONForms work?
   - Would a component that conditionally imports work?

---

## Search Terms for This Research Round

- `"Could not resolve component" playwright angular`
- `ImportRegistry.resolveImportRef error`
- `@sand4rt/experimental-ct-angular component not found`
- `vite component not bundled empty chunk`
- `playwright ct angular third party library not resolved`
- `@analogjs/vite-plugin-angular external module`
- `vite rollup empty chunk dynamic import`
- `jsonforms vite bundle issue`
- `angular standalone component vite tree shaking`

---

## Expected Deliverables

1. **Root cause**: Why is the component not being bundled?

2. **Working solution**: Exact configuration or code changes to make the test pass.

3. **If truly impossible**:
   - Explanation of the fundamental limitation
   - Link to relevant GitHub issues
   - Recommended workaround (e.g., E2E test instead of CT)

---

## Additional Context

### What DOES Work
- Angular build (`npm run build`) - component compiles and works in app
- TypeScript type checking - no errors
- ESLint - passes
- Other components with Angular Material - work fine in CT
- The `define: { global: {} }` fix for Ajv - works

### What DOESN'T Work
- Mounting ToolFormComponent in Playwright CT
- Any component that imports from `@jsonforms/angular`

### Project Constraints
- Must use Angular 21 with zoneless change detection
- Must use standalone components
- Cannot downgrade versions
- Snapshot testing is the goal

---

## Hypothesis to Investigate

The most likely cause is that **Playwright CT's component discovery relies on static analysis** that fails when a component imports from `@jsonforms/angular`. Possible reasons:

1. **JSONForms uses side-effect imports** that confuse the bundler
2. **The `angularMaterialRenderers` export** has unusual module structure
3. **Tree-shaking incorrectly removes** the component because it can't trace the dependency graph
4. **The `JsonFormsModule`** has NgModule patterns incompatible with standalone component analysis

The solution might involve:
- Forcing the component into a specific chunk
- Disabling tree-shaking for certain paths
- Using a different import pattern
- Configuring Vite to treat JSONForms differently

---

## SOLUTION - ISSUE RESOLVED ✅

### Root Cause

The issue was **NOT** tree-shaking or JSONForms-specific. The root cause was that `tsconfig.spec.json` did not include component files in its `include` array.

**Original `tsconfig.spec.json`:**
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { ... },
  "include": ["src/**/*.d.ts", "src/**/*.spec.ts"]
}
```

The `@analogjs/vite-plugin-angular` uses this tsconfig for compilation during Playwright CT builds. Since `*.component.ts` files were not in the `include` array, the Angular compiler didn't process new component files, resulting in empty chunk files.

### Why SessionCardComponent Worked

SessionCardComponent worked because it was:
1. Already compiled and cached from a previous build
2. Or referenced through other paths that were included in the tsconfig

New components like `ToolFormComponent` had never been compiled, so their chunks were empty.

### The Fix

Add `src/**/*.component.ts` to the `include` array in `tsconfig.spec.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.d.ts", "src/**/*.spec.ts", "src/**/*.component.ts"]
}
```

### Verification

After the fix:
- Component chunk files are now properly generated (e.g., `tool-form.component-ZpPM052P.js` at 1,693.78 kB)
- 10 out of 12 tests pass
- The "Could not resolve component" error is GONE

### Remaining Issue

2 visual regression tests fail with "element not found" for `getByTestId('tool-form')`. This is a **separate issue** from the bundling problem. The page snapshot confirms the component renders correctly - the issue is with the test locator or timing. This requires separate investigation.

---

## Notes for Researcher

- The first research round solved Issue 1 but didn't anticipate Issue 2
- Focus specifically on the **component registration/bundling** problem
- Check `@sand4rt/experimental-ct-angular` source code if needed
- Check `@playwright/experimental-ct-core` for how component resolution works
- This is likely a Vite/Rollup bundling issue, not a runtime issue
- The component works at runtime (Angular build passes) - it's only the test bundling that fails
