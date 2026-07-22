# INTENT.md — artifact contract

The front-end trio (INTENT · RESEARCH · ASSUMPTIONS): triage seeds INTENT (all-Clear → none of
these files exist; the pipeline enters at spec). Discuss appends Answers or, autonomous, writes
ASSUMPTIONS. Research writes RESEARCH. Resolution is derived by Q-id join (terminal check: the
SPEC DoD) — no status fields, single writer per section.

- **Purpose:** the feature's front door — goal + uncertainty coverage + the open-question ledger
  that gates and bounds discuss/research. The list is the signal, not a vibe.
- **Location:** `specs/<slug>/INTENT.md` · **Durability:** EPHEMERAL (archived on ship).
- **Writers:** triage seeds Goal/Coverage/Questions; discuss appends Answers (a determined
  mid-pipeline correction may seed its Answer in the same triage write — see the discuss
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
```

Question fields: stable `Q<N>` (never reused/renumbered) · `[category]` from the coverage taxonomy ·
`route=user|research` (assume-route questions become ASSUMPTIONS entries instead, per triage filter) ·
`affects=<named downstream artifact>` (a section suffix like `SPEC.AC` is allowed for precision; no
artifact → drop or assume) · `split="<reading A> vs <reading B>"` (the interpretation divergence that
makes it a real question) · optional `[irreversible]`. Resolution is **derived by Q-id join**
(Answers / RESEARCH Findings / ASSUMPTIONS entry / else open) — never stored as a status field.
<!-- Taxonomy fixed at these six categories (Phase 3, discuss slice). Reconciliation with spec's completeness sweep (skills/spec/SKILL.md step 4): spec's four axes are the finer-grained *completeness* hunt inside what triage covers coarsely as edge/failure + constraints *uncertainty* — triage asks "is this area unclear?", spec asks "is every implied criterion written?" — different questions, deliberately both kept. -->

**Definition of Done:**
- [ ] Goal present.
- [ ] One Coverage row per taxonomy category; every Partial/Missing row points to ≥1 `Q<N>` or notes the filter or at-cap landing that recorded it.
- [ ] ≤10 questions total for the feature (re-gating included; the ≤5-per-gate cap is enforced by triage at write time — not checkable from this file).
- [ ] Every question has category, route, `affects=`, and `split=`; no duplicates.
- [ ] Every `## Answers` entry references a real `Q<N>`.
