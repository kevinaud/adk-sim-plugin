Moving CI logic into `ops` is a natural extension that provides huge benefits:

1. **Local reproducibility**: Run the exact CI checks locally before pushing
2. **Single source of truth**: CI logic defined once in Python, not duplicated in YAML
3. **Testability**: CI logic itself can be unit tested
4. **Debuggability**: When CI fails, reproduce locally with same command

Let me add a new section to the proposal:

---

## **14. CI Integration: Thin Workflows, Fat CLI**

### **14.1 Design Principle**

> **Workflows should be thin orchestration layers that call `ops` commands.**

GitHub Actions YAML should only handle:
- **Environment setup**: Checkout, tool installation, caching
- **GitHub-specific operations**: Secrets, artifacts, OIDC tokens, permissions
- **Parallelization**: Matrix strategies, job dependencies

All actual *logic* lives in `ops`, making it:
- Testable locally
- Debuggable without push-wait-fail cycles
- Consistent between local and CI

### **14.2 Current Workflow Analysis**

| Workflow | Current Logic Location | Proposed Location |
|----------|----------------------|-------------------|
| `ci.yaml` | Calls `scripts/presubmit.sh` | `ops ci` |
| `publish.yaml` | Inline build/verify steps | `ops ci build`, `ops ci verify` |
| `build-image.yaml` | Devcontainer action | Keep in GHA (GitHub-specific) |
| `codeql.yml` | GitHub CodeQL action | Keep in GHA (GitHub-native) |

### **14.3 New Command Group: `ops ci`**

```
ops ci
├── check          # Full CI validation (default)
├── build          # Build all artifacts for release
├── verify         # Verify built artifacts work
├── matrix         # Output matrix config as JSON (for dynamic GHA matrices)
└── report         # Generate CI summary report
```

**`ops/src/ops/commands/ci.py`:**

