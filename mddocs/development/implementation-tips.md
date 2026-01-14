# Implementation Tips Knowledge Base

This document serves as a knowledge base for the implementation agent to record findings that were difficult to obtain but useful for future development. Each entry helps prevent repeated debugging of the same issues across different invocations.

---

## Table of Contents

1. [Commands fail with "No such file or directory"](#commands-fail-with-no-such-file-or-directory)

---

## Tips

### Commands fail with "No such file or directory"

**Problem**: When running commands like `ops build` or similar repo-level commands, you get errors like:
```
bash: ops: command not found
```

**Root Cause**: Either the terminal is in a subdirectory without the virtual environment activated, or the ops CLI isn't installed.

**Solution**: Always run repo-level commands from the repository root with `uv run`:
```bash
cd /workspaces/adk-sim-plugin
uv run ops ci check
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
