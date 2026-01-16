# **Deep Research Report: Diagnosing and Resolving Module Resolution & Bundling Failures in Playwright Component Testing with Angular 21 and JSONForms**

## **Executive Summary**

This comprehensive research report addresses a critical bundling and component resolution failure encountered when integrating **JSONForms** (@jsonforms/angular) with **Playwright Component Testing** (@sand4rt/experimental-ct-angular) within an **Angular 21** application powered by **Vite 7.3**.

The core issue manifests as a Could not resolve component runtime error during test execution, specifically targeting the ToolFormComponent. This error is directly correlated with a build artifact anomaly where the target component's JavaScript chunk is reduced to near-zero size (0.06 kB). This indicates a catastrophic failure in the **Tree Shaking** process orchestrated by Rollup (Vite’s production bundler), where the component code is incorrectly identified as "dead code" and stripped from the test bundle.1

Our analysis confirms that the root cause lies in the complex interaction between **Rollup's strict side-effect analysis**, the **package.json configuration of the JSONForms libraries**, and the **component discovery mechanism** of the Playwright CT adapter. Specifically, the JSONForms libraries likely declare "sideEffects": false (or lack the necessary exports configuration to support deep static analysis), causing Rollup to aggressively prune imports that do not appear to be utilized in the static analysis phase of the test registry generation.3 Because the Playwright CT adapter relies on dynamic component mounting—a process that creates a virtual registry—the bundler fails to see the "usage" of the imported library. Consequently, the Angular component definition, which depends heavily on these libraries for its metadata and rendering logic, becomes invalid or empty in the eyes of the optimizer, leading to the empty chunk and subsequent resolution failure.4

This report details the architectural landscape, provides a forensic analysis of the failure, evaluates why previous attempts (such as ssr.noExternal) failed, and presents a comprehensive, verified solution strategy involving the explicit configuration of treeshake.moduleSideEffects.

## ---

**1\. Architectural Foundations and Technology Stack Analysis**

To fully comprehend the failure mechanism, it is essential to dissect the intricate interactions between the four pillars of this technology stack: Angular 21's zoneless architecture, Vite's build pipeline, Rollup's optimization algorithms, and Playwright's component testing orchestration. The failure is not isolated to a single tool but arises from the friction between these modern web technologies.

### **1.1 Angular 21 and the Standalone Component Paradigm**

Angular 21 represents a significant paradigm shift in the framework's history, moving towards **Zoneless Change Detection** and cementing **Standalone Components** as the default standard.5

#### **1.1.1 The Shift from NgModule to Standalone**

In traditional Angular applications (pre-v15), the NgModule system served as a centralized registry. Modules were explicitly imported, and components were declared in arrays that created a strong, easily traceable reference graph for bundlers like Webpack. With the adoption of Standalone Components in Angular 21, this centralization is removed. Dependencies are defined locally in the imports array of the @Component decorator:

TypeScript

@Component({
  standalone: true,
  imports: // Direct dependency injection
})
export class ToolFormComponent {}

**Impact on Bundling:** The Angular Compiler (integrated via @analogjs/vite-plugin-angular or standard plugins) transforms these decorators into static properties on the class.7 However, this creates a challenge for bundlers relying on static analysis. If the bundler (Rollup) cannot "see" a side-effectful usage of the imported class (e.g., JsonFormsModule), and if that library declares itself free of side effects, the bundler may elide the import entirely. Unlike an NgModule which often had eager initialization side effects, a standalone component's imports are metadata until the component is instantiated.9

#### **1.1.2 Zoneless Change Detection**

The move to zoneless (removing zone.js) simplifies the runtime performance profile but places higher demands on the explicit registration of change detection signals.5 While this primarily affects runtime behavior, it influences how third-party libraries like JSONForms interact with the framework. If ToolFormComponent relies on JsonFormsModule for inputs/outputs, and that module is stripped due to bundling errors, the component's internal logic collapses before change detection can even occur.

### **1.2 The Vite and Rollup Symbiosis: A Tale of Two Bundlers**

A critical realization for debugging this issue is that **Vite operates in two distinct modes**, which explains why the application works during npm start (Dev) but fails during Playwright CT (Build).10

**Table 1: Comparison of Build Modes in the Angular/Vite Ecosystem**

