# **Playwright Sequential Test Failure Investigation: Angular 21 (Vite) and Docker Architecture Analysis**


## Table of Contents

- [**1\. Executive Summary and Problem Definition**](#1-executive-summary-and-problem-definition)
- [**2\. Architectural Context: The Angular-Vite Convergence**](#2-architectural-context-the-angular-vite-convergence)
  - [**2.1 The Paradigm Shift from Webpack to Vite**](#21-the-paradigm-shift-from-webpack-to-vite)
  - [**2.2 The "Hidden App-Root" Pattern and Bootstrapping**](#22-the-hidden-app-root-pattern-and-bootstrapping)
  - [**2.3 Angular 21 Zoneless Hydration Mechanics**](#23-angular-21-zoneless-hydration-mechanics)
  - [**2.4 Docker Network Isolation and Port Binding**](#24-docker-network-isolation-and-port-binding)
- [**3\. Failure Mechanism Analysis: The Sequential Anomaly**](#3-failure-mechanism-analysis-the-sequential-anomaly)
  - [**3.1 The "ReuseExistingServer" Trap**](#31-the-reuseexistingserver-trap)
  - [**3.2 WebSocket Connection Exhaustion and Blocking**](#32-websocket-connection-exhaustion-and-blocking)
  - [**3.3 The HMR Overlay Interference**](#33-the-hmr-overlay-interference)
  - [**3.4 Resource Exhaustion in Docker**](#34-resource-exhaustion-in-docker)
- [**4\. Deep Dive: Configuration Vectors and Root Cause Identification**](#4-deep-dive-configuration-vectors-and-root-cause-identification)
  - [**4.1 Playwright Configuration Analysis**](#41-playwright-configuration-analysis)
  - [**4.2 Vite Configuration Analysis**](#42-vite-configuration-analysis)
  - [**4.3 Angular Bootstrapping Logic**](#43-angular-bootstrapping-logic)
  - [**4.4 Synthesis of Root Causes**](#44-synthesis-of-root-causes)
- [**5\. Remediation Strategy and Best Practices**](#5-remediation-strategy-and-best-practices)
  - [**5.1 Step 1: Network Hardening for Docker**](#51-step-1-network-hardening-for-docker)
  - [**5.2 Step 2: Disabling HMR for E2E Testing**](#52-step-2-disabling-hmr-for-e2e-testing)
  - [**5.3 Step 3: Playwright Server Configuration**](#53-step-3-playwright-server-configuration)
  - [**5.4 Step 4: Application-Level Visibility Fallback**](#54-step-4-application-level-visibility-fallback)
  - [**5.5 Step 5: Handling Zoneless Stability in Tests**](#55-step-5-handling-zoneless-stability-in-tests)
- [**6\. Advanced Debugging: The "White Screen" Phenomenon**](#6-advanced-debugging-the-white-screen-phenomenon)
- [**7\. Conclusion**](#7-conclusion)
- [**8\. Summary of Findings & Recommendations**](#8-summary-of-findings-recommendations)
- [**9\. References and Citations**](#9-references-and-citations)
    - [**Works cited**](#works-cited)

## **1\. Executive Summary and Problem Definition**

The modernization of the frontend development ecosystem has introduced a paradigm shift in how applications are built, served, and tested. The transition from Webpack to Vite in Angular 21 represents a fundamental architectural change, moving from bundle-based serving to native ESM (ECMAScript Modules) serving with Hot Module Replacement (HMR) powered by persistent WebSockets. While this shift offers significant improvements in developer experience (DX) and build speeds, it introduces complex state management challenges within automated testing environments, particularly when encapsulated in Docker containers.

This report investigates a specific, high-impact failure mode observed in Playwright end-to-end (E2E) test suites running against Angular 21 applications. The failure manifests as a sequential anomaly: the initial test case executes successfully, but subsequent tests within the same suite fail immediately or time out. The visible symptom is a "hidden app-root," indicating that the application shell—typically styled to be invisible or display a loading indicator prior to framework bootstrapping—never transitions to the active application state.

The analysis suggests that this failure is not a defect in the application logic itself, but a convergence of three distinct architectural vectors: the persistence of the Vite HMR WebSocket connection across test boundaries, the "reuseExistingServer" configuration in Playwright, and the specific bootstrapping mechanics of Angular 21’s zoneless hydration process. When these components operate within a Dockerized environment, the network isolation and port binding behaviors create a scenario where the HMR client script blocks the application initialization sequence during the second test run. This report provides an exhaustive technical breakdown of these mechanisms, supported by evidence from current documentation and community issue trackers, and offers a comprehensive remediation strategy for enterprise-grade Continuous Integration (CI) pipelines.

## **2\. Architectural Context: The Angular-Vite Convergence**

To fully comprehend the failure of sequential tests in this specific technology stack, it is necessary to first deconstruct the underlying architecture of Angular 21’s development server and its interaction with the Vite ecosystem. The move to Angular 21 is not merely a version increment; it involves the adoption of "Zoneless" change detection and a complete reliance on Vite for the development server, fundamentally altering the runtime characteristics of the application during testing.

### **2.1 The Paradigm Shift from Webpack to Vite**

For nearly a decade, the Angular Command Line Interface (CLI) relied on Webpack as its primary build tool. The Webpack development server operated on a bundling model: when a file changed, Webpack would recompile the dependency graph and serve a new JavaScript bundle to the browser. Crucially, the "live reload" mechanism in Webpack often triggered a full page refresh or used a polling mechanism that was relatively stateless.1 In a testing context, this was robust; every test run essentially received a fresh bundle, and the tear-down of the previous test state was absolute.

Angular 21 completes the transition to Vite, a build tool that fundamentally changes the serving model by leveraging native ES modules (ESM) in the browser. Instead of bundling the application before serving, Vite serves source files directly and performs light transformation on demand.3 This architecture relies heavily on a persistent WebSocket connection between the browser (client) and the Vite server to facilitate Hot Module Replacement (HMR). HMR allows modules to be swapped in place without a full page reload, preserving the application state.5

In an End-to-End (E2E) testing context using Playwright, this persistence becomes a liability. While Webpack’s full reload cleared the application state effectively, Vite’s HMR attempts to maintain a connection that may become unstable, "stale," or blocked when Playwright recycles browser contexts or when tests run sequentially against a reused server instance.7 The WebSocket connection, unlike a standard HTTP request, is a long-lived, stateful tunnel. If the test runner tears down the browser context without cleanly closing the socket, or if the server maintains a "ghost" connection, the subsequent test run encounters a port conflict or a refusal of connection that the client-side script cannot handle gracefully.

### **2.2 The "Hidden App-Root" Pattern and Bootstrapping**

The user query identifies the primary symptom as a "hidden app-root." To understand why this is significant, we must analyze the standard Angular application architecture, often referred to as the "app shell" or "pre-bootstrap loading" pattern.9

When an Angular application loads, the index.html file is served first. This file contains the \<app-root\> tag, which is the mounting point for the application. However, until the JavaScript bundles are downloaded, parsed, and executed, and until Angular bootstraps the root component, this tag is empty. To prevent the user from seeing a blank white screen or unstyled content (FOUC), developers routinely apply styles to the app-root selector or inject a loading overlay (splash screen) directly into the index.html.

Common implementations of this pattern include:

* **CSS Hiding:** Rules such as app-root:empty { display: none; } or specific classes that set visibility: hidden are applied to the root element. The expectation is that once Angular bootstraps, it will populate the element (making it non-empty) or the application logic will remove the hiding class.9
* **Aria Attributes:** Setting aria-hidden="true" on the root to prevent screen readers from announcing content before it is ready is another common practice that can interfere with testing tools if not toggled off correctly.11
* **Overlay Injection:** Placing a div with a spinner inside app-root. Angular's default behavior is to clear the inner HTML of app-root when it bootstraps, effectively removing the spinner. If bootstrap fails, the spinner remains, potentially obscuring the application.12

In the reported failure mode, the app-root remains hidden in subsequent tests. This is a critical diagnostic indicator. It signifies that **Angular has failed to bootstrap**. The application script main.ts has either not executed, halted due to a runtime error, or is waiting indefinitely for a "stable" signal that never arrives.13 The test failure is not because the element is missing, but because the framework responsible for making it visible has been arrested by an upstream failure.

### **2.3 Angular 21 Zoneless Hydration Mechanics**

Angular 21 introduces "Zoneless" change detection by default, removing the dependency on zone.js.15 This is a massive internal shift that impacts how the framework determines stability and readiness, which are concepts central to E2E testing.

Historically, Playwright (and Protractor before it) relied on zone.js to know when the application was stable. zone.js monkey-patched asynchronous APIs (like setTimeout, Promise, and XHR) to track pending tasks. When the queue of pending tasks emptied, the app was considered "stable," and the test would proceed.

In a Zoneless architecture, Angular relies on explicit signals and hydration cues. The framework listens for specific triggers to update the DOM. If the application is using Server-Side Rendering (SSR) with hydration (which is increasingly common and default in newer Angular versions), the client-side script must "hydrate" the static HTML served by the server. If this hydration process is interrupted—for example, by a Vite HMR overlay injecting unexpected DOM nodes or a WebSocket error halting the script execution—Angular may throw a hydration mismatch error. This error often results in the application aborting the bootstrap process entirely, leaving the app-root in its pre-hydrated, hidden state.17

### **2.4 Docker Network Isolation and Port Binding**

The third critical component in this failure triad is the Docker environment. The networking model of Docker introduces boundaries that do not exist in local development on a host machine.

Vite’s development server, by default, binds to localhost (127.0.0.1). Inside a Docker container, this loopback address is isolated to that container. For an external process (like a Playwright runner on the host or in a separate container) to access the application, the Vite server must be configured to bind to 0.0.0.0.8

However, the HTTP port binding is only half the equation. The HMR mechanism uses a separate WebSocket connection. If the Vite configuration does not explicitly define the clientPort for HMR, it will instruct the browser to connect to the port it sees internally (e.g., port 5173 on the container's localhost). The browser, running in a Playwright context outside that networking namespace, attempts to connect to ws://localhost:5173. If the port mapping is not perfectly aligned, or if the Docker proxy is overwhelmed by rapid connection cycling (a known issue with Docker's userland proxy), the WebSocket connection fails with ERR\_CONNECTION\_REFUSED. Crucially, Vite's client-side script often blocks or throws unhandled exceptions if this connection cannot be established, which arrests the main Angular bundle execution.20

## **3\. Failure Mechanism Analysis: The Sequential Anomaly**

The specific pattern of "Pass, then Fail" is the diagnostic key that eliminates simple configuration errors. If the ports were wrong, or the dependencies missing, the *first* test would fail. The sequential failure implies a state accumulation or resource exhaustion issue that manifests only after the first test execution cycle completes.

### **3.1 The "ReuseExistingServer" Trap**

Playwright’s webServer configuration block includes a reuseExistingServer option. This defaults to true in local development environments and false in CI environments (often toggled via \!process.env.CI).22 However, in complex Dockerized setups, developers often force this to true to avoid the overhead of spinning up the Angular CLI (which is heavy) for every single test file.

When reuseExistingServer is active, the following sequence occurs:

1. **Test 1 Starts:** Playwright launches the Vite server. The server initializes, binds ports, and waits. The browser context opens, navigates to the application URL, establishes an HMR WebSocket connection, and the test passes.22
2. **Test 1 Ends:** Playwright closes the *browser context*, but the *Vite server* remains running. Ideally, the WebSocket connection should be severed cleanly.
3. **Test 2 Starts:** Playwright creates a *new* browser context (or reuses a worker) and navigates to the same URL.
4. **The Failure:** The new browser page attempts to connect to the existing Vite server.

The failure occurs here. The Vite server, having serviced the first connection, may maintain internal state regarding the connected client. When the second connection attempt comes from a new browser context (but potentially the same IP/Port due to Docker NAT), a race condition or state conflict arises. Evidence suggests that the Vite server does not effectively handle the rapid disconnection and reconnection of HMR sockets typical in high-speed E2E tests, especially when network address translation (Docker) introduces latency or keeps sockets in a TIME\_WAIT state.20

### **3.2 WebSocket Connection Exhaustion and Blocking**

A critical insight from the research material is the behavior of Vite's HMR client when WebSocket connections fail. The HMR client is injected as a script tag early in the document. It attempts to open a WebSocket to the server to listen for updates.

* **Blocking Behavior:** In some configurations, particularly with Angular 19+ (and by extension 21), the bootstrapping of the application logic is implicitly dependent on the module graph loading managed by Vite. If the HMR socket fails (ERR\_CONNECTION\_REFUSED), the Vite client may throw an unhandled exception or enter a retry loop.20
* **Console Errors:** Snippets indicate that failed HMR connections log errors like \[vite\] failed to connect to websocket.20 While these are often non-fatal in manual testing where a user might just refresh, in an automated Playwright environment, this error can be fatal. If the test framework waits for "network idle," the retry loop prevents that state. More critically, if the error prevents the execution of main.ts, the bootstrapApplication function is never called.26

If the HMR client script halts execution due to a socket error, the app-root logic is never reached. Consequently, the app-root remains in its pre-bootstrap "hidden" state, causing the Playwright locator to time out while waiting for visibility.

### **3.3 The HMR Overlay Interference**

Vite includes a built-in "Error Overlay" that covers the screen when compilation errors occur. Even when no errors are visible, the logic for this overlay is part of the HMR client. Snippets reveal that tests can fail because the HMR overlay intercepts clicks or interactions, even if it appears invisible or transparent.27

In a sequential test run, the shutdown of Test 1 might leave the server in a state where it thinks the client has disconnected abnormally. When Test 2 connects, the server might briefly send an error state or a "reconnecting" signal. This can trigger the injection of the overlay into the DOM. Since Angular 21's hydration is non-destructive and expects a pristine DOM matching the server output, the presence of this overlay element can cause a Hydration Mismatch. Angular detects the mismatch, aborts hydration to prevent data corruption, and leaves the app in a broken state.18

### **3.4 Resource Exhaustion in Docker**

Running E2E tests involves launching a full browser (Chromium) inside or alongside a container. This is resource-intensive.

* **File Descriptors:** Vite watches thousands of files. The browser opens dozens of connections. Linux containers have default ulimit settings that are often too low for this combination.30
* **Ephemeral Ports:** Rapidly opening and closing TCP connections (as Playwright does when creating new contexts for each test) can exhaust the pool of available ephemeral ports if the Docker network stack doesn't recycle them fast enough. This leads to ERR\_CONNECTION\_REFUSED on the second or third test, matching the reported symptom.31

## **4\. Deep Dive: Configuration Vectors and Root Cause Identification**

To pinpoint the exact cause, we must analyze the specific configuration files involved in this stack: playwright.config.ts, vite.config.ts, and angular.json.

### **4.1 Playwright Configuration Analysis**

The webServer configuration block in Playwright is the primary suspect in the "Pass-Fail" sequence.

| Configuration Option | Implication in Docker/Angular 21 | Evidence |
| :---- | :---- | :---- |
| reuseExistingServer: true | Reuses the stateful Vite server. Accumulates WebSocket connections. Does not reset HMR state between tests. Essential for speed, fatal for isolation. | 8 |
| reuseExistingServer:\!process.env.CI | Standard practice. However, if the Docker environment is not explicitly flagged as CI=true, it defaults to reuse, triggering the failure. | 23 |
| url vs port | Using url makes Playwright wait for a 200 OK via HTTP. This does *not* guarantee the WebSocket port is open or accepting connections. Using port checks TCP availability but ignores application readiness. | 32 |
| fullyParallel: true | If tests run in parallel against a single Vite server instance, HMR messages may be broadcast to the wrong browser context, causing race conditions and hydration mismatches. | 8 |

**Insight:** The sequential nature of the failure strongly suggests that webServer is not being torn down and restarted between tests, and the second test is inheriting a degraded state (zombie sockets or memory leaks) from the first.

### **4.2 Vite Configuration Analysis**

The default Vite configuration is hostile to Dockerized E2E testing due to strict security defaults regarding host binding and HMR origins.

* **Host Binding:** server.host: '0.0.0.0' is mandatory in Docker. If missing, Playwright (running in a different container or the host) cannot reach the server.19
* **HMR Protocol & Port:** In Docker/SSL environments, the HMR protocol (ws vs wss) must match the serving protocol. More importantly, if server.hmr.clientPort is not set, Vite tells the browser to connect to the *internal* container port. The browser, potentially running outside the container (or in a separate container with different port mapping), cannot reach this internal port. This results in the ERR\_CONNECTION\_REFUSED seen in console logs, blocking the app start.20

### **4.3 Angular Bootstrapping Logic**

The bootstrapping logic in main.ts is the final gatekeeper.

TypeScript

// Typical Angular 21 Zoneless Bootstrap
bootstrapApplication(AppComponent, {
  providers:
}).catch(err \=\> console.error(err));

If bootstrapApplication fails, the catch block logs the error, but the UI remains in the state defined in index.html. If the Vite client script (injected before main.ts) fails or hangs, the browser stops processing the module graph. The bootstrapApplication function is never called. The app-root remains hidden forever.

### **4.4 Synthesis of Root Causes**

Based on the intersection of these behaviors, we can identify the specific failure chain:

**Root Cause A: The "Silent Blocker" (HMR Port Mismatch)**

1. Vite starts inside Docker on port 5173\. It tells the browser (HMR client) to connect to ws://localhost:5173.
2. **Test 1:** Playwright routes the HTTP request. The HMR socket might fail, but the first load is robust enough (or cached) to ignore it, or the timing allows Angular to bootstrap before the socket timeout.
3. **Test 2:** The browser context is reset. The page reloads. The browser attempts to reconnect to the HMR socket. Due to accumulated failed connections or port exhaustion from Test 1, the connection is refused.
4. **Result:** The Vite client script enters a blocking retry loop. This delays or prevents the execution of the Angular bundle. Angular never bootstraps. The app-root remains hidden.

**Root Cause B: The "Hydration Mismatch" (HMR Overlay)**

1. **Test 2:** The browser reloads. If the Vite server detects a momentary disconnection or error from the previous session, it injects the HMR Error Overlay into the DOM.
2. **Angular Hydration:** Angular 21 attempts to hydrate the view. It expects app-root to contain specific server-rendered nodes. Instead, it finds the Vite Overlay nodes.
3. **Result:** Hydration aborts due to DOM mismatch. The application enters a broken state where the interactive client-side logic never attaches. The interface appears frozen.

## **5\. Remediation Strategy and Best Practices**

To permanently resolve the sequential test failure, a layered approach is required, addressing the network configuration, the server lifecycle, and the application bootstrapping.

### **5.1 Step 1: Network Hardening for Docker**

The Vite server must be explicitly configured to broadcast the correct location of the HMR socket to the client, accounting for the Docker port mapping. This ensures that the browser can always establish the WebSocket connection, preventing the client script from blocking.

**Action:** Modify vite.config.ts to explicitly define the HMR client port.

TypeScript

// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0', // Bind to all interfaces for Docker
    port: 5173,
    hmr: {
      // FORCE the client to connect to the mapped port, not the internal one
      clientPort: 5173,
      // Ensure the protocol matches (ws for http, wss for https)
      protocol: 'ws',
    },
    // Watch settings are crucial for Docker file system events
    watch: {
      usePolling: true,
    }
  }
});

*Reasoning:* Setting clientPort ensures that even if Vite sees itself running on an internal container IP, it instructs the browser to connect via the public-facing port mapped in Docker Compose. This resolves the ERR\_CONNECTION\_REFUSED errors.19

### **5.2 Step 2: Disabling HMR for E2E Testing**

Hot Module Replacement is a development-time convenience that becomes a liability in automated testing. It introduces non-deterministic network traffic (WebSocket heartbeats) that can cause flakes. For E2E tests, stability is paramount.

**Action:** Disable HMR specifically when running in the test environment.

TypeScript

// vite.config.ts
export default defineConfig(({ mode }) \=\> {
  const isTest \= mode \=== 'test' |

| process.env.NODE\_ENV \=== 'test';

  return {
    server: {
      // Disable HMR in test mode to prevent socket blocking
      hmr: isTest? false : {... },
    }
  };
});

**Alternative Action (Angular CLI):** In angular.json, ensure the test configuration disables live reload optimizations.

JSON

"configurations": {
  "test": {
    "liveReload": false,
    "hmr": false
  }
}

*Reasoning:* Disabling HMR forces the application to load as a standard static bundle. This removes the WebSocket point of failure entirely. The application bootstrap becomes deterministic: load script \-\> execute \-\> render. It eliminates the possibility of the HMR overlay causing hydration mismatches.37

### **5.3 Step 3: Playwright Server Configuration**

We must ensure that Playwright does not reuse a "dirty" server instance that might have a hung WebSocket connection from a previous test.

**Action:** Update playwright.config.ts to enforce server isolation in CI/Docker.

TypeScript

// playwright.config.ts
export default defineConfig({
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:4200',
    // CRITICAL: Disable server reuse in CI to force fresh starts
    reuseExistingServer:\!process.env.CI,
    timeout: 120 \* 1000,
  },
  use: {
    // Ensure the base URL matches the Docker service name if running internal to Docker network
    baseURL: process.env.CI? 'http://app-service:4200' : 'http://localhost:4200',
  }
});

*Reasoning:* While reusing the server saves startup time, in a Dockerized CI environment, the risk of port exhaustion or zombie socket connections outweighs the speed benefit. Forcing a fresh server (or ensuring reuseExistingServer is correctly disabled in CI) mitigates state leakage between tests.8

### **5.4 Step 4: Application-Level Visibility Fallback**

To prevent the "hidden app-root" symptom from obscuring the true error (and to allow Playwright to debug effectively), modify the application to fail gracefully or ensure visibility even if bootstrap hangs.

**Action:** Update index.html to separate the loader from the root using CSS sibling selectors rather than nesting.

*Current (Problematic):*

HTML

\<app-root style\="display: none"\>Loading...\</app-root\>

*Recommended:*

HTML

\<app-root\>\</app-root\>
\<div id\="loader"\>Loading...\</div\>
\<style\>
  /\* Only hide the loader when app-root has content (is bootstrapped) \*/
  app-root:not(:empty) \+ \#loader { display: none; }
\</style\>

*Reasoning:* This CSS technique (:not(:empty)) automatically hides the loader *only* when Angular successfully injects content into app-root. If Angular fails to bootstrap, the loader remains visible, but the app-root itself isn't forcibly hidden by an inline style that requires JavaScript to remove. This allows Playwright to query the app-root state more accurately and potentially capture a screenshot of the failure state.9

### **5.5 Step 5: Handling Zoneless Stability in Tests**

Since Angular 21 is zoneless, Playwright's auto-waiting mechanisms (which historically relied on polling window.angular or zone.js status) might fail to detect when the app is idle.

**Action:** Implement a custom waiter in Playwright tests that checks for DOM population rather than network idle.

TypeScript

// test-utils.ts
export async function waitForAppStable(page: Page) {
  // Wait until app-root has children (indicating hydration/render complete)
  await page.waitForFunction(() \=\> {
    return\!\!document.querySelector('app-root')?.children.length;
  });
}

*Reasoning:* This explicit check bypasses the reliance on network idle or zone stability. It waits purely for the DOM to be populated, which confirms that bootstrapApplication has succeeded and the component tree has rendered.39

## **6\. Advanced Debugging: The "White Screen" Phenomenon**

If the remediation steps above do not resolve the issue, the investigation must turn to **browser console logs** captured by Playwright. The "hidden app-root" is essentially a variation of the "White Screen of Death," and the clues are almost always in the console.

Playwright does not automatically fail a test on console errors; it usually fails on a timeout waiting for a selector.
Recommendation: Configure Playwright to dump console logs on failure to identify the specific blocking error.

TypeScript

// playwright.config.ts
hooks: {
  onTestFailure: async ({ page }) \=\> {
    const logs \= await page.evaluate(() \=\> window.logs); // Custom log capture
    console.log("Browser Logs:", logs);
  }
}

* If the logs reveal \[vite\] failed to connect to websocket followed by Uncaught Error:..., the HMR connection is definitively the blocker.
* If the logs reveal Hydration Mismatch or NG0500, the issue is the Zoneless/SSR conflict where the Vite overlay is polluting the DOM before hydration completes.18

## **7\. Conclusion**

The failure of sequential Playwright tests in an Angular 21 \+ Vite \+ Docker environment is a deterministic consequence of conflicting network architectures and state management strategies. The persistence of the Vite HMR WebSocket across tests, combined with the strict isolation of the Docker network, creates a scenario where subsequent tests fail to establish the control channel required for the application to bootstrap. This leaves the app-root in its initial, hidden state, appearing as a test failure.

The solution is not found in changing the test logic, but in reconfiguring the infrastructure to respect the boundaries of the environment:

1. **Bind Vite to 0.0.0.0** and explicitly map the HMR clientPort to bypass Docker NAT issues.
2. **Disable HMR** (hmr: false) in the test configuration to eliminate WebSocket fragility and ensure a deterministic bootstrap sequence.
3. **Disable reuseExistingServer** in CI/Docker environments to ensure a clean network slate for every test suite.

By treating the test environment as a static production-like target rather than a dynamic development environment, the instability introduced by HMR is eliminated, ensuring reliable sequential test execution.

## **8\. Summary of Findings & Recommendations**

| Failure Vector | Mechanism | Impact | Recommendation |
| :---- | :---- | :---- | :---- |
| **Vite HMR** | WebSocket connection failure in Docker | Blocks App Bootstrap | Set server.hmr.clientPort or hmr: false |
| **Playwright** | reuseExistingServer | Accumulates stale connections | Set reuseExistingServer:\!process.env.CI |
| **Angular** | Pre-bootstrap styling | Hides App on failure | Use CSS :empty selector instead of JS toggling |
| **Network** | localhost binding | Unreachable in Docker | Bind server.host to 0.0.0.0 |
| **Hydration** | Zoneless/HMR conflict | Hydration Mismatch Error | Disable HMR/LiveReload for hydration tests |

## **9\. References and Citations**

The analysis in this report is derived from the following documented behaviors and community investigations:

* **Playwright Worker & Server Reuse:**.8
* **Vite HMR & WebSocket Failures:**.20
* **Angular App-Root & Loading Strategies:**.9
* **Docker Network Isolation:**.8
* **Angular Zoneless & Hydration:**.15
* **Debugging Playwright Timeouts:**.42

#### **Works cited**

1. @angular-devkit/build-optimizer | Yarn, accessed January 12, 2026, [https://classic.yarnpkg.com/en/package/@angular-devkit/build-optimizer](https://classic.yarnpkg.com/en/package/@angular-devkit/build-optimizer)
2. Angular 12 \- Generating browser application bundles (phase: sealing) very slow, accessed January 12, 2026, [https://stackoverflow.com/questions/67733861/angular-12-generating-browser-application-bundles-phase-sealing-very-slow](https://stackoverflow.com/questions/67733861/angular-12-generating-browser-application-bundles-phase-sealing-very-slow)
3. llms-full.txt \- Nuxt, accessed January 12, 2026, [https://nuxt.com/llms-full.txt](https://nuxt.com/llms-full.txt)
4. Angular 17: Continuing the Renaissance \- This Dot Labs, accessed January 12, 2026, [https://www.thisdot.co/blog/angular-17-continuing-the-renaissance](https://www.thisdot.co/blog/angular-17-continuing-the-renaissance)
5. Does Vite recommend using Typescript \+ SWC for new projects? : r/reactjs \- Reddit, accessed January 12, 2026, [https://www.reddit.com/r/reactjs/comments/1174dev/does\_vite\_recommend\_using\_typescript\_swc\_for\_new/](https://www.reddit.com/r/reactjs/comments/1174dev/does_vite_recommend_using_typescript_swc_for_new/)
6. Migrating Remix to Vite \- Fernando Abolafio \- Medium, accessed January 12, 2026, [https://fernandoabolafio.medium.com/migrating-remix-to-vite-0fc96c183f2d](https://fernandoabolafio.medium.com/migrating-remix-to-vite-0fc96c183f2d)
7. Bulk Playwright tests are failing : r/QualityAssurance \- Reddit, accessed January 12, 2026, [https://www.reddit.com/r/QualityAssurance/comments/1fugq1l/bulk\_playwright\_tests\_are\_failing/](https://www.reddit.com/r/QualityAssurance/comments/1fugq1l/bulk_playwright_tests_are_failing/)
8. Same working Playwright tests fail when placed in a project in playwright.config.js \[closed\], accessed January 12, 2026, [https://stackoverflow.com/questions/79710990/same-working-playwright-tests-fail-when-placed-in-a-project-in-playwright-config](https://stackoverflow.com/questions/79710990/same-working-playwright-tests-fail-when-placed-in-a-project-in-playwright-config)
9. Pre-bootstrap loading screen \- angular \- Stack Overflow, accessed January 12, 2026, [https://stackoverflow.com/questions/35243443/pre-bootstrap-loading-screen](https://stackoverflow.com/questions/35243443/pre-bootstrap-loading-screen)
10. Optimize User Experience While Your Angular App Loads | by Netanel Basal \- Medium, accessed January 12, 2026, [https://medium.com/netanelbasal/optimize-user-experience-while-your-angular-app-loads-7e982a67ff1a](https://medium.com/netanelbasal/optimize-user-experience-while-your-angular-app-loads-7e982a67ff1a)
11. Warning: "Blocked aria-hidden on an element because its descendant retained focus" in Angular modal \- Stack Overflow, accessed January 12, 2026, [https://stackoverflow.com/questions/79159883/warning-blocked-aria-hidden-on-an-element-because-its-descendant-retained-focu](https://stackoverflow.com/questions/79159883/warning-blocked-aria-hidden-on-an-element-because-its-descendant-retained-focu)
12. After Upgrade to Angular 12 styles.scss not found on some routes · Issue \#21332 \- GitHub, accessed January 12, 2026, [https://github.com/angular/angular-cli/issues/21332](https://github.com/angular/angular-cli/issues/21332)
13. server app instance not removed from DOM after client bootstraps app · Issue \#111 · angular/preboot \- GitHub, accessed January 12, 2026, [https://github.com/angular/preboot/issues/111](https://github.com/angular/preboot/issues/111)
14. How to avoid the angular white screen of death | by Korbinian Kuhn \- Medium, accessed January 12, 2026, [https://korbiniankuhn.medium.com/how-to-avoid-the-angular-white-screen-of-death-a11e31d13633](https://korbiniankuhn.medium.com/how-to-avoid-the-angular-white-screen-of-death-a11e31d13633)
15. Angular 21: Signal Forms, Zoneless Mode & Vitest \- International JavaScript Conference, accessed January 12, 2026, [https://javascript-conference.com/blog/angular-21-signal-forms-zoneless-vitest/](https://javascript-conference.com/blog/angular-21-signal-forms-zoneless-vitest/)
16. Announcing Angular v21, accessed January 12, 2026, [https://blog.angular.dev/announcing-angular-v21-57946c34f14b](https://blog.angular.dev/announcing-angular-v21-57946c34f14b)
17. Angular v21 Goes Zoneless by Default: What Changes & Why It's Faster \- PushBased, accessed January 12, 2026, [https://push-based.io/article/angular-v21-goes-zoneless-by-default-what-changes-why-its-faster-and-how-to](https://push-based.io/article/angular-v21-goes-zoneless-by-default-what-changes-why-its-faster-and-how-to)
18. NG0751: @defer behavior when HMR is enabled \- Angular, accessed January 12, 2026, [https://angular.dev/errors/NG0751](https://angular.dev/errors/NG0751)
19. Server Options \- Vite, accessed January 12, 2026, [https://vite.dev/config/server-options](https://vite.dev/config/server-options)
20. Disabling WebSocket and HMR · Issue \#18489 · vitejs/vite \- GitHub, accessed January 12, 2026, [https://github.com/vitejs/vite/issues/18489](https://github.com/vitejs/vite/issues/18489)
21. Failed to connect to websocket. · Issue \#29915 · angular/angular-cli \- GitHub, accessed January 12, 2026, [https://github.com/angular/angular-cli/issues/29915](https://github.com/angular/angular-cli/issues/29915)
22. Retries \- Playwright, accessed January 12, 2026, [https://playwright.dev/docs/test-retries](https://playwright.dev/docs/test-retries)
23. TestConfig \- Playwright, accessed January 12, 2026, [https://playwright.dev/docs/api/class-testconfig](https://playwright.dev/docs/api/class-testconfig)
24. Web server \- Playwright, accessed January 12, 2026, [https://playwright.dev/docs/test-webserver](https://playwright.dev/docs/test-webserver)
25. Fixing WebSocket Connection Errors in Laravel \+ Vite \+ SSL with Herd or Valet \- Medium, accessed January 12, 2026, [https://medium.com/@lucaspedreiraBR/fixing-websocket-connection-errors-in-laravel-vite-ssl-with-herd-or-valet-741b22a6582d](https://medium.com/@lucaspedreiraBR/fixing-websocket-connection-errors-in-laravel-vite-ssl-with-herd-or-valet-741b22a6582d)
26. Playwright test will only pass when debugging, but fails when running when testing angular app \- Stack Overflow, accessed January 12, 2026, [https://stackoverflow.com/questions/74382787/playwright-test-will-only-pass-when-debugging-but-fails-when-running-when-testi](https://stackoverflow.com/questions/74382787/playwright-test-will-only-pass-when-debugging-but-fails-when-running-when-testi)
27. HMR overlay captures test clicks and cannot be disabled · Issue \#8554 \- GitHub, accessed January 12, 2026, [https://github.com/vitest-dev/vitest/issues/8554](https://github.com/vitest-dev/vitest/issues/8554)
28. You Can Also Disable This Overlay By Setting Server.hmr.overlay To False In Vite.config.js., accessed January 12, 2026, [https://devs.keenthemes.com/question/you-can-also-disable-this-overlay-by-setting-serverhmroverlay-to-false-in-viteconfigjs](https://devs.keenthemes.com/question/you-can-also-disable-this-overlay-by-setting-serverhmroverlay-to-false-in-viteconfigjs)
29. Bootstrap Modal Dialog showing under Modal Background \- Rick Strahl's Web Log, accessed January 12, 2026, [https://weblog.west-wind.com/posts/2016/sep/14/bootstrap-modal-dialog-showing-under-modal-background](https://weblog.west-wind.com/posts/2016/sep/14/bootstrap-modal-dialog-showing-under-modal-background)
30. Troubleshooting \- Vite, accessed January 12, 2026, [https://vite.dev/guide/troubleshooting](https://vite.dev/guide/troubleshooting)
31. Is there a limit (practical or otherwise) to the number of web sockets a page opens?, accessed January 12, 2026, [https://stackoverflow.com/questions/26003756/is-there-a-limit-practical-or-otherwise-to-the-number-of-web-sockets-a-page-op](https://stackoverflow.com/questions/26003756/is-there-a-limit-practical-or-otherwise-to-the-number-of-web-sockets-a-page-op)
32. Playwright does not see the running webserver \- Stack Overflow, accessed January 12, 2026, [https://stackoverflow.com/questions/78114461/playwright-does-not-see-the-running-webserver](https://stackoverflow.com/questions/78114461/playwright-does-not-see-the-running-webserver)
33. Playwright tests running flaky when setting \`reuseExistingServer: true\` in module federation setup · Issue \#32865 · nrwl/nx \- GitHub, accessed January 12, 2026, [https://github.com/nrwl/nx/issues/32865](https://github.com/nrwl/nx/issues/32865)
34. vite \- Failed to connect to websocket \- Stack Overflow, accessed January 12, 2026, [https://stackoverflow.com/questions/74465346/failed-to-connect-to-websocket](https://stackoverflow.com/questions/74465346/failed-to-connect-to-websocket)
35. Vitejs: WebSocket connection to 'wss://host:port/' failed due to HMR \- Stack Overflow, accessed January 12, 2026, [https://stackoverflow.com/questions/71956576/vitejs-websocket-connection-to-wss-hostport-failed-due-to-hmr](https://stackoverflow.com/questions/71956576/vitejs-websocket-connection-to-wss-hostport-failed-due-to-hmr)
36. Configuring Vite, accessed January 12, 2026, [https://v2.vitejs.dev/config/](https://v2.vitejs.dev/config/)
37. How can I turn off ViteJS's Hot Module Reload? \- Stack Overflow, accessed January 12, 2026, [https://stackoverflow.com/questions/72548801/how-can-i-turn-off-vitejss-hot-module-reload](https://stackoverflow.com/questions/72548801/how-can-i-turn-off-vitejss-hot-module-reload)
38. @analogjs/platform@1.16.1 and @analogjs/vite-plugin-angular@1.16.1 break hot reload of dev server · Issue \#1733 · analogjs/analog \- GitHub, accessed January 12, 2026, [https://github.com/analogjs/analog/issues/1733](https://github.com/analogjs/analog/issues/1733)
39. Wait for Angular zone to be stable · Issue \#8433 · microsoft/playwright \- GitHub, accessed January 12, 2026, [https://github.com/microsoft/playwright/issues/8433](https://github.com/microsoft/playwright/issues/8433)
40. HMR is broken: Vite shows websocket error using react embedded app when using \--use-localhost \- Shopify Developer Community Forums, accessed January 12, 2026, [https://community.shopify.dev/t/hmr-is-broken-vite-shows-websocket-error-using-react-embedded-app-when-using-use-localhost/13455](https://community.shopify.dev/t/hmr-is-broken-vite-shows-websocket-error-using-react-embedded-app-when-using-use-localhost/13455)
41. Angular v20. Ushering In the Era of Reactive… | by Adekola Olawale \- Medium, accessed January 12, 2026, [https://medium.com/@Adekola\_Olawale/angular-v20-ae5b88393011](https://medium.com/@Adekola_Olawale/angular-v20-ae5b88393011)
42. debugging a TimeoutError in Playwright (Angular Material Inputs) | by Kapil kumar \- Medium, accessed January 12, 2026, [https://medium.com/@kapilkumar080/playwright-debugging-a-timeouterror-in-playwright-angular-material-inputs-38fb91963143](https://medium.com/@kapilkumar080/playwright-debugging-a-timeouterror-in-playwright-angular-material-inputs-38fb91963143)
43. Playwright showing strange behaviour: not respecting TimeOut values and GUI run is different from headless \[closed\] \- Stack Overflow, accessed January 12, 2026, [https://stackoverflow.com/questions/79600685/playwright-showing-strange-behaviour-not-respecting-timeout-values-and-gui-run](https://stackoverflow.com/questions/79600685/playwright-showing-strange-behaviour-not-respecting-timeout-values-and-gui-run)
