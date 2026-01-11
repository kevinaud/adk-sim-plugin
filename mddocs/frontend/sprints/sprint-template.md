# Sprint [N]: [Sprint Title]

**Created**: [DATE]  
**Status**: Planning | In Progress | Complete  
**TDD Phase(s)**: [e.g., Phase 1: Foundation]

---

## Sprint Goal

<!--
  Write 2-3 sentences describing what this sprint will accomplish.
  Focus on user-facing outcomes and technical milestones.
  Reference specific TDD tasks being tackled.
-->

[Describe the primary objective of this sprint in concrete terms. What will be demonstrable when this sprint is complete?]

---

## Selected Scope

<!--
  List the specific tasks from frontend-tdd.md "Implementation Phases" that this sprint covers.
  Copy the exact task names so they can be checked off in the TDD when complete.
  Include the FR numbers for traceability.
-->

### Tasks from TDD

| Task | FR | Phase | Notes |
|------|----|-------|-------|
| [Task name from TDD] | [FR-XXX] | [Phase N] | [Any clarifications] |

---

## Research Summary

<!--
  This section captures relevant context from the existing research documents.
  The sprint planning agent will populate this by browsing the research docs.
  Each subsection should include:
  - A link to the source section
  - A brief summary of the key insights
  - How it applies to this sprint's work
-->

### Relevant Findings

#### [Topic 1]

**Source**: [Link to specific section in research doc]

[2-4 sentence summary of the key insight and how it applies to this sprint]

#### [Topic 2]

**Source**: [Link to specific section in research doc]

[2-4 sentence summary]

### Key Decisions Already Made

<!--
  Extract any decisions from research docs or TDD that constrain implementation choices.
  This prevents re-litigating decisions during implementation.
-->

| Decision | Choice | Source |
|----------|--------|--------|
| [What was decided] | [The choice made] | [Link to source] |

### Open Questions for This Sprint

<!--
  List any ambiguities discovered during research that need resolution.
  These should be discussed before implementation begins.
-->

- [ ] [Question that needs answering before starting]

---

## Pull Request Plan

<!--
  Break down the sprint's work into discrete PRs.
  Target ~200 lines max per PR, but smaller is fine.
  Each PR should be independently mergeable and testable.
  
  PR IDs use format: S[sprint#]PR[#] (e.g., S1PR1, S1PR2)
-->

### S[N]PR1: [PR Title]

**Estimated Lines**: ~[X] lines  
**Depends On**: - (or previous PR)

**Goal**: [One sentence describing what this PR accomplishes]

**Files to Create/Modify**:
- `path/to/file.ts` - [what changes]
- `path/to/file.spec.ts` - [test coverage]

**Background Reading**:
<!--
  Links to specific sections in research docs, TDD, or spec that are relevant
  to this particular PR. Someone starting a fresh Copilot session should read
  these before implementing.
-->
- [Section Name](./relative/path/to/doc.md#section-anchor) - [why relevant]
- [Another Section](./path.md#anchor) - [why relevant]

**Acceptance Criteria**:
- [ ] [Specific, verifiable outcome]
- [ ] Tests pass for new code
- [ ] Presubmit passes

---

### S[N]PR2: [PR Title]

**Estimated Lines**: ~[X] lines  
**Depends On**: S[N]PR1

**Goal**: [One sentence]

**Files to Create/Modify**:
- `path/to/file.ts` - [what changes]

**Background Reading**:
- [Link](./path.md#anchor) - [why relevant]

**Acceptance Criteria**:
- [ ] [Outcome]

---

<!--
  Continue adding PRs as needed.
  A typical sprint might have 3-8 PRs.
-->

## Implementation Notes

<!--
  Any additional context that applies across all PRs in this sprint.
  Patterns to follow, gotchas to avoid, etc.
-->

### Patterns to Follow

- [Pattern from research/TDD that should be applied]

### Gotchas to Avoid

- [Known pitfall or anti-pattern]

---

## Definition of Done

- [ ] All PRs merged to feature branch
- [ ] Corresponding TDD tasks checked off
- [ ] Tests passing (unit + any applicable E2E)
- [ ] No new lint warnings
- [ ] Sprint retrospective notes added (optional)

---

## Retrospective Notes

<!--
  Fill in after sprint completion.
  What went well? What was harder than expected?
  Any learnings to carry forward?
-->

[To be completed after sprint]
