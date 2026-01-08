#!/bin/bash

# Define your prefilled strings
exclude_list=(
  "lock"
  "logs"
  "docs"
  "\.github/agents"
  "\.github/prompts"
  "\.specify"
)

# Join the array elements into a comma-separated string
exclude_param=$(IFS=,; echo "${exclude_list[*]}")

# Execute command:
# --exclude is handled by the script
# "$@" appends any and all arguments passed when the script is run
allpaste --exclude="$exclude_param" "$@"
