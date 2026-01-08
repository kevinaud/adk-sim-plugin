#!/bin/bash

# Define your prefilled strings
include_list=(
  "lock"
  "logs"
  "docs"
  "\.github/agents"
  "\.github/prompts"
  "\.specify"
)

# Join the array elements into a comma-separated string
include_param=$(IFS=,; echo "${include_list[*]}")

# Execute command:
# --include is handled by the script
# "$@" appends any and all arguments passed when the script is run
allpaste --include="$include_param" "$@"
