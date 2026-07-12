---
name: review
description: This skill should be used when the user wants to qualitatively audit or assess the quality of a devloop feature against its own SPEC/PLAN — when they say "review this devloop feature", "review this feature's plan", "audit this feature's implementation", "is this plan well-shaped", or as a quality pass at the plan→implement seam or before ship. Delegates to the reviewer agent, which returns advisory one-line findings. Parameterized by target=plan|impl (default impl). Not a general code review — scoped to a devloop feature's artifacts.
allowed-tools:
  - Glob
  - Task
---

# review — advisory quality lane (reads & judges)

This is a **thin** stage: it delegates the real work to the `reviewer` agent, which reads its own
bounded set (`specs/<slug>/` + the feature's changed code) and returns terse one-line findings.
`review` is the **deliberate inverse of the reasoning-blind verifier** — it *reads and judges*
whether the plan and code are well-shaped: simple, secure, idiomatic, not over-engineered, not
drifting from SPEC intent.

`review` is **advisory, never a gate.** verify enforces each seam mechanically; review advises it.
The framing: **verify : the TDD rule :: review : the simplicity/quality rules.** Surface findings —
never present them as a blocker, never let them touch the verify verdict.

## Process

1. **Slugify** the feature name you were given (lowercase, hyphens) → `<slug>`. Parse an optional
   `target=plan|impl` token from the arguments; **default `impl`**. (`target` names the *artifact*
   under review — deliberately not verify's `stage`; both accept `plan|impl`.)

2. **Check the precondition.** Confirm `specs/<slug>/PLAN.md` exists (via Glob). If it does not, stop
   and tell the user to run `/devloop:plan <feature-name>` first — review needs a plan to judge
   against. (For `target=impl`, the "no implementation commits → run implement first" check lives in
   the agent, which has git; do not attempt it here.)

3. **Dispatch the `reviewer` agent** via Task, passing `<slug>` and `target`. The agent reads its own
   bounded working set and returns findings. Do not read the PLAN or the diff in this context — let
   the agent own that (context hygiene; the critique stays out of this conversation).

4. **On return, surface the findings.** Report the agent's one-line findings and summary **as
   advisory input** — most-severe first, `Clean. Nothing to flag.` when empty. Never call them a gate,
   never block on them: a concern becomes a gate only by being made mechanical (promoted to a
   falsifiable SPEC `AC-N` that verify grades, or a hook that denies).

## Handoff

On **`target=plan`** → recommend addressing any findings, then `/devloop:implement <feature-name>`
(or continue via the driver). Drift and gaps are cheapest to fix now, before implementation commits —
run this alongside the mechanical `/devloop:verify <feature-name> stage=plan` coverage check.

On **`target=impl`** → this is a quality pass before `/devloop:ship <feature-name>`; address findings
at your discretion. The PR is the human checkpoint; review never blocks the ship — the `impl-verify`
PASS is the only gate there.
<!-- DEFERRED(Phase 2): durable REVIEW.md + driver-run findings→re-plan loop; ephemeral returned findings for now. -->
