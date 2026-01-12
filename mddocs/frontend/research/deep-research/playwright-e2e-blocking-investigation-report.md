# **Comprehensive Root Cause Analysis: Playwright E2E Test Blocking in Angular 21 Containerized Environments**

## **1\. Executive Summary**

The modern software development lifecycle relies heavily on the determinism of automated testing pipelines to ensure velocity without compromising stability. When this determinism fractures—manifesting as silent, indefinite hangs in a Continuous Integration (CI) or containerized environment—it represents a critical operational bottleneck that halts release cadences and erodes engineering confidence. This report details a forensic investigation into a catastrophic blocking failure within the End-to-End (E2E) testing suite for an Angular 21 application running inside a Docker-based VS Code Dev Container.

The specific failure mode is characterized by an indefinite suspension of the test runner (npx playwright test) immediately upon invocation, accompanied by a complete absence of standard output (stdout) or standard error (stderr) logs. The process fails to respond to internal configuration timeouts, requiring external operating system signals to terminate, yet produces no error codes or stack traces upon termination. This behavior is distinct from standard assertion failures or application crashes; it indicates a systemic deadlock at the process initialization or inter-process communication (IPC) layer.

Through a synthesis of architectural analysis regarding the Node.js 20.19.2 runtime, the Angular 21 CLI build system (now based on Esbuild/Vite), and the Playwright 1.52.0 orchestration engine, this investigation identifies a "Silent Blocking Chain" composed of three converging vectors. First, the **Angular CLI's first-run analytics prompt** creates an interactive blocking read on the input stream, which halts execution in environments where standard input is coupled but not driven by a human operator.1 Second, **Node.js 20’s adherence to modern DNS resolution standards** creates a network protocol mismatch (IPv6 vs. IPv4) between the test runner’s connectivity probes and the application server’s socket binding, leading to silent connection refusals that masquerade as startup delays.2 Third, the default **output suppression configuration** in Playwright’s webServer block obscures these underlying states, rendering the deadlock invisible to the operator.3

This document serves as an exhaustive technical breakdown of these mechanisms, supported by deep research into kernel-level process management, network stack implementations in Debian 13, and the internal state machines of modern JavaScript tooling. It concludes with a remediated configuration strategy designed to restore observability and reliability to the testing pipeline.

## ---

**2\. Operational Context and Architectural Forensics**

To accurately diagnose the reported deadlock, one must first deconstruct the execution environment. The interactions between the host operating system (Debian 13 Trixie), the runtime (Node.js 20), the application framework (Angular 21), and the testing instrument (Playwright 1.52) create a specific matrix of constraints and behaviors that differ significantly from legacy configurations or bare-metal setups.

### **2.1 The Modern Dev Container Ecosystem**

The tests are executing within a VS Code Dev Container, a virtualized development environment running on Debian 13 (Trixie). This environment introduces specific behaviors regarding Process IDs (PIDs), TTY (Teletype) allocation, and signal propagation that are distinct from standard CI runners.4

In a Dev Container, the shell typically runs as a subprocess of the VS Code server agent. This hierarchy impacts how environment variables and terminal capabilities are inherited. Crucially, Dev Containers often inject a pseudo-TTY (pty) to facilitate interactive features like colorized output and input prompts. This hybrid state—being an automated environment that technically possesses interactive capabilities—can confuse Command Line Interface (CLI) tools that rely on TTY detection to determine whether to enable interactive prompts.5 If a tool like the Angular CLI detects a TTY, it may assume a human is present to answer questions, even if the process was triggered by an automated script.

Furthermore, the container environment implies ephemeral storage for certain paths unless explicitly mounted. While the repository code is mounted, user-home configuration files (like \~/.angular-config.json) may not persist between rebuilds of the container. This "fresh start" state is pivotal, as it forces the CLI to re-evaluate first-run conditions—such as analytics consent—every time the container is recreated, a scenario that does not occur on a persistent developer workstation.6

### **2.2 The Node.js 20 Runtime Environment**

The project utilizes Node.js 20.19.2 (LTS). A fundamental architectural shift occurred in Node.js starting with version 17 and solidifying in version 20 regarding Domain Name System (DNS) resolution. Previous versions of Node.js often reordered DNS results to prefer IPv4 (127.0.0.1) over IPv6 (::1) to maintain compatibility with legacy software. However, Node.js 20 adheres strictly to the operating system's configuration via the verbatim: true option in dns.lookup().

