# devloop — Artifact Format Contract

The **single source of truth** for every stage-transition artifact. devloop's pipeline is
artifact-handoff: each stage reads the prior stage's file and writes its own, so these formats are
the **API between stages**. Stages reference this file (`${CLAUDE_PLUGIN_ROOT}/docs/ARTIFACTS.md`)
rather than re-describing formats inline — one definition, no producer/consumer drift.

## Format philosophy
- **Model-optimized Markdown, single source of truth.** Dense, structured, human- *and*
  machine-readable at once. No separate human docs; any prettier view is *derived* (regenerated),
  never a second authored source.
- **Principles, not ceremony.** Take the durable essence of the requirements/architecture standards
  — unambiguous, verifiable, traceable — enforced via falsifiable criteria + the trace matrix. Do
  **not** adopt IEEE 1016 / 42010 templates (human-doc apparatus that recreates the doc-sprawl
  devloop rejects).
- **EARS + check-method tag for criteria.** Requirement phrasing follows EARS (unambiguous,
  testable, model-parseable); the check-method tag says *how* verify checks it. Orthogonal, composable.
- **Every artifact carries a Definition of Done (DoD) checklist** — a self-check the next stage or
  `doctor` runs against the file. Stable typed IDs (`AC-N`, `T-N`) are the traceability anchors.

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

---

## SPEC.md
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
- **AC-2** [artifact]: THE SYSTEM SHALL <always-true property / required artifact>
- **AC-3** [truth]: IF <condition> THEN THE SYSTEM SHALL <response>