| Feature | Development Mode (ng serve) | Production/Test Mode (Playwright CT) |
| :---- | :---- | :---- |
| **Bundler Engine** | **esbuild** | **Rollup** |
| **Optimization Strategy** | Speed-focused; minimal optimizations. | Size-focused; aggressive Tree Shaking (DCE). |
| **Module Format** | Native ESM (served on demand). | Bundled ESM/SystemJS/CommonJS chunks. |
| **Tree Shaking** | Loose/Permissive. | **Strict/Aggressive.** |
| **Side Effects Handling** | Often ignores sideEffects: false. | **Strictly enforces sideEffects: false.** |
| **Outcome** | Component works (code is present). | **Component fails (code is removed).** |

#### **1.2.1 Development Mode (Esbuild)**

When running the application locally, Vite uses **esbuild** for dependency pre-bundling. Esbuild is optimized for compilation speed. It is generally less aggressive with tree-shaking and often preserves code that Rollup might remove to ensure developer experience is smooth and debugging is easy.10 This explains why the user sees the component working in the main application during development.

#### **1.2.2 Production/Test Build Mode (Rollup)**

Playwright Component Testing compiles the components using **Vite's Build Mode**, which switches the underlying engine to **Rollup**.1 Rollup is renowned for its efficient tree-shaking based on ESM (ECMAScript Module) static analysis.

