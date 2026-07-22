---
name: verify
description: This skill should be used when the user wants to grade a devloop feature against its SPEC — when they say "verify this", "run verify", "check the implementation", "does this meet the spec", or after implement and before ship. Delegates to the verifier agent, which reasoning-blindly builds VERIFY.md from real test output, artifacts, and the git log. Parameterized by stage=plan|impl (default impl).
argument-hint: "<feature-name> [stage=plan|impl]"
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

1. The feature name is `$ARGUMENTS` (slash-invoked) or inferred from the conversation / asked when
   empty (model-invoked). **Slugify** it (lowercase, hyphens) → `<slug>`. Parse an optional
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

On **PASS** → state the next step: with `stage=impl`, `/devloop:ship <feature-name>`; with
`stage=plan`, `/devloop:implement <feature-name>` (or continue via the driver). Standalone only (skip
under the driver): tell the user to run `/clear` (or start a new session) for fresh context before the
next devloop command. On **FAIL** → surface the failed ACs / BLOCK rows. Run standalone,
verify just reports them for the user to address and re-run; **under the driver, a FAIL feeds the
self-heal loop** (`skills/drive/SKILL.md` step 6a), which loops back to implement (capped 3,
no-progress-aborted).

The "ship blocked on verify PASS" gate is enforced by the **ship** stage (it reads the VERIFY
verdict), not here — verify only produces the verdict.
