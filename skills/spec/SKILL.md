---
name: spec
description: This skill should be used when the user wants to turn a feature idea into a specification with acceptance criteria in a devloop project — when they say "spec this", "write a spec", "define acceptance criteria", "what does done mean for X", or before planning or implementing any non-trivial feature. Produces a durable specs/<slug>/SPEC.md contract whose every criterion is mechanically checkable.
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

# spec — write the feature contract

Turn a feature into a **contract**: a `SPEC.md` whose every acceptance criterion is *falsifiable*.
Downstream stages (plan, implement, verify) are graded against this file, and an autonomous verifier
later checks each criterion **by its check-method** — running a test, confirming an artifact exists,
confirming a wiring link holds, or flagging a named `manual` hole. So a criterion must be falsifiable;
one that genuinely can't be mechanically checked is tagged `manual` (a named hole), never left vague.
This is the convergent stage: narrow the feature down to what "done" provably means.

## Inputs

Slugify the feature name you were given (lowercase, hyphens) → `<slug>`. Then gather the bounded working set — read
only what informs this feature, never the whole project:

- `specs/<slug>/INTENT.md` and `specs/<slug>/RESEARCH.md` if present (from earlier stages) — they
  carry the goal, open questions, and findings to formalize.
- `specs/<slug>/ASSUMPTIONS.md` if present — defaults already chosen (autonomous discuss, or the
  triage record-as-assumption filter). **Treat each entry as given**: formalize it into the SPEC;
  never re-ask the user what an `A<N>` already decided (re-asking defeats autonomous mode — ship
  surfaces the whole file for human confirmation later).
- `CONSTITUTION.md` if present — the project's thin conventions doc to respect while specifying.
- `ROADMAP.md` if present — find this feature's row for its declared **Boundary** (scope edges) and
  **depends[]** (upstream features whose SPECs constrain this one). Treat these as given; ask the
  user only to fill what the roadmap leaves open.
  <!-- DEFERRED(Phase 4): creating/updating this feature's ROADMAP row (risk/depends/Boundary) is a multi-feature concern; for now a missing row just means asking the user for the boundary. -->
- `specs/<slug>/SPEC.md` if it already exists — never silently overwrite a contract. Ask whether to
  **revise or replace** only while no downstream consumer exists (no `specs/<slug>/PLAN.md` and no
  implementation commits for the slug). Once downstream artifacts trace to `AC-N`s, **revise — never
  replace** (replace orphans the trace matrix + the TDD commit history). Under a re-gate the downstream
  exists by definition → always revise; see the revision note in the Process below.

## Process

1. **Establish goal and boundaries.** From INTENT + RESEARCH + ASSUMPTIONS + ROADMAP (or by
   asking), pin down: the goal in
   1–2 sentences, what is **in scope** vs explicitly **out of scope**, and hard constraints (perf,
   compat, security, deadlines). Batch questions — do not interrogate one field at a time. When the feature
   admits more than one reasonable interpretation, surface the alternatives and let the user choose —
   never silently pick one and bury the assumption.