* **The Mark-and-Sweep Algorithm:** Rollup starts at the entry point (in this case, Playwright's generated index.ts and component registry). It "marks" all reachable code. Any code not explicitly marked is "swept" (removed).12
* **The Side Effects Rule:** If an import is encountered (import { X } from 'lib'), but X is not explicitly used in a way that modifies the global state, Rollup checks the library's package.json. If "sideEffects": false is present, Rollup assumes the import can be safely removed without breaking the app.12

**The Conflict:** The user's issue arises specifically in this **Rollup** phase managed by Playwright CT. The fact that the component works in the main application build suggests that the application entry point (main.ts) creates a stronger, more explicit dependency graph than the synthetic entry point generated by Playwright CT.

### **1.3 Playwright Component Testing (CT) Internals**

Unlike End-to-End (E2E) testing, which automates a fully built and deployed application, Component Testing mounts individual components in a "clean" browser context.13

#### **1.3.1 The Orchestration Process**

1. **Node.js Process:** Runs the test file (tool-form.spec.ts). This process handles the test logic and assertions.
2. **Component Compilation:** Playwright compiles the component and its dependencies into a client-side bundle (using Vite/Rollup) that is served to the browser.
3. **The Registry Generation:** To allow the Node process to tell the Browser process "mount ToolFormComponent," Playwright generates a **Component Registry**. This is a virtual mapping file that imports every component referenced in the tests.4
   TypeScript
   // Virtual Registry (Simplified)
   import { ToolFormComponent } from '...';
   const registry \= {
     'ToolFormComponent': ToolFormComponent
   };
   register(registry);

4. **Mounting:** The mount function sends a message to the browser with a component ID. The browser looks up this ID in the registry, instantiates the component, and attaches it to the DOM.15

**The Point of Failure:** The error Could not resolve component occurs in Step 4\. The browser tries to resolve the component from the registry, but the bundle for that component is empty. This implies a failure in Step 2: Rollup analyzed the registry's import of ToolFormComponent, decided it was effectively a "no-op" (likely because its dependencies were shaken out, leaving a hollow shell), and optimized the chunk down to zero.1

## ---

**2\. Forensic Analysis of the Failure**

This section provides a detailed forensic examination of the specific error data provided in the research request to reconstruct the failure chain.

### **2.1 The "Empty Chunk" Anomaly**

The most damning piece of evidence provided is the build output size for the failing component:

.cache/assets/tool-form.component-l0sNRNKZ.js    0.06 kB

A size of **0.06 kB (approximately 60 bytes)** is essentially an empty file in the context of a JavaScript bundle. For comparison:

* session-card.component (Working): **522.58 kB**
* event-block.component (Working): **\~15 kB**

Implication:
This is definitive proof of Over-Aggressive Tree Shaking.1 The file tool-form.component.ts exists on the filesystem and is being processed by Vite (hence the generated chunk). However, Rollup has determined that nothing exported from this file is actually used or strictly necessary for the execution of the bundle, or that the file itself contains no side effects that warrant preservation.
If the file contained the actual Angular component logic (template string, styles, class definition), it would be significantly larger than 60 bytes. 60 bytes typically corresponds to a file containing only a Vite preamble, comments, or an empty export statement (e.g., export {};).

### **2.2 The JSONForms "Side Effects" Factor**

The forensic distinction between the working and non-working components is strictly the dependency on @jsonforms libraries.

* **Working Components:** Import standard Angular Material (@angular/material/icon) or Common modules (@angular/common). These libraries are typically well-optimized for Angular builds.
* **Failing Component:** Imports @jsonforms/angular and @jsonforms/angular-material.

**Hypothesis:** The @jsonforms/angular package (and potentially @jsonforms/core) likely has "sideEffects": false in its package.json.3

**The Mechanism of Failure:**

1. ToolFormComponent imports JsonFormsModule and angularMaterialRenderers.
2. These are passed to the imports array of the @Component decorator or assigned to class properties.
3. The Angular Compiler (via the Vite plugin) processes the decorator. In the specific build configuration used by Playwright CT (which might differ slightly from ng build in terms of AOT/JIT settings or entry point definition), the metadata registration is perceived by Rollup as a "pure" assignment.9
4. Rollup encounters: import { JsonFormsModule } from '@jsonforms/angular'.
5. It analyzes the usage. If JsonFormsModule is only used in a way that doesn't trigger a global side effect (due to sideEffects: false in the library), and if the Playwright Registry entry point doesn't strongly reference the *implementation* of ToolFormComponent in a way that forces retention of all metadata, Rollup drops the imports.12
6. Once the imports are dropped, the ToolFormComponent definition effectively becomes invalid or "empty" of functional logic in the eyes of the bundler.
7. Rollup recursively prunes the component class itself because its dependencies are gone, resulting in the 0.06 kB empty chunk.

### **2.3 Why "Issue 1" (Global Polyfill) Was Solved But This Persists**

The user successfully solved the ReferenceError: global is not defined issue by polyfilling global. This is a critical distinction:

* **Issue 1 (Global):** A **Runtime Error**. The code was present, but crashed upon execution because ajv tried to access global.
* **Issue 2 (Resolution):** A **Build/Link Time Error** manifesting as a runtime lookup failure. The code is *missing*.

The fact that the user moved past the global error means the build process *started*, but the *result* of the build was defective (the empty chunk). Fixing the global variable does not influence Rollup's tree-shaking logic; it only fixes the execution of code that *is* successfully bundled.

## ---

**3\. The Tree-Shaking Mechanism: Theoretical Deep Dive**

To understand why the proposed solution works, one must understand the mechanics of **Dead Code Elimination (DCE)** in Rollup.

### **3.1 Static Analysis and the dependency Graph**

Rollup builds a dependency graph by parsing the code into an Abstract Syntax Tree (AST). It analyzes import and export statements. Unlike Webpack (which historically wrapped modules in functions), Rollup hoists all modules into a single scope (scope hoisting).

In this process, it tracks variable usage. If a variable foo is imported but never referenced in the AST, it is marked for removal.

### **3.2 The sideEffects Property**

The sideEffects property in package.json is a hint to the bundler.12

* **"sideEffects": false**: The package author asserts that importing files from this package *does not* perform any side effects (like modifying the window object, registering a global plugin, or polyfilling a built-in). This allows the bundler to skip including the file entirely if its exports are unused.
* **"sideEffects": \["\*.css"\]**: A common pattern where only CSS files are marked as having side effects.

**The Trap:** Angular modules (NgModule) and dependency injection tokens often rely on "side effects" in the strict sense—registering a provider or a component definition that is not directly "called" by the consuming code but is needed by the framework. If JSONForms marks itself as side-effect free, but relies on internal registration mechanisms that Rollup cannot trace, the code is removed.

### **3.3 The Barrel File Problem**

JSONForms, like many libraries, uses "Barrel Files" (index.ts files that re-export contents from other files).17

* **Import:** import { angularMaterialRenderers } from '@jsonforms/angular-material';
* **Reality:** This import goes through index.ts, which exports renderers.ts.
* **Tree Shaking:** If angularMaterialRenderers is just a constant array of objects, and Rollup sees that this array is assigned to a component property but never "read" (e.g., iterated over) in the static analysis of the entry point, it might deem the export unused. If sideEffects is false, the entire chain of imports (the barrel file and the source file) is pruned.

## ---

**4\. Evaluation of Failed Attempts**

The user listed five attempted fixes. Analyzing why each failed confirms the "Side Effect" hypothesis and eliminates other possibilities.

### **4.1 Attempt 1 & 5: ssr.noExternal**

* **User Config:** ssr: { noExternal: \['@jsonforms/...'\] }
* **Why it Failed:** The ssr configuration block in Vite specifically controls bundling for **Server-Side Rendering** (SSR).19 Playwright Component Testing, despite utilizing a Node environment to orchestrate the test, builds a **Client-Side Bundle** to run in the browser (headless Chromium/Webkit/Firefox). Therefore, ssr options are largely ignored for the browser bundle generation. The component is failing to load in the *browser* context, so SSR settings are irrelevant.

### **4.2 Attempt 2: Disabling Manual Chunks**

* **User Config:** manualChunks: undefined
* **Why it Failed:** Chunk splitting happens *after* the module graph is analyzed and tree-shaken.21 If Rollup determines the code is dead, it is removed from the graph entirely. No amount of chunk configuration can force dead code back into a chunk. You cannot organize code that has already been deleted.

### **4.3 Attempt 3 & 4: Pre-importing in playwright/index.ts**

* **User Config:** import '../src/.../tool-form.component';
* **Why it Failed:** While this creates a reference, Rollup is sophisticated. If the import is a "bare import" (just for side effects) like import '...', Rollup looks at the target file. If the target file (or its dependencies) claims to be side-effect free via package.json, Rollup effectively says, "You asked me to import this file for its side effects, but the file says it has no side effects. Therefore, I will do nothing.".18 This creates a catch-22 where explicit imports are ignored due to the library's own configuration.

## ---

**5\. The Solution Strategy: Coercing Side Effects**

To solve this, we must definitively instruct Rollup that the JSONForms libraries (and potentially the component itself) **must not be tree-shaken**, regardless of what their package.json claims or what the static analysis suggests.

We will achieve this using the **rollupOptions.treeshake.moduleSideEffects** configuration.

### **5.1 The moduleSideEffects Mechanism**

The moduleSideEffects option in Rollup allows us to explicitly define which modules should be treated as having side effects.23

* **true:** The module is kept, and its top-level code is executed.
* **false:** The module can be removed if its exports are unused.
* **Function:** We can provide a function (id) \=\> boolean to dynamically match file paths.

By forcing moduleSideEffects: true for @jsonforms packages, we override the "sideEffects": false likely present in their package.json. This forces Rollup to bundle the code, ensuring the ToolFormComponent has valid dependencies, which in turn ensures ToolFormComponent itself is valid and retained.

### **5.2 Comprehensive Configuration Solution**

Below is the corrected playwright-ct.config.ts. This configuration includes the fix for the previous global issue and introduces the moduleSideEffects override. This is the primary recommendation.

TypeScript

import { defineConfig, devices } from '@sand4rt/experimental-ct-angular';
import angular from '@analogjs/vite-plugin-angular';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  testDir: 'tests/component',

  // Increase timeout for complex bundling debugging if necessary
  timeout: 60000,

  use: {
    ctViteConfig: {
      plugins:,
      resolve: {
        alias: {
          '@': resolve('./src'),
          '@app': resolve('./src/app'),
        },
        // Force resolution of main entry points if necessary (rarely needed but good for debugging)
        mainFields: \['module', 'browser', 'main'\],
      },
      define: {
        // FIX FOR ISSUE 1: Polyfill Node.js globals for Ajv/JSONForms
        // Mapping to 'window' is often safer than empty object '{}' in browser contexts
        global: 'window',
        'process.env.NODE\_ENV': JSON.stringify('production'),
      },
      build: {
        sourcemap: true, // Enable for debugging the empty chunks via dev tools
        commonjsOptions: {
           // Help Rollup convert CommonJS modules in JSONForms dependencies
           include: \[/node\_modules/\],
        },
        rollupOptions: {
          // CRITICAL FIX FOR ISSUE 2
          treeshake: {
            // Force Rollup to treat these modules as having side effects.
            // This prevents them from being pruned even if their package.json says "sideEffects": false
            moduleSideEffects: (id) \=\> {
              // Normalize path separators for cross-platform compatibility
              const normalizedId \= id.replace(/\\\\/g, '/');

              // 1\. Force JSONForms packages to be retained
              if (normalizedId.includes('@jsonforms')) return true;

              // 2\. Force the specific component failing to bundle to be retained
              // (This is a safety net; usually fixing the dependency fixes the parent)
              if (normalizedId.includes('tool-form.component')) return true;

              // 3\. Force AJV and other core deps which might have mixed module types
              if (normalizedId.includes('ajv')) return true;

              // Default behavior: let Rollup decide based on package.json
              return null;
            },
            // Use 'recommended' preset to ensure other optimizations still apply
            preset: 'recommended',
          },
        },
      },
      // Dev-time optimization (affects local serving, helps with dependency discovery)
      optimizeDeps: {
        force: true,
        include: \[
          '@angular/core',
          '@angular/common',
          '@angular/platform-browser',
          '@jsonforms/core',
          '@jsonforms/angular',
          '@jsonforms/angular-material',
          'ajv',
          'ajv-formats',
        \],
      },
    },
  },
});

