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

> ⚠️ **CRITICAL: ALWAYS USE `git town append` FOR SPRINT PRs**
>
> Within a sprint, **ALL branches after the first MUST use `git town append`** to maintain the stack.
>
> **WHY THIS MATTERS:**
> - The sprint plan file (sprint3.md) exists on PR1's branch, NOT on main
> - If you use `git town hack` for PR2+, you'll be on main and won't see the sprint plan
> - Stacked branches ensure all sprint context propagates through the chain
>
> **THE ONLY TIME TO USE `git town hack`:**
> - Creating the VERY FIRST PR of a sprint (PR1)
> - That's it. Never for PR2, PR3, PR4, etc.

1. **Sync all branches**:
   ```bash
   git town sync --all
   ```
   If conflicts: resolve, then `git town continue`

2. **Determine which command to use**:

   | Scenario | Command | Example |
   |----------|---------|---------|
   | **First PR of sprint** | `git town hack` | `git town hack sprint-3/pr1/gateway-methods` |
   | **ANY subsequent PR** | `git town append` | `git town append sprint-3/pr2/route-guard` |

   **NEVER use `git town hack` for PR2 or later, even if the sprint plan says "Depends On: -"**

3. **Create branch** (from the correct parent):
   ```bash
   # ONLY for the very first PR of a sprint:
   git checkout main
   git town hack sprint-<N>/pr1/<description>

   # For ALL other PRs (PR2, PR3, PR4, etc.):
   # First ensure you're on the previous PR's branch!
   git checkout sprint-<N>/pr<N-1>/<previous-description>
   git town append sprint-<N>/pr<N>/<description>
   ```

4. **Verify the stack is correct**:
   ```bash
   git town branch
   ```
   Expected output for PR3:
   ```
     main
       sprint-3/pr1/...
         sprint-3/pr2/...
   *       sprint-3/pr3/...   <-- Current branch, child of PR2
   ```

   **If your branch shows as a direct child of `main` when it should be stacked, DELETE IT and recreate with `git town append`.**

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
- **Use `git town hack` for any PR after PR1** (Critical - breaks sprint context)
- Write or modify source code (delegate to implementer)
- Run tests directly (implementer's job)
- Use `gh run watch` (blocks agent)
- Use raw `git checkout -b` (use Git Town)
- Pause between PRs unnecessarily

### REQUIRED
- ALWAYS WAIT FOR EXPLICIT USER APPROVAL BEFORE MERGING
- **READ [references/merge-process.md](references/merge-process.md) BEFORE ANY MERGE** (Critical)
- **Use `git town append` for PR2+ (ALWAYS stack within a sprint)**
- **Verify stack with `git town branch` after creating any branch**
- Use `git town` commands for branch management
- Pass background reading links to implementer
- Create Draft PRs first, mark ready after CI passes
- Process PRs in dependency order
- Sync after merging to propagate to stacked branches
