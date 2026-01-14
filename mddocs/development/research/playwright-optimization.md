# **Advanced Architectural Optimization of Python Test Infrastructure: UV, Docker, Playwright, and CI Strategies**

## **1\. High-Performance Execution Environments: The Convergence of Docker, UV, and Python 3.14**

The optimization of test execution environments constitutes the foundational layer of any high-velocity software delivery pipeline. In the context of modern Python development, this landscape is currently undergoing a radical transformation driven by three convergent technologies: the maturation of containerization standards (Docker BuildKit), the emergence of high-performance packaging tools (uv), and the evolutionary leaps in the Python runtime itself (Python 3.14). The effective synthesis of these technologies requires a departure from legacy practices—such as monolithic requirements.txt installs and single-stage builds—toward a highly granular, cache-optimized architectural model.

### **1.1 The uv Revolution in Containerized Builds**

The introduction of uv, an extremely fast Python package installer and resolver written in Rust, addresses the primary bottleneck in Python container builds: dependency resolution latency. Traditional workflows utilizing pip or poetry often suffer from extended I/O blocking during package installation and creating large, non-deterministic build artifacts. uv mitigates these issues through aggressive parallelization and a content-addressable global cache, but its integration into Docker requires a specific set of patterns to realize these benefits.1

#### **1.1.1 Mechanics of Dependency Resolution and Layer Caching**

In a containerized environment, the efficiency of the build process is strictly governed by the Docker layer caching mechanism. This mechanism invalidates all subsequent layers once a change is detected in a preceding layer. The user's primary concern regarding "test execution speed" necessitates a build architecture that maximizes cache hit rates for the most resource-intensive operations—specifically, the installation of third-party dependencies.

The optimal strategy leverages uv's ability to separate the resolution phase (locking) from the installation phase (syncing). By copying the dependency definition files (pyproject.toml and uv.lock) into the container in isolation from the application source code, the build system can create a cached layer containing the virtual environment. This layer remains valid as long as the dependencies remain unchanged, regardless of frequent modifications to the application logic.2

The distinction between uv sync and uv pip install is critical here. While uv pip install mimics the imperative behavior of legacy tools, uv sync provides a declarative synchronization of the environment with the lockfile. For reproducible test environments, uv sync is the superior command, particularly when combined with the \--frozen flag. This flag asserts that the uv.lock file must correspond exactly to the pyproject.toml, failing the build if a discrepancy exists—a crucial safeguard for CI consistency.3

#### **1.1.2 Advanced BuildKit Cache Mounting**

A naive implementation of uv in Docker might still incur unnecessary network overhead if the layer cache is invalidated. To address this, the architecture must utilize Docker BuildKit's cache mounting capabilities. The instruction RUN \--mount=type=cache,target=/root/.cache/uv exposes a persistent cache volume to the build container. This volume survives across different build invocations on the same host, allowing uv to rehydrate the package installation from local artifacts rather than re-downloading them from PyPI, even when the intermediate Docker layer is invalidated.2

This optimization is particularly potent in CI environments that support sticky runners or cache persistence, as it transforms the $O(n)$ complexity of dependency installation (where $n$ is the number of packages) into an operation bounded primarily by disk I/O speed.

#### **1.1.3 The Multi-Stage Build Architecture**

To satisfy the dual requirements of build speed and minimal image size, a multi-stage build strategy is indispensable. This approach decouples the build environment—which requires compilers, headers, and the uv binary itself—from the runtime environment, which should contain only the compiled bytecode and necessary shared libraries.1

Stage 1: The Builder
The builder stage handles the heavy lifting. It should inherit from a uv-optimized base image, such as ghcr.io/astral-sh/uv:python3.14-bookworm-slim. This image comes pre-loaded with the uv binary, eliminating the bootstrapping step.6 Within this stage, the configuration ENV UV\_LINK\_MODE=copy is essential. By default, uv attempts to use hardlinks to save disk space. However, in the context of Docker's overlay filesystem, hardlinks can behave unpredictably across layers or fail to register as distinct file operations during the COPY phase. Forcing a copy ensures that the virtual environment creates standalone files that can be cleanly transferred to the final stage.7
Stage 2: The Runtime
The final stage should utilize a pristine Python base image, such as python:3.14-slim-bookworm. The COPY \--from=builder /app/.venv /app/.venv instruction transfers the fully hydrated virtual environment. Crucially, the environment variable PATH="/app/.venv/bin:$PATH" must be set to prioritize the virtual environment's binaries, ensuring that calls to python or pytest utilize the isolated environment without requiring explicit activation commands.3

### **1.2 The Python 3.14 Runtime Landscape**

The adoption of Python 3.14 introduces specific constraints and opportunities regarding image availability and concurrency models. As of early 2026, Python 3.14 represents the bleeding edge of the language, necessitating a nuanced approach to base image selection.