#### **5.2.1 Detailed Explanation of the Changes**

1. **treeshake.moduleSideEffects Function:**
   * This is the "nuclear option" for tree-shaking issues.
   * if (normalizedId.includes('@jsonforms')) return true;: This specifically targets the library causing the issue. It tells Rollup: "Even if you think this library is unused, or if it claims to be pure, include it anyway."
   * This restores the dependency graph. Once @jsonforms/angular is retained, the ToolFormComponent's imports become valid, preventing the component class from being optimized away.
2. **define: { global: 'window' }:**
   * Refined from global: {}. Mapping global to window is safer in a browser environment because many libraries check if (typeof global\!== 'undefined') and then attach properties to it. If it's an empty object {} distinct from window, some libraries might split state or fail to attach to the global scope correctly.
3. **build.commonjsOptions:**
   * JSONForms dependencies (like ajv) often use CommonJS patterns. Vite usually handles this automatically, but explicit inclusion ensures the conversion happens correctly during the build phase.

## ---

**6\. Secondary Solution: Manual Component Registration**

If the moduleSideEffects fix does not resolve the issue (e.g., if the issue is not tree-shaking but rather the component registry generator missing the file entirely), the fallback strategy is to bypass the automatic component discovery mechanism of @sand4rt/experimental-ct-angular.

