---
title: Documentation Index
type: index
---

# ADK Simulator Documentation


## Table of Contents

- [Document Types](#document-types)
- [Structure](#structure)
- [Conventions](#conventions)

## Document Types

- **PRD** (Product Requirements Document): Defines what we're building and why
- **TDD** (Technical Design Document): Defines how we're building it
- **Implementation Plan**: Detailed breakdown of implementation steps

## Structure

```
mddocs/
├── README.md           # This file
├── prd.md              # Root product requirements
├── tdd.md              # Root technical design
└── features/           # Feature-specific documentation
    └── <feature>/
        ├── prd.md      # Feature PRD
        └── tdd.md      # Feature TDD
```

## Conventions

All documents follow the conventions defined in the [markdown-docs skill](../.claude/skills/markdown-docs/conventions.md).

Key rules:
- Use relative links between documents
- Use `#anchor` fragments to link to specific sections
- Use hierarchical paths (`#parent/child`) for ambiguous headings
- Run `python .claude/skills/markdown-docs/scripts/validate_links.py mddocs/` before committing
