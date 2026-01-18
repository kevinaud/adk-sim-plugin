# syntax=docker/dockerfile:1
# ============================================================
# ADK Simulator - Optimized Multi-Stage Build
# ============================================================
# Builds both frontend and backend for production deployment.
# Uses uv with BuildKit cache mounting for fast, reproducible builds.
# See mddocs/development/devplatform.md for documentation.
# ============================================================

# ============================================================
# Stage 1: Build Angular Frontend
# ============================================================
FROM node:22-slim AS frontend-build

WORKDIR /app

# Copy package files for dependency caching (npm workspaces)
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY packages/adk-sim-protos-ts/package.json ./packages/adk-sim-protos-ts/
COPY packages/adk-converters-ts/package.json ./packages/adk-converters-ts/

# Install dependencies at workspace root
RUN npm ci

# Copy source files
COPY frontend/ ./frontend/
COPY packages/adk-sim-protos-ts/ ./packages/adk-sim-protos-ts/
COPY packages/adk-converters-ts/ ./packages/adk-converters-ts/

# Build workspace packages in dependency order (protos -> converters -> frontend)
# These packages export from dist/ which must be built before frontend can import them
RUN npm run build --workspace=@adk-sim/protos && \
    npm run build --workspace=@adk-sim/converters

# Build frontend for production
WORKDIR /app/frontend
RUN npm run build

# ============================================================
# Stage 2: Python Backend Runtime
# ============================================================
FROM python:3.14-slim AS runtime

WORKDIR /app

# Install uv from official image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# ============================================================
# UV Configuration for Containerized Environments
# ============================================================
# UV_LINK_MODE=copy: Prevents hardlink issues in Docker overlayfs.
#   By default uv uses hardlinks which can behave unpredictably
#   across Docker layers. Copy mode ensures standalone files.
#
# UV_COMPILE_BYTECODE=1: Pre-compiles .pyc files during install.
#   Reduces Python startup time in ephemeral containers by
#   avoiding lazy compilation on first import.
# ============================================================
ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1

# ============================================================
# Dependency Layer (Maximizes Docker Cache Hit Rate)
# ============================================================
# Copy only dependency definitions first. This layer is
# invalidated only when dependencies change, not when
# application source changes.
# ============================================================
COPY pyproject.toml uv.lock ./
COPY packages/adk-sim-protos/pyproject.toml ./packages/adk-sim-protos/
COPY packages/adk-sim-testing/pyproject.toml ./packages/adk-sim-testing/
COPY server/pyproject.toml ./server/
COPY plugins/python/pyproject.toml ./plugins/python/
COPY ops/pyproject.toml ./ops/

# ============================================================
# BuildKit Cache Mount for uv
# ============================================================
# --mount=type=cache persists the uv cache across builds on
# the same host. This transforms dependency installation from
# a network-bound operation (~45-60s) to a local I/O operation
# (~2-5s) when the layer cache is invalidated but packages
# exist in the cache.
#
# --no-install-project: Install only third-party dependencies,
# not the local packages (which require source code).
# ============================================================
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-install-workspace

# ============================================================
# Source Layer
# ============================================================
# Copy source after dependencies. Changes to source code only
# invalidate this layer, preserving the dependency cache above.
# ============================================================
COPY packages/adk-sim-protos/src/ ./packages/adk-sim-protos/src/
COPY packages/adk-sim-testing/src/ ./packages/adk-sim-testing/src/
COPY server/src/ ./server/src/
COPY plugins/python/src/ ./plugins/python/src/
COPY ops/src/ ./ops/src/

# Install workspace packages now that source is available
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen

# ============================================================
# Copy Frontend Bundle
# ============================================================
# Copy built frontend from Stage 1 into the static directory.
# The Python server serves these files at the root path.
# ============================================================
COPY --from=frontend-build /app/frontend/dist/frontend/ ./server/src/adk_sim_server/static/