#### **1.2.1 Image Availability and Base OS Selection**

While the official python DockerHub repository typically provides rc (release candidate) or alpha tags for upcoming versions (e.g., 3.14.0a3-slim), availability can be sporadic during the early development cycle. The python-devs/ci-images registry serves as a reliable fallback, offering daily builds of the main branch and active development versions.9

A critical decision point is the choice between Alpine Linux and Debian-based (Bookworm/Slim) images. While Alpine images (python:3.14-alpine) are historically smaller, their reliance on musl-libc instead of glibc introduces significant compatibility friction for Python wheels, which are predominantly compiled for manylinux (glibc). This often forces the build process to compile dependencies from source, negating the speed benefits of uv and extending build times significantly. Consequently, python:3.14-slim-bookworm is the optimal choice for test execution speed, balancing binary compatibility with a reduced footprint.10

#### **1.2.2 Bytecode Compilation Optimization**

Python's startup time—a key component of test execution latency—is influenced by the presence of compiled bytecode (.pyc files). In a typical local development cycle, these are generated lazily. However, in an ephemeral container environment, lazy compilation incurs a penalty on every container start. The uv build process should therefore explicitly trigger compilation. This can be achieved via the \--compile-bytecode flag during the sync operation or by setting ENV UV\_COMPILE\_BYTECODE=1 globally in the Dockerfile. This step trades a marginal increase in build time for a measurable decrease in test suite initialization time.1

### **1.3 Architectural Reference: The Optimized Dockerfile**

The following architectural reference integrates these concepts into a cohesive definition for a high-performance, Python 3.14-ready testing container.

Dockerfile

\# syntax=docker/dockerfile:1
\# \--------------------------------------------------------------------------------
\# Stage 1: Builder \- Dependency Resolution and Installation
\# \--------------------------------------------------------------------------------
FROM ghcr.io/astral-sh/uv:python3.14\-bookworm-slim AS builder

\# Architectural Configuration:
\# 1\. UV\_LINK\_MODE=copy: Prevents hardlink issues in overlayfs.
\# 2\. UV\_COMPILE\_BYTECODE=1: Optimizes startup time by pre-compiling.pyc files.
\# 3\. PYTHONUNBUFFERED=1: Ensures real-time logging output.
ENV UV\_LINK\_MODE=copy \\
    UV\_COMPILE\_BYTECODE=1 \\
    PYTHONUNBUFFERED=1

WORKDIR /app

\# Optimization: Copy dependency definitions first to maximize cache hit rate.
\# Docker BuildKit will skip the subsequent RUN instruction if these files match the cache.
COPY pyproject.toml uv.lock./

\# Optimization: Cache Mount
\# The \--mount=type=cache instruction persists the uv global cache between builds.
\# We use \--no-install-project to strictly limit this layer to 3rd-party dependencies.
RUN \--mount=type\=cache,target=/root/.cache/uv \\
    uv sync \--frozen \--no-install-project \--no-dev

\# Optimization: Project Installation
\# We copy the source code in a separate layer. This ensures that changes to application
\# logic do not invalidate the heavy dependency installation layer above.
COPY..

\# Install the project itself (if it's a package) and any dev dependencies needed for tests.
RUN \--mount=type\=cache,target=/root/.cache/uv \\
    uv sync \--frozen \--no-dev

\# \--------------------------------------------------------------------------------
\# Stage 2: Runtime \- Minimal Execution Environment
\# \--------------------------------------------------------------------------------
FROM python:3.14\-slim-bookworm AS runtime

\# Security: Run as a non-root user.
\# While typical in prod, for testing, root is often required for Playwright system deps
\# unless specifically configured. We assume a root context for CI simplicity or a configured
\# 'pwuser' for advanced setups.
ENV PATH="/app/.venv/bin:$PATH" \\
    PYTHONPATH="/app"

WORKDIR /app

\# Transfer the pre-built virtual environment from the builder stage.
COPY \--from=builder /app/.venv /app/.venv
COPY \--from=builder /app /app

\# Default entrypoint for the test runner
CMD \["pytest"\]

## **2\. CI Execution Speed: GitHub Actions Best Practices**

While Docker optimizations reduce the cost of environment provisioning, the total velocity of the Continuous Integration (CI) pipeline is dictated by how effectively the workload is distributed and how efficiently artifacts are reused. The "CI execution speed" requirement demands a shift from linear execution models to highly parallelized, sharded architectures, particularly for resource-intensive workloads like Playwright E2E tests.

### **2.1 Horizontal Scaling: The Sharding Strategy**