2. **Draft criteria in EARS + a check-method tag.** Phrase each requirement in EARS — the constrained,
   testable shapes (WHEN / WHILE / IF / ubiquitous / WHERE) enumerated in the EARS quick reference of
   `${CLAUDE_PLUGIN_ROOT}/docs/ARTIFACTS.md` — and tag *how* verify confirms it: **truth** (run a
   command/test), **artifact** (a file/output that must exist with real content), **link** (a
   connection that must hold, e.g. a route calls a function), **manual** (not mechanically checkable).

   Reject vague criteria ("should be fast", "user-friendly"). When the user gives one, ask the
   follow-up that converts it to a tagged EARS statement ("fast = WHEN load hits 100 rps THE SYSTEM
   SHALL keep p95 < 200ms" → `truth`). Two or three rounds of this is normal.

   When an AC's trigger or response still admits more than one reading ("reject invalid
   date" — `2026-02-30`? empty?), anchor it with an indented, **unbolded** `e.g.` sub-line
   under the AC bullet: concrete input → concrete observable outcome. The example is
   illustrative, not normative — the EARS statement stays the contract; the example is the
   first test case the implementer writes.

3. **Assign a stable criterion ID** to each (`AC-1`, `AC-2`, …). Plan, implement, and verify
   reference these IDs to build the trace matrix (criterion ↔ test). Never reuse or renumber an ID
   once assigned.

   **Revising an existing SPEC** follows the Revision rules in the ARTIFACTS SPEC section: **amend** in
   place under the stable `AC-N` (new text, same ID, plus an unbolded `(amended: …)` sub-line);
   **add** at the next free `AC-N` **above the highest ever used** — a whole-file scan that counts `(was AC-N)` notes too; **withdraw** by
   relocating the criterion out of `## Acceptance criteria` to `## Out of scope` as an unbolded `- (was
   AC-N) <what + why withdrawn>` note (the ID stays in-file so it can never be reused). That ARTIFACTS
   block is the source of truth — on any divergence it wins.

4. **Completeness sweep — hunt what the feature implies but the criteria don't state.** The step-5
   self-check form-checks each criterion but cannot catch a *missing* one, so before it, ask
   adversarially: *"what does this feature imply that isn't written yet?"* Walk a small, **relevance-gated** taxonomy so
   it's a checklist, not a vibe (LLMs under-ask) — surface only what the feature's nature actually
   implies; never manufacture criteria a feature doesn't:
   - **error / failure paths** — the operation failing, timing out, or hitting a downstream error.
   - **edge & boundary inputs** — empty, missing, oversize, malformed, duplicate.
   - **trust boundaries / secrets / injection** — untrusted input, authz, secret handling.
   - **concurrency & idempotency** — races, retries, double-submits (only when the feature is stateful).

   Each surfaced item becomes **either** a new tagged EARS `AC-N` **or** an explicit *out-of-scope* /
   `manual` note with a reason — **named, never silently dropped** (the completeness counterpart to the
   vague-criteria rejection above, which polices only form).
   <!-- Reconciled with the triage coverage taxonomy (Phase 3): these four axes are the finer-grained *completeness* hunt inside what triage covers coarsely as edge/failure + constraints *uncertainty*. Spec keeps this sweep as the convergent last-check — triage asks "is this area unclear?", spec asks "is every implied criterion written?" — different questions, deliberately both kept. -->

5. **Self-check before writing.** Confirm every criterion has an EARS form, a check-method tag, and an
   ID, and that the completeness sweep ran. If one genuinely cannot be mechanically checked (e.g.
   subjective visual polish), tag it `manual` and note why — a **named hole**, never a silent one.

## Output

Write `specs/<slug>/SPEC.md` in the exact schema and pass its Definition of Done — both defined in
`${CLAUDE_PLUGIN_ROOT}/docs/ARTIFACTS.md` (the SPEC.md section). That file is the single source of
truth for the format; follow it rather than improvising sections.

Keep it lean — a spec is a contract, not an essay. Every line must be something a verifier or
planner will act on. Keep the `**AC-N** [tag]:` bullet format exact: downstream stages parse it
mechanically to build the criterion ↔ test trace matrix.

**Self-check after writing** — when `specs/<slug>/INTENT.md` exists, run
`node ${CLAUDE_PLUGIN_ROOT}/scripts/intent-lint.mjs specs/<slug>/INTENT.md stage=spec` — exit 0,
or fix the printed violations and re-run. This is the mechanical half of the DoD's terminal
Q-join: an INTENT question resolved nowhere (no Answer, no RESEARCH Finding, no ASSUMPTIONS
entry) must be carried into this SPEC as a `[NEEDS CLARIFICATION: … (Q<N>)]` entry or a `manual`
AC citing its `Q<N>`. No INTENT.md → skip the command (nothing to join).

## Handoff

State the next step: `/devloop:plan <feature-name>` (or continue via the driver). The criterion IDs
are the anchor the plan maps tasks and tests to. Standalone only (skip under the driver): tell the
user to run `/clear` (or start a new session) for fresh context before running plan.