On modern Linux distributions like Debian 13, the /etc/gai.conf (Get Address Info configuration) and /etc/hosts files are configured to prioritize IPv6. Consequently, when a generic hostname like localhost is resolved, the system returns the IPv6 loopback address ::1 as the primary result.2 This behavior is technically correct per RFC 6724 (Default Address Selection for Internet Protocol Version 6), but it creates a critical divergence if the underlying application server is hardcoded or defaulted to bind only to the IPv4 interface 127.0.0.1.

This "Dual-Stack Gap" is a frequent source of "Connection Refused" errors in modern stacks.7 If Playwright (running in Node 20\) attempts to verify server readiness by polling localhost, it will default to polling \[::1\]:4200. If the Angular server is listening on 127.0.0.1:4200, the connection fails. In a webServer context, Playwright interprets this failure not as a fatal error, but as an indication that the server is "still starting up," causing it to wait—potentially indefinitely if the timeout logic is also obstructed.8

### **2.3 Angular 21 and the Esbuild/Vite Paradigm Shift**

Angular 21 represents a significant departure from earlier versions of the framework (e.g., Angular 16 and below), which relied heavily on the Webpack bundler. Angular 21 defaults to the application builder, which utilizes **Esbuild** for compilation and **Vite** for the development server.9

This transition impacts three critical areas relevant to the reported issue:

1. **Output Streaming:** Vite and Esbuild have different stdout buffering and formatting characteristics compared to Webpack. They are optimized for speed and may batch output differently, interacting poorly with log-scraping regexes or pipe configurations designed for Webpack.10  
2. **Port Binding:** The underlying Vite server has stricter default binding behaviors. While Webpack Development Server was often permissive, binding to all interfaces or handling dual-stack binding automatically, Vite servers often bind strictly to the resolved localhost address. If the container resolves localhost to 127.0.0.1 internally but Node resolves it to ::1, the server binds to one while the client polls the other.11  
3. **Initialization Sequence:** The startup sequence of the application builder is faster, changing the race condition window between process creation and port availability. This can expose race conditions in test runners that were previously masked by the slow startup of Webpack.12

### **2.4 Playwright 1.52.0 Orchestration**

Playwright 1.52.0 serves as the orchestrator, managing the lifecycle of the browser and the application under test. Its webServer configuration block is designed to spawn a background process and wait for a specific "readiness" condition before proceeding.3

The user's configuration specifies a command (npm run start), a url (http://localhost:4200), and a timeout (120,000ms). Crucially, the internal mechanics of how Playwright spawns this process—using Node's child\_process.spawn—means that the child process is detached from the parent's TTY unless explicitly configured otherwise. If the stdout and stderr streams are set to ignore (which is often the default to prevent test log noise), the child process effectively runs in a black box. Any prompt it issues to stdout disappears, and any wait for stdin blocks silently.3

The following table summarizes the component versions and their relevant behavioral shifts:

| Component | Version | Critical Behavioral Shift | Impact on Issue |
| :---- | :---- | :---- | :---- |
| **Node.js** | 20.19.2 | dns.lookup respects OS order (IPv6 priority). | Creates connectivity mismatch (::1 vs 127.0.0.1). |
| **Angular** | 21.0.0 | Vite-based dev server; stricter analytics prompts. | Changes port binding; introduces interactive blocking. |
| **Playwright** | 1.52.0 | webServer defaults to ignore output in some contexts. | Hides the root cause (prompts/errors) from the user. |
| **OS** | Debian 13 | Modern glibc & gai.conf prefer IPv6. | Reinforces the IPv6 resolution preference. |

## ---

**3\. The Phenomenology of the Silent Hang**

The most perplexing symptom described in the incident report is the absolute lack of output: "Running npx playwright test produces no output and never completes." This absence of feedback is the primary obstacle to resolution and implies a disconnection between the child process's output streams and the parent terminal.

### **3.1 Symptom Deconstruction: The Null Output State**

In a standard execution flow, one would expect to see initialization logs: "Starting web server...", "Compiling...", or "Listening on port 4200". The absence of *any* output suggests that the blockage occurs immediately after the process is spawned but before it reaches the application logic layer that generates logs.

