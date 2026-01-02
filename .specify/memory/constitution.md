<!--
================================================================================
SYNC IMPACT REPORT
================================================================================
Version change: 1.1.0 → 1.2.0 (new principles added)

Modified sections:
- IV. Classicist Unit Testing: Added CRITICAL prohibition on mocks without explicit user permission

Added sections:
- V. Small, Focused Pull Requests (100-200 LOC max, tests included, no unrelated changes)
- VI. Git Town Branch Management (mandatory git-town for dependent branch chains)
- VII. Sequential PR Planning (~50 PRs per feature, spec plans must be framed as PR sequences)
- VIII. Presubmit Gate (./scripts/presubmit.sh must pass before any push to remote)

Removed sections:
- (none)

Templates validation:
- ✅ plan-template.md: Compatible (Constitution Check section present - recommend adding PR planning)
- ✅ spec-template.md: Compatible (no direct constitution references)
- ✅ tasks-template.md: Compatible (task organization supports incremental PR delivery)

Follow-up TODOs: None
================================================================================
-->

# RPC Stream Prototype Constitution

## Purpose

This codebase is a **learning exercise** to understand bidirectional streaming in gRPC from both server and client perspectives.

**Primary Goal**: Simplicity and understandability.

**Explicit Non-Goal**: Production-grade robustness, especially when it introduces additional complexity.

## Core Principles

### I. Simplicity First

All design decisions MUST prioritize clarity and ease of understanding over production hardening.

- Code MUST be written to teach and illustrate gRPC streaming concepts
- Abstractions SHOULD only be introduced when they improve comprehension
- Complex error handling, retry logic, or resilience patterns MUST NOT be added unless they directly serve the learning objective
- When choosing between a "correct" complex solution and a "good enough" simple solution, prefer simplicity

**Rationale**: This is a prototype for learning. Complexity obscures the core concepts being studied.

### II. Dev Container-Managed System Dependencies

System-level dependencies MUST be managed via dev container configuration.

- All system packages, tools, and runtime dependencies MUST be declared in `.devcontainer/devcontainer.json` or related Dockerfile
- Developers MUST NOT require manual system installation steps beyond opening the dev container
- The dev container MUST provide a reproducible, consistent development environment

**Rationale**: Ensures any developer can clone and immediately work without environment setup friction.

### III. UV-Managed Python Dependencies

Python dependencies MUST be managed via `uv`.

- All Python packages MUST be declared in `pyproject.toml`
- Dependency installation MUST use `uv sync`
- Script execution MUST use `uv run`
- Direct `pip install` commands are PROHIBITED in development workflows

**Rationale**: uv provides fast, reproducible dependency resolution with lockfile support.

### IV. Classicist Unit Testing

Unit tests MUST follow the "Classicist" (Detroit School) approach with the following dependency hierarchy:

1. **Real Implementation (Preferred)**: Use actual dependency code whenever possible
2. **High-Fidelity Fakes**: Use lightweight, in-memory implementations for slow or I/O-bound dependencies (databases, network calls)
   - Fakes MUST be implemented as shared, reusable components (e.g., `FakePaymentGateway` class)
   - Fakes MUST be located in `tests/fixtures/` and used consistently across the test suite
   - Ad-hoc or inline fakes for individual tests are PROHIBITED
3. **Mocks/Stubs (ABSOLUTELY LAST RESORT)**: Use ONLY for non-deterministic behavior or error states that cannot be reproduced with Fakes

**⚠️ CRITICAL: MOCKING REQUIRES EXPLICIT PERMISSION**

Mocking ANY dependency in a unit test is PROHIBITED without explicit, documented permission from the user/project owner. Before introducing ANY mock:

1. The agent MUST ask the user for explicit permission
2. The user MUST approve the specific mock in writing
3. The rationale for why a real implementation or fake is insufficient MUST be documented

Violations of this rule are considered severe and will require immediate remediation.

**Verification Style**: Tests MUST use State-Based Verification (checking return values or state changes) rather than Interaction-Based Verification (checking which methods were called).

**Rationale**: Classicist testing produces more resilient tests that verify behavior rather than implementation details. Mocks couple tests to implementation and make refactoring painful.

