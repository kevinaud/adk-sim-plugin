#!/usr/bin/env bash
# ============================================================
# should-run-e2e.sh - Determine if e2e tests should run
# ============================================================
# Exits 0 (success) if e2e tests should run
# Exits 1 (failure) if e2e tests can be skipped
#
# Logic: Skip e2e tests ONLY when ALL changed files match
# patterns that we're confident cannot affect runtime behavior.
# ============================================================

set -euo pipefail

# File patterns that CANNOT affect runtime behavior
# These are documentation, editor config, and CI/agent definitions
SKIP_PATTERNS=(
    "^mddocs/"
    "^\.github/agents/"
    "^\.claude/"
    "^README\.md$"
    "^CLAUDE\.md$"
    "^frontend/CLAUDE\.md$"
    "^server/CLAUDE\.md$"
    "^protos/CLAUDE\.md$"
    "^\.vscode/"
    "^git-town\.toml$"
)

# Build a single regex from all patterns
build_skip_regex() {
    local regex=""
    for pattern in "${SKIP_PATTERNS[@]}"; do
        if [[ -n "$regex" ]]; then
            regex="$regex|$pattern"
        else
            regex="$pattern"
        fi
    done
    echo "$regex"
}

# Get files changed between HEAD and the remote tracking branch
# Falls back to comparing against origin/main if no tracking branch
get_changed_files() {
    local upstream
    upstream=$(git rev-parse --abbrev-ref '@{upstream}' 2>/dev/null || echo "origin/main")

    # Get the merge base to find what's actually being pushed
    local merge_base
    merge_base=$(git merge-base HEAD "$upstream" 2>/dev/null || echo "$upstream")

    git diff --name-only "$merge_base" HEAD 2>/dev/null
}

main() {
    local skip_regex
    skip_regex=$(build_skip_regex)

    local changed_files
    changed_files=$(get_changed_files)

    # If no files changed, run e2e tests (safety default)
    if [[ -z "$changed_files" ]]; then
        echo "No changed files detected - running e2e tests (safety default)"
        exit 0
    fi

    # Check each file - if ANY file doesn't match skip patterns, run e2e
    local non_skippable_files=""
    while IFS= read -r file; do
        if [[ -n "$file" ]] && ! echo "$file" | grep -qE "$skip_regex"; then
            non_skippable_files="$non_skippable_files$file"$'\n'
        fi
    done <<< "$changed_files"

    if [[ -n "$non_skippable_files" ]]; then
        echo "Files affecting runtime detected - e2e tests required"
        exit 0
    else
        echo "Only documentation/config files changed - skipping e2e tests"
        echo "Skipped patterns: ${SKIP_PATTERNS[*]}"
        exit 1
    fi
}

main "$@"
