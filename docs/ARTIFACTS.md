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
  `doctor` runs against the file. Stable typed IDs (`AC-N`, `T<N>`) are the traceability anchors.
- **Token-lean, always.** Every artifact is written for downstream consumers and costs tokens on every
  downstream read — no filler words, no restated context, no narrative prose. Every line must change
  what a consumer (planner/implementer/verifier/human) does; if a line could be deleted without
  changing consumer behavior, delete it.

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
- [ ] If INTENT.md exists: every `Q<N>` is resolved (INTENT Answers / RESEARCH Finding / ASSUMPTIONS entry) or appears in this SPEC as `[NEEDS CLARIFICATION]` / a `manual` AC.

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

Task fields: stable `T<N>` id (`T1`, `T2`, …) · `[tdd|standard]` tag · `scope=`\`token\` (the commit
scope the TDD hook matches, e.g. `test(auth)`→`feat(auth)`) · `deps=[T-ids]` · optional `[P]` parallel
marker · `covers=[AC-ids]` for the trace matrix.

**Definition of Done:**
- [ ] Every SPEC `AC-N` appears in some task's `covers=` (else listed under Coverage gaps).
- [ ] Every `tdd` task has a `scope=` token; deps are acyclic and reference real `T<N>` ids.
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

## REVIEW.md
- **Purpose:** durable, advisory quality findings — the reviewer's qualitative judgment of whether a
  PLAN or the implementation is well-shaped (simple, secure, idiomatic, true to SPEC intent). The
  **deliberate inverse of VERIFY.md**: judgment, not reasoning-blind evidence.
- **Location:** `specs/<slug>/REVIEW.md` · **Durability:** EPHEMERAL (archived on ship, like VERIFY).
- **Parameterized:** `target=plan` (judge the PLAN vs the SPEC) or `target=impl` (judge the changed
  code). Same-path, latest-write-wins — the header records which (mirrors VERIFY.md's `stage=`).
- **Advisory — never a gate.** REVIEW.md carries **no PASS/FAIL verdict**: a verdict would read as a
  blocker, and review never blocks (a concern becomes a gate only by being promoted to a SPEC `AC-N`
  verify grades, or a hook). The driver's plan-review→re-plan loop consumes the *finding count* (it
  re-plans while findings strictly shrink, then continues to implement regardless) — never a verdict.

```markdown
# Review: <feature name>  (target=plan|impl)

## Findings
- <file>:L<line>: <lane/tag> <what>. <fix/replacement>.
- <file>:L<line>: <lane/tag> <what>. <fix/replacement>.

## Summary
<one line>
```

Findings are **most-severe first**, one line each (a leading `- ` bullet is presentational — the
driver's count parser is prefix-agnostic). When there is nothing to flag, the `## Findings` body is the
`Clean. Nothing to flag.` sentinel (bulleted or bare — both read as count zero). The count is
**derived** from the `## Findings` lines — do **not** also record a number in `## Summary` (single
source; no drift for a consumer to reconcile).

**Definition of Done:**
- [ ] Header names the `target` (`plan` or `impl`).
- [ ] Each finding is one line: `<file>:L<line>: <lane/tag> <what>. <fix>.`, most-severe first.
- [ ] No verdict / PASS-FAIL (advisory — never a gate); an empty review is the exact `Clean. Nothing to flag.` sentinel.
- [ ] `## Summary` carries no finding count (derived from `## Findings`).

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

The front-end trio (INTENT · RESEARCH · ASSUMPTIONS): triage seeds INTENT (all-Clear → none of
these files exist; the pipeline enters at spec). Discuss appends Answers or, autonomous, writes
ASSUMPTIONS. Research writes RESEARCH. Resolution is derived by Q-id join (terminal check: the
SPEC DoD) — no status fields, single writer per section.

## INTENT.md
- **Purpose:** the feature's front door — goal + uncertainty coverage + the open-question ledger
  that gates and bounds discuss/research. The list is the signal, not a vibe.
- **Location:** `specs/<slug>/INTENT.md` · **Durability:** EPHEMERAL (archived on ship).
- **Writers:** triage seeds Goal/Coverage/Questions; discuss appends Answers. Absent file =
  all-Clear (front-end skipped).

```markdown
# Intent: <feature name>

## Goal
<1–2 sentences — the ask in the user's terms; input to SPEC Goal>

## Coverage
| category | status | note |
|----------|--------|------|
| goal | Clear | |
| scope | Partial | → Q1 |
| success-criteria | Missing | → Q2 |
| constraints | Partial | → Q3 |
| integration-surface | Missing | → Q4 |
| edge/failure | Clear | |

## Questions
- **Q1** [scope] route=user affects=SPEC split="admins only vs all users": Who can trigger the export?
- **Q2** [success-criteria] route=research affects=SPEC.AC split="p95<200ms vs no target": Is there a latency target?
- **Q3** [constraints] route=user affects=SPEC [irreversible] split="soft-delete vs hard-delete": May exports purge source rows?
- **Q4** [integration-surface] route=research affects=PLAN split="reuse report queue vs new worker": Is the report queue reusable?

## Answers
- **Q1**: all users; admins additionally get bulk export.
```

