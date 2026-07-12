---
name: plan
description: This skill should be used when the user wants to turn a finished SPEC into an executable task plan in a devloop project — when they say "plan this", "break the spec into tasks", "write a plan", "make the implementation plan", or after spec and before implement. Delegates to the planner agent to produce a traceable specs/<slug>/PLAN.md.
allowed-tools:
  - Glob
  - Task
---

# plan — turn the SPEC into a task plan

This is a **thin** stage: it delegates the real work to the `planner` agent, which converts the
frozen `SPEC.md` contract into a traceable, tagged `PLAN.md`. Keeping planning in the agent preserves
context hygiene — the detailed reasoning stays out of this conversation; only the summary returns.

## Process

1. **Slugify** the feature name you were given (lowercase, hyphens) → `<slug>`.

2. **Check the precondition.** Confirm `specs/<slug>/SPEC.md` exists. If it does not, stop and tell
   the user to run `/devloop:spec <feature-name>` first — plan requires a contract to plan against.

3. **Dispatch the `planner` agent** via Task, passing `<slug>`. The agent reads its own bounded
   working set (SPEC + CONSTITUTION + ROADMAP + dependency SPECs) and writes `specs/<slug>/PLAN.md`.
   Do not read the SPEC or draft tasks in this context — let the agent own that.

4. **On return, check the result.** Confirm `specs/<slug>/PLAN.md` exists and surface the agent's
   summary (task count, tdd/standard split, any coverage gaps or risks). If the agent reported a
   **coverage gap** (a SPEC criterion no task covers), stop and surface it — an orphan requirement is
   a BLOCK, not something to paper over.

## Handoff

**Recommended before implement (advisory, not a gate):** run `/devloop:review <feature-name>
target=plan` — a qualitative drift/quality pass — alongside the mechanical `/devloop:verify
<feature-name> stage=plan` coverage check. Drift, gaps, and over-engineering are cheapest to fix now,
while the plan is still just words and nothing is committed.
<!-- DEFERRED(Phase 2): the driver runs plan-verify + plan-review at this seam automatically (Orchestration concern); manual recommendation for now. -->

Then state the next step: `/devloop:implement <feature-name>` (or continue via the driver). Tasks
carry `covers=[AC-ids]`, so implement and verify trace each task back to the SPEC criteria it
satisfies.
