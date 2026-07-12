---
name: verify
description: This skill should be used when the user wants to grade a devloop feature against its SPEC — when they say "verify this", "run verify", "check the implementation", "does this meet the spec", or after implement and before ship. Delegates to the verifier agent, which reasoning-blindly builds VERIFY.md from real test output, artifacts, and the git log. Parameterized by stage=plan|impl (default impl).
allowed-tools:
  - Glob
  - Task
---

# verify — grade the feature against its SPEC (reasoning-blind)

This is a **thin** stage: it delegates the real work to the `verifier` agent, which reads its own
bounded set (SPEC + PLAN + git + real test output) and writes `specs/<slug>/VERIFY.md`. Keeping the
grade in the agent preserves context hygiene and reasoning-blindness — the implementer's narrative
never enters the judgment; only the verdict returns.

## Process

1. **Slugify** the feature name you were given (lowercase, hyphens) → `<slug>`. Parse an optional
   `stage=plan|impl` token from the arguments; **default `impl`**.

2. **Check the precondition.** Confirm `specs/<slug>/PLAN.md` exists (via Glob). If it does not, stop
   and tell the user to run `/devloop:plan <feature-name>` first — verify needs a plan to grade
   against. (The "no implementation commits → run implement first" check for `stage=impl` lives in
   the agent, which has git; do not attempt it here.)

3. **Dispatch the `verifier` agent** via Task, passing `<slug>` and `stage`. The agent reads its own
   bounded working set and writes VERIFY.md. Do not read the PLAN or run tests in this context — let
   the agent own that (reasoning-blindness depends on it).

4. **On return, surface the verdict.** Report the agent's summary (verdict, AC pass/fail counts, any
   BLOCK / WARN / MANUAL, test command used). A FAIL or any BLOCK is a real gate — surface it plainly,
   never paper over it.

## Handoff

On **PASS** → state the next step: `/devloop:ship <feature-name>` (or continue via the driver). On
**FAIL** → surface the failed ACs / BLOCK rows for the user to address, then re-run verify; there is
**no automatic heal loop** in Phase 1.
<!-- DEFERRED(Phase 2): capped self-heal loop back to implement on FAIL + no-progress abort; manual re-run for now. -->

The "ship blocked on verify PASS" gate is enforced by the **ship** stage (it reads the VERIFY
verdict), not here — verify only produces the verdict.
