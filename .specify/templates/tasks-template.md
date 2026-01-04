---

description: "Task list template for feature implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Implementation and tests MUST be submitted together in the same PR (per Constitution V.).

**Organization**: Tasks are grouped by Pull Request to enable small, focused submissions (100-200 LOC max).

## Constitutional Requirements

- **PR Size**: Each PR MUST be 100-200 lines max - tasks are grouped to fit this constraint
- **Tests Included**: Every implementation task includes its corresponding tests in the same PR
- **Git Town**: Use `git town append` to create dependent PR branches
- **Presubmit Gate**: Run `./scripts/presubmit.sh` before every `git push`
- **No Mocks**: Unit tests MUST use real implementations or fakes; mocks require explicit user permission

## Format: `[ID] [phNfM] [P?] Description`

- **[phNfM]**: Which Pull Request this task belongs to (e.g., ph1f1, ph2f3, ph3f10)
- **[P]**: Can run in parallel within the same PR (different files, no dependencies)
- **Task IDs**: Scoped within each phase (each phase starts from T001)
- Include exact file paths in descriptions
- Each PR groups related tasks that fit within 100-200 LOC

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- **Web app**: `backend/src/`, `frontend/src/`
- **Mobile**: `api/src/`, `ios/src/` or `android/src/`
- Paths shown below assume single project - adjust based on plan.md structure

<!-- 
  ============================================================================
  IMPORTANT: The tasks below are SAMPLE TASKS for illustration purposes only.
  
  The /speckit.tasks command MUST replace these with actual tasks based on:
  - PR Sequence from plan.md (with estimated line counts)
  - User stories from spec.md (with their priorities P1, P2, P3...)
  - Entities from data-model.md
  - Endpoints from contracts/
  
  Tasks MUST be organized by Pull Request:
  - Each PR is 100-200 lines max (HARD LIMIT)
  - Each PR includes implementation AND tests together
  - Target ~50 PRs for a typical feature
  
  DO NOT keep these sample tasks in the generated tasks.md file.
  ============================================================================
-->

## ph1f1: Initial Scaffold (~50 lines)

**Branch**: `git town hack phase/1/feat/1/scaffold`
**Depends on**: -
**Goal**: Project structure and configuration

- [ ] T001 [ph1f1] Create project directory structure per plan.md
- [ ] T002 [ph1f1] [P] Add base configuration files

---

## ph1f2: Core Types (~100 lines)

**Branch**: `git town append phase/1/feat/2/core-types`
**Depends on**: ph1f1
**Goal**: Define foundational type definitions

- [ ] T003 [ph1f2] Define core interfaces in src/types/
- [ ] T004 [ph1f2] Add type tests in tests/unit/test_types.py

---

## ph1f3: Base Model (~120 lines)

**Branch**: `git town append phase/1/feat/3/base-model`
**Depends on**: ph1f2
**Goal**: Implement first model with tests

- [ ] T005 [ph1f3] Create [Entity] model in src/models/[entity].py
- [ ] T006 [ph1f3] Add [Entity] model tests in tests/unit/test_[entity].py

---

## ph2f1: Service Layer - Part 1 (~100 lines)

**Branch**: `git town append phase/2/feat/1/service-part1`
**Depends on**: ph1f3
**Goal**: First slice of service implementation

- [ ] T001 [ph2f1] Create [Service] class skeleton in src/services/[service].py
- [ ] T002 [ph2f1] Add [Service] constructor tests in tests/unit/test_[service].py

---

## ph2f2: Service Layer - Part 2 (~150 lines)

**Branch**: `git town append phase/2/feat/2/service-part2`
**Depends on**: ph2f1
**Goal**: Add first method to service

- [ ] T003 [ph2f2] Implement [Service].create() method
- [ ] T004 [ph2f2] Add [Service].create() tests

---

[Continue PR sequence from plan.md - target ~50 PRs total]

---

## phNfM: Final Polish (~100 lines)

**Branch**: `git town append phase/N/feat/M/polish`
**Depends on**: phNf(M-1)
**Goal**: Documentation and cleanup

- [ ] T001 [phNfM] Update documentation in docs/
- [ ] T002 [phNfM] Add integration tests

---

## Dependencies & Execution Order

### PR Chain (Managed by Git Town)

```
main
 └── ph1f1: Initial scaffold
      └── ph1f2: Core types
           └── ph1f3: Base model
                └── ph2f1: Service part 1
                     └── ph2f2: Service part 2
                          └── ... (~50 PRs total)
```

### Git Town Commands

```bash
# Start feature - Phase 1
git town hack phase/1/feat/1/scaffold

# Create stacked PRs within Phase 1
git town append phase/1/feat/2/core-types
git town append phase/1/feat/3/base-model
# ... continue for each PR

# Sync with upstream
git town sync

# After PR merges, re-parent children
git town sync  # Automatically handles re-parenting
```

### Before Every Push

```bash
# MANDATORY: Run presubmit before any push
./scripts/presubmit.sh

# Only push if presubmit passes
git push
```

---

## Implementation Strategy

### Small PR Workflow

1. Complete all tasks for ph1f1
2. Run `./scripts/presubmit.sh` - must pass
3. Push and create PR
4. `git town append phase/1/feat/2/...` for next PR
5. Repeat for all ~50 PRs

### Incremental Delivery

- Each PR adds a coherent slice of functionality
- Codebase remains functional after each merge
- Large classes built incrementally (methods across PRs)
- Tests always accompany implementation

### Line Count Validation

Before submitting any PR:
1. Check diff: `git diff --stat`
2. If >200 lines, split into smaller PRs
3. Each PR should be reviewable in ~10 minutes

---

## Testing Guidelines

### Tests MUST Be In Same PR As Implementation

❌ WRONG:
- ph2f2: Implement UserService
- ph2f3: Add UserService tests

✅ CORRECT:
- ph2f2: Implement UserService + tests (~150 lines total)

### No Mocks Without Permission

Per Constitution IV., mocking requires explicit user permission.

Preference hierarchy:
1. Real implementations
2. High-fidelity fakes in `tests/fixtures/`
3. Mocks (ONLY with explicit permission)

If you believe a mock is necessary:
1. STOP and document why
2. Ask user for permission
3. Only proceed if approved

---

## Notes

- [P] tasks = parallelizable within the same PR
- [phNfM] label maps task to specific Pull Request (phase N, feature M)
- Task IDs are phase-scoped (each phase starts from T001)
- Each PR MUST be 100-200 lines max (HARD LIMIT)
- Tests and implementation go in SAME PR
- Run `./scripts/presubmit.sh` before every push
- Use `git town append` for stacked PRs