### V. Small, Focused Pull Requests

All code contributions MUST be submitted as small, focused pull requests.

- **Maximum Size**: 100-200 lines of changed code per pull request (HARD LIMIT)
- **Minimum Size**: No minimum—a 1-line PR is acceptable if it makes logical sense
- **Focus**: Each PR MUST address a single, cohesive concern
  - PRs containing unrelated changes are PROHIBITED
  - A PR that "also fixes" or "also adds" unrelated functionality MUST be split
- **Tests Included**: Implementation and corresponding tests MUST be submitted in the same PR
  - Submitting implementation without tests (or tests without implementation) is PROHIBITED
- **Incremental Building**: Large classes or features MUST be built incrementally across multiple PRs
  - Each PR adds a coherent slice of functionality
  - The codebase MUST remain functional after each PR merge

**Rationale**: Small PRs enable faster reviews, easier rollbacks, cleaner git history, and reduce merge conflicts. They enforce disciplined, incremental development.

### VI. Git Town Branch Management

All git branches MUST be managed using `git-town`.

- Creating branches with raw `git checkout -b` or `git branch` is PROHIBITED for feature work
- Use `git town hack <branch>` to create new feature branches
- Use `git town append <branch>` to create dependent/stacked branches off the current branch
- Use `git town sync` to synchronize branch chains with upstream changes
- Use `git town ship` to merge completed branches

**Dependent Branch Chains**: Features MUST be developed as chains of dependent PRs:

- PR #2 branches off PR #1 (not main)
- PR #3 branches off PR #2
- When PR #1 merges, git-town automatically re-parents PR #2 onto main

**Rationale**: Git-town enables stacked PRs that can be reviewed independently while maintaining proper dependency chains. This is essential for the small-PR workflow.

### VII. Sequential PR Planning

Every feature specification plan MUST be framed as a sequence of pull requests.

- Plans MUST enumerate the specific PRs required to implement the feature
- A typical feature should result in approximately **50 PRs** (adjust based on complexity)
- Each PR in the plan MUST have:
  - A clear, single-purpose description
  - An estimated line count (target: 100-200 lines)
  - Dependencies on previous PRs in the chain
- The PR sequence MUST be executable in order—each PR builds on the previous

**Planning Example**:
```
PR 1: Add empty UserService class with constructor (50 lines)
PR 2: Add UserService.create() method stub (80 lines)
PR 3: Implement UserService.create() validation logic (120 lines)
PR 4: Add UserService.create() persistence (100 lines)
PR 5: Add unit tests for UserService.create() (150 lines)
...
```

**Rationale**: Pre-planning the PR sequence ensures disciplined incremental delivery and prevents scope creep.

### VIII. Presubmit Gate

Code MUST NOT be pushed to any remote branch until `./scripts/presubmit.sh` passes.

- Running `git push` is PROHIBITED if presubmit checks are failing
- The presubmit script includes all quality gates: linting, type checking, tests
- Agents MUST run `./scripts/presubmit.sh` and verify success before any `git push` command
- Pushing code that fails presubmit—even to a feature branch—is a violation

**Rationale**: Ensures all remote branches maintain quality standards and CI remains green.

## Development Tooling

- **Quality Checks**: Agents MUST execute `./scripts/check_quality.sh` before considering code complete
- **Linting**: Ruff (configured in `pyproject.toml`)
- **Type Checking**: Pyright in strict mode
- **Testing**: pytest with `tests/` directory structure

## Frontend Architecture & Standards

This section defines mandatory constraints for all Angular code in `frontend/`.

### I. Modern Lifecycle Management

Components and services MUST use `DestroyRef` and `takeUntilDestroyed` for cleanup logic.

- Implementing the `OnDestroy` interface is PROHIBITED unless required for external library interoperability
- Manual boolean flags (e.g., `isDestroyed`, `isAlive`) to track component lifecycle are PROHIBITED
- Cleanup callbacks MUST be registered via `this.destroyRef.onDestroy(() => ...)`

