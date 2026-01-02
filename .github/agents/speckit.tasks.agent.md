---
description: Generate an actionable, dependency-ordered tasks.md for the feature based on available design artifacts.
handoffs: 
  - label: Analyze For Consistency
    agent: speckit.analyze
    prompt: Run a project analysis for consistency
    send: true
  - label: Implement Project
    agent: speckit.implement
    prompt: Start the implementation in phases
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Constitutional Requirements (MANDATORY)

Tasks MUST be organized to support these constitutional principles:

### Small, Focused PRs (Constitution V.)
- Tasks MUST be grouped into PRs of 100-200 lines max
- Each PR group addresses a SINGLE, cohesive concern
- Implementation AND tests MUST be in the SAME PR group
- A typical feature should have ~50 PRs

### Sequential PR Planning (Constitution VII.)
- Tasks MUST be organized by Pull Request number (PR1, PR2, PR3...)
- Each PR group has clear dependencies on previous PRs
- Use `git town append` to create stacked branch chains

### No Mocks Without Permission (Constitution IV.)
- Test tasks MUST use real implementations or fakes
- If a mock seems necessary, flag it for user approval

## Outline

1. **Setup**: Run `.specify/scripts/bash/check-prerequisites.sh --json` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Load design documents**: Read from FEATURE_DIR:
   - **Required**: plan.md (tech stack, libraries, structure, **PR sequence**), spec.md (user stories with priorities)
   - **Optional**: data-model.md (entities), contracts/ (API endpoints), research.md (decisions), quickstart.md (test scenarios)
   - Note: Not all projects have all documents. Generate tasks based on what's available.

3. **Execute task generation workflow**:
   - Load plan.md and extract tech stack, libraries, project structure, **and PR sequence**
   - Load spec.md and extract user stories with their priorities (P1, P2, P3, etc.)
   - If data-model.md exists: Extract entities and map to PRs
   - If contracts/ exists: Map endpoints to PRs
   - If research.md exists: Extract decisions for setup tasks
   - **Map user stories to PR sequence from plan.md**
   - Generate tasks organized by Pull Request (see Task Generation Rules below)
   - Validate each PR stays within 100-200 LOC limit
   - Ensure each PR includes both implementation AND tests

4. **Generate tasks.md**: Use `.specify/templates/tasks-template.md` as structure, fill with:
   - Correct feature name from plan.md
   - **Tasks grouped by PR number (PR1, PR2, PR3... targeting ~50 PRs)**
   - Each PR section includes:
     - PR goal and scope
     - Estimated line count (MUST be 100-200 max)
     - Implementation tasks
     - Test tasks (in SAME PR, not separate)
     - Dependencies on previous PRs
   - All tasks must follow the strict checklist format (see Task Generation Rules below)
   - Clear file paths for each task
   - Git Town commands for branch creation (`git town append`)

5. **Report**: Output path to generated tasks.md and summary:
   - Total task count
   - **Total PR count (target: ~50 for typical feature)**
   - Task count per PR
   - Line count estimate per PR (flag any >200)
   - Parallel opportunities within PRs
   - Format validation: Confirm ALL tasks follow the checklist format (checkbox, ID, PR label, file paths)

Context for task generation: $ARGUMENTS

The tasks.md should be immediately executable - each task must be specific enough that an LLM can complete it without additional context.

## Task Generation Rules

**CRITICAL**: Tasks MUST be organized by Pull Request to enable small, focused submissions (100-200 LOC max).

**Tests are MANDATORY**: Implementation and tests MUST be in the SAME PR (Constitution V.).

### Checklist Format (REQUIRED)

Every task MUST strictly follow this format:

```text
- [ ] [TaskID] [PR#] [P?] Description with file path
```

**Format Components**:

1. **Checkbox**: ALWAYS start with `- [ ]` (markdown checkbox)
2. **Task ID**: Sequential number (T001, T002, T003...) in execution order
3. **[PR#] label**: REQUIRED - which PR this task belongs to (PR1, PR2, PR3...)
4. **[P] marker**: Include ONLY if task is parallelizable within the same PR
5. **Description**: Clear action with exact file path

**Examples**:

- ✅ CORRECT: `- [ ] T001 [PR1] Create project structure per implementation plan`
- ✅ CORRECT: `- [ ] T005 [PR2] [P] Implement auth middleware in src/middleware/auth.py`
- ✅ CORRECT: `- [ ] T012 [PR5] [P] Create User model in src/models/user.py`
- ✅ CORRECT: `- [ ] T013 [PR5] Add User model tests in tests/unit/test_user.py`
- ❌ WRONG: `- [ ] Create User model` (missing ID and PR label)
- ❌ WRONG: `- [ ] T001 Create model` (missing PR label)
- ❌ WRONG: Implementation in PR5, tests in PR6 (tests MUST be same PR)

### PR-Based Organization

**Target: ~50 PRs per feature** (adjust based on complexity)

1. **Each PR MUST**:
   - Be 100-200 lines of code maximum (HARD LIMIT)
   - Address a SINGLE, cohesive concern
   - Include both implementation AND tests
   - Have clear dependencies on previous PRs

2. **PR Grouping Strategy**:
   - Group related tasks that fit within 100-200 LOC
   - If a logical unit exceeds the limit, split across multiple PRs
   - Keep tests with their implementation (same PR)

3. **From plan.md PR Sequence**:
   - Use the PR sequence defined in plan.md as the primary organization
   - Map tasks to the appropriate PR
   - Validate line count estimates

### PR Structure Example

```markdown
## PR 1: Initial scaffold (~80 lines)
- [ ] T001 [PR1] Create directory structure
- [ ] T002 [PR1] Add base configuration files

## PR 2: Core types (~120 lines)  
- [ ] T003 [PR2] Define User interface in src/types/user.ts
- [ ] T004 [PR2] Add User type tests in tests/unit/test_user_types.ts

## PR 3: User model implementation (~150 lines)
- [ ] T005 [PR3] Implement User model in src/models/user.ts
- [ ] T006 [PR3] Add User model tests in tests/unit/test_user_model.ts
```

### Git Town Integration

Each PR section should include the git-town command:

```markdown
## PR N: [Description] (~X lines)
**Branch**: `git town append feature/00N-description`
**Depends on**: PR N-1
```
