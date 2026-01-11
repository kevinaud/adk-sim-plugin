---
description: Plan a frontend sprint by researching existing docs and creating a focused sprint plan with PR breakdown.
handoffs:
  - label: Start Implementation
    agent: sprint-orchestrate
    prompt: Implement sprint PRs from this plan
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Create a focused sprint plan that:
1. Captures the agreed scope from the TDD's Implementation Phases
2. Gathers all relevant context from existing research documents
3. Breaks down the work into small, well-documented PRs (~200 lines max each)
4. Provides enough context that each PR can be implemented in an isolated Copilot session

## Prerequisites

- User has discussed sprint scope and identified which TDD tasks to include
- The `$ARGUMENTS` should describe the sprint goals and selected TDD tasks
- Sprint template exists at `mddocs/frontend/sprints/sprint-template.md`

## Execution Steps

### Step 1: Determine Sprint Number

Check for existing sprints in `mddocs/frontend/sprints/` to determine the next sprint number.

```bash
ls mddocs/frontend/sprints/sprint*.md 2>/dev/null | wc -l
```

The new sprint will be `sprint[N+1].md`.

### Step 2: Parse User Input

From `$ARGUMENTS`, extract:
- **Sprint Goal**: What we're trying to accomplish
- **TDD Tasks**: Specific tasks from the Implementation Phases section
- **Phase(s)**: Which TDD phase(s) this sprint covers

If the user input is vague, ask clarifying questions about:
- Which specific TDD tasks are in scope?
- Any particular priorities within the scope?

### Step 3: Research Phase (CRITICAL)

This is the most important step. Use the markdown-docs MCP tools extensively to gather relevant context.

#### 3a. Browse Document Structure

First, get the table of contents for each relevant doc to understand what's available:

**Required docs to browse**:
- `mddocs/frontend/frontend-tdd.md` - Technical design details
- `mddocs/frontend/frontend-spec.md` - Requirements and user stories

**Research docs to browse** (check TOC for relevant sections):
- `mddocs/frontend/research/prototype-findings.md`
- `mddocs/frontend/research/angular-architecture-analysis.md`
- `mddocs/frontend/research/angular-testing-analysis.md`
- `mddocs/frontend/research/adk-typescript-research.md`
- `mddocs/frontend/research/converter-research.md`
- `mddocs/frontend/research/project-infrastructure.md`
- `mddocs/frontend/research/jsonforms-research.md`
- `mddocs/frontend/research/playwright-testing-research.md`
- `mddocs/frontend/research/sheriff-research.md`
- `mddocs/frontend/research/frontend-configuration-research.md`

Use tools from `markdown-docs` Agent Skill to browse each document's structure. You can do this by calling the get_section tool with standard table of contents section ID.

#### 3b. Selective Content Retrieval

Based on the sprint scope, identify which sections are relevant and retrieve their content using the get_section tool (one call for each section).

For each TDD task in scope, look for:
- **Implementation patterns** in prototype-findings or architecture docs
- **Testing approaches** in testing-analysis or playwright docs
- **Data structures** in adk-typescript or converter research
- **Configuration details** in relevant research docs

#### 3c. Extract Key Decisions

Look for decisions already made that affect this sprint:
- Check the TDD's "Key Design Decisions" table
- Check research doc "Recommendations" or "Decisions" sections
- Note any constraints or requirements from the spec

### Step 4: Design PR Breakdown

Break the sprint scope into small PRs:

**PR Sizing Rules**:
- Target ~200 lines max (including tests)
- Each PR should be independently mergeable
- Each PR should have a clear, single purpose
- Tests go with their implementation (same PR)
- No minimum size - smaller is fine if logically complete

**PR Sequencing**:
- Order PRs by dependency (what needs to exist first?)
- Early PRs should establish foundations (types, interfaces)
- Later PRs add implementation and features
- Consider: can any PRs be done in parallel?

**For each PR, define**:
1. Clear goal (one sentence)
2. Files to create/modify
3. Relevant background reading links (specific sections, not whole docs)
4. Acceptance criteria (verifiable outcomes)

### Step 5: Write Sprint Plan

Create the sprint plan document at `mddocs/frontend/sprints/sprint[N].md` using the template structure.

**Key sections to fill**:
1. **Sprint Goal**: Clear statement of outcomes
2. **Selected Scope**: Tasks from TDD with FR numbers
3. **Research Summary**: 
   - Relevant findings with source links
   - Key decisions already made
   - Open questions needing resolution
4. **Pull Request Plan**: Each PR with full details
5. **Implementation Notes**: Patterns to follow, gotchas to avoid

### Step 6: Report

Output a summary:
- Sprint number and file path
- Number of PRs planned
- Total estimated lines
- Any open questions that need discussion before implementation

## Output Quality Rules

### Research Summary Quality

- **Link to specific sections**, not just whole documents
- **Summarize the insight**, don't just say "see this doc"
- **Explain relevance** to this sprint's work
- Include code examples if they exist in research docs

### PR Plan Quality

- **Background Reading links must be specific** - point to exact sections
- **Acceptance criteria must be verifiable** - "component renders" not "looks good"
- **File paths must be concrete** - actual paths in the codebase
- **Estimates should be realistic** - check similar files for calibration

### Avoid Common Pitfalls

- ❌ Don't plan PRs that are too large (>200 lines)
- ❌ Don't skip the research phase
- ❌ Don't create vague acceptance criteria
- ❌ Don't forget to link background reading for each PR
- ❌ Don't assume context - each PR plan should be self-contained

## Example PR Entry

```markdown
### S1PR2: Create SessionStateService with connection status signals

**Estimated Lines**: ~80 lines  
**Depends On**: S1PR1

**Goal**: Implement the global state service that tracks session and connection state using signals.

**Files to Create/Modify**:
- `frontend/src/app/data-access/session/session-state.service.ts` - Service implementation
- `frontend/src/app/data-access/session/session-state.service.spec.ts` - Unit tests

**Background Reading**:
- [Signal-based State Management](./research/prototype-findings.md#signal-based-state-management) - Pattern to follow for signal usage
- [SessionStateService Design](./frontend-tdd.md#sessionstateservice-global) - Interface and responsibility
- [FR-023 Connection Status](./frontend-spec.md#communication) - Requirement for connection indicator

**Acceptance Criteria**:
- [ ] Service provides `currentSession` signal (Session | null)
- [ ] Service provides `connectionStatus` signal (ConnectionStatus enum)
- [ ] Service provides `isConnected` computed signal
- [ ] Unit tests cover state transitions
- [ ] Presubmit passes
```
