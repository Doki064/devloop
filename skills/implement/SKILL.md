---
name: implement
description: This skill should be used when the user wants to work a finished PLAN into code in a devloop project — when they say "implement this", "work the plan", "build the tasks", "start implementing", or after plan and before verify. Delegates to the implementer agent, which works the PLAN.md tasks test-first and commits them.
allowed-tools:
  - Glob
  - Task
---

# implement — work the PLAN into code

This is a **thin** stage: it delegates the real work to the `implementer` agent, which works the
`PLAN.md` tasks into code, tests, and commits. Keeping implementation in the agent preserves context
hygiene — the detailed edit-by-edit reasoning stays out of this conversation; only the summary returns.

## Process

1. **Slugify** the feature name you were given (lowercase, hyphens) → `<slug>`. Parse an optional
   **`heal`** token from the arguments (the driver's self-heal loop passes it after a verify FAIL);
   absent by default → a normal implement.

2. **Check the precondition.** Confirm `specs/<slug>/PLAN.md` exists. If it does not, stop and tell
   the user to run `/devloop:plan <feature-name>` first — implement needs a task plan to work from.

3. **Dispatch the `implementer` agent** via Task, passing `<slug>` **and the `heal` token if present**.
   The agent reads its own bounded working set (PLAN + the SPEC criteria each task covers + the code it
   touches — plus `VERIFY.md` in heal mode) and writes code, tests, and commits. Do not read the PLAN
   or write code in this context — let the agent own that.
   <!-- DEFERRED(Phase 5): isolation: worktree + baseRef: head; implement on the current tree for now. -->

4. **On return, check the result.** Surface the agent's summary (tasks completed, tdd/standard split,
   commits, any risks). If the agent reports a task it could **not** drive to GREEN — or a test
   command that errors — stop and surface it; a failed task is a BLOCK, not something to paper over.
   If instead the agent returned a **`REGATE <spec-invalidating|plan-only>: …`** line, surface it
   **verbatim** and route by tier: `spec-invalidating` → tell the user to run `/devloop:discuss
   <feature-name>` and include the discovery text in the invocation; `plan-only` → tell the user to
   run `/devloop:plan <feature-name> replan` and include the discovery text. The discovery re-enters the pipeline there — do not attempt
   to build past it here.

## Handoff

State the next step: `/devloop:verify <feature-name>` (or continue via the driver). Each `tdd` task's
`test(scope)→feat(scope)` commit pair is the evidence verify checks against the PLAN's `scope=` tokens.
**A REGATE return (step 4) supersedes this handoff** — the next step is the tier's re-entry command
(`/devloop:discuss` or `/devloop:plan … replan`) with the discovery text, not verify.
Standalone only (skip under the driver): tell the user to run `/clear` (or start a new session) for
fresh context before running verify.