```python
"""CI pipeline commands.

These commands encapsulate all CI logic, allowing:
- Local reproduction of CI failures
- Single source of truth for validation logic
- Testable CI pipeline steps
"""
import json
import sys
from pathlib import Path

import typer
from rich.console import Console
from rich.panel import Panel

from ops.core.paths import REPO_ROOT
from ops.core.process import run

app = typer.Typer(
  help="CI pipeline commands. Run the same checks locally that CI runs.",
)
console = Console()


@app.callback(invoke_without_command=True)
def ci(ctx: typer.Context) -> None:
  """
  Run full CI validation.

  This runs the exact same checks that the CI workflow runs,
  allowing you to catch issues before pushing.

  Examples:
    ops ci              Run all CI checks
    ops ci check        Same as above (explicit)
    ops ci build        Build release artifacts
    ops ci verify       Verify artifacts work
  """
  if ctx.invoked_subcommand is None:
    # Default to full check
    ctx.invoke(check)


@app.command()
def check(
  skip_e2e: bool = typer.Option(
    False, "--skip-e2e", help="Skip E2E tests (faster)"
  ),
  fail_fast: bool = typer.Option(
    False, "--fail-fast", "-x", help="Stop on first failure"
  ),
) -> None:
  """
  Run full CI validation suite.

  This is equivalent to what runs on every PR:
  1. Ensure dependencies are installed
  2. Build TypeScript packages
  3. Run all pre-commit hooks
  4. Run all test suites

  Examples:
    ops ci check                 Full validation
    ops ci check --skip-e2e      Skip slow E2E tests
    ops ci check --fail-fast     Stop on first failure
  """
  console.print(Panel("CI Validation Suite", style="blue"))

  steps = [
    ("Installing dependencies", _install_deps),
    ("Building TypeScript packages", _build_ts),
    ("Running quality checks", _run_quality),
    ("Running backend tests", _run_backend_tests),
    ("Running frontend tests", _run_frontend_tests),
    ("Running component tests", _run_component_tests),
  ]

  if not skip_e2e and _should_run_e2e():
    steps.extend([
      ("Running frontend E2E tests", _run_frontend_e2e),
      ("Running backend E2E tests", _run_backend_e2e),
    ])
  elif not skip_e2e:
    console.print("[dim]Skipping E2E tests (only docs changed)[/dim]")

  failed = []
  for name, func in steps:
    console.print(f"\n[bold]{name}...[/bold]")
    try:
      func()
      console.print(f"[green]✓[/green] {name}")
    except Exception as e:
      console.print(f"[red]✗[/red] {name}: {e}")
      failed.append(name)
      if fail_fast:
        break

  console.print()
  if failed:
    console.print(f"[red]✗ CI failed:[/red] {', '.join(failed)}")
    raise typer.Exit(1)
  else:
    console.print("[green]✓ All CI checks passed![/green]")


@app.command()
def build(
  output_dir: Path = typer.Option(
    Path("dist"), "--output", "-o", help="Output directory for artifacts"
  ),
) -> None:
  """
  Build all release artifacts.

  Builds:
  - Python wheels and sdists for all packages
  - TypeScript packages (compiled)
  - Frontend bundle (embedded in server)

  This is what runs in the publish workflow before upload.

  Examples:
    ops ci build                  Build to ./dist/
    ops ci build -o /tmp/release  Build to custom directory
  """
  console.print(Panel("Building Release Artifacts", style="blue"))

  # Use the build module
  from ops.commands.build import _build_all
  _build_all(force=True)

  # Build Python packages
  console.print("\n[bold]Building Python packages...[/bold]")
  output_dir.mkdir(parents=True, exist_ok=True)

  packages = [
    "adk-sim-protos",
    "adk-sim-testing",
    "adk-sim-server",
    "adk-agent-sim",
  ]

  for pkg in packages:
    run(["uv", "build", "--package", pkg, "--out-dir", str(output_dir)])
    console.print(f"[green]✓[/green] Built {pkg}")

  # List artifacts
  console.print(f"\n[bold]Artifacts in {output_dir}:[/bold]")
  for artifact in sorted(output_dir.glob("*")):
    size = artifact.stat().st_size
    console.print(f"  {artifact.name} ({size:,} bytes)")


@app.command()
def verify(
  dist_dir: Path = typer.Option(
    Path("dist"), "--dist", "-d", help="Directory containing built artifacts"
  ),
) -> None:
  """
  Verify built artifacts are installable and functional.

  Creates a fresh virtual environment, installs the built packages,
  and runs smoke tests to ensure everything works.

  Examples:
    ops ci verify                 Verify artifacts in ./dist/
    ops ci build && ops ci verify Build then verify
  """
  import shutil
  import tempfile

  console.print(Panel("Verifying Artifacts", style="blue"))

  with tempfile.TemporaryDirectory() as tmpdir:
    venv_path = Path(tmpdir) / ".venv"

    # Create isolated venv
    console.print("[bold]Creating verification environment...[/bold]")
    run(["uv", "venv", str(venv_path)])

    # Install from local dist
    console.print("[bold]Installing packages...[/bold]")
    run([
      "uv", "pip", "install",
      "--python", str(venv_path / "bin" / "python"),
      "adk-sim-server",
      "--find-links", str(dist_dir),
      "--prerelease=allow",
    ])

    # Smoke test: imports
    console.print("[bold]Testing imports...[/bold]")
    run([
      str(venv_path / "bin" / "python"), "-c",
      "import adk_sim_server; import adk_sim_protos; print('✓ Imports OK')"
    ])

    # Smoke test: server starts and serves frontend
    console.print("[bold]Testing server startup...[/bold]")
    import subprocess
    import time

    proc = subprocess.Popen(
      [str(venv_path / "bin" / "adk-sim")],
      stdout=subprocess.PIPE,
      stderr=subprocess.PIPE,
    )
    try:
      time.sleep(3)

      # Check server responds
      import urllib.request
      response = urllib.request.urlopen("http://localhost:8080/")
      html = response.read().decode()

      if "<app-root>" not in html:
        raise RuntimeError("Frontend not served correctly")

      console.print("[green]✓[/green] Server serves frontend")
    finally:
      proc.terminate()
      proc.wait()

  console.print("\n[green]✓ All verification checks passed![/green]")


@app.command()
def matrix(
  type: str = typer.Argument(..., help="Matrix type: 'python' or 'node'"),
) -> None:
  """
  Output CI matrix configuration as JSON.

  Used by GitHub Actions for dynamic matrix strategies.
  Allows matrix definition to live in code, not YAML.

  Examples:
    ops ci matrix python    Output Python version matrix
    ops ci matrix node      Output Node version matrix

  In workflow:
    matrix: ${{ fromJson(steps.matrix.outputs.matrix) }}
  """
  matrices = {
    "python": {
      "version": ["3.12", "3.13", "3.14"],
      "os": ["ubuntu-latest"],
    },
    "node": {
      "version": ["20", "22", "24"],
      "os": ["ubuntu-latest"],
    },
  }

  if type not in matrices:
    console.print(f"[red]Unknown matrix type: {type}[/red]")
    console.print(f"Available: {', '.join(matrices.keys())}")
    raise typer.Exit(2)

  # Output raw JSON for GHA consumption
  print(json.dumps(matrices[type]))


# ============================================================
# Internal helper functions
# ============================================================

def _install_deps() -> None:
  """Ensure all dependencies are installed."""
  run(["npm", "install", "--silent"], cwd=REPO_ROOT)
  run(["uv", "sync", "--frozen"], cwd=REPO_ROOT)


def _build_ts() -> None:
  """Build TypeScript packages."""
  run(["npm", "run", "build", "--workspace=packages/adk-sim-protos-ts"], cwd=REPO_ROOT)
  run(["npm", "run", "build", "--workspace=packages/adk-converters-ts"], cwd=REPO_ROOT)


def _run_quality() -> None:
  """Run pre-commit quality checks."""
  run(["uv", "run", "pre-commit", "run", "--all-files", "--hook-stage", "manual"], cwd=REPO_ROOT)


def _run_backend_tests() -> None:
  """Run Python unit and integration tests."""
  run(["uv", "run", "pytest", "server/tests/unit", "plugins/python/tests", "-v"], cwd=REPO_ROOT)


def _run_frontend_tests() -> None:
  """Run frontend Vitest tests."""
  run(["npm", "run", "ng", "--", "test", "--watch=false"], cwd=REPO_ROOT / "frontend", env={"CI": "true"})


def _run_component_tests() -> None:
  """Run Playwright component tests."""
  run(["npm", "exec", "playwright", "test", "--", "-c", "playwright-ct.config.ts"], cwd=REPO_ROOT / "frontend")


def _run_frontend_e2e() -> None:
  """Run Playwright E2E tests."""
  run(["npm", "exec", "playwright", "test", "--", "-c", "playwright.config.ts"], cwd=REPO_ROOT / "frontend")


def _run_backend_e2e() -> None:
  """Run backend E2E tests (requires Docker)."""
  run(["uv", "run", "pytest", "server/tests/e2e", "--run-e2e", "-v"], cwd=REPO_ROOT)


def _should_run_e2e() -> bool:
  """
  Determine if E2E tests should run based on changed files.

  Skip E2E if only documentation/config files changed.
  This is the logic from scripts/should-run-e2e.sh, now in Python.
  """
  import subprocess

  skip_patterns = [
    r"^mddocs/",
    r"^\.github/agents/",
    r"^\.claude/",
    r"^README\.md$",
    r"^CLAUDE\.md$",
    r"^\.vscode/",
  ]

  try:
    # Get upstream branch
    result = subprocess.run(
      ["git", "rev-parse", "--abbrev-ref", "@{upstream}"],
      capture_output=True,
      text=True,
    )
    upstream = result.stdout.strip() if result.returncode == 0 else "origin/main"

    # Get merge base
    result = subprocess.run(
      ["git", "merge-base", "HEAD", upstream],
      capture_output=True,
      text=True,
    )
    merge_base = result.stdout.strip() if result.returncode == 0 else upstream

    # Get changed files
    result = subprocess.run(
      ["git", "diff", "--name-only", merge_base, "HEAD"],
      capture_output=True,
      text=True,
    )
    changed_files = result.stdout.strip().split("\n") if result.stdout.strip() else []

    if not changed_files:
      return True  # Safety default

    # Check if any file doesn't match skip patterns
    import re
    skip_regex = "|".join(skip_patterns)

    for f in changed_files:
      if f and not re.match(skip_regex, f):
        return True  # Found a non-skippable file

    return False  # All files are skippable

  except Exception:
    return True  # Safety default on any error
```