For browser automation suites, vertical scaling (adding more CPU cores to a single runner) yields diminishing returns due to the high memory overhead of browser processes. A single standard GitHub Actions runner (typically 2 vCPU, 7GB RAM) reaches saturation with 2-3 concurrent headless browser instances, leading to flaky timeouts and context-switching overhead.13 The superior strategy is horizontal scaling, or **Sharding**, where the test suite is partitioned across multiple isolated runners.

#### **2.1.1 Dynamic Matrix Generation**

Hardcoding shard configurations (e.g., creating 4 explicit jobs in the YAML file) creates a maintenance burden and inefficient resource utilization. An optimal architecture utilizes a **Dynamic Matrix**, where a preliminary job calculates the necessary number of shards based on the current volume of tests or historical execution timing.14

This process involves three distinct pipeline phases:

1. **Orchestration Job:** This lightweight job checks out the code and runs a script to inventory the tests. It applies a heuristic (e.g., "target 5 minutes per shard") to determine the optimal shard count ($N$). It outputs a JSON array (e.g., \[1, 2, 3,... N\]) to the pipeline context.
2. **Execution Matrix:** The main test job is configured with strategy: matrix: shard: ${{ fromJson(needs.setup.outputs.shards) }}. GitHub Actions automatically spawns $N$ parallel jobs. Each job executes a slice of the suite using Playwright's native sharding flag: \--shard=${{ matrix.shard }}/${{ needs.setup.outputs.total\_shards }}.15
3. **Aggregation Job:** A final job collects the test reports (blob reports) from all shards, merges them into a cohesive HTML report, and publishes the result. This ensures that the developer receives a unified view of the system health despite the distributed execution.14

**Table 1: Sharding Strategy Comparison**

| Metric | Static Sharding | Dynamic Sharding |
| :---- | :---- | :---- |
| **Scalability** | Low (Requires YAML edits) | High (Auto-adjusts to test volume) |
| **Resource Usage** | Inefficient (Fixed allocation) | Optimized (Allocation matches load) |
| **Complexity** | Low | Medium (Requires orchestrator script) |
| **Failure Isolation** | Moderate | High (Granular failure visibility) |

### **2.2 Advanced Caching Architectures in GitHub Actions**

The most significant latency vector in a clean CI run is the network transfer time required to fetch Python packages and Playwright browser binaries.

#### **2.2.1 The uv Cache Configuration**

The astral-sh/setup-uv action provides a specialized caching mechanism that is aware of uv's internal structure. Configuring enable-cache: true allows the action to persist the uv cache directory across runs. The cache key is automatically derived from uv.lock. This reduces the dependency installation step from a network-bound operation (\~45-60s) to a local I/O operation (\~2-5s).16

Crucially, the workflow must handle the distinction between "dev" and "prod" dependencies. In CI, the installation command uv sync \--frozen ensures that the environment exactly matches the lockfile. The snippet 16 highlights a potential pitfall where \--no-dev might not behave as expected in all contexts; however, for testing pipelines, dev dependencies (like pytest and playwright) are explicitly required, so the standard sync command is appropriate.

#### **2.2.2 The Playwright Browser Cache**

Playwright browser binaries (Chromium, Firefox, WebKit) are massive artifacts, often exceeding 500MB combined. Downloading these on every CI run is a major performance anti-pattern. Caching these binaries requires a precise keying strategy to avoid "cache thrashing" (restoring a cache that is incompatible with the current Playwright version).

The cache key must combine the Operating System and the hash of the lockfile: ${{ runner.os }}-playwright-${{ hashFiles('uv.lock') }}. This is because the browser binary version is strictly coupled to the playwright package version defined in uv.lock. If the lockfile changes (e.g., upgrading Playwright from 1.48 to 1.49), the cache key changes, forcing a fresh download of the new browser binaries.17

However, simply restoring the binary is insufficient. Playwright browsers require system-level dependencies (libraries for GStreamer, codecs, etc.) that are not present on a minimal Ubuntu runner. The command playwright install-deps handles this via apt-get, but this is slow. A superior optimization is to execute the CI job *inside* a container that already has these dependencies pre-installed. The official mcr.microsoft.com/playwright image is recommended for this purpose, as it decouples the system dependency management from the CI workflow execution time.19

### **2.3 Workflow Optimization: Service Containers vs. Docker Compose**

For integration tests requiring services like Postgres or Redis, GitHub Actions offers two patterns: "Service Containers" defined in the YAML, or a manual docker-compose up step.

The **Service Container** approach is generally faster and more reliable for CI. The service lifecycle is managed by the GitHub Actions runner, which pulls and starts the images asynchronously while the setup steps (checkout, python install) are running. This parallelism hides the container startup latency. In contrast, a docker-compose up step in the workflow is blocking; the pipeline waits for the containers to stabilize before proceeding.

**Optimal Service Configuration:**

YAML