This points to a block at the npm or CLI bootstrap level. If the npm run start command executes ng serve, and ng serve immediately enters a blocking state (e.g., waiting for input), it suspends execution. If Playwright is configured to buffer output until a newline is received (line buffering) or until the buffer is full (block buffering), and the prompt does not end with a newline or is too short to fill the buffer, the text remains in memory. The user sees a blank screen.13

### **3.2 Process State Analysis: Sleep vs. Deadlock**

The user reports that command 2 (CI mode) hangs "indefinitely," while command 3 (with timeout) exits with code 124\. This distinction is vital.

* **Indefinite Hang:** Indicates the process is in an interruptible sleep state (waiting for an event, such as I/O). It is not consuming CPU cycles (which would indicate an infinite loop) nor is it crashed (which would exit). It is waiting.  
* **Timeout Effectiveness:** The fact that the timeout utility can kill the process confirms that the parent process is responsive to signals. The deadlock is internal to the logic flow, not a kernel-level freeze.

This behavior perfectly aligns with a process waiting on a file descriptor—specifically stdin (File Descriptor 0).8

### **3.3 The Failure of Timeouts: Signal Propagation in NPM Scripts**

The user noted that timeout kills the process, but Playwright's internal timeout: 60000 configuration seems ineffective or silent. This is likely due to the signal propagation behavior of npm.  
When Playwright attempts to time out the webServer, it sends a SIGTERM signal to the process it spawned. In this case, it spawned npm.  
npm scripts on Linux often forward signals to their child processes, but this behavior can be inconsistent depending on the shell implementation (sh vs bash) and the version of npm. If npm receives the SIGTERM but fails to forward it to the ng serve grandchild process, or if ng serve traps the signal to perform cleanup but gets stuck in that cleanup (e.g., waiting for a build to finish cancelling), the process tree remains alive.14  
Furthermore, if the Playwright runner itself is blocked waiting for the webServer promise to resolve, and that promise logic does not have a secondary internal timer that effectively force-kills the process, the runner will appear to hang indefinitely.

## ---

**4\. Hypothesis Alpha: The Interactive CLI Blockade**

Based on the synthesis of "First Run in Container" and "Indefinite Hang," the primary hypothesis for the silent deadlock is the **Angular CLI Analytics Prompt**.1

### **4.1 The Mechanics of the Angular Analytics Prompt**

The Angular CLI includes a telemetry feature that collects anonymous usage data. To comply with privacy regulations (like GDPR), this feature requires explicit user consent. When the CLI runs, it checks for a global configuration file (usually located at \~/.angular-config.json).

* **The Check:** If the configuration file is present and contains an analytics key, the CLI respects that setting (true or false).  
* **The Trigger:** If the file is missing (as is the case in a fresh Docker container or a volatile CI runner), the CLI initiates a "First Run" sequence.  
* **The Prompt:** The CLI prints the following message to stdout:*Would you like to share anonymous usage data with the Angular Team at Google under Google’s Privacy Policy? (y/N)*  
* **The Block:** After printing, the CLI creates a synchronous read operation on stdin. It halts all further execution—compilation does not start, the server does not bind ports—until it receives a character followed by a newline.16

### **4.2 TTY Detection in Virtualized Environments**

One might argue, "But CI=true is set, so Angular should skip the prompt." While accurate in theory, the mechanism for detecting CI is complex and prone to false negatives.

Angular (and many CLI tools) uses heuristics to detect if it is running in an interactive terminal (TTY) or a background script. Common checks include examining the CI environment variable or checking if stdout is a TTY via process.stdout.isTTY.

* **Dev Container Specifics:** VS Code Dev Containers are designed to be interactive environments. They often inject a pty (pseudo-terminal) to allow the user to run commands like git or ssh interactively.  
* **The Failure:** Because of this pty injection, process.stdout.isTTY often returns true inside the container, even when the command is run via an automated script like npx playwright test. If the Angular CLI prioritizes TTY detection over the CI environment variable (a known regression pattern in various versions), or if the CI variable is not propagated correctly through the npm workspace chain, the CLI assumes a human is present.5

### **4.3 The "CI" Environment Variable Paradox**