```typescript
// ❌ PROHIBITED
class MyComp implements OnDestroy {
  isAlive = true;
  ngOnDestroy() { this.isAlive = false; }
}

// ✅ REQUIRED
class MyComp {
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.destroyRef.onDestroy(() => {
      // cleanup logic here
    });
  }
}
```

**Rationale**: DestroyRef provides a declarative, injection-based lifecycle that eliminates boilerplate and prevents missed cleanup.

### II. Dependency Injection Strategy

All dependencies MUST be obtained using the `inject()` function.

- Constructor-based dependency injection is PROHIBITED
- Dependencies SHOULD be declared as `private readonly` class fields

```typescript
// ❌ PROHIBITED
constructor(private service: UserService) {}

// ✅ REQUIRED
private readonly userService = inject(UserService);
```

**Rationale**: `inject()` enables safer field initialization, clearer type inference, and avoids constructor parameter ordering issues.

### III. Signal State Encapsulation

State services MUST follow the "Private Writable / Public Readonly" pattern.

- `WritableSignal` instances MUST be private
- Public state MUST be exposed as `Signal<T>` (readonly) using `.asReadonly()`
- Direct mutation of state from outside the owning service is PROHIBITED

```typescript
// ✅ REQUIRED PATTERN
private readonly _currentUser = signal<User | null>(null);
readonly currentUser = this._currentUser.asReadonly();
```

**Rationale**: Enforces unidirectional data flow and prevents accidental state corruption from consumer components.

### IV. Computed Signal Type Safety

Computed signals that may return `null` or `undefined` MUST have explicit generic type annotations.

- Relying on type inference for nullable return values is PROHIBITED
- The generic type MUST document the nullability intent

```typescript
// ❌ PROHIBITED (relies on inference for nullable)
readonly activeItem = computed(() => findItem() || null);

// ✅ REQUIRED
readonly activeItem = computed<Item | undefined>(() => this.items().find(i => i.active));
```

**Rationale**: Explicit types prevent "Type 'null' is not assignable to 'undefined'" errors and document API contracts.

### V. Template Control Flow

Components MUST use Angular's built-in control flow syntax (`@if`, `@for`, `@switch`).

- Structural directives (`*ngIf`, `*ngFor`, `*ngSwitch`) are PROHIBITED
- Importing `CommonModule` solely for structural directives is PROHIBITED

**Rationale**: Built-in control flow is more performant, requires no imports, and is the forward-looking Angular standard.

### VI. Streaming Data Handling

When consuming `AsyncIterable` (gRPC streams) or Observables in components:

- Cancellation MUST be handled via `DestroyRef` or an `AbortController` tied to `DestroyRef`
- Manual boolean flags to break async loops are PROHIBITED
- For `AsyncIterable`, pass an `AbortSignal` or check `destroyRef` to exit iteration

```typescript
// ✅ REQUIRED PATTERN for AsyncIterable
private readonly destroyRef = inject(DestroyRef);

async consumeStream(stream: AsyncIterable<Event>) {
  const abortController = new AbortController();
  this.destroyRef.onDestroy(() => abortController.abort());

  for await (const event of stream) {
    if (abortController.signal.aborted) break;
    // process event
  }
}
```

**Rationale**: Ties stream lifecycle to component lifecycle automatically, preventing memory leaks and orphaned subscriptions.

## Quality Gates

Before any code is considered complete:

1. `./scripts/presubmit.sh` MUST pass with zero errors (required before any push)
2. `./scripts/check_quality.sh` MUST pass with zero errors
3. All new functionality MUST have corresponding unit tests (submitted in same PR)
4. Tests MUST follow the Classicist hierarchy (real → fake → mock WITH EXPLICIT PERMISSION ONLY)
5. Shared fakes MUST be placed in `tests/fixtures/`
6. PRs MUST be ≤200 lines and single-purpose

## Governance

This constitution supersedes all other development practices for this repository.

- All code contributions MUST comply with these principles
- Amendments require updating this document with version increment
- Version follows semantic versioning: MAJOR (principle changes), MINOR (new sections), PATCH (clarifications)

**Version**: 1.2.0 | **Ratified**: 2025-12-28 | **Last Amended**: 2026-01-02
