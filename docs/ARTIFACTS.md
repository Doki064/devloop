# devloop — Artifact Format Contract (index)

Every stage-transition artifact is defined by a **contract file that lives in its writer stage's
`skills/<stage>/references/` dir** — writer and schema co-evolve in one place. devloop's pipeline is
artifact-handoff: each stage reads the prior stage's file and writes its own, so these formats are
the **API between stages** — one definition per artifact, no producer/consumer drift. This file is the
**thin index**: the table below, the shared Format philosophy that governs the whole set, and the
project-root durables (ROADMAP/CONSTITUTION) whose writer (`init`) does not exist until Phase 4.
Consumers point at the specific contract file(s) they use; fall back to this index only where the
context is genuinely the whole artifact set.

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

## Contract index
Each contract lives with its writer stage; consumers reference the specific file(s) they read/write.

| Artifact | Contract file | Purpose |
|----------|---------------|---------|
| SPEC.md | `skills/spec/references/SPEC.md` | durable feature contract every downstream stage is graded against (+ EARS quick reference). |
| PLAN.md | `skills/plan/references/PLAN.md` | turns the SPEC into an executable, traceable task breakdown. |
| VERIFY.md | `skills/verify/references/VERIFY.md` | reasoning-blind evidence that criteria are met (artifacts + test output + git log). |
| REVIEW.md | `skills/review/references/REVIEW.md` | durable, advisory quality findings — the deliberate inverse of VERIFY.md. |
| INTENT.md | `skills/discuss/references/INTENT.md` | the feature's front door + open-question ledger (+ the front-end-trio preamble). |
| RESEARCH.md | `skills/research/references/RESEARCH.md` | distilled findings answering the INTENT questions routed to research. |
| ASSUMPTIONS.md | `skills/discuss/references/ASSUMPTIONS.md` | defaults chosen without the user — the autonomous-degrade audit trail. |
| ROADMAP.md | this index (below) | lean cross-feature ordering + dependency index. |
| CONSTITUTION.md | this index (below) | the project's thin, non-negotiable principles. |

---

## Project-root durables
ROADMAP.md and CONSTITUTION.md are multi-reader and live at the project root; their writer (`init`)
arrives in Phase 4, at which point these schemas move to its `references/` dir. Until then they stay
in this index.

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
<!-- Resume core (drive `.done` markers + `.devloop/active` + resume-entry) + doctor derive per-stage
     state from markers + git directly — no authored PROGRESS.md needed for resume or diagnosis.
     DEFERRED(Phase 5): PROGRESS.md schema — a *derived* human-readable per-task snapshot; fill when a consumer needs it (no consumer today). -->
- **PROGRESS.md** (derived, `specs/<slug>/`) — `DEFERRED(Phase 5)`.