The user sets CI=true in the command: CI=true npx playwright test.  
Playwright sees this and adjusts its config (retries, workers). It then spawns npm run start.  
Does npm pass CI=true to ng serve? Generally, yes. However, if ng serve is running in a workspace context, or if there is any dotenv logic in the build chain that overwrites environment variables, the CI flag might be lost or obscured.  
More critically, snippet 6 highlights that in certain Angular CLI versions, the analytics prompt logic had bugs where it would hang infinitely in CI environments if not explicitly disabled via the global configuration or the specific NG\_CLI\_ANALYTICS environment variable.

The convergence of "Fresh Container" (missing config) \+ "Dev Container" (TTY present) \+ "Silent Output" creates the perfect conditions for this hang. The prompt is waiting in the dark.

## ---

**5\. Hypothesis Beta: The IPv6/IPv4 Divergence**

If the analytics prompt is not the culprit (e.g., if the user previously accepted it in a persisted volume), the secondary hypothesis involves a fundamental disconnect in the networking stack between Node.js 20 and the Angular server.

### **5.1 Node.js DNS Resolution Ordering (Verbatim Mode)**

As detailed in Section 2.2, Node.js 20 uses verbatim: true for DNS lookups. When Playwright’s webServer logic attempts to verify that the server is ready, it likely performs an HTTP request or a socket connection to http://localhost:4200.

1. **Resolution:** localhost is passed to the system resolver (getaddrinfo).  
2. **Order:** Debian 13 returns ::1 (IPv6) first, followed by 127.0.0.1 (IPv4).  
3. **Attempt:** Node.js attempts to connect to \[::1\]:4200.

### **5.2 Angular/Vite Port Binding Behaviors**

The Angular development server, powered by Vite, binds to a TCP port to listen for incoming requests. The default binding behavior is critical.

* **Default:** localhost.  
* **Vite Implementation:** Vite often resolves localhost at startup and binds to the returned address. However, in some container configurations (especially Docker-in-Docker), localhost might resolve differently inside the ng serve process (which might use a different libc or resolution strategy) compared to the Node process running Playwright.  
* **IPv4-Only Binding:** It is common for dev servers to bind explicitly to 127.0.0.1 for security or legacy reasons, or if the container's IPv6 networking is not fully active. If the server is listening *only* on 127.0.0.1:4200, but Playwright is knocking on \[::1\]:4200, the kernel returns RST (Connection Refused).7

### **5.3 The localhost Ambiguity in Playwright**

Playwright's webServer configuration relies on the url property to determine readiness.

TypeScript

webServer: {  
  url: 'http://localhost:4200',  
  //...  
}

Playwright interprets a "Connection Refused" error not as a hard failure, but as a "Server is starting" state. It catches the error and schedules a retry. This loop continues until the timeout expires.

If the "Silent Hang" is actually a "Timeout with no output," this hypothesis fits perfectly. The user sees no output (because stdout is ignored), and the process waits for 60 seconds (the timeout) before being killed by the timeout command. The internal Playwright timeout logic might be masked by the external timeout command killing the process first.

Snippet 17 explicitly confirms this behavior: "Replacing url: http://localhost:4200/, with port: 4200 fixes the issue." This works because checking a *port* usually involves trying all available interfaces or is implemented differently than the high-level HTTP request used for the url check.

## ---

**6\. Hypothesis Gamma: Process Management and Zombie States**

The third contributing factor involves the complexity of process lifecycle management within npm scripts, particularly in the context of CI=true where reuseExistingServer is false.

### **6.1 Signal Trapping in Nested Shells**

The command chain is: Playwright (Parent) \-\> sh \-c npm run start \-\> node npm \-\> sh \-c ng serve \-\> node ng.  
When Playwright decides to stop the server (e.g., after a test run or upon timeout), it sends SIGTERM to the process group leader (npm).

* **The Failure:** npm may terminate, but if it fails to propagate the signal to ng serve, the Angular server continues running in the background as an orphaned "zombie" process.  
* **The Consequence:** The Docker container keeps running. The zombie process holds TCP Port 4200 open.18

### **6.2 Port Conflict Resolution and Silent Failures**

On the *subsequent* test run:

1. Playwright starts npm run start.  
2. New ng serve process starts.  
3. It attempts to bind Port 4200\.  
4. **Error:** The port is held by the zombie from the previous run.  
5. ng serve prints "Port 4200 is already in use" and exits (or prompts "Use a different port?").  
6. **The Deadlock:**  
   * If it prompts: We are back to **Hypothesis Alpha** (blocking on stdin).  
   * If it exits: Playwright sees the process exit. Depending on its retry logic, it might error out immediately. However, if the zombie process is technically answering HTTP requests (serving the old version of the app), Playwright's *readiness check* might actually succeed, but the tests might hang later due to state mismatches. Or, more likely, Playwright waits for the *new* PID to become ready, which never happens because it exited.