services:
  postgres:
    image: postgres:15-alpine
    env:
      POSTGRES\_PASSWORD: ci\_password
      POSTGRES\_DB: test\_db
    ports:
      \- 5432:5432
    \# Health checks are critical to avoid race conditions
    options: \>-
      \--health-cmd pg\_isready
      \--health-interval 10s
      \--health-timeout 5s
      \--health-retries 5

This configuration ensures that the database is fully ready to accept connections before the test step begins, eliminating "connection refused" flakes that often plague CI pipelines.19

## **3\. Dev Container Optimization for Playwright**

Standardizing the developer experience (DX) is as critical as optimizing CI. The Dev Container specification allows teams to codify the development environment, ensuring that "works on my machine" translates to "works in production." However, running graphical browser automation inside a containerized environment presents unique challenges regarding resource allocation, user permissions, and visualization.

### **3.1 The Micro-Service Dev Container Architecture**

A common architectural anti-pattern is the creation of a "Monolithic" Dev Container—a single Dockerfile that installs Python, Postgres, Redis, and the application. This results in bloated images that are slow to build and difficult to maintain. The optimal approach leverages the **Sidecar Pattern**, utilizing Docker Compose to orchestrate a cluster of lightweight, specialized containers.22

#### **3.1.1 Configuration via devcontainer.json**

The devcontainer.json file serves as the control plane. Instead of referencing a single image, it should reference a docker-compose.yml file.

**Key Configuration Elements:**

* dockerComposeFile: Points to the composition file defining the Python service and its dependencies (DB, Cache).
* service: Specifies which service in the compose file represents the developer's workspace (e.g., app). VS Code will attach to this container.
* workspaceFolder: Maps the local source code into the container.
* shutdownAction: "stopCompose" ensures that all sidecar services are gracefully terminated when the developer closes VS Code, preventing resource leaks.24

Example Network Topology:
The Python container (Workspace) communicates with the Postgres container (Sidecar) via the Docker network using the service name as the hostname (postgres:5432). This mirrors the production environment's network topology more closely than using localhost.26

### **3.2 Optimizing Playwright in the Dev Container**

Running Playwright inside the Dev Container requires addressing two primary friction points: the "Headless" limitation and the Linux permission model.

#### **3.2.1 Root vs. Non-Root Execution**

By default, many Docker images run as root. However, Chromium's sandbox mechanism is incompatible with the root user unless the \--no-sandbox flag is used, which creates a security variance compared to production browsers. The mcr.microsoft.com/devcontainers/python images use a non-root user (vscode) by default.

To run Playwright reliably as a non-root user:

1. **System Dependencies:** The container must have the necessary shared libraries installed. Using the ghcr.io/devcontainers/features/desktop-lite or specifically installing Playwright dependencies during the image build is required.
2. **Seccomp Profiles:** If strict sandboxing is required (mimicking high-security environments), the container must be launched with a custom seccomp profile (seccomp\_profile.json) that enables user\_namespace cloning capabilities (clone, setns, unshare).27
3. **IPC Configuration:** The default Docker IPC (Inter-Process Communication) allocation (64MB) is insufficient for modern browsers, leading to crashes (SIGKILL) during complex rendering operations. The docker-compose.yml must set ipc: host or explicitly increase shm\_size to at least 2GB.27

#### **3.2.2 The Browser Mount Strategy**

To prevent the developer from re-downloading 500MB of browser binaries every time the Dev Container is rebuilt, the browser cache should be mounted from the host machine into the container.

**Configuration:**

JSON

"mounts": \[
  "source=${localEnv:HOME}/.cache/ms-playwright,target=/home/vscode/.cache/ms-playwright,type=bind"
\]

This binds the host's Playwright cache to the container's cache directory. The environment variable PLAYWRIGHT\_BROWSERS\_PATH must be set within the container to point to this target. This ensures that a browser downloaded once on the host is available instantly inside any Dev Container project.28

### **3.3 Visual Debugging: The CDP Connection Pattern**

A significant limitation of containerized testing is the inability to "watch" the browser. While X11 forwarding is possible, it is brittle. A superior pattern is the **Remote CDP Connection**.

In this architecture, the developer launches a browser instance on their *host* machine (e.g., Chrome) with the debugging port open: chrome.exe \--remote-debugging-port=9222. Inside the Dev Container, the Playwright configuration is adjusted to connect to this remote instance rather than launching a local binary.

**Code Implementation:**

Python

\# conftest.py
import pytest
import os

@pytest.fixture
def browser(playwright):
    cdp\_url \= os.getenv("PLAYWRIGHT\_CDP\_URL") \# e.g., "http://host.docker.internal:9222"
    if cdp\_url:
        \# Connect to the visible browser on the host
        browser \= playwright.chromium.connect\_over\_cdp(cdp\_url)
    else:
        \# Standard headless launch for CI
        browser \= playwright.chromium.launch()
    yield browser
    browser.close()

