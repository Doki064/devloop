# INTENT.md — artifact contract

The front-end trio (INTENT · RESEARCH · ASSUMPTIONS): triage seeds INTENT (all-Clear → none of
these files exist; the pipeline enters at spec). Discuss appends Answers and records settled `D<N>`
Decisions, or, autonomous, writes ASSUMPTIONS. Research writes RESEARCH. Resolution is derived by
Q-id join (terminal check: the SPEC DoD) — no status fields, single writer per section.

- **Purpose:** the feature's front door — goal + uncertainty coverage + the open-question ledger
  that gates and bounds discuss/research. The list is the signal, not a vibe.
- **Location:** `specs/<slug>/INTENT.md` · **Durability:** EPHEMERAL (ship-time archival is
  `DEFERRED(Phase 4)` — see `skills/ship/SKILL.md`; currently left in place, not archived).
- **Writers:** triage seeds Goal/Coverage/Questions; discuss appends Answers and Decisions (a
  determined mid-pipeline correction may seed its Answer in the same triage write — see the discuss
  skill's re-gate path). Absent file = all-Clear (front-end skipped).

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

## Decisions
- **D1**: exports run as an async job, not inline — reuses the report queue; keeps request latency bounded.
```

Question fields: stable `Q<N>` (never reused/renumbered) · `[category]` from the coverage taxonomy ·
`route=user|research` (assume-route questions become ASSUMPTIONS entries instead, per triage filter) ·
`affects=<named downstream artifact>` (a section suffix like `SPEC.AC` is allowed for precision; no
artifact → drop or assume) · `split="<reading A> vs <reading B>"` (the interpretation divergence that
makes it a real question) · optional `[irreversible]`. Resolution is **derived by Q-id join**
(Answers / RESEARCH Findings / ASSUMPTIONS entry / else open) — never stored as a status field.

Decision fields: stable `D<N>` (never reused/renumbered) · the settled decision, then a one-line
rationale after ` — `. `## Decisions` records choices made in discuss — including ones the user
volunteered without a question being asked — so a downstream stage can trace why. Append-only; not
derived from any `Q<N>` (a decision may stand without a question). Byte-loose join at `stage=plan`:
each `D<N>` must appear as a token somewhere in SPEC.md **or** PLAN.md (the semantic half lives in
DoD prose). No dup-`D<N>` rule — the join is a dup-tolerant set, the same asymmetry as the no-dup-`Q`
rule (only dup-AC corrupts covers=/TDD targeting).
<!-- Taxonomy fixed at these six categories (Phase 3, discuss slice). Reconciliation with spec's completeness sweep (skills/spec/SKILL.md step 4): spec's four axes are the finer-grained *completeness* hunt inside what triage covers coarsely as edge/failure + constraints *uncertainty* — triage asks "is this area unclear?", spec asks "is every implied criterion written?" — different questions, deliberately both kept. -->

**Definition of Done:**
- [ ] Goal present.
- [ ] One Coverage row per taxonomy category; every Partial/Missing row points to ≥1 `Q<N>` or notes the filter or at-cap landing that recorded it.
- [ ] ≤10 questions total for the feature (re-gating included; the ≤5-per-gate cap is enforced by triage at write time — not checkable from this file).
- [ ] Every question has category, route, `affects=`, and `split=`; no duplicates.
- [ ] Every `## Answers` entry references a real `Q<N>`.
- [ ] Every `## Decisions` entry has a stable `D<N>` and a ` — ` rationale; append-only, never renumbered (the D-join is byte-checked; the rationale clause is author-checked).
- [ ] Every `D<N>` appears as a token in SPEC.md or PLAN.md (byte-checked: `intent-lint … stage=plan`).