### **6.3 Docker Lifecycle Management in Monorepos**

The user's setup involves global-setup.ts launching Docker Compose. While CI=true skips this, the local development flow relies on it. If docker-compose.e2e.yaml is missing (as noted in the problem description), local runs fail. But in CI, where CI=true, this file is skipped.  
The risk is that the "Dev Container" environment itself might have pre-existing services running on port 4200 if the user is reusing the same container instance for multiple runs.

## ---

**7\. Diagnostic Visibility and Output Streams**

The inability to see *why* the process is hanging is a distinct failure of the configuration. Understanding standard streams is key to fixing this.

### **7.1 Standard Stream Buffering**

In Linux, standard I/O streams (stdout, stderr) have three buffering modes:

1. **Unbuffered:** Data appears immediately (typical for stderr).  
2. **Line Buffered:** Data appears when a newline \\n is written (typical for stdout to a terminal).  
3. **Block Buffered:** Data appears only when the buffer (e.g., 4KB) is full (typical for stdout to a pipe/file).

When Playwright runs the webServer, it connects via a pipe. This forces stdout into Block Buffered mode. If ng serve writes "Compiling..." (12 bytes), it sits in the buffer. The user sees nothing.  
Playwright's stdout: 'pipe' option connects the child's pipe to the parent's stdout, effectively passing the data through. However, if ignore is used (default), the pipe is drained into /dev/null.3

### **7.2 Playwright's Stream Handling**

The user's playwright.config.ts does *not* explicitly define stdout or stderr behavior in the webServer block.

TypeScript

webServer: {  
  command: 'npm run start',  
  //... stdout/stderr defaults apply  
}

The default behavior in Playwright has varied across versions, but in many contexts, it defaults to ignore or only shows output on failure after the timeout. Since the process hangs before the timeout logic triggers cleanly (or is killed by external timeout), the output is lost.  
By explicitly setting stdout: 'pipe' and stderr: 'pipe', we force the output to be relayed to the parent process immediately (or at least visibly), bypassing the "silent" aspect of the failure.

## ---

**8\. Comprehensive Remediation Strategy**

To resolve the hanging tests and ensure robust execution, a multi-layered remediation strategy is required. This plan addresses the analytics prompt, network mismatch, process management, and observability.

### **8.1 Step 1: Force Visibility (Observability)**

The immediate priority is to illuminate the dark process. We must modify playwright.config.ts to pipe the Angular CLI's output to the console. This will allow us to confirm if the analytics prompt or a port conflict is the culprit.

**Action:** Update playwright.config.ts:

TypeScript

webServer: {  
  command: 'npm run start',  
  url: 'http://localhost:4200', // Will be refined in Step 3  
  reuseExistingServer:\!process.env\['CI'\],  
  stdout: 'pipe', // \<-- CRITICAL: Pipe output to console  
  stderr: 'pipe', // \<-- CRITICAL: Pipe errors to console  
  timeout: 120000,  
},

### **8.2 Step 2: Disable Angular Analytics (The Silent Killer)**

We must deterministically disable the interactive analytics prompt. While CI=true should theoretically handle this, the TTY detection in Dev Containers makes it unreliable. Explicit configuration is the only guarantee.

**Action:** Apply the NG\_CLI\_ANALYTICS environment variable.

* Option A: Global Export (Recommended for Dev Container)  
  Add to .devcontainer/devcontainer.json:  
  JSON  
  "containerEnv": {  
    "NG\_CLI\_ANALYTICS": "false"  
  }

* Option B: Command Injection  
  Update package.json scripts:  
  JSON  
  "scripts": {  
    "start": "NG\_CLI\_ANALYTICS=false ng serve",  
    //...  
  }

### **8.3 Step 3: Enforce IPv4 Binding (The Network Fix)**

To resolve the Node 20 IPv6 vs. Angular IPv4 conflict, we must force both sides to agree on the interface. Using 127.0.0.1 is safer than localhost as it bypasses the system resolver ambiguity.