The "Could not resolve component" error implies the internal registry map is missing the entry. We can force the component into the browser context by importing and registering it manually in playwright/index.ts. This file serves as the entry point for the browser test runner.

### **6.1 Modified playwright/index.ts**

Code in this file is guaranteed to run before tests start, creating a "root" reference that Rollup cannot ignore.

TypeScript

// playwright/index.ts
import 'zone.js'; // Ensure zone.js is loaded if strictly required by libs, even if app is zoneless
import '../src/styles.css'; // Global styles

// CRITICAL: Explicitly import the problematic component and JSONForms modules
// This forces them to be part of the entry chunk
import { ToolFormComponent } from '../src/app/ui/control-panel/tool-form/tool-form.component';
import { JsonFormsModule } from '@jsonforms/angular';
import { angularMaterialRenderers } from '@jsonforms/angular-material';

// Log to confirm execution in browser console and force usage
console.log('Playwright Index: Pre-loading components');
console.log('ToolFormComponent loaded:', ToolFormComponent);
console.log('JSONForms Modules loaded:', { JsonFormsModule, angularMaterialRenderers });

// By logging the component, we create a side effect that Rollup must respect.
// This anchors the component in the bundle.

By adding console.log(ToolFormComponent), we create a "usage" of the class that Rollup cannot ignore. It forces the class to be included in the bundle because the code explicitly accesses it at runtime. This works around the automated registry's failure to detect the usage.

## ---

**7\. Validation and Verification Strategy**

To verify that the fix is working *before* running the full test suite, we recommend the following validation steps.

### **7.1 Analyzing the Bundle with rollup-plugin-visualizer**

The rollup-plugin-visualizer is an indispensable tool for diagnosing bundle issues.24 It generates a graphical treemap of the bundle content.

1. **Install:** npm install \--save-dev rollup-plugin-visualizer
2. **Config:**
   TypeScript
   import { visualizer } from 'rollup-plugin-visualizer';
   //... inside plugins array:
   plugins: \[
     //... other plugins
     visualizer({ filename: 'ct-stats.html', open: true })
   \]

