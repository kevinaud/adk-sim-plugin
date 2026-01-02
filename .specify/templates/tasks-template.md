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

## Format: `[ID] [PR#] [P?] Description`

- **[PR#]**: Which Pull Request this task belongs to (e.g., PR1, PR2, PR3)
- **[P]**: Can run in parallel within the same PR (different files, no dependencies)
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

## PR 1: Initial Scaffold (~50 lines)

**Branch**: `git town hack feature/001-scaffold`
**Depends on**: -
**Goal**: Project structure and configuration

- [ ] T001 [PR1] Create project directory structure per plan.md
- [ ] T002 [PR1] [P] Add base configuration files

---

## PR 2: Core Types (~100 lines)

**Branch**: `git town append feature/002-core-types`
**Depends on**: PR 1
**Goal**: Define foundational type definitions

- [ ] T003 [PR2] Define core interfaces in src/types/
- [ ] T004 [PR2] Add type tests in tests/unit/test_types.py

---

## PR 3: Base Model (~120 lines)

**Branch**: `git town append feature/003-base-model`
**Depends on**: PR 2
**Goal**: Implement first model with tests

- [ ] T005 [PR3] Create [Entity] model in src/models/[entity].py
- [ ] T006 [PR3] Add [Entity] model tests in tests/unit/test_[entity].py

---

## PR 4: Service Layer - Part 1 (~100 lines)

**Branch**: `git town append feature/004-service-part1`
**Depends on**: PR 3
**Goal**: First slice of service implementation

- [ ] T007 [PR4] Create [Service] class skeleton in src/services/[service].py
- [ ] T008 [PR4] Add [Service] constructor tests in tests/unit/test_[service].py

---

## PR 5: Service Layer - Part 2 (~150 lines)

**Branch**: `git town append feature/005-service-part2`
**Depends on**: PR 4
**Goal**: Add first method to service

- [ ] T009 [PR5] Implement [Service].create() method
- [ ] T010 [PR5] Add [Service].create() tests

---

[Continue PR sequence from plan.md - target ~50 PRs total]

---

## PR N: Final Polish (~100 lines)

**Branch**: `git town append feature/0NN-polish`
**Depends on**: PR N-1
**Goal**: Documentation and cleanup

- [ ] TXXX [PRN] Update documentation in docs/
- [ ] TXXX [PRN] Add integration tests

---

## Dependencies & Execution Order

### PR Chain (Managed by Git Town)

```
main
 └── PR 1: Initial scaffold
      └── PR 2: Core types
           └── PR 3: Base model
                └── PR 4: Service part 1
                     └── PR 5: Service part 2
                          └── ... (~50 PRs total)
```

### Git Town Commands

```bash
# Start feature
git town hack feature/001-scaffold

# Create stacked PRs
git town append feature/002-core-types
git town append feature/003-base-model
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

1. Complete all tasks for PR 1
2. Run `./scripts/presubmit.sh` - must pass
3. Push and create PR
4. `git town append feature/002-...` for next PR
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
- PR 5: Implement UserService
- PR 6: Add UserService tests

✅ CORRECT:
- PR 5: Implement UserService + tests (~150 lines total)

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
- [PR#] label maps task to specific Pull Request
- Each PR MUST be 100-200 lines max (HARD LIMIT)
- Tests and implementation go in SAME PR
- Run `./scripts/presubmit.sh` before every push
- Use `git town append` for stacked PRs