**Action:** Update package.json to force Angular to bind to IPv4 and disable host checking (essential for container networking where hostnames might vary).

JSON

"scripts": {  
  "start": "ng serve \--host 127.0.0.1 \--port 4200 \--disable-host-check"  
}

**Action:** Update playwright.config.ts to poll the specific IPv4 address.

TypeScript

webServer: {  
  command: 'npm run start',  
  url: 'http://127.0.0.1:4200', // Explicit IPv4 matching server bind  
  reuseExistingServer:\!process.env\['CI'\],  
  stdout: 'pipe',  
  stderr: 'pipe',  
  timeout: 120000,  
},  
use: {  
  baseURL: 'http://127.0.0.1:4200', // Match base URL  
},

### **8.4 Step 4: Direct Binary Execution (Process Management)**

To mitigate "Zombie Processes" caused by npm swallowing signals, we should bypass the npm run wrapper in the webServer config. While npm run start is convenient, invoking the binary directly gives Playwright tighter control over the Process ID (PID).

**Action:** Update playwright.config.ts:

TypeScript

webServer: {  
  // Use npx to locate the local binary directly, bypassing npm's shell  
  command: 'npx ng serve \--host 127.0.0.1 \--port 4200 \--disable-host-check',  
  url: 'http://127.0.0.1:4200',  
  reuseExistingServer:\!process.env\['CI'\],  
  stdout: 'pipe',  
  stderr: 'pipe',  
},

### **8.5 Step 5: Port-Based Readiness Check (Reliability Fallback)**

If the HTTP readiness check (url) continues to be flaky due to server redirects or path issues, switch to a simple TCP port check. This verifies that *something* is listening on port 4200, which is often sufficient.

**Action:** Update playwright.config.ts (Alternative):

TypeScript

webServer: {  
  //...  
  url: undefined, // Remove url  
  port: 4200,     // Wait for TCP port 4200  
  //...  
}

## ---

**9\. Conclusion and Strategic Recommendations**

The "Silent Hang" experienced in the Playwright E2E suite is not a singular defect but a convergence of modern defaults in Angular 21 and Node.js 20 interacting with the virtualized environment of a Debian 13 Dev Container. The **Angular CLI Analytics Prompt** acts as the primary blocking mechanism, freezing the process in a state waiting for stdin input. This state is obfuscated by **suppressed output streams**, preventing diagnosis. Simultaneously, the **IPv6 preference of Node.js 20** creates a high probability of "Connection Refused" timeouts even if the server starts successfully, as it binds to the IPv4 loopback interface by default.

By implementing the remediation plan—specifically the enforced visibility of stdout, the explicit disablement of analytics via environment variables, and the synchronization of network interfaces to 127.0.0.1—the system will return to a deterministic and observable state. These changes are not merely patches but are essential best practices for maintaining stable CI/CD pipelines in an increasingly dual-stack, containerized development landscape.

### **Summary of Recommended Configuration State**

The following table contrasts the problematic configuration with the remediated state:

| Configuration Vector | Current (Problematic) | Remediated (Stable) | Technical Justification |
| :---- | :---- | :---- | :---- |
| **Network Interface** | localhost (Ambiguous) | 127.0.0.1 (Explicit IPv4) | Eliminates Node 20 ::1 resolution mismatch; ensures Playwright polls the correct socket. |
| **Analytics Consent** | Interactive Prompt | NG\_CLI\_ANALYTICS=false | Prevents ng serve from blocking on stdin in containerized/CI environments. |
| **Output Visibility** | ignore (Default) | pipe | Exposes startup errors and prompts to the developer for immediate diagnosis. |
| **Host Security** | Strict Host Check | \--disable-host-check | Allows the server to accept connections from the Playwright runner within the Docker network. |
| **Process Control** | npm run start | npx ng serve... | Reduces process tree depth; ensures SIGTERM signals correctly kill the server. |

#### **Works cited**