### **14.4 Simplified Workflows**

**`.github/workflows/ci.yaml` (after):**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    name: CI Checks
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Python
        uses: astral-sh/setup-uv@v7

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install dependencies
        run: |
          uv sync --frozen
          npm ci

      # ONE COMMAND DOES EVERYTHING
      - name: Run CI
        run: uv run ops ci check
```

**Compare to before (60+ lines):**
```yaml
# Before: Logic scattered in YAML
- name: Build TS packages
  run: |
    npm run build --workspace=packages/adk-sim-protos-ts
    npm run build --workspace=packages/adk-converters-ts

- name: Run pre-commit
  run: uv run pre-commit run --all-files --hook-stage manual

- name: Run backend tests
  run: uv run pytest server/tests/unit plugins/python/tests -v

- name: Run frontend tests
  run: cd frontend && CI=true npm run ng -- test --watch=false
# ... etc
```

**`.github/workflows/publish.yaml` (after):**

```yaml
name: Publish Packages

on:
  push:
    tags: ['v*']

permissions:
  contents: read
  id-token: write

jobs:
  build-and-verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v7
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: |
          uv sync --frozen
          npm ci

      # TWO COMMANDS: BUILD AND VERIFY
      - name: Build artifacts
        run: uv run ops ci build --output dist/

      - name: Verify artifacts
        run: uv run ops ci verify --dist dist/

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  # Publishing jobs stay in GHA (need secrets/tokens)
  publish-pypi:
    needs: build-and-verify
    runs-on: ubuntu-latest
    environment: pypi
    permissions:
      id-token: write
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/
      - uses: pypa/gh-action-pypi-publish@release/v1
        with:
          packages-dir: dist/

  publish-npm:
    needs: build-and-verify
    runs-on: ubuntu-latest
    permissions:
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: |
          npm run build --workspace=packages/adk-sim-protos-ts
          npm run build --workspace=packages/adk-converters-ts
      - run: |
          cd packages/adk-sim-protos-ts && npm publish --provenance --access public
          cd ../adk-converters-ts && npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### **14.5 What Stays in GitHub Actions**

