#!/bin/bash

# ==============================================================================
# CONFIGURATION
# ==============================================================================

# 1. INCLUDES
include_list=(
  "frontend/"
  "packages/adk-sim-protos-ts/"
  "docker/frontend.Dockerfile"
  "docs/adk-sim-v2-prd.md"
)

# 2. EXCLUDES
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

# 3. TRUNCATES
# Only truncate files that contain "google/" in their path.
# This keeps your 'adksim/' protos full-length while shrinking the huge vendored deps.
truncate_list=(
  "packages/adk-sim-protos-ts/src/google/"
)

# ==============================================================================
# EXECUTION
# ==============================================================================

include_param=$(IFS=,; echo "${include_list[*]}")
exclude_param=$(IFS=,; echo "${exclude_list[*]}")
truncate_param=$(IFS=,; echo "${truncate_list[*]}")

allpaste \
  --include="$include_param" \
  --exclude="$exclude_param" \
  --truncate-pattern="$truncate_param" \
  --truncate-limit=1000 \
  "$@"
