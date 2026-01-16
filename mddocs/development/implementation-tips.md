# Implementation Tips Knowledge Base

This document serves as a knowledge base for the implementation agent to record findings that were difficult to obtain but useful for future development. Each entry helps prevent repeated debugging of the same issues across different invocations.

---

## Table of Contents

1. [Commands fail with "No such file or directory"](#commands-fail-with-no-such-file-or-directory)
2. [SCSS @use rules must precede Tailwind directives](#scss-use-rules-must-precede-tailwind-directives)

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

### SCSS @use rules must precede Tailwind directives

**Problem**: When integrating Tailwind CSS v4 with Angular Material in SCSS, the build fails with:
```
@use rules must be written before any other rules.
   |
21 | @use '@angular/material' as mat;
   | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

**Root Cause**: SCSS has a strict requirement that `@use` statements must appear before any other rules, including `@layer` and `@import`. Most Tailwind v4 documentation shows `@layer` and `@import` at the top of the file, which works for plain CSS but breaks when combined with SCSS modules like Angular Material.

**Solution**: Structure the `styles.scss` file with Angular Material `@use` and theme configuration FIRST, then add the Tailwind CSS directives after:
```scss
/* Angular Material SCSS must come first */
@use '@angular/material' as mat;
@include mat.core();
/* ... Material theme config ... */
@include mat.all-component-themes($theme);

/* Tailwind directives come AFTER SCSS setup */
@layer theme, base, components, utilities;
@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/utilities.css' layer(utilities);
@source './app';
```

**General Principle**: When combining SCSS modules with CSS-in-JS or CSS frameworks, always respect SCSS's requirement that `@use` rules be at the top. Adapt framework documentation patterns to work with SCSS constraints.

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