Some things **must** remain in workflow YAML:

| Concern | Reason |
|---------|--------|
| **Checkout** | `actions/checkout` handles Git auth, LFS, submodules |
| **Tool setup** | `setup-python`, `setup-node` handle caching, PATH |
| **Secrets** | `${{ secrets.* }}` only available in GHA context |
| **OIDC tokens** | PyPI/npm trusted publishing needs GHA identity |
| **Artifacts** | `upload-artifact`/`download-artifact` for job data passing |
| **Matrix strategies** | GHA-native parallelization |
| **Permissions** | `permissions:` block is GHA-specific |
| **Job dependencies** | `needs:` for job ordering |
| **Caching** | `actions/cache` for dependency caching |
| **CodeQL** | GitHub-native security scanning |
| **Devcontainer builds** | `devcontainers/ci` action |

### **14.6 Dynamic Matrices from `ops`**

For cases where you want matrix definition in code:

```yaml
jobs:
  setup:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.matrix.outputs.matrix }}
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v7
      - run: uv sync --frozen
      - id: matrix
        run: echo "matrix=$(uv run ops ci matrix python)" >> $GITHUB_OUTPUT

  test:
    needs: setup
    strategy:
      matrix: ${{ fromJson(needs.setup.outputs.matrix) }}
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.version }}
      - run: uv run ops ci check
```

### **14.7 Local CI Reproduction**

The killer feature: **reproduce CI failures locally**:

```bash
# CI failed? Run the exact same thing locally:
$ ops ci check

# Want to skip slow E2E during iteration?
$ ops ci check --skip-e2e

# Just want to verify the build works?
$ ops ci build && ops ci verify

# Debug a specific step?
$ ops ci check --fail-fast  # Stop at first failure
```

### **14.8 Benefits Summary**

| Before | After |
|--------|-------|
| CI logic in YAML (untestable) | CI logic in Python (testable) |
| "Works on my machine" | Same command locally and in CI |
| Push-wait-fail debug cycle | Instant local reproduction |
| YAML sprawl (200+ lines) | Thin wrappers (~30 lines each) |
| Duplicated between workflows | Single source of truth |
| Hard to understand CI failures | Clear error messages with fix hints |

---

## **15. Updated Migration Plan**

Add a new phase for CI migration:

### **Phase 5.5: CI Commands (Week 3)**

**Goal:** Port all CI logic to `ops ci`

**Tasks:**
1. Implement `ops ci check` with all validation steps
2. Implement `ops ci build` for artifact creation
3. Implement `ops ci verify` for artifact validation
4. Port E2E skip logic from `should-run-e2e.sh`
5. Add `ops ci matrix` for dynamic matrices

**Success Criteria:**
- `ops ci check` produces same result as current CI
- Can reproduce any CI failure locally
- CI workflows reduced to <50 lines each

**Deliverable:** PR with ci commands, simplified workflows

---

## **16. Updated File Inventory**

**Additional files to create:**
```
ops/src/ops/commands/ci.py     # CI pipeline commands
```

**Files to simplify:**
```
.github/workflows/ci.yaml       # ~60 lines → ~25 lines
.github/workflows/publish.yaml  # ~80 lines → ~50 lines
```

**Files to delete (already planned):**
```
scripts/presubmit.sh           # → ops ci check
scripts/should-run-e2e.sh      # → _should_run_e2e() in ci.py
scripts/check-generated.sh     # → included in ops ci check
```
