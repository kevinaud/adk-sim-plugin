# Git Town Reference

Git Town automates branch management for stacked changes. Master these commands and patterns.

## Core Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `git town hack <name>` | Create branch off `main` | First PR in sprint, independent work |
| `git town append <name>` | Create branch off current | Subsequent PRs that depend on current branch |
| `git town sync --all` | Sync all branches with remote | Before starting work, after merges |
| `git town sync --stack` | Sync only current stack | When you only need your stack updated |
| `git town propose --title "<title>" --body "<body>"` | Create PR for current branch (non-interactive) | After pushing, to create GitHub PR |
| `git town branch` | Show branch hierarchy | Understand current stack structure |
| `git town switch` | Interactive branch switcher | Navigate between branches |

## Error Recovery Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `git town continue` | Resume after conflict resolution | After resolving merge conflicts |
| `git town skip` | Skip current branch, continue sync | When conflicts can't be resolved now |
| `git town undo` | Undo last Git Town command | When something goes wrong |

## Stacked Changes Workflow

**Creating a Stack:**
```bash
# Start on main
git town hack sprint-1/pr1/first-change    # Creates: main → pr1

# Build on top
git town append sprint-1/pr2/second-change  # Creates: main → pr1 → pr2
git town append sprint-1/pr3/third-change   # Creates: main → pr1 → pr2 → pr3
```

**Visualize Stack:**
```bash
git town branch
# Output:
#   main
#    \
#     sprint-1/pr1/first-change
#      \
#       sprint-1/pr2/second-change
#        \
#   *     sprint-1/pr3/third-change
```

## Best Practices

1. **Sync frequently**: Run `git town sync --all` often to avoid phantom conflicts
2. **Ship oldest first**: Always merge PRs from oldest to newest in a stack
3. **One responsibility per branch**: Keep each branch focused on a single change
4. **Handle conflicts immediately**: When sync fails, resolve and run `git town continue`

## Merge Conflict Resolution

When `git town sync` or `git town continue` hits a conflict:

1. **Resolve the conflict** in your editor
2. **Stage resolved files**: `git add <files>`
3. **Continue Git Town**: `git town continue`

If you can't resolve:
- **Skip this branch**: `git town skip` (continues with other branches)
- **Abort everything**: `git town undo` (reverts to pre-command state)

## After Merging a PR

When a PR is merged via GitHub CLI:

1. **Squash/merge and delete remote branch**:
   ```bash
   gh pr merge <pr-number> --squash --delete-branch
   ```

2. **Sync to update local state**:
   ```bash
   git town sync --all
   ```
   - Updates local state after remote merge
   - Deletes local branch (tracking branch is gone)
   - Propagates merged changes to child branches
   - **Re-parents child branches appropriately**
   - Updates stack hierarchy automatically

3. **Resolve any merge conflicts** that may arise during sync

4. **Continue if conflicts were resolved**:
   ```bash
   git town continue
   ```

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Branch has diverged" | Run `git town sync` to reconcile |
| Phantom merge conflicts | Conflicts from squash-merge; use `git town sync` frequently |
| Child PR shows wrong diff | Update PR base: `gh pr edit <n> --base <parent>` |
| Stale local branches | `git town sync --all` removes shipped branches |
