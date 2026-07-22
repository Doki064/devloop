# SPEC.md — artifact contract

- **Purpose:** the durable feature contract; every downstream stage is graded against it.
- **Location:** `specs/<slug>/SPEC.md` · **Durability:** DURABLE (accumulates).

```markdown
# Spec: <feature name>

## Goal
<1–2 sentences>

## In scope
- ...

## Out of scope
- ...

## Constraints
- <perf / compat / security / deadline>

## Acceptance criteria
- **AC-1** [truth|artifact|link|manual]: WHEN <trigger> THE SYSTEM SHALL <response>
  e.g. <concrete input> → <concrete observable outcome>   (optional, only for ambiguous ACs)
- **AC-2** [artifact]: THE SYSTEM SHALL <always-true property / required artifact>
- **AC-3** [truth]: IF <condition> THEN THE SYSTEM SHALL <response>

## Open questions
- [NEEDS CLARIFICATION: <what's unresolved> (Q4)]   (resolve before ship, or convert to a `manual` AC; cite the `Q<N>` when carrying an unresolved INTENT question)
```

**Example sub-lines.** An AC may carry an optional indented, unbolded `e.g.` sub-line (concrete
input → concrete observable outcome) anchoring an ambiguous criterion. Illustrative, not
normative — and being unbolded it is invisible to every `**AC-N** [tag]:` consumer (verifier
walk, plan coverage, `stage=spec` lint), the same invisibility trick as `(was AC-N)` withdraw
notes.

**Revision (a spec re-run or a mid-pipeline re-gate).** Revise in place — never renumber:
- **Amend** — a criterion whose meaning changed keeps its `AC-N` and gets new text
  (downstream `covers=` and TDD scopes hang on the ID; verify re-grades it). The amended
  criterion also gains an indented, unbolded `(amended: <one-line what changed / why>)`
  sub-line under the AC bullet — invisible to `**AC-N** [tag]:` consumers, the same trick as
  `e.g.` sub-lines and `(was AC-N)` notes.
- **Add** — next free `AC-N` above the **highest ever used**: a whole-file scan that
  counts `(was AC-N)` notes too (append-only, the same discipline as `Q<N>`/`A<N>`).
- **Withdraw** — the criterion leaves `## Acceptance criteria` and lands under
  `## Out of scope` as an unbolded `- (was AC-N) <what + why withdrawn>` note: the ID
  stays in-file so it can never be reused, and the unbolded form is invisible to every
  `**AC-N** [tag]:` consumer (verifier walk, plan coverage, lint).
- **Replace** (contract restart, IDs reset) is legal only while **no** `PLAN.md` and
  **no** implementation commits exist for the slug — after that, always revise: a replace
  would orphan the trace matrix and the TDD commit history.

**Definition of Done:**
- [ ] Every criterion has a stable `AC-N` ID (never reused/renumbered), a check-method tag, and EARS form.
- [ ] No duplicate `AC-N` inside `## Acceptance criteria` (byte-checked: `intent-lint … stage=spec`).
- [ ] Goal, In scope, and Out of scope are all present.
- [ ] No bare `[NEEDS CLARIFICATION]` remains — each is resolved or recorded as a `manual` named hole.
- [ ] No vague criteria ("fast", "user-friendly") — each is falsifiable.
- [ ] Completeness sweep done — each implied error/edge/trust/concurrency category is surfaced as an AC or an explicit out-of-scope/`manual` note (not silently absent).
- [ ] If INTENT.md exists: every `Q<N>` is resolved (INTENT Answers / RESEARCH Finding / ASSUMPTIONS entry) or appears in this SPEC as a `[NEEDS CLARIFICATION]` / `manual` AC **citing its `Q<N>`** (byte-checked: `intent-lint … stage=spec`).

## EARS quick reference (for acceptance criteria)
Constrained requirement syntax; keywords always in this order:
- **Ubiquitous** — `THE SYSTEM SHALL <response>` (an always-true property).
- **Event-driven** — `WHEN <trigger> THE SYSTEM SHALL <response>`.
- **State-driven** — `WHILE <state> THE SYSTEM SHALL <response>`.
- **Unwanted behavior** — `IF <condition> THEN THE SYSTEM SHALL <response>` (errors/faults).
- **Optional/complex** — combine (`WHERE <feature> …`, or multiple clauses).

Check-method tag (how verify confirms it):
- **truth** — verifiable by running a command/test (`WHEN GET /health THE SYSTEM SHALL return 200`).
- **artifact** — a file/output that must exist with real content.
- **link** — a connection that must hold (a route imports and calls a function).
- **manual** — genuinely not mechanically checkable → a **named hole**, never a silent gap.