This setup provides the best of both worlds: the code executes in the standardized container environment, but the visual feedback occurs natively on the developer's monitor.27

## **4\. Test Independence Strategies: Isolation vs. Performance**

The requirement for "Test independence" introduces a fundamental trade-off between **Isolation** (guaranteeing that Test A cannot affect Test B) and **Performance** (the time cost of enforcing that isolation). In the context of database-backed applications, this trade-off manifests in three primary strategies: dedicated containers, transaction rollbacks, and truncation/reseeding.

### **4.1 The Testcontainers Strategy (High Isolation, High Latency)**

The Testcontainers library allows the test runner to programmatically spin up disposable containers for every test context.

* **Mechanism:** For each test (or test class), the library contacts the Docker daemon, spins up a fresh postgres:15 container, waits for the port mapping, and runs the test.
* **Analysis:** This offers perfect isolation. Port conflicts are impossible because ports are randomized. However, the overhead is significant. Starting a Postgres container takes 2-5 seconds. For a suite of 500 tests, a per-function strategy adds \~25 minutes of idle wait time. This approach is viable *only* for a small set of critical integration tests where data corruption is a high risk.31
* **Optimization:** The "Singleton Pattern" involves creating a session-scoped fixture that starts the container once. All tests share this single instance. This shifts the bottleneck from container startup to data cleanup (see Section 4.3).34

### **4.2 The Transaction Rollback Strategy (Low Latency, Limited Scope)**

For integration tests where the test code and the application code share the same memory space (or database engine), the transaction rollback pattern is the gold standard for speed.

* **Mechanism:** The test setup opens a SQL transaction. The application performs operations within this transaction. At the test teardown, the transaction is ROLLBACK-ed rather than COMMIT-ed. The data never permanently touches the disk.
* **Async Complexity:** In async Python (FastAPI/SQLAlchemy), this requires careful orchestration. The test must create an external transaction and force the application to join it. Snippets suggest using run\_sync or nested transactions (SAVEPOINT) to achieve this. The pytest-asyncio plugin and custom event listeners on the SQLAlchemy session are often required to prevent the application from auto-committing.36
* **E2E Incompatibility:** This strategy fundamentally fails for Playwright E2E tests. In an E2E scenario, the Test Runner (Python process) and the Application Server (Uvicorn process) are distinct. They hold separate connections to the database. The Application Server *must* commit its transaction for the data to be visible to subsequent requests. The Test Runner cannot initiate a rollback on a connection it does not own. Therefore, transaction rollbacks are unsuitable for black-box E2E testing.39

### **4.3 The Hybrid Truncation Strategy (The E2E Standard)**

For high-speed E2E execution, the optimal strategy combines the Singleton Container pattern with a Truncation cleanup strategy.

* **Mechanism:**
  1. **Session Scope:** A single DB container is started (via Testcontainers or docker-compose) for the entire test session.
  2. **Function Scope:** A fixture runs *before* (or after) each test to execute TRUNCATE TABLE tablename CASCADE.
  3. **Performance:** TRUNCATE is an aggressive DDL operation that is significantly faster than DELETE FROM (which generates row-level transaction logs) and faster than DROP/CREATE TABLE (which involves heavy catalog updates).34

**Table 2: Comparison of Isolation Strategies**

| Strategy | Speed | Isolation Quality | E2E Compatible? | Best Use Case |
| :---- | :---- | :---- | :---- | :---- |
| **Per-Test Container** | Slowest | Perfect | Yes | Debugging flaky tests |
| **Transaction Rollback** | Fastest | High | **No** | Unit/Integration API tests |
| **Truncate (Singleton)** | Fast | Medium | Yes | Standard E2E suites |
| **Logical (Tenant) Isolation** | Instant | Application-Dependent | Yes | **Parallel/Sharded E2E** |

### **4.4 Advanced Parallelism: Logical Isolation (Multi-Tenancy)**

When running tests in parallel (sharding), a single DB container becomes a contention point. If Test A truncates the table while Test B is reading from it, failures occur.

The most advanced strategy for parallel E2E is **Logical Isolation**. Instead of cleaning the database, the test makes the data unique.

* **Tenant Partitioning:** Each test generates a unique TenantID (e.g., a UUID). All users and data created by the test are associated with this ID.
* **No Cleanup:** Because Test A's data is isolated by TenantID from Test B's data, they can run simultaneously on the same DB without interference. Cleanup is deferred to a bulk operation at the end of the session, or the container is simply destroyed. This allows for massive parallelism without the locking overhead of truncation.43

## **5\. Synthesis: The Optimal Architecture**