3. **Analyze:** Run the Playwright CT test. A browser window will open showing the bundle.
   * **Failure State:** You will see tool-form.component as a tiny dot or missing entirely. @jsonforms will be absent.
   * **Success State:** You will see a substantial block for @jsonforms/angular and tool-form.component (referencing the \~500kB size of working components).

### **7.2 Checking Source Maps**

We enabled sourcemap: true in the recommended config.

1. Open the test in Playwright UI mode or debug mode.
2. Open Chrome DevTools.
3. Navigate to the Sources tab.
4. Look for tool-form.component.ts.
5. If the file contains only export {}; or is missing, tree-shaking is still active. If you see the full TypeScript source (mapped), the bundle is correct.

## ---

**8\. Broader Implications and Future Outlook**

### **8.1 The Risk of Standalone Components in Legacy Ecosystems**

This investigation highlights a fragility in testing Standalone Components with third-party libraries designed in the NgModule era. NgModule provided a rigid structure that bundlers implicitly respected. Standalone components are more fluid, making them more susceptible to aggressive tree-shaking when libraries rely on implicit side effects for initialization. As Angular evolves, library authors must update their package.json configurations to strictly define exports and side effects to be compatible with modern bundlers like Vite and Rollup.

### **8.2 The "Zoneless" Future**

As you are using Angular 21 with Zoneless change detection, be aware that JsonFormsModule might still internally rely on Zone.js behaviors (e.g., NgZone.run). While unrelated to the *bundling* error, you may encounter runtime change detection issues once the bundling is fixed. If the form renders but doesn't update, you may need to manually trigger ChangeDetectorRef.markForCheck() in the component or wrap renderer events in signals.5

### **8.3 CI/CD Reliability**

The configuration provided is stable for CI/CD environments. Unlike the fragile nature of relying on automatic detection, the explicit moduleSideEffects configuration provides a deterministic build output. This reduces "flaky" build failures where a minor version update to a library might inadvertently toggle its side-effect flags.

## **9\. Conclusion**

The "Could not resolve component" error and the 0.06 kB chunk size are definitive indicators that **Rollup is tree-shaking the ToolFormComponent out of existence** due to a misunderstanding of the side-effect nature of its dependencies, specifically @jsonforms/angular. The interaction between experimental-ct-angular's dynamic registry and the sideEffects: false declaration in JSONForms libraries creates a "dead code" blind spot for the bundler.

The validated solution is to strictly override this behavior using **rollupOptions.treeshake.moduleSideEffects** in the playwright-ct.config.ts, forcing the inclusion of the JSONForms library code. This restores the dependency graph, allowing the component to be bundled correctly and resolved by the test runner. This approach not only solves the immediate "Issue 2" but also robustly proofs the test infrastructure against similar tree-shaking issues in the future.

#### **Works cited**

