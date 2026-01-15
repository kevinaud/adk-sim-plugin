---
name: sprint-orchestration
description: Orchestrate sprint implementation by managing Git branches, PRs, and CI while delegating coding to the sprint-implement agent. Use when implementing PRs from a sprint plan. Triggers on commands like "/sprint-orchestration sprint 1" or requests to "implement the sprint" or "work on sprint PRs". This skill manages the process but does NOT write code - it delegates to sprint-implement for implementation.
---

# Sprint Orchestration

Coordinate the implementation of PRs defined in a sprint plan. Delegate all code writing to `sprint-implement` while handling Git branch management, Pull Request lifecycle, and CI monitoring.

**You do NOT write code. You manage the process.**

## CRITICAL SAFETY RULE

### NEVER MERGE A PR WITHOUT EXPLICIT USER APPROVAL

This is the **MOST IMPORTANT RULE**. Violation is a **CRITICAL FAILURE**.

**STRICTLY FORBIDDEN:**
- NEVER merge any PR without explicit user approval
- NEVER assume approval is implied
- NEVER interpret silence as consent to merge
- NEVER auto-merge after CI passes

**MANDATORY APPROVAL FLOW:**
1. Complete all PRs and present them for review
2. **STOP COMPLETELY** and wait for user response
3. User MUST explicitly say: "approved", "lgtm", "merge it", "go ahead", or similar
4. **ONLY AFTER** receiving explicit approval, proceed with merging

**IF IN DOUBT, DO NOT MERGE. ASK FOR CLARIFICATION.**

---

## Reference Documents

Load these references when needed:

- **[Merge Process](references/merge-process.md)** - **MUST READ before merging any PR.** Contains critical steps to prevent GitHub from auto-closing child PRs. Do NOT merge from memory.
- **[Git Town Commands](references/git-town.md)** - Detailed Git Town commands for branch management, stacking, and conflict resolution.

---

## Input

- **Sprint Number** (required): Which sprint to work on (e.g., "sprint 1", "S1")
- **PR Scope** (optional): Which PRs to process (e.g., "S1PR1", "all", "next 2")
  - Default: Process all remaining PRs in the sprint

---

## Pre-Flight Checks

### 1. Locate Sprint Plan

```bash
ls mddocs/frontend/sprints/sprint*.md
```

If not found: STOP with "Sprint plan not found. Run `/frontend-sprint-plan` first."

### 2. Verify Tools

```bash
git --version
git town version
gh auth status
```

- If Git Town not installed: STOP with error
- If GitHub CLI not authenticated: provide setup instructions

### 3. Parse Sprint Plan

Extract from sprint plan:
- Sprint goal and scope
- List of PRs with details
- Which PRs are already complete (check "Definition of Done" section)

---

## Main Orchestration Loop

For each PR in scope (in dependency order):

### Phase 1: PR Analysis

1. **Extract PR details**: ID, goal, files, background reading, acceptance criteria, dependencies, estimated lines
2. **Determine branch name**: `sprint-<N>/<pr-id>/<brief-description>`
3. **Check dependencies**: Verify dependent PRs exist or are merged; skip if not met
4. **Log scope** (no pause): Display PR ID, goal, estimated LOC

### Phase 2: Branch Setup

1. **Sync all branches**:
   ```bash
   git town sync --all
   ```
   If conflicts: resolve, then `git town continue`

2. **Determine parent branch**:
   - First PR or no dependencies: parent is `main` → use `git town hack`
   - Depends on previous PR: use `git town append`

3. **Create branch**:
   ```bash
   # First PR (off main):
   git town hack sprint-<N>/<pr-id>/<description>

   # Subsequent PRs (stacked):
   git town append sprint-<N>/<pr-id>/<description>
   ```

4. **Verify**: `git town branch`, `git branch --show-current`, `git status`

See [references/git-town.md](references/git-town.md) for detailed Git Town commands.

### Phase 3: Delegate to Implementation Agent

1. **Prepare context**:
   - PR goal and acceptance criteria
   - Files to create/modify
   - **Background reading links** (critical)
   - Any error logs from previous CI failures

2. **Invoke `sprint-implement` agent** using the Task tool:
   ```
   Task tool with subagent_type="sprint-implement"
   ```
   Pass full PR details including background reading. **WAIT** for completion.

3. **Verify implementation**: Check `git status`, verify changes align with PR goal

### Phase 3b: Code Simplification

After the implementation agent completes, invoke the code-simplifier to review and potentially simplify the changes.

1. **Determine parent branch** (CRITICAL for correct diff scope):
   ```bash
   # Get the parent branch from git town's configuration
   git config --get git-town-branch.$(git branch --show-current).parent
   ```
   - If no parent is configured, fall back to `main`
   - **NEVER diff against `main` if this is a stacked branch** - doing so would include changes from parent PRs in the diff scope

2. **Invoke `code-simplifier` agent** using the Task tool:
   ```
   Task tool with subagent_type="code-simplifier:code-simplifier"
   ```

   **CRITICAL INSTRUCTIONS TO PASS TO CODE-SIMPLIFIER:**

   ```markdown
   ## Scope Constraint (MANDATORY)

   You MUST only review and modify code that is part of THIS PR's changes.

   **Determine the diff scope:**
   - Parent branch: `<parent-branch-from-step-1>`
   - Run: `git diff <parent-branch>...HEAD --name-only` to see files in scope
   - Run: `git diff <parent-branch>...HEAD` to see the actual changes

   **STRICTLY FORBIDDEN:**
   - DO NOT modify any code outside the files listed in the diff
   - DO NOT modify any lines within those files that weren't changed by this PR
   - DO NOT "improve" code in other areas of the codebase, even if you see obvious improvements
   - DO NOT touch code from parent PRs in the stack

   **Your scope is ONLY:**
   - Code added or modified in this PR (diff against parent branch)
   - Simplifications that maintain the same functionality
   - Clarity improvements within the PR's changed code

   ## What to Look For

   Within the PR scope, look for opportunities to:
   - Reduce code complexity without changing behavior
   - Improve readability and clarity
   - Remove unnecessary abstractions or indirection
   - Consolidate duplicate logic introduced in this PR
   - Simplify conditional logic
   - Use more idiomatic patterns for the language/framework

   ## Output

   If no meaningful simplifications are found, report that the code is already clean.
   If simplifications are made, briefly list what was changed and why.
   ```

