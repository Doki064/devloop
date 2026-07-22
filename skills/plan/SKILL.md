---
name: plan
description: This skill should be used when the user wants to turn a finished SPEC into an executable task plan in a devloop project — when they say "plan this", "break the spec into tasks", "write a plan", "make the implementation plan", or after spec and before implement. Delegates to the planner agent to produce a traceable specs/<slug>/PLAN.md.
argument-hint: "<feature-name> [replan]"
allowed-tools:
  - Glob
  - Task
---

# plan — turn the SPEC into a task plan

This is a **thin** stage: it delegates the real work to the `planner` agent, which converts the
frozen `SPEC.md` contract into a traceable, tagged `PLAN.md`. Keeping planning in the agent preserves
context hygiene — the detailed reasoning stays out of this conversation; only the summary returns.

## Process

1. The feature name is `$ARGUMENTS` (slash-invoked) or inferred from the conversation / asked when
   empty (model-invoked). **Slugify** it (lowercase, hyphens) → `<slug>`. Parse an optional
   **`replan`** token from the arguments (the driver's plan-review→re-plan loop passes it when
   REVIEW.md findings warrant a revised plan; a re-gate re-entry passes it with a discovery text);
   absent by default → a normal first plan. Keep any **discovery text** stated alongside `replan` —
   step 3 forwards it to the agent as a finding source.

2. **Check the precondition.** Confirm `specs/<slug>/SPEC.md` exists. If it does not, stop and tell
   the user to run `/devloop:spec <feature-name>` first — plan requires a contract to plan against.

3. **Dispatch the `planner` agent** via Task, passing `<slug>` **and the `replan` token if present**,
   **plus any discovery text stated with it** (the agent treats REVIEW.md and/or the discovery as
   its finding sources). The agent reads its own bounded working set (SPEC +
   CONSTITUTION + ROADMAP + dependency SPECs — plus `REVIEW.md` in re-plan mode when present) and writes
   `specs/<slug>/PLAN.md`. Do not read the SPEC or draft tasks in this context — let the agent own that.

4. **On return, check the result.** If the agent returned a **`REGATE spec-invalidating: …`** line
   (a finding only a contract change can satisfy — it stopped before emitting a plan), surface it
   **verbatim** and route: tell the user to run `/devloop:discuss <feature-name>` and include the
   REGATE line's discovery in the invocation (the planner never emits `REGATE plan-only` — it owns
   the plan). Otherwise confirm `specs/<slug>/PLAN.md` exists and surface the agent's summary (task
   count, tdd/standard split, any coverage gaps or risks); if the agent reported a **coverage gap**
   (a SPEC criterion no task covers), stop and surface it — an orphan requirement is a BLOCK, not
   something to paper over. Run step 5's self-check before stopping: the lint confirms the gap is
   recorded under `## Coverage gaps` (an explicit named hole), never silently dropped.

5. **Self-check before declaring the plan complete** — when `specs/<slug>/INTENT.md` exists, run
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/intent-lint.mjs specs/<slug>/INTENT.md stage=plan` (INTENT is
   the first arg; PLAN.md and SPEC.md are read as its siblings) — exit 0, or fix the PLAN and re-run.
   This byte-checks the AC→task trace matrix the PLAN DoD promises: every SPEC `AC-N` must appear in
   some task's `covers=[…]` or be recorded under `## Coverage gaps`, and every id inside a `covers=[…]`
   must be a real SPEC AC. A violation means **fix the PLAN** — add the covering task or an explicit
   Coverage-gaps entry, never silently drop the criterion. No INTENT.md (a standalone plan with no
   discuss stage) → skip the command; the driver path always has one, so the gate runs there.

## Handoff

**Recommended before implement (advisory, not a gate):** run `/devloop:review <feature-name>
target=plan` — a qualitative drift/quality pass — alongside the mechanical `/devloop:verify
<feature-name> stage=plan` coverage check. Drift, gaps, and over-engineering are cheapest to fix now,
while the plan is still just words and nothing is committed.
<!-- The `drive` skill wires this seam automatically (runs plan-verify as a gate + plan-review as advisory) on the driver path; this manual recommendation is for standalone /devloop:plan use. plan-review stays advisory in both paths — it never gates. -->

Then state the next step: `/devloop:implement <feature-name>` (or continue via the driver). Tasks
carry `covers=[AC-ids]`, so implement and verify trace each task back to the SPEC criteria it
satisfies. Standalone only (skip under the driver): tell the user to run `/clear` (or start a new
session) for fresh context before the next devloop command.
