---
title: Documentation Index
type: index
---

# ADK Simulator Documentation

## Table of Contents

- [Overview](#overview)
- [Document Types](#document-types)
- [Structure](#structure)
- [Conventions](#conventions)

## Overview

This directory contains all project documentation for the ADK Agent Simulator. Start with:

- [Product Requirements (PRD)](prd.md) - What we're building and why
- [Technical Design (TDD)](tdd.md) - System architecture and implementation approach

## Document Types

- **PRD** (Product Requirements Document): Defines what we're building and why
- **TDD** (Technical Design Document): Defines how we're building it
- **Spec**: Plugin or component specifications
- **Research**: Investigation and analysis documents
- **Sprint**: Implementation planning documents

## Structure

```
mddocs/
├── prd.md                    # Product requirements
├── tdd.md                    # Technical design
│
├── frontend/                 # Web UI documentation
│   ├── frontend-spec.md      # Frontend specification
│   ├── frontend-tdd.md       # Frontend technical design
│   ├── research/             # Frontend research & analysis
│   │   ├── adk-typescript-research.md
│   │   ├── playwright-testing-research.md
│   │   ├── sheriff-research.md
│   │   └── ...
│   └── sprints/              # Sprint planning
│       ├── sprint-template.md
│       └── sprint1.md
│
├── plugins/                  # Plugin specifications
│   ├── adk-sim-python-plugin-spec.md
│   └── adk-sim-java-plugin-spec.md
│
└── development/              # Developer guides & tooling
    ├── adk/                  # ADK testing guides
    │   ├── adk_unit_testing.md
    │   └── adk_integration_testing.md
    ├── aitools/              # AI tooling guides
    │   ├── claude-agent-skills-research.md
    │   └── copilot_custom_agents.md
    ├── angular/              # Angular best practices
    │   ├── angular-architecture-practices.md
    │   └── angular-testing-research.md
    └── releases/             # Release process
        ├── publishing.md
        └── release-best-practices-research-report.md
```

## Conventions

All documents follow the conventions defined in the [markdown-docs skill](../.claude/skills/markdown-docs/conventions.md).

Key rules:
- Use relative links between documents
- Use `#anchor` fragments to link to specific sections
- Use hierarchical paths (`#parent/child`) for ambiguous headings
- Run `python .claude/skills/markdown-docs/scripts/validate_links.py mddocs/` before committing
