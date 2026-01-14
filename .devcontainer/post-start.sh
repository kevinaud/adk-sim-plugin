#!/bin/bash
# ============================================================
# Dev Container Post-Start Script
# ============================================================
# Runs every time the container starts (not just on create)
# ============================================================

# ------------------------------------------------------------
# GitHub CLI Auto-Login
# ------------------------------------------------------------
TOKEN_FILE="/home/vscode/.gh_token_file"

if [ -s "$TOKEN_FILE" ]; then
    echo "🔑 Auto-logging into GitHub CLI..."
    gh auth login --with-token < "$TOKEN_FILE"
    echo "✅ GitHub CLI authenticated"
else
    echo "⚠️  No GitHub token found at $TOKEN_FILE"
    echo "   To enable auto-login, create ~/.gh_token_file on your host"
    echo "   with a GitHub personal access token."
fi

# ------------------------------------------------------------
# Python Dependency Sync
# ------------------------------------------------------------
uv sync

# ------------------------------------------------------------
# Create .claude/agents Symlink
# ------------------------------------------------------------
# Creates a symlink so .github/agents/ appears at .claude/agents/
# Idempotent - safe to run multiple times
# ------------------------------------------------------------

mkdir -p .claude

if [ ! -L .claude/agents ]; then
    ln -sf ../.github/agents .claude/agents
    echo "✅  Created symlink: .claude/agents -> .github/agents"
elif [ ! -e .claude/agents ]; then
    # Symlink exists but target is missing
    echo "⚠️  Symlink exists but target .github/agents is missing"
else
    echo "✅  Symlink .claude/agents already exists. Skipping."
fi

# ------------------------------------------------------------
# Clone Repositories (Idempotent) - Skipped in CI
# ------------------------------------------------------------
# Only clones if the directory does not already exist in /workspaces
# ------------------------------------------------------------

if [ "$CI" != "true" ]; then
    REPOS=(
        "https://github.com/google/adk-python"
        "https://github.com/google/adk-java"
        "https://github.com/google/adk-js"
        "https://github.com/google/adk-docs"
    )

    # 1. Create the directory as root (required for /workspaces sometimes)
    sudo mkdir -p /workspaces/adk-repos

    # 2. FIX: Change ownership to the current user (vscode) so git can write to it
    sudo chown -R $USER /workspaces/adk-repos

    # Navigate to the repo directory
    cd /workspaces/adk-repos || exit 1

    for url in "${REPOS[@]}"; do
        repo_name=$(basename "$url" .git)

        if [ ! -d "$repo_name" ]; then
            echo "⬇️  Cloning $repo_name..."
            git clone "$url"
        else
            echo "✅  $repo_name already exists. Skipping clone."
        fi
    done

    cd /workspaces/adk-sim-plugin
else
    echo "⏭️  Skipping ADK repo cloning (CI detected)"
fi

# curl -fsSL https://claude.ai/install.sh | bash