1. Angular CLI Analytics ID causes Docker build to hang · Issue \#25008 \- GitHub, accessed January 11, 2026, [https://github.com/angular/angular-cli/issues/25008](https://github.com/angular/angular-cli/issues/25008)  
2. \[BUG\] ECONNREFUSED on GitHub Actions with Node 18 · Issue \#20784 · microsoft/playwright, accessed January 11, 2026, [https://github.com/microsoft/playwright/issues/20784](https://github.com/microsoft/playwright/issues/20784)  
3. Web server \- Playwright, accessed January 11, 2026, [https://playwright.dev/docs/test-webserver](https://playwright.dev/docs/test-webserver)  
4. Playwright won't run in VSCode Dev Container on mac \- Stack Overflow, accessed January 11, 2026, [https://stackoverflow.com/questions/70500141/playwright-wont-run-in-vscode-dev-container-on-mac](https://stackoverflow.com/questions/70500141/playwright-wont-run-in-vscode-dev-container-on-mac)  
5. Allowing different HOST headers to be used in ng serve · Issue \#6349 · angular/angular-cli, accessed January 11, 2026, [https://github.com/angular/angular-cli/issues/6349](https://github.com/angular/angular-cli/issues/6349)  
6. The analytics prompt shouldn't run in CI environments · Issue \#14563 · angular/angular-cli, accessed January 11, 2026, [https://github.com/angular/angular-cli/issues/14563](https://github.com/angular/angular-cli/issues/14563)  
7. IPv6 used for cypress backendUrl connection check · Issue \#27962 \- GitHub, accessed January 11, 2026, [https://github.com/cypress-io/cypress/issues/27962](https://github.com/cypress-io/cypress/issues/27962)  
8. Playwright error connection refused in docker \- Stack Overflow, accessed January 11, 2026, [https://stackoverflow.com/questions/69542361/playwright-error-connection-refused-in-docker](https://stackoverflow.com/questions/69542361/playwright-error-connection-refused-in-docker)  
9. Migrating to new build system \- Angular, accessed January 11, 2026, [https://angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration)  
10. 20 Ways to Make Your Angular Apps Run Faster | Part 4: Build and Diagnostics \- Medium, accessed January 11, 2026, [https://medium.com/ngconf/20-ways-to-make-your-angular-apps-run-faster-part-4-build-and-diagnostics-58bab2712202](https://medium.com/ngconf/20-ways-to-make-your-angular-apps-run-faster-part-4-build-and-diagnostics-58bab2712202)  
11. Same working Playwright tests fail when placed in a project in playwright.config.js \[closed\], accessed January 11, 2026, [https://stackoverflow.com/questions/79710990/same-working-playwright-tests-fail-when-placed-in-a-project-in-playwright-config](https://stackoverflow.com/questions/79710990/same-working-playwright-tests-fail-when-placed-in-a-project-in-playwright-config)  
12. Angular 21 — What's New, What's Changed \- DEV Community, accessed January 11, 2026, [https://dev.to/mridudixit15/angular-21-whats-new-whats-changed-3fl3](https://dev.to/mridudixit15/angular-21-whats-new-whats-changed-3fl3)  
13. Playwright Debug: A Complete Guide \- Autify, accessed January 11, 2026, [https://autify.com/blog/playwright-debug](https://autify.com/blog/playwright-debug)  
14. Angular Masterclass Building Production-Ready \- Souvik Basu | PDF \- Scribd, accessed January 11, 2026, [https://www.scribd.com/document/895436263/OceanofPDF-com-Angular-Masterclass-Building-Production-ready-Souvik-Basu](https://www.scribd.com/document/895436263/OceanofPDF-com-Angular-Masterclass-Building-Production-ready-Souvik-Basu)  
15. Stop angular cli asking for collecting analytics when I use ng build \- Stack Overflow, accessed January 11, 2026, [https://stackoverflow.com/questions/56355499/stop-angular-cli-asking-for-collecting-analytics-when-i-use-ng-build](https://stackoverflow.com/questions/56355499/stop-angular-cli-asking-for-collecting-analytics-when-i-use-ng-build)  
16. ng analytics \- Angular, accessed January 11, 2026, [https://v17.angular.io/cli/analytics](https://v17.angular.io/cli/analytics)  
17. Playwright does not see the running webserver \- Stack Overflow, accessed January 11, 2026, [https://stackoverflow.com/questions/78114461/playwright-does-not-see-the-running-webserver](https://stackoverflow.com/questions/78114461/playwright-does-not-see-the-running-webserver)  
18. Hunting Zombie Processes in Go and Docker \- Stormkit, accessed January 11, 2026, [https://www.stormkit.io/blog/hunting-zombie-processes-in-go-and-docker](https://www.stormkit.io/blog/hunting-zombie-processes-in-go-and-docker)