#!/bin/bash
# ============================================================
# Dev Container Initialization Script
# ============================================================
# Syncs dependencies after workspace mount.
# 
# This runs as postCreateCommand (once after container create).
# See post-start.sh for things that run every container start.
# ============================================================

set -e

echo "🚀 Initializing dev container..."

# ------------------------------------------------------------
# Install Git Town
# ------------------------------------------------------------
curl https://www.git-town.com/install.sh | sh

# ------------------------------------------------------------
# Fix uv-cache permissions (for CI runner compatibility)
# ------------------------------------------------------------
if [ -d "/opt/uv-cache" ]; then
    if [ ! -w "/opt/uv-cache" ]; then
        echo "🔧 Fixing uv-cache permissions..."
        sudo chown -R "$(id -u):$(id -g)" /opt/uv-cache 2>/dev/null || true
    fi
fi

# ------------------------------------------------------------
# Python Dependencies: Sync with uv
# ------------------------------------------------------------
echo "🐍 Syncing Python dependencies..."
uv sync

# ------------------------------------------------------------
# Frontend Node.js Dependencies: Restore from backup
# ------------------------------------------------------------
if [ -d "/opt/backup/frontend_node_modules" ]; then
    if [ ! -d "frontend/node_modules" ] || [ -z "$(ls -A frontend/node_modules 2>/dev/null)" ]; then
        echo "📦 Restoring frontend/node_modules from backup..."
        cp -r /opt/backup/frontend_node_modules ./frontend/node_modules
    fi
fi

# Sync npm dependencies to catch any drift
if [ -f "frontend/package.json" ]; then
    echo "📦 Syncing frontend npm dependencies..."
    (cd frontend && npm install)
fi

# ------------------------------------------------------------
# Development-only setup (skipped in CI)
# ------------------------------------------------------------
if [ "$CI" != "true" ]; then
    echo "🔧 Running development-only setup..."
    
    # Clone ADK repos for AI agent reference (add your clone commands here)
    # git clone https://github.com/... /path/to/adk-repo
    
else
    echo "⏭️  Skipping development-only setup (CI detected)"
fi

echo "✅ Dev container initialization complete!"
