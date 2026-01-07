## 3. Execution Plan & Detailed Audit

This refactor will be executed in **two distinct stages**.
1.  **Stage 1: Structural Refactor:** Move code into workspaces, splitting the monolith into distinct packages, but **maintaining the existing runtime architecture** (Docker Compose + Envoy).
2.  **Stage 2: Architectural Evolution:** Implement the "Monolithic Server" CLI, remove Envoy, and bundle the frontend.

---

### STAGE 1: Structural Refactor (Code Migration)
**Goal:** Establish the Polyglot Monorepo structure (`packages/`, `server/`, `plugins/`). The application behavior, build commands, and Docker Compose setup must remain functionally identical, just pointing to new paths.

#### Phase A: Workspace Initialization
1.  **Root `pyproject.toml`:**
    *   **Action:** Overwrite existing file.
    *   **Content:** Define `[tool.uv.workspace]` with members: `["server", "plugins/python", "packages/*"]`. Remove all dependencies (they move to sub-projects).
2.  **Root `package.json`:**
    *   **Action:** Create new file.
    *   **Content:** Define `workspaces`: `["frontend", "packages/adk-sim-protos-ts", "plugins/typescript"]`.

#### Phase B: Shared Internal Packages (`packages/`)
1.  **`packages/adk-sim-protos` (Python):**
    *   **Action:** Create directory structure `packages/adk-sim-protos/src/adk_sim_protos`.
    *   **Config:** Create `pyproject.toml` using `hatchling` build system. Add dependency `betterproto[compiler]`.
    *   **Code:** Move `adk_agent_sim/betterproto_patch.py` to `packages/adk-sim-protos/src/adk_sim_protos/betterproto_patch.py`.
2.  **`packages/adk-sim-protos-ts` (TypeScript):**
    *   **Action:** Create directory structure `packages/adk-sim-protos-ts/src`.
    *   **Config:** Create `package.json`. Name: `@adk-sim/protos`. Main: `src/index.ts`. Dependencies: `@bufbuild/protobuf`, `@connectrpc/connect`.
3.  **`packages/adk-sim-testing` (Python):**
    *   **Action:** Create directory structure `packages/adk-sim-testing/src/adk_sim_testing`.
    *   **Config:** Create `pyproject.toml` using `hatchling`. Dependencies: `adk-sim-protos`, `google-adk`, `pytest`, `sqlalchemy`.
    *   **Code:** Move `tests/fixtures/` contents to `src/adk_sim_testing/fixtures/`. Move `tests/unit/adk_helpers.py` to `src/adk_sim_testing/helpers.py`. Move `tests/e2e/response_helpers.py` to `src/adk_sim_testing/proto_helpers.py`.
    *   **Refactor:** Update internal imports in these files to point to `adk_sim_protos` instead of `adk_agent_sim.generated`.

#### Phase C: Server Migration (`server/`)
1.  **Structure:** Create `server/src/adk_sim_server` and `server/tests`.
2.  **Code Move:**
    *   Move `adk_agent_sim/server/*` -> `server/src/adk_sim_server/`.
    *   Move `adk_agent_sim/persistence/*` -> `server/src/adk_sim_server/persistence/`.
    *   Move `adk_agent_sim/settings.py` -> `server/src/adk_sim_server/settings.py`.
    *   Move `adk_agent_sim/__init__.py` -> `server/src/adk_sim_server/__init__.py`.
3.  **Test Move:**
    *   Move `tests/unit/server/*` -> `server/tests/unit/`.
    *   Move `tests/unit/persistence/*` -> `server/tests/unit/persistence/`.
    *   Move `tests/e2e/*` -> `server/tests/e2e/` (Server owns E2E).
4.  **Config:** Create `server/pyproject.toml`.
    *   Name: `adk-sim-server`.
    *   Deps: `grpclib`, `sqlalchemy`, `databases[aiosqlite]`, `python-dotenv`, `structlog`, `tenacity`.
    *   Workspace Deps: `adk-sim-protos` (main), `adk-sim-testing` (dev).
5.  **Refactor Imports:**
    *   Change `adk_agent_sim.server` -> `adk_sim_server`.
    *   Change `adk_agent_sim.generated` -> `adk_sim_protos`.
    *   Change `tests.fixtures` -> `adk_sim_testing.fixtures`.

#### Phase D: Plugin Migration (`plugins/python/`)
1.  **Structure:** Create `plugins/python/src/adk_agent_sim` (maintaining the public package name) and `plugins/python/tests`.
2.  **Code Move:**
    *   Move `adk_agent_sim/plugin/*` -> `plugins/python/src/adk_agent_sim/plugin/`.
    *   Create `plugins/python/src/adk_agent_sim/__init__.py`.