Question fields: stable `Q<N>` (never reused/renumbered) · `[category]` from the coverage taxonomy ·
`route=user|research` (assume-route questions become ASSUMPTIONS entries instead, per triage filter) ·
`affects=<named downstream artifact>` (a section suffix like `SPEC.AC` is allowed for precision; no
artifact → drop or assume) · `split="<reading A> vs <reading B>"` (the interpretation divergence that
makes it a real question) · optional `[irreversible]`. Resolution is **derived by Q-id join**
(Answers / RESEARCH Findings / ASSUMPTIONS entry / else open) — never stored as a status field.
<!-- DEFERRED(Phase 3): fix the exact coverage-taxonomy category list at the triage build slice — must reconcile with the spec completeness-sweep categories (skills/spec/SKILL.md step 4). -->

**Definition of Done:**
- [ ] Goal present.
- [ ] One Coverage row per taxonomy category; every Partial/Missing row points to ≥1 `Q<N>` or notes the filter that dropped it.
- [ ] ≤10 questions total for the feature (re-gating included; the ≤5-per-gate cap is enforced by triage at write time — not checkable from this file).
- [ ] Every question has category, route, `affects=`, and `split=`; no duplicates.
- [ ] Every `## Answers` entry references a real `Q<N>`.

---

## RESEARCH.md
- **Purpose:** distilled findings answering the INTENT questions routed to research — evidence-up,
  a decision record, never a transcript. Bounded: no finding without a Q-id.
- **Location:** `specs/<slug>/RESEARCH.md` · **Durability:** EPHEMERAL (archived on ship).
- **Writer:** researcher agent (parallel researchers merge into one file). Header records mode.

```markdown
# Research: <feature name>  (mode=greenfield|brownfield)

## Findings
- **Q2** [high]: p95<200ms is the platform norm; adopt it. — <url | file:line>

## Unanswered
- **Q4**: queue internals undocumented → risk: PLAN may double-build a worker; flag at plan review.
```

One line per finding: `Q<N>` · confidence `[high|med|low]` · the answer · a concrete source
(external URL for greenfield; `file:line` allowed in brownfield). Unanswered questions become
**named risks** — spec converts each to `[NEEDS CLARIFICATION]` or a `manual` AC.

**Definition of Done:**
- [ ] Header records `mode`.
- [ ] Every INTENT question with `route=research` appears exactly once — in Findings **or** Unanswered.
- [ ] Every finding has a confidence tag and a concrete source; no finding without a `Q<N>` (no unsolicited research).
- [ ] Every Unanswered entry names its downstream risk.

---

## ASSUMPTIONS.md
- **Purpose:** defaults chosen without the user — the audit trail that makes autonomous degrade
  safe. Ship surfaces the whole file in the PR for human confirmation ([irreversible] first).
- **Location:** `specs/<slug>/ASSUMPTIONS.md` · **Durability:** EPHEMERAL (archived on ship).
- **Writers:** discuss in autonomous mode (self-Q&A); triage's record-as-assumption filter.

```markdown
# Assumptions: <feature name>

- **A1** (Q3): assume soft-delete, not hard-delete — reversible default when the user is absent. affects=SPEC [irreversible]
- **A2** (—): assume CSV output, not XLSX — no format stated; CSV is the platform default. affects=PLAN
```

Fields: stable `A<N>` · `(Q<N>)` when it resolves a ledger question, `(—)` for a spot default with
no gate question · chosen **and** rejected reading (mirrors `split=`) · one-line basis ·
`affects=` · optional `[irreversible]`. **A-numbering is append-only:** whichever stage writes next
continues at the next free `A<N>` — one appender at a time (stages run sequentially, including
re-gated re-runs), the same single-writer principle as INTENT's sections.

**Definition of Done:**
- [ ] Every entry: `A<N>`, chosen default + rejected alternative, basis, `affects=`.
- [ ] `(Q<N>)` link present whenever the entry resolves an INTENT question.
- [ ] An entry resolving an `[irreversible]` `Q<N>` carries `[irreversible]` (the tag propagates, so ship surfaces it first — never silently assumed).
- [ ] No entry duplicates a user answer or research finding (those are not assumptions).

---

## Stubbed artifacts (schemas specified in their build phase)
<!-- Resume core (drive `.done` markers + `.devloop/active` + resume-entry) + doctor derive per-stage
     state from markers + git directly — no authored PROGRESS.md needed for resume or diagnosis.
     DEFERRED(Phase 5): PROGRESS.md schema — a *derived* human-readable per-task snapshot; fill when a consumer needs it (no consumer today). -->
- **PROGRESS.md** (derived, `specs/<slug>/`) — `DEFERRED(Phase 5)`.