## Open questions
- [NEEDS CLARIFICATION: <what's unresolved>]   (resolve before ship, or convert to a `manual` AC)
```

**Definition of Done:**
- [ ] Every criterion has a stable `AC-N` ID (never reused/renumbered), a check-method tag, and EARS form.
- [ ] Goal, In scope, and Out of scope are all present.
- [ ] No bare `[NEEDS CLARIFICATION]` remains — each is resolved or recorded as a `manual` named hole.
- [ ] No vague criteria ("fast", "user-friendly") — each is falsifiable.
- [ ] Completeness sweep done — each implied error/edge/trust/concurrency category is surfaced as an AC or an explicit out-of-scope/`manual` note (not silently absent).

---

## PLAN.md
- **Purpose:** turns the SPEC into an executable, traceable task breakdown.
- **Location:** `specs/<slug>/PLAN.md` · **Durability:** EPHEMERAL (archived on ship).
- **Grouping unit is the feature, not a tier inside PLAN:** PLAN stays a flat, feature-scoped task
  list; grouping/sequencing lives one tier up in ROADMAP (`depends`/`Boundary`), never as a phase
  tier inside PLAN — if a feature's scope outgrows one coherent PLAN, tighten its ROADMAP Boundary
  and split the feature.

```markdown
# Plan: <feature name>

## Summary
<approach in 2–3 sentences>

## Technical context
- Language/deps: <...>
- Test command: <...>
- Constraints: <from SPEC>

## Constitution check
<PASS | FAIL> — <one line per relevant CONSTITUTION principle and how the plan honors it>

## Tasks
- **T1** [tdd] scope=`auth` deps=[] covers=[AC-1,AC-2]: Implement token verification
- **T2** [standard] scope=`config` deps=[] [P] covers=[AC-3]: Add config loader
- **T3** [tdd] scope=`login` deps=[T1] covers=[AC-4]: Wire /login to verify_token

## Complexity tracking
<empty = good; else one row per deviation from the simplest approach + its justification>

## Coverage gaps
<none | AC-N: reason it cannot be mapped to a task>
```

Task fields: stable `T-N` id · `[tdd|standard]` tag · `scope=`\`token\` (the commit scope the TDD
hook matches, e.g. `test(auth)`→`feat(auth)`) · `deps=[T-ids]` · optional `[P]` parallel marker ·
`covers=[AC-ids]` for the trace matrix.

**Definition of Done:**
- [ ] Every SPEC `AC-N` appears in some task's `covers=` (else listed under Coverage gaps).
- [ ] Every `tdd` task has a `scope=` token; deps are acyclic and reference real `T-N` ids.
- [ ] Constitution check is PASS.
- [ ] Each Complexity-tracking entry has a justification (empty section is the good case).
- [ ] Each task is sized to fit one context window (coherence-cliff law).

---

## VERIFY.md
- **Purpose:** reasoning-blind evidence that criteria are met — judges artifacts + real test output +
  git log, **never** the implementer's narrative.
- **Location:** `specs/<slug>/VERIFY.md` · **Durability:** EPHEMERAL (archived on ship).
- **Parameterized:** `stage=plan` (goal-backward coverage check) or `stage=impl` (run tests +
  TDD-commit check).

```markdown
# Verify: <feature name>  (stage=plan|impl)

## Trace matrix
| AC | check (test path / command) | result | evidence (output snippet / commit sha) |
|------|------------------------------|--------|-----------------------------------------|
| AC-1 | tests/test_auth.py::test_token | PASS | `1 passed` · a1b2c3d |
| AC-2 | migrations/003_users.sql exists | PASS | file present, creates users table |

## Unmapped
- Orphan requirement (AC with no check) → **BLOCK**
- Orphan test (check with no AC) → **WARN**

## Verdict
<PASS | FAIL>
```

A `manual` AC (not mechanically checkable) gets a **named-hole row** — result `MANUAL`, surfaced for
the human checkpoint (ship = PR) — counting as **neither PASS/FAIL nor BLOCK** (never a silent gap).

**Definition of Done:**
- [ ] Every SPEC `AC-N` has a row with a concrete result and evidence (`MANUAL` for `manual` ACs).
- [ ] No `PASS` row lacks evidence.
- [ ] Verdict is FAIL if any AC fails or any orphan requirement (BLOCK) exists (`MANUAL` rows are neither).

---

## ROADMAP.md
- **Purpose:** lean cross-feature index driving multi-feature ordering and dependency awareness.
- **Location:** project root · **Durability:** DURABLE.

```markdown
# Roadmap

| slug | status | goal | risk | depends | Boundary |
|------|--------|------|------|---------|----------|
| auth | active | token-based login | med | [] | auth only; no RBAC |
```

**Definition of Done:**
- [ ] One row per known feature; `depends` entries reference real slugs.
- [ ] Each row's Boundary states the scope edge the SPEC must respect.

---

## CONSTITUTION.md
- **Purpose:** the project's thin, non-negotiable principles every stage respects.
- **Location:** project root · **Durability:** DURABLE.

```markdown
# Constitution

1. <principle — testable as discipline, e.g. "All behavior lands via a failing test first">
2. <principle>
```

**Definition of Done:**
- [ ] Principles are enforceable as discipline (a stage/gate can honor or check them), not prose dumps.
- [ ] Thin and forward-looking — no file-by-file rules (those belong in a linter/hook).

---

## Stubbed artifacts (schemas specified in their build phase)
<!-- DEFERRED(Phase 3): INTENT.md schema — goal + open-questions emitted by discuss; fill when the discuss stage is built. -->
<!-- DEFERRED(Phase 3): RESEARCH.md schema — findings bounded by open-questions; fill when the research stage is built. -->
<!-- DEFERRED(Phase 3): ASSUMPTIONS.md schema — recorded defaults/interpretations; fill when discuss/gating lands. -->
<!-- Resume core (drive `.done` markers + `.devloop/active` + resume-entry) derives per-stage state from
     markers + git directly — no authored PROGRESS.md needed for resume itself.
     DEFERRED(Phase 2): PROGRESS.md schema — a *derived* human-readable per-task snapshot; fill when the doctor slice consumes it. -->
<!-- DEFERRED(Phase 2): REVIEW.md schema — durable findings when the driver/refine loop consumes them; ephemeral returned report until then. -->
- **INTENT.md** (ephemeral, `specs/<slug>/`) — `DEFERRED(Phase 3)`.
- **RESEARCH.md** (ephemeral, `specs/<slug>/`) — `DEFERRED(Phase 3)`.
- **ASSUMPTIONS.md** (ephemeral, `specs/<slug>/`) — `DEFERRED(Phase 3)`.
- **PROGRESS.md** (derived, `specs/<slug>/`) — `DEFERRED(Phase 2)`.
