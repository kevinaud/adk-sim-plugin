---
description: Execute the implementation planning workflow using the plan template to generate design artifacts.
handoffs: 
  - label: Create Tasks
    agent: speckit.tasks
    prompt: Break the plan into tasks
    send: true
  - label: Create Checklist
    agent: speckit.checklist
    prompt: Create a checklist for the following domain...
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Constitutional Requirements (MANDATORY)

Plans MUST support these constitutional principles:

### Sequential PR Planning (Constitution VII.)
- Plan MUST enumerate specific PRs required (~50 for typical feature)
- Each PR: 100-200 lines max, single-purpose, tests included
- PR sequence with dependencies must be documented

### Git Town Branch Management (Constitution VI.)
- Document `git town append` commands for PR branch creation
- PRs stack dependently off each other

### No Mocks Without Permission (Constitution IV.)
- Flag any components where mocks might be tempting
- Document fake implementations needed

## Outline

1. **Setup**: Run `.specify/scripts/bash/setup-plan.sh --json` from repo root and parse JSON for FEATURE_SPEC, IMPL_PLAN, SPECS_DIR, BRANCH. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Load context**: Read FEATURE_SPEC and `.specify/memory/constitution.md`. Load IMPL_PLAN template (already copied).

3. **Execute plan workflow**: Follow the structure in IMPL_PLAN template to:
   - Fill Technical Context (mark unknowns as "NEEDS CLARIFICATION")
   - Fill Constitution Check section from constitution (include PR planning gates)
   - Evaluate gates (ERROR if violations unjustified)
   - Phase 0: Generate research.md (resolve all NEEDS CLARIFICATION)
   - Phase 1: Generate data-model.md, contracts/, quickstart.md
   - Phase 1: Update agent context by running the agent script
   - **Phase 2: Generate PR Sequence** (~50 PRs, 100-200 LOC each)
   - Re-evaluate Constitution Check post-design

4. **Stop and report**: Command ends after Phase 2 planning. Report branch, IMPL_PLAN path, generated artifacts, and **PR count**.

## Phases

### Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```text
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

### Phase 1: Design & Contracts

**Prerequisites:** `research.md` complete

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Agent context update**:
   - Run `.specify/scripts/bash/update-agent-context.sh copilot`
   - These scripts detect which AI agent is in use
   - Update the appropriate agent-specific context file
   - Add only new technology from current plan
   - Preserve manual additions between markers

**Output**: data-model.md, /contracts/*, quickstart.md, agent-specific file

### Phase 2: PR Sequence Planning (MANDATORY)

**Prerequisites:** Phase 1 complete

**Target: ~50 PRs** (adjust based on feature complexity)

1. **Decompose feature into small PRs**:
   - Each PR MUST be 100-200 lines max (HARD LIMIT)
   - Each PR MUST be single-purpose
   - Each PR MUST include implementation AND tests together

2. **Generate PR sequence table** in plan.md:
   ```markdown
   | PR # | Branch Name | Description | Est. Lines | Depends On |
   |------|-------------|-------------|------------|------------|
   | 1 | feature/001-scaffold | Initial project structure | ~50 | - |
   | 2 | feature/002-types | Core type definitions | ~100 | PR 1 |
   | 3 | feature/003-user-model | User model + tests | ~150 | PR 2 |
   ```

3. **PR planning rules**:
   - Build large classes incrementally (methods across multiple PRs)
   - Tests go in same PR as implementation they test
   - Document git-town command for each PR: `git town append feature/00N-name`
   - No PR contains unrelated changes

4. **Validate PR sequence**:
   - Sum of line estimates should roughly match feature scope
   - Each PR can be reviewed independently
   - Merging any single PR leaves codebase functional

**Output**: PR Sequence section in plan.md

## Key rules

- Use absolute paths
- ERROR on gate failures or unresolved clarifications
- **ERROR if no PR sequence generated**
- **WARN if any PR exceeds 200 LOC estimate**