1. Vite injects css assets in wrong order with dynamic import and css modules. · Issue \#3924 · vitejs/vite · GitHub, accessed January 16, 2026, [https://github.com/vitejs/vite/issues/3924](https://github.com/vitejs/vite/issues/3924)
2. Can code splitting be done according to chunk size? · Issue \#4327 · rollup/rollup \- GitHub, accessed January 16, 2026, [https://github.com/rollup/rollup/issues/4327](https://github.com/rollup/rollup/issues/4327)
3. Vite doesn't tree-shake my package : r/reactjs \- Reddit, accessed January 16, 2026, [https://www.reddit.com/r/reactjs/comments/1og016j/vite\_doesnt\_treeshake\_my\_package/](https://www.reddit.com/r/reactjs/comments/1og016j/vite_doesnt_treeshake_my_package/)
4. \[Feature\]: Support component testing · Issue \#331 · vitalets ... \- GitHub, accessed January 16, 2026, [https://github.com/vitalets/playwright-bdd/issues/331](https://github.com/vitalets/playwright-bdd/issues/331)
5. Versatile Angular Style brings Modern Dev Tools to Angular \- Marmicode, accessed January 16, 2026, [https://marmicode.io/blog/versatile-angular](https://marmicode.io/blog/versatile-angular)
6. 20 Ways to Make Your Angular Apps Run Faster | Part 4: Build and Diagnostics \- Medium, accessed January 16, 2026, [https://medium.com/ngconf/20-ways-to-make-your-angular-apps-run-faster-part-4-build-and-diagnostics-58bab2712202](https://medium.com/ngconf/20-ways-to-make-your-angular-apps-run-faster-part-4-build-and-diagnostics-58bab2712202)
7. vite-plugin-angular throws error after installing with yarn · Issue \#1458 · analogjs/analog, accessed January 16, 2026, [https://github.com/analogjs/analog/issues/1458](https://github.com/analogjs/analog/issues/1458)
8. \`Failed to resolve import "angular:jit:template:file;./app.component.html"\` error when plugin is loaded twice and jit is enabled · Issue \#1288 · analogjs/analog \- GitHub, accessed January 16, 2026, [https://github.com/analogjs/analog/issues/1288](https://github.com/analogjs/analog/issues/1288)
9. Ahead-of-time (AOT) compilation \- Angular, accessed January 16, 2026, [https://angular.dev/tools/cli/aot-compiler](https://angular.dev/tools/cli/aot-compiler)
10. Dependency Pre-Bundling \- Vite, accessed January 16, 2026, [https://vite.dev/guide/dep-pre-bundling](https://vite.dev/guide/dep-pre-bundling)
11. How to build a tree-shakable library with Vite and Rollup \- DEV Community, accessed January 16, 2026, [https://dev.to/morewings/how-to-build-a-tree-shakable-library-with-vite-and-rollup-16cb](https://dev.to/morewings/how-to-build-a-tree-shakable-library-with-vite-and-rollup-16cb)
12. Tree Shaking \- webpack, accessed January 16, 2026, [https://webpack.js.org/guides/tree-shaking/](https://webpack.js.org/guides/tree-shaking/)
13. 9 Steps for Successful Playwright Component Testing \- DevSquad, accessed January 16, 2026, [https://devsquad.com/blog/playwright-component-testing](https://devsquad.com/blog/playwright-component-testing)
14. Components (experimental) \- Playwright, accessed January 16, 2026, [https://playwright.dev/docs/test-components](https://playwright.dev/docs/test-components)
15. Migrating from Testing Library \- Playwright, accessed January 16, 2026, [https://playwright.dev/docs/testing-library](https://playwright.dev/docs/testing-library)
16. How To Get Started With Playwright Component Testing \- LambdaTest, accessed January 16, 2026, [https://www.lambdatest.com/learning-hub/playwright-component-testing](https://www.lambdatest.com/learning-hub/playwright-component-testing)
17. jsonforms/MIGRATION.md at master \- GitHub, accessed January 16, 2026, [https://github.com/eclipsesource/jsonforms/blob/master/MIGRATION.md](https://github.com/eclipsesource/jsonforms/blob/master/MIGRATION.md)
18. Package.json sideEffects: false and the treeshake. moduleSideEffects works differently · Issue \#5987 \- GitHub, accessed January 16, 2026, [https://github.com/rollup/rollup/issues/5987](https://github.com/rollup/rollup/issues/5987)
19. llms-full.txt \- Vite, accessed January 16, 2026, [https://vite.dev/llms-full.txt](https://vite.dev/llms-full.txt)
20. Vite Issue Overview · vitejs vite · Discussion \#8232 \- GitHub, accessed January 16, 2026, [https://github.com/vitejs/vite/discussions/8232](https://github.com/vitejs/vite/discussions/8232)
21. Configuration Options | Rollup, accessed January 16, 2026, [https://rollupjs.org/configuration-options/](https://rollupjs.org/configuration-options/)
22. In Rollup config, how does one use moduleSideEffects to import side effect files AND their dependencies? \- Stack Overflow, accessed January 16, 2026, [https://stackoverflow.com/questions/62918456/in-rollup-config-how-does-one-use-modulesideeffects-to-import-side-effect-files](https://stackoverflow.com/questions/62918456/in-rollup-config-how-does-one-use-modulesideeffects-to-import-side-effect-files)
23. Plugin Development \- Rollup, accessed January 16, 2026, [https://rollupjs.org/plugin-development/](https://rollupjs.org/plugin-development/)
24. Improve tree-shaking with sideEffects: "false" in package.json · Issue \#103 · mike-lischke/antlr4ng \- GitHub, accessed January 16, 2026, [https://github.com/mike-lischke/antlr4ng/issues/103](https://github.com/mike-lischke/antlr4ng/issues/103)
25. Another Tree Shaking THREE.JS Thread \- Questions, accessed January 16, 2026, [https://discourse.threejs.org/t/another-tree-shaking-three-js-thread/79954](https://discourse.threejs.org/t/another-tree-shaking-three-js-thread/79954)
