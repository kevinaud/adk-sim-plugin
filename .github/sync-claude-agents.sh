#!/bin/bash
# ============================================================
# Sync GitHub Copilot agents to Claude Code format
# ============================================================
# Source of truth: .github/agents/*.agent.md (GitHub Copilot)
# Target: .claude/agents/*.md (Claude Code)
#
# Conversions:
#   - Renames *.agent.md -> *.md
#   - Assumes 'name' field exists in frontmatter (add it if missing)
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SOURCE_DIR="$REPO_ROOT/.github/agents"
TARGET_DIR="$REPO_ROOT/.claude/agents"

if [ ! -d "$SOURCE_DIR" ]; then
    echo "⚠️  Source directory not found: $SOURCE_DIR"
    exit 1
fi

mkdir -p "$TARGET_DIR"

# Count files synced
synced=0

for src_file in "$SOURCE_DIR"/*.agent.md; do
    [ -e "$src_file" ] || continue  # Skip if no matches

    basename=$(basename "$src_file" .agent.md)
    target_file="$TARGET_DIR/$basename.md"

    cp "$src_file" "$target_file"

    # Add model: opus to frontmatter if not present
    if ! grep -q "^model:" "$target_file"; then
        # Find the line number of the second --- (closing frontmatter)
        # Insert model: opus right before it
        awk '
            /^---$/ {
                if (++count == 2) {
                    print "model: opus"
                }
            }
            { print }
        ' "$target_file" > "$target_file.tmp" && mv "$target_file.tmp" "$target_file"
    fi

    synced=$((synced + 1))
done

if [ $synced -gt 0 ]; then
    echo "✅  Synced $synced agent(s) from .github/agents/ to .claude/agents/"
else
    echo "⚠️  No .agent.md files found in $SOURCE_DIR"
fi
