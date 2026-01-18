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

GitHub automatically closes PRs when their base branch is deleted.

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

**Load the `jujutsu` skill** and use its sync workflow:

```bash
jj git fetch
```

This updates your local repository with the merged changes from the remote.

### Step 5: Handle Squash-Merge Recovery

After a squash-merge, local commits may diverge from remote. Use jujutsu skill's squash-merge recovery workflow if needed:

1. Identify remaining local work that needs rebasing
2. Rebase onto the updated main using `jj rebase`
3. Abandon any redundant local commits using `jj abandon`

See `.claude/skills/jujutsu/references/workflows.md` for detailed recovery protocol.

### Step 6: Handle Any Conflicts

If conflicts occur during rebase, use jujutsu skill's conflict resolution workflow:

1. Check for conflicts: `jj resolve --list`
2. Read conflicted files and resolve markers
3. Write clean files (jj auto-snapshots resolution)
4. Verify: `jj status`

### Step 7: Verify and Log

```bash
jj log --limit 5
jj status
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

# 4. Sync local state (load jujutsu skill first)
jj git fetch

# 5. If local work needs rebasing, use jujutsu skill's recovery workflow

# 6. Verify
jj log --limit 5
jj status
```

---

## Common Mistakes and How to Avoid Them

| Mistake | Consequence | Prevention |
|---------|-------------|------------|
| Merge without updating child PR bases | GitHub auto-closes child PRs | ALWAYS run `gh pr list --base` first |
| Merge child before parent | Broken diffs, merge conflicts | Process in dependency order |
| Skip fetch after merge | Stale local state | ALWAYS fetch after merge |

---

## Troubleshooting

### Child PR was auto-closed by GitHub

If you forgot to update the base before merging:
1. The PR is closed but branch still exists locally
2. Push the branch again: `jj git push --bookmark <bookmark-name>`
3. Create new PR: `gh pr create`

### Conflicts after fetch

Use jujutsu skill's conflict resolution workflow:
1. Check which file(s) have conflicts: `jj resolve --list`
2. Open and resolve each conflict
3. jj auto-snapshots resolved files
4. Verify with `jj status`

### "Bookmark has diverged" state

This is expected after squash-merge. Use jujutsu skill's squash-merge recovery workflow to rebase remaining work.
