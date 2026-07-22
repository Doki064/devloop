# PLAN.md — artifact contract

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
- [ ] Every SPEC `AC-N` appears in some task's `covers=` (else listed under Coverage gaps), and every `covers=` id is a real SPEC `AC-N` (byte-checked: `intent-lint … stage=plan`).
- [ ] Every `tdd` task has a `scope=` token; deps are acyclic and reference real `T<N>` ids.
- [ ] Constitution check is PASS.
- [ ] Each Complexity-tracking entry has a justification (empty section is the good case).
- [ ] Each task is sized to fit one context window (coherence-cliff law).
