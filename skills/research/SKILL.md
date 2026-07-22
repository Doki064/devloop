---
name: research
description: This skill should be used when the user wants to answer a devloop feature's open research questions before speccing — when they say "research this feature", "run research", "answer the open questions", "resolve the research questions", or after discuss leaves route=research questions in specs/<slug>/INTENT.md. Dispatches researcher agents (parallel when questions are independent) and merges their findings into specs/<slug>/RESEARCH.md; unanswered questions become named risks for spec.
argument-hint: "<feature-name>"
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
  - Task
---

# research — answer the ledger's research questions, bounded

This is a **thin** stage: the token-heavy investigation happens in `researcher` agents; this
context only partitions questions, merges returned findings, and self-checks. Research is
**bounded by the ledger** — it answers the INTENT questions routed to research, nothing else; a
finding no question asked for is a defect, not a bonus.

<!-- Fan-out lives HERE, not in the agent, and this skill (not the agent) writes RESEARCH.md — a
     deliberate deviation from the planner/verifier pattern (agent writes the artifact): nested
     agent dispatch is not portable across harnesses (consumer subagent contexts verifiably drop
     tools — the slice-2 AskUserQuestion probe), and parallel researchers writing one file would
     clobber each other. The skill is the single merge point; context hygiene is preserved where
     it matters — only schema-shaped lines return from the agents. -->

## Process

1. The feature name is `$ARGUMENTS` (slash-invoked) or inferred from the conversation / asked when
   empty (model-invoked). **Slugify** it (lowercase, hyphens) → `<slug>`.

2. **Check the precondition.** Confirm `specs/<slug>/INTENT.md` exists. If it does not, stop:
   with no question ledger there is nothing bounded to research — tell the user to run
   `/devloop:discuss <feature-name>` first (or `/devloop:spec <feature-name>` when intent is
   already clear).

3. **Collect the open questions.** Read INTENT's `## Questions` and take those with
   `route=research`. If `specs/<slug>/RESEARCH.md` already exists, drop the questions already
   present in its Findings or Unanswered — re-invocation **enriches, never clobbers**: existing
   lines are never rewritten or renumbered. Zero questions remaining → report "research complete
   — proceed to spec" and go to the Handoff; the no-op is the good case.

4. **Decide the mode once**, before any dispatch: **brownfield** when the target project
   contains source the feature could integrate with (code files outside `specs/`, `docs/`,
   `.devloop/`, and plugin/config state); else **greenfield**. One decision for the whole run —
   parallel researchers must not disagree in one header.

5. **Dispatch researcher agents** via Task. With ≤2 remaining questions, or interdependent
   ones, dispatch ONE researcher carrying all of them. With more that are independent, cluster
   by topic/`affects=` and dispatch one researcher per cluster **in a single message** so they
   run in parallel. Pass each researcher: the `<slug>`, the mode, its assigned question lines
   verbatim, and the INTENT `## Goal` for context. Researchers **return** schema-shaped finding
   lines; they do not write files.

6. **Merge into `specs/<slug>/RESEARCH.md`** per the exact schema in
   `${CLAUDE_PLUGIN_ROOT}/skills/research/references/RESEARCH.md` (the single
   source of truth for the format, including the source-goes-last ` — ` rule). Create the file
   with its `(mode=…)` header when absent; otherwise insert new lines **section-targeted** —
   findings at the end of `## Findings`, unanswered at the end of `## Unanswered` — never a bare
   append at end-of-file.

7. **Self-check after every write:**
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/intent-lint.mjs specs/<slug>/INTENT.md stage=research` —
   exit 0, or fix the printed violations and re-run before moving on. A coverage violation (an
   assigned question in neither section) means a researcher returned nothing for it: re-dispatch
   that question once; if it still comes back empty, record the question under `## Unanswered`
   with the downstream risk derived from its `affects=`.

## Handoff

State the next step: `/devloop:spec <feature-name>` (or continue via the driver). Summarize the
findings with their confidence tags — **Unanswered risks first** — and the mode used. Standalone
only (skip under the driver): tell the user to run `/clear` (or start a new session) for fresh
context before running spec.
