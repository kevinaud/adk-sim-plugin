FROM mcr.microsoft.com/devcontainers/python:3.14

# ============================================================
# Backup-Restore Pattern for Dev Container Dependencies
# ============================================================
# - Dependencies are installed at build time for caching
# - frontend/node_modules is backed up to /opt/backup (survives mount)
# - init.sh restores from backup after workspace mount
# ============================================================

# Install uv from official image (faster, always up-to-date)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Configure uv for optimal caching
ENV UV_LINK_MODE=copy
ENV UV_CACHE_DIR=/opt/uv-cache

# Install Node.js 22 from NodeSource (required for Angular 21+)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Angular CLI globally
RUN npm install -g @angular/cli

# Install Buf globally
RUN npm install -g @bufbuild/buf

# Install Claude Code CLI globally
# RUN npm install -g @anthropic-ai/claude-code
# RUN curl -fsSL https://claude.ai/install.sh | bash

# Create backup directory for node_modules
RUN mkdir -p /opt/backup

# Pre-create the config directory with correct permissions
# This prevents the Docker Volume from being created as 'root'
RUN mkdir -p /home/vscode/.claude && \
  chown -R vscode:vscode /home/vscode/.claude

# Set working directory for dependency installation
WORKDIR /workspace

# Copy Python project files for UV workspace dependency resolution
# Root project files
COPY pyproject.toml uv.loc* ./

# Workspace member project files (required for UV to resolve dependencies)
COPY server/pyproject.toml ./server/
COPY plugins/python/pyproject.toml ./plugins/python/
COPY packages/adk-sim-protos/pyproject.toml ./packages/adk-sim-protos/
COPY packages/adk-sim-testing/pyproject.toml ./packages/adk-sim-testing/

# Install Python dependencies (frozen if lock exists, skip local packages)
RUN if [ -s uv.lock ]; then \
      uv sync --frozen --no-install-project --no-install-workspace; \
    else \
      uv sync --no-install-project --no-install-workspace; \
    fi

# Copy npm workspace files for dependency layer caching
# Root workspace config
COPY package.json package-lock.jso* ./

# Workspace member package files (required for npm workspace resolution)
COPY frontend/package.json frontend/package-lock.jso* ./frontend/
COPY packages/adk-sim-protos-ts/package.json ./packages/adk-sim-protos-ts/
# Create minimal source for local workspace package to satisfy npm install
RUN mkdir -p packages/adk-sim-protos-ts/src && \
    echo "export {};" > packages/adk-sim-protos-ts/src/index.ts

# Install all npm workspace dependencies and backup frontend node_modules
# With workspaces, node_modules may be in frontend/ or hoisted to root
RUN npm install && \
    mkdir -p /opt/backup/frontend_node_modules && \
    if [ -d frontend/node_modules ]; then \
      cp -r frontend/node_modules/* /opt/backup/frontend_node_modules/; \
    fi
