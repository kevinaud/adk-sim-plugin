#!/bin/bash

# ==============================================================================
# CONFIGURATION
# ==============================================================================

# 1. INCLUDES
# Broadly target the frontend, the typescript protos it consumes, and docker infra.
include_list=(
  "frontend/"
  "packages/adk-sim-protos-ts/"
  "docker/frontend.Dockerfile"
)

# 2. EXCLUDES
# Aggressively filter out high-token/low-value files like locks, caches, and binaries.
exclude_list=(
  "package-lock.json"
  "yarn.lock"
  "pnpm-lock.yaml"
  "node_modules"
  ".angular"
  "dist"
  "coverage"
  ".ico"
  ".png"
  ".jpg"
  ".jpeg"
  ".svg"
  ".git"
  ".DS_Store"
)

# ==============================================================================
# EXECUTION
# ==============================================================================

# Join the array elements into comma-separated strings
include_param=$(IFS=,; echo "${include_list[*]}")
exclude_param=$(IFS=,; echo "${exclude_list[*]}")

# Run allpaste
# - We pass the calculated includes/excludes
# - "$@" passes through any extra arguments you provide at runtime (e.g., --output=file.md)
allpaste \
  --include="$include_param" \
  --exclude="$exclude_param" \
  "$@"