3. **Verify simplifications** (if any were made):
   - Run `git diff` to review the simplifier's changes
   - Ensure changes are within the PR scope (diff against parent branch)
   - If changes are out of scope, revert them: `git checkout -- <file>`

### Phase 4: Commit and Push

1. **Review changes**: `git diff --stat` (target ~200 lines max)

2. **Stage and commit**:
   ```bash
   git add -A
   git commit -m "<PR-ID>: <brief description>

   <PR goal>

   Acceptance Criteria:
   - <criteria 1>
   - <criteria 2>
   "
   ```

3. **Push**: `git push -u origin HEAD`

### Phase 5: Create PR and Monitor CI

1. **Create Draft PR**:
   ```bash
   git town propose --title "<PR-ID>: <description>" --body "## Goal
   <PR goal>

   ## Sprint Context
   Sprint: <N>
   Sprint Plan: mddocs/frontend/sprints/sprint<N>.md

   ## Acceptance Criteria
   - [ ] <criteria>

   ## Background Reading
   - <links>
   "
   ```

   Then mark as draft: `gh pr ready --undo`

2. **Monitor CI** (poll, NEVER use `gh run watch`):
   ```bash
   gh run list --branch $(git branch --show-current) --limit 1 --json databaseId,status
   gh run view <run-id> --json status,conclusion
   ```

3. **Handle CI Failure**:
   ```bash
   gh run view <run-id> --log-failed
   ```
   Re-invoke `sprint-implement` with error context. Max 3 attempts.

4. **CI Success**: `gh pr ready`

### Phase 6: Record Progress

Log PR completion (number, URL, branch). Add to batch for review. Continue to next PR.

### Phase 7: Batch Review Gate (APPROVAL REQUIRED)

After ALL requested PRs are complete:

1. **Present summary**:
   ```markdown
   ## Sprint <N> Progress

   | PR | Branch | Status | LOC |
   |----|--------|--------|-----|
   | S1PR1 | sprint-1/pr1/scaffold | Ready | 45 |

   All PRs ready for review.

   AWAITING YOUR APPROVAL - I will NOT merge until you explicitly approve.
   ```

2. **Request explicit approval**:
   - "Reply **'approved'** to merge all PRs"
   - "Reply **'approved S1PR1'** to merge specific PRs"
   - "Reply **'changes S1PR2: <feedback>'** for revisions"

3. **MANDATORY FULL STOP**:
   - DO NOT PROCEED
   - DO NOT MERGE ANYTHING
   - WAIT FOR USER RESPONSE

### Phase 8: Merge PRs (ONLY AFTER APPROVAL)

> **MANDATORY: READ [references/merge-process.md](references/merge-process.md) BEFORE MERGING ANY PR**
>
> The merge process contains critical steps that MUST be followed exactly. Skipping steps will cause GitHub to auto-close child PRs or create orphaned branches. **DO NOT attempt to merge from memory. READ THE REFERENCE FIRST.**

**PRE-MERGE VERIFICATION**: Did user EXPLICITLY approve? If NO or UNSURE: STOP.

**BEFORE YOUR FIRST MERGE**: Read [references/merge-process.md](references/merge-process.md) in its entirety. This is not optional.

Follow the merge process reference for each approved PR (oldest/parent first):
1. Find and update all child PR bases BEFORE merging
2. Squash merge with `gh pr merge --squash --delete-branch`
3. Sync local state with `git town sync --all`
4. Resolve any conflicts and run `git town continue`
5. Log completion

---

## Final Report

```markdown
## Sprint <N> Orchestration Complete

### PRs Merged
| PR | Description | LOC |
|----|-------------|-----|
| S1PR1 | Project scaffold | 45 |

### Sprint Progress
- PRs completed: X
- PRs remaining: Y

### Next Steps
- Update TDD checkboxes
- Run `/sprint-orchestration sprint 1` to continue (if PRs remain)
```

---

## Rules Summary

### PROHIBITED
- MERGE ANY PR WITHOUT EXPLICIT USER APPROVAL (Critical)
- Write or modify source code (delegate to implementer)
- Run tests directly (implementer's job)
- Use `gh run watch` (blocks agent)
- Use raw `git checkout -b` (use Git Town)
- Pause between PRs unnecessarily
- Allow code-simplifier to modify code outside the current PR scope
- Diff against `main` for stacked branches (use parent branch from git town config)

### REQUIRED
- ALWAYS WAIT FOR EXPLICIT USER APPROVAL BEFORE MERGING
- **READ [references/merge-process.md](references/merge-process.md) BEFORE ANY MERGE** (Critical)
- Use `git town` commands for branch management
- Pass background reading links to implementer
- **Invoke code-simplifier after implementation** with strict scope constraints
- **Determine parent branch from git town config** before code simplification
- Create Draft PRs first, mark ready after CI passes
- Process PRs in dependency order
- Sync after merging to propagate to stacked branches
