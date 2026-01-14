# PR Merge Process

**READ THIS ENTIRE DOCUMENT BEFORE MERGING ANY PR.**

This document contains critical steps that MUST be followed in order. Skipping steps will cause PRs to be auto-closed by GitHub or create orphaned branches.

---

## Pre-Merge Verification Checklist

Before executing ANY merge step, verify ALL of the following:

- [ ] User has EXPLICITLY approved merging (said "approved", "lgtm", "merge it", etc.)
- [ ] You are merging PRs in dependency order (oldest/parent FIRST)
- [ ] CI has passed on all PRs being merged
- [ ] You have identified all child PRs that need base branch updates

**If ANY checkbox is not checked: STOP. DO NOT MERGE.**

---

## Critical: Update Child PR Bases BEFORE Merging

GitHub automatically closes PRs when their base branch is deleted. Git Town tracks branches locally but CANNOT prevent this.

**This step is MANDATORY before every merge:**

### Step 1: Find Child PRs

```bash
gh pr list --base <branch-being-merged> --json number,headRefName
```

Example: Before merging `sprint-1/pr1/scaffold`:
```bash
gh pr list --base sprint-1/pr1/scaffold --json number,headRefName
# Returns: [{"number": 42, "headRefName": "sprint-1/pr2/state-service"}]
```

### Step 2: Update Each Child PR's Base

```bash
gh pr edit <child-pr-number> --base <parent-base-branch>
```

Example: Update PR #42 to target `main` instead of the branch being merged:
```bash
gh pr edit 42 --base main
```

**Do this for EVERY child PR before proceeding to merge.**

---

## Merge Execution

### Step 3: Squash Merge and Delete Remote Branch

```bash
gh pr merge <pr-number> --squash --delete-branch
```

This:
- Squash-merges the PR into its base branch
- Deletes the remote branch automatically
- Updates the PR status to "merged"

### Step 4: Sync Local State

```bash
git town sync --all
```

This:
- Updates local state after remote merge
- Deletes the local branch (tracking branch is gone)
- Propagates merged changes to child branches
- Re-parents child branches in Git Town's tracking
- Updates stack hierarchy automatically

### Step 5: Handle Any Merge Conflicts

If `git town sync` reports conflicts:

1. Open conflicting files and resolve them
2. Stage resolved files: `git add <files>`
3. Continue: `git town continue`

### Step 6: Verify and Log

```bash
git town branch  # Verify stack looks correct
git status       # Ensure clean state
```

Log: "S<N>PR<M> merged successfully"

---

## Complete Merge Sequence Example

Merging S1PR1 which has child S1PR2:

```bash
# 1. Find children
gh pr list --base sprint-1/pr1/scaffold --json number,headRefName
# Output: [{"number": 42, "headRefName": "sprint-1/pr2/state-service"}]

# 2. Update child base BEFORE merge
gh pr edit 42 --base main

# 3. Now safe to merge
gh pr merge 41 --squash --delete-branch

# 4. Sync local state
git town sync --all

# 5. If conflicts, resolve then:
git town continue

# 6. Verify
git town branch
```

---

## Common Mistakes and How to Avoid Them

| Mistake | Consequence | Prevention |
|---------|-------------|------------|
| Merge without updating child PR bases | GitHub auto-closes child PRs | ALWAYS run `gh pr list --base` first |
| Merge child before parent | Broken diffs, merge conflicts | Process in dependency order |
| Skip `git town sync` after merge | Stale local state, phantom conflicts | ALWAYS sync after merge |
| Forget `git town continue` after resolving conflicts | Incomplete sync, stuck state | Always continue after resolving |

---

## Troubleshooting

### Child PR was auto-closed by GitHub

If you forgot to update the base before merging:
1. The PR is closed but branch still exists locally
2. Push the branch again: `git push -u origin <branch>`
3. Create new PR: `git town propose`

### Merge conflicts during sync

1. Check which file(s) have conflicts: `git status`
2. Open and resolve each conflict
3. Stage: `git add <files>`
4. Continue: `git town continue`

### "Branch has diverged" error

Run sync to reconcile:
```bash
git town sync --all
```