3.  **Test Move:**
    *   Move `tests/unit/plugin/*` -> `plugins/python/tests/unit/`.
    *   Move `tests/integration/*` -> `plugins/python/tests/integration/`.
4.  **Config:** Create `plugins/python/pyproject.toml`.
    *   Name: `adk-agent-sim` (matches PyPI).
    *   Deps: `google-adk`, `grpclib`.
    *   Workspace Deps: `adk-sim-protos` (main), `adk-sim-testing` (dev).
5.  **Refactor Imports:**
    *   Change `adk_agent_sim.generated` -> `adk_sim_protos`.
    *   Change `tests.fixtures` -> `adk_sim_testing.fixtures`.

#### Phase E: Frontend Integration
1.  **Dependency:** In `frontend/package.json`, add `"@adk-sim/protos": "*"`. Run `npm install` at root.
2.  **Refactor:** Update Angular imports to use `@adk-sim/protos` instead of `src/app/generated`.
3.  **Cleanup:** Delete `frontend/src/app/generated`.

#### Phase F: Infrastructure Updates (Maintaining Current Architecture)
1.  **`scripts/gen_protos.sh` & `buf.gen.yaml`:** Update output paths to point to `packages/adk-sim-protos/src/adk_sim_protos` and `packages/adk-sim-protos-ts/src`.
2.  **`scripts/check_quality.sh`:** Update paths to run linters from the root (respecting workspaces). Update frontend lint command.
3.  **`docker/backend.Dockerfile`:** Update to copy `packages/` and `server/` directories specifically.
4.  **`docker-compose.yaml`:**
    *   Update build context to `.` (root).
    *   Update `backend` volumes to mount `server/src/adk_sim_server`.
    *   Update `backend` command to `python -m adk_sim_server.main`.
5.  **`Makefile`:** Update `server`, `test`, `generate` targets to use the new paths and `uv run` commands relative to sub-projects.

---

### STAGE 2: Architectural Evolution (The Monolithic Server)
**Goal:** Eliminate Envoy, bundle the frontend, and create the single-process `adk-sim run` CLI.

#### Phase G: The gRPC-Web Gateway
1.  **New Dependency:** Add `starlette`, `uvicorn`, `httpx` to `server/pyproject.toml`.
2.  **Gateway Implementation (`server/src/adk_sim_server/web.py`):**
    *   Create a Starlette `HTTPEndpoint` or middleware.
    *   **Logic:** Intercept `POST` requests to `/adksim.v1.SimulatorService/*`.
    *   **Translation:** Decode the gRPC-Web payload (base64/binary), invoke the `SimulatorService` method directly (in-memory call), encode the response, and return it.
    *   *Note:* Avoid a loopback network call if possible; call the service class methods directly.

#### Phase H: The CLI Entrypoint
1.  **CLI Module (`server/src/adk_sim_server/cli.py`):**
    *   Use `typer` (already a dependency) to define the `run` command.
    *   **Arguments:** `--port` (default 50051), `--web-port` (default 8080), `--db-url`.
    *   **Concurrency:** Use `asyncio.gather()` to start:
        1.  The `grpclib` Server (serving `SimulatorService`).
        2.  The `uvicorn` Server (serving the Starlette app).
2.  **Static Files:**
    *   Configure Starlette to serve `StaticFiles` from a bundled directory (e.g., `adk_sim_server/static`) on the root route `/`.
    *   Ensure `index.html` is served for SPA routing (fallback).

#### Phase I: Frontend Bundling
1.  **Build Config:** Update `server/pyproject.toml` (hatch config) to include a build hook.
    *   **Hook:** Runs `npm run build` in `frontend/`.
    *   **Copy:** Copies `frontend/dist/frontend/browser/*` to `server/src/adk_sim_server/static/`.
2.  **Config Update:** In `frontend/src/environments/environment.prod.ts`, set `grpcWebUrl: ''` (relative path) so requests go to the origin (the Python server).

#### Phase J: Infrastructure Cleanup
1.  **Remove Envoy:** Delete `envoy/` directory. Remove `envoy` service from `docker-compose.yaml`.
2.  **Update Compose:**
    *   Expose ports `50051` AND `8080` on the `backend` service.
    *   Update `backend` command to `uv run adk-sim run` (or `python -m adk_sim_server.cli`).
3.  **Update Makefile:** `make server` should now run the CLI entrypoint.

## 4. Final Verification
1.  **Install:** `uv tool install --editable server/` (simulating user install).
2.  **Run:** `adk-sim run`.
3.  **Verify:**
    *   Browser loads at `http://localhost:8080`.
    *   Plugin connects at `localhost:50051`.
    *   Interactions in the browser (e.g., submitting a decision) work without Envoy.