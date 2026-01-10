# Markdown Documentation Conventions

This document specifies the conventions for the `mddocs/` documentation corpus.

## File Organization

All validated documentation lives under `mddocs/`. Structure is flexible, but common patterns:

```
mddocs/
├── prd.md                    # Root product requirements
├── tdd.md                    # Root technical design
└── features/
    └── auth/
        ├── prd.md            # Feature-specific PRD
        └── tdd.md            # Feature-specific TDD
```

## Linking Syntax

Use standard markdown links with relative paths:

```markdown
[link text](relative/path/to/file.md)
[link text](relative/path/to/file.md#section-anchor)
[link text](#section-in-same-file)
```

### Anchor Generation

Heading anchors are generated using GitHub-Flavored Markdown rules:

1. Convert to lowercase
2. Replace spaces with hyphens
3. Remove punctuation (except hyphens)
4. Collapse consecutive hyphens

| Heading | Anchor |
|---------|--------|
| `## User Authentication` | `#user-authentication` |
| `### OAuth 2.0 Integration` | `#oauth-20-integration` |
| `## API Rate Limiting (v2)` | `#api-rate-limiting-v2` |
| `## What's New?` | `#whats-new` |

### Hierarchical Anchors

When a document has multiple headings with the same slug (e.g., multiple `### Requirements` sections), use path-style anchors:

```markdown
## User Authentication
### Requirements          ← #user-authentication/requirements

## Billing
### Requirements          ← #billing/requirements
```

Link using the path:
```markdown
See [auth requirements](prd.md#user-authentication/requirements)
```

## Document Structure

### Required Frontmatter

Documents should have YAML frontmatter with metadata:

```yaml
---
title: Feature Name
type: prd | tdd | impl-plan
parent: ../prd.md  # Optional: primary parent document
related:           # Optional: other related documents
  - ../tdd.md
  - ./sub-feature/prd.md
---
```

### Recommended Sections

**For PRDs:**
- Overview / Background
- Goals & Non-Goals
- User Stories / Requirements
- Success Metrics
- Related Documents

**For TDDs:**
- Overview
- Background / Context
- Design Goals & Constraints
- Detailed Design
- Alternatives Considered
- Related Documents

## Related Documents Section

Every document should have a "Related Documents" section (typically near the top) linking to:
- Parent documents (more general)
- Sibling documents (same scope, different perspective)
- Child documents (more specific)

```markdown
## Related Documents

- [Main PRD](../prd.md) - Overall product requirements
- [Main TDD](../tdd.md) - System architecture
- [Auth TDD](./tdd.md) - Technical design for this feature
```

## Validation

Before committing, run the link validator:

```bash
python .claude/skills/markdown-docs/scripts/validate_links.py mddocs/
```

This ensures all cross-document references are valid.