Based on the deep research and analysis, the optimal execution path for the user's Python 3.14/Playwright stack is a composite architecture:

1. **Build Layer:** Use uv in a multi-stage Docker build, leveraging ghcr.io/astral-sh/uv:python3.14-bookworm-slim. Employ pyproject.toml caching and \--compile-bytecode to minimize startup latency.
2. **CI Layer:** Implement dynamic sharding in GitHub Actions. Cache the uv environment and Playwright binaries (keyed by uv.lock). Use Service Containers for databases to parallelize startup.
3. **DX Layer:** Configure devcontainer.json with the Sidecar Pattern (Postgres/Redis via Compose). Mount the host's browser cache. Use CDP for visual debugging.
4. **Test Layer:** Employ a hybrid isolation strategy. Use Transaction Rollbacks for internal API integration tests. Use Singleton Containers with Logical (Tenant) Isolation for parallel Playwright E2E tests to maximize throughput without sacrificing stability.

This architecture addresses the user's concerns by attacking latency at every level: the build (caching), the pipeline (sharding), the developer workflow (hybrid rendering), and the database (logical isolation).

#### **Works cited**

1. Production-ready Python Docker Containers with uv \- Hynek Schlawack, accessed January 14, 2026, [https://hynek.me/articles/docker-uv/](https://hynek.me/articles/docker-uv/)
2. Optimal Dockerfile for Python with uv | Container Builds | Depot Documentation, accessed January 14, 2026, [https://depot.dev/docs/container-builds/optimal-dockerfiles/python-uv-dockerfile](https://depot.dev/docs/container-builds/optimal-dockerfiles/python-uv-dockerfile)
3. Python package management with uv for dockerized environments | by Raman Shaliamekh, accessed January 14, 2026, [https://medium.com/@shaliamekh/python-package-management-with-uv-for-dockerized-environments-f3d727795044](https://medium.com/@shaliamekh/python-package-management-with-uv-for-dockerized-environments-f3d727795044)
4. Faster Python Docker Builds \- REVSYS, accessed January 14, 2026, [https://www.revsys.com/tidbits/faster-python-docker-builds/](https://www.revsys.com/tidbits/faster-python-docker-builds/)
5. Multi-stage builds \- Docker Docs, accessed January 14, 2026, [https://docs.docker.com/build/building/multi-stage/](https://docs.docker.com/build/building/multi-stage/)
6. Why does running a Dockerized Python app with uv run trigger a build while it doesn't on my local machine? \- Stack Overflow, accessed January 14, 2026, [https://stackoverflow.com/questions/79369392/why-does-running-a-dockerized-python-app-with-uv-run-trigger-a-build-while-it-do](https://stackoverflow.com/questions/79369392/why-does-running-a-dockerized-python-app-with-uv-run-trigger-a-build-while-it-do)
7. Using uv in Docker \- Astral Docs, accessed January 14, 2026, [https://docs.astral.sh/uv/guides/integration/docker/](https://docs.astral.sh/uv/guides/integration/docker/)
8. astral-sh/uv-docker-example \- GitHub, accessed January 14, 2026, [https://github.com/astral-sh/uv-docker-example](https://github.com/astral-sh/uv-docker-example)
9. CI images \- python-devs \- GitLab, accessed January 14, 2026, [https://gitlab.com/python-devs/ci-images/-/tree/main](https://gitlab.com/python-devs/ci-images/-/tree/main)
10. The best Docker base image for your Python application (May 2024), accessed January 14, 2026, [https://pythonspeed.com/articles/base-image-python-docker-images/](https://pythonspeed.com/articles/base-image-python-docker-images/)
11. Alpine, Slim, Bullseye, Bookworm, Noble — Different Docker Images Explained \- Medium, accessed January 14, 2026, [https://medium.com/@faruk13/alpine-slim-bullseye-bookworm-jammy-noble-differences-in-docker-images-explained-d9aa6efa23ec](https://medium.com/@faruk13/alpine-slim-bullseye-bookworm-jammy-noble-differences-in-docker-images-explained-d9aa6efa23ec)
12. How I Reduced Docker Image Size from 588 MB to Only 47.7 MB \- A whomping 91.89 \- Reddit, accessed January 14, 2026, [https://www.reddit.com/r/docker/comments/1f1wqnb/how\_i\_reduced\_docker\_image\_size\_from\_588\_mb\_to/](https://www.reddit.com/r/docker/comments/1f1wqnb/how_i_reduced_docker_image_size_from_588_mb_to/)
13. Ideas to speed up Playwright End-to-End tests? (Typescript, GitHub Actions) \- Reddit, accessed January 14, 2026, [https://www.reddit.com/r/QualityAssurance/comments/1cnnx1c/ideas\_to\_speed\_up\_playwright\_endtoend\_tests/](https://www.reddit.com/r/QualityAssurance/comments/1cnnx1c/ideas_to_speed_up_playwright_endtoend_tests/)
14. Speeding Up Playwright Tests with Dynamic Sharding in GitHub Actions | by Lewis Nelson, accessed January 14, 2026, [https://lewis-38728.medium.com/speeding-up-playwright-tests-with-dynamic-sharding-in-github-actions-91906aa9ed8f](https://lewis-38728.medium.com/speeding-up-playwright-tests-with-dynamic-sharding-in-github-actions-91906aa9ed8f)
15. Sharding | Playwright, accessed January 14, 2026, [https://playwright.dev/docs/test-sharding](https://playwright.dev/docs/test-sharding)
16. Even with \`uv sync \--no-dev\`, development dependencies are still installed when workflow executes. · Issue \#12558 · astral-sh/uv \- GitHub, accessed January 14, 2026, [https://github.com/astral-sh/uv/issues/12558](https://github.com/astral-sh/uv/issues/12558)
17. Continuous Integration \- Playwright, accessed January 14, 2026, [https://playwright.dev/docs/ci](https://playwright.dev/docs/ci)
18. Make Playwright faster: experimenting with containers and build caching on Github actions, accessed January 14, 2026, [https://blog.karmacomputing.co.uk/make-playwright-faster-with-containers-and-build-caching-github-actions/](https://blog.karmacomputing.co.uk/make-playwright-faster-with-containers-and-build-caching-github-actions/)
19. Integrating Playwright in CI with GitHub Actions and Docker | by thanan \- DevOps.dev, accessed January 14, 2026, [https://blog.devops.dev/integrating-playwright-in-ci-with-github-actions-and-docker-7baafe76de99](https://blog.devops.dev/integrating-playwright-in-ci-with-github-actions-and-docker-7baafe76de99)
20. Playwright-Python-Example/.github/workflows/nightly.yml at main · nirtal85/Playwright-Python-Example · GitHub, accessed January 14, 2026, [https://github.com/nirtal85/Playwright-Python-Example/blob/main/.github/workflows/nightly.yml](https://github.com/nirtal85/Playwright-Python-Example/blob/main/.github/workflows/nightly.yml)
21. Continuous Integration | Playwright Python, accessed January 14, 2026, [https://playwright.dev/python/docs/ci](https://playwright.dev/python/docs/ci)
22. Connect to multiple containers \- Visual Studio Code, accessed January 14, 2026, [https://code.visualstudio.com/remote/advancedcontainers/connect-multiple-containers](https://code.visualstudio.com/remote/advancedcontainers/connect-multiple-containers)
23. November 2024 \- pamela fox's blog, accessed January 14, 2026, [http://blog.pamelafox.org/2024/11/](http://blog.pamelafox.org/2024/11/)
24. azure-flask-postgres-flexible-appservice/.devcontainer/devcontainer.json at main · Azure-Samples/azure-flask-postgres-flexible-appservice · GitHub, accessed January 14, 2026, [https://github.com/Azure-Samples/azure-flask-postgres-flexible-appservice/blob/main/.devcontainer/devcontainer.json](https://github.com/Azure-Samples/azure-flask-postgres-flexible-appservice/blob/main/.devcontainer/devcontainer.json)
25. azure-django-postgres-flexible-aca/.devcontainer/devcontainer.json at main · Azure-Samples/azure-django-postgres-flexible-aca · GitHub, accessed January 14, 2026, [https://github.com/Azure-Samples/azure-django-postgres-flexible-aca/blob/main/.devcontainer/devcontainer.json](https://github.com/Azure-Samples/azure-django-postgres-flexible-aca/blob/main/.devcontainer/devcontainer.json)
26. A multi dev container setup to support OAuth 2.0 authentication | by Bas Berkhout | Medium, accessed January 14, 2026, [https://basberk.medium.com/a-multi-dev-container-setup-to-support-oauth-2-0-authentication-ca54b80cfbe7?source=rss------docker-5](https://basberk.medium.com/a-multi-dev-container-setup-to-support-oauth-2-0-authentication-ca54b80cfbe7?source=rss------docker-5)
27. Docker \- Playwright, accessed January 14, 2026, [https://playwright.dev/docs/docker](https://playwright.dev/docs/docker)
28. How to install Playwright and Artillery in the official JavaScript DevContainer (bookworm-24)? \- Stack Overflow, accessed January 14, 2026, [https://stackoverflow.com/questions/79855678/how-to-install-playwright-and-artillery-in-the-official-javascript-devcontainer](https://stackoverflow.com/questions/79855678/how-to-install-playwright-and-artillery-in-the-official-javascript-devcontainer)
29. Playwright: Executing Tests on Remote Browser and Browser in Servers | by thanan | Medium, accessed January 14, 2026, [https://medium.com/@thananjayan1988/playwright-executing-tests-on-remote-browser-and-browser-in-servers-48c9979b5b4f](https://medium.com/@thananjayan1988/playwright-executing-tests-on-remote-browser-and-browser-in-servers-48c9979b5b4f)
30. Is there a way to connect to my existing browser session using playwright \- Stack Overflow, accessed January 14, 2026, [https://stackoverflow.com/questions/71362982/is-there-a-way-to-connect-to-my-existing-browser-session-using-playwright](https://stackoverflow.com/questions/71362982/is-there-a-way-to-connect-to-my-existing-browser-session-using-playwright)
31. Testcontainers performance : r/csharp \- Reddit, accessed January 14, 2026, [https://www.reddit.com/r/csharp/comments/1j4v3y3/testcontainers\_performance/](https://www.reddit.com/r/csharp/comments/1j4v3y3/testcontainers_performance/)
32. Testcontainers performance slower than plain docker \- Stack Overflow, accessed January 14, 2026, [https://stackoverflow.com/questions/75490201/testcontainers-performance-slower-than-plain-docker](https://stackoverflow.com/questions/75490201/testcontainers-performance-slower-than-plain-docker)
33. Getting started with Testcontainers for Python, accessed January 14, 2026, [https://testcontainers.com/guides/getting-started-with-testcontainers-for-python/](https://testcontainers.com/guides/getting-started-with-testcontainers-for-python/)
34. How to Write Integration Tests for Python APIs with Testcontainers \- OneUptime, accessed January 14, 2026, [https://oneuptime.com/blog/post/2025-01-06-python-testcontainers-integration/view](https://oneuptime.com/blog/post/2025-01-06-python-testcontainers-integration/view)
35. reuse/singleton containers · Issue \#53 · testcontainers/testcontainers-python \- GitHub, accessed January 14, 2026, [https://github.com/testcontainers/testcontainers-python/issues/53](https://github.com/testcontainers/testcontainers-python/issues/53)
36. Rollback when using pytest · fastapi sqlmodel · Discussion \#940 \- GitHub, accessed January 14, 2026, [https://github.com/fastapi/sqlmodel/discussions/940](https://github.com/fastapi/sqlmodel/discussions/940)
37. External transaction with asyncio · sqlalchemy sqlalchemy · Discussion \#10857 \- GitHub, accessed January 14, 2026, [https://github.com/sqlalchemy/sqlalchemy/discussions/10857](https://github.com/sqlalchemy/sqlalchemy/discussions/10857)
38. Testing FastAPI with async database session \- DEV Community, accessed January 14, 2026, [https://dev.to/whchi/testing-fastapi-with-async-database-session-1b5d](https://dev.to/whchi/testing-fastapi-with-async-database-session-1b5d)
39. Database Rollback Strategies in Playwright \- The Green Report, accessed January 14, 2026, [https://www.thegreenreport.blog/articles/database-rollback-strategies-in-playwright/database-rollback-strategies-in-playwright.html](https://www.thegreenreport.blog/articles/database-rollback-strategies-in-playwright/database-rollback-strategies-in-playwright.html)
40. Pg\_tmp – Run tests on an isolated, temporary PostgreSQL database \- Hacker News, accessed January 14, 2026, [https://news.ycombinator.com/item?id=26947964](https://news.ycombinator.com/item?id=26947964)
41. Pytest- How to remove created data after each test function \- Stack Overflow, accessed January 14, 2026, [https://stackoverflow.com/questions/78132353/pytest-how-to-remove-created-data-after-each-test-function](https://stackoverflow.com/questions/78132353/pytest-how-to-remove-created-data-after-each-test-function)
42. Top 120+ SQL Interview Questions and Answers \[2024\] \- LambdaTest, accessed January 14, 2026, [https://www.lambdatest.com/learning-hub/sql-interview-questions](https://www.lambdatest.com/learning-hub/sql-interview-questions)
43. Best practices for Playwright E2E testing with database reset between tests? (FastAPI \+ React \+ PostgreSQL) : r/softwaretesting \- Reddit, accessed January 14, 2026, [https://www.reddit.com/r/softwaretesting/comments/1ouc86w/best\_practices\_for\_playwright\_e2e\_testing\_with/](https://www.reddit.com/r/softwaretesting/comments/1ouc86w/best_practices_for_playwright_e2e_testing_with/)
44. Test Data Strategies for E2E Tests \- The worldwide Playwright Users Event, accessed January 14, 2026, [https://www.playwright-user-event.org/playwright-tips/test-data-strategies-for-e2e-tests](https://www.playwright-user-event.org/playwright-tips/test-data-strategies-for-e2e-tests)
