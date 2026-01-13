# Implementation Tips Knowledge Base

This document serves as a knowledge base for the implementation agent to record findings that were difficult to obtain but useful for future development. Each entry helps prevent repeated debugging of the same issues across different invocations.

---

## Table of Contents

1. [Commands fail with "No such file or directory"](#commands-fail-with-no-such-file-or-directory)

---

## Tips

### Commands fail with "No such file or directory"

**Problem**: When running commands like `./scripts/presubmit.sh`, `make generate`, or similar repo-level commands, you get errors like:
```
bash: ./scripts/presubmit.sh: No such file or directory
```
or
```
make: *** No rule to make target 'generate'. Stop.
```

**Root Cause**: The terminal is in a subdirectory (e.g., `packages/adk-converters-ts/`) instead of the repository root.

**Solution**: Always run repo-level commands from the repository root:
```bash
cd /workspaces/adk-sim-plugin
./scripts/presubmit.sh
```

**General Principle**: When commands that should exist "don't exist", first check your current working directory with `pwd`. Repo-level scripts and Makefile targets must be run from the repo root.

---

<!-- 
Template for new entries:

### <Title>

**Problem**: <What error or symptom was seen>

**Root Cause**: <Why it happened>

**Solution**: <How to fix it>

**General Principle**: <Up-leveled insight for similar future issues>

---
-->
