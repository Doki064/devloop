---
name: discuss
description: This skill should be used when the user wants to clarify a feature's intent before speccing it in a devloop project — when they say "discuss this feature", "clarify the requirements", "what's unclear about X", "triage this feature", or when a feature idea is too vague to spec without guessing. Records the surviving questions and their answers or assumptions in specs/<slug>/INTENT.md and ASSUMPTIONS.md; an `auto` token in the invocation selects autonomous mode (reversible assumptions instead of questions).
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

# discuss — triage the uncertainty, then ask only what survives

The feature's front door. A cheap **triage** detects what is genuinely unclear *before* any
answering begins, emits a bounded open-questions ledger, then a single Q&A round resolves what the
user can answer. The **list is the signal, not a vibe** — LLMs under-ask, so detection walks a
fixed taxonomy adversarially instead of trusting a felt sense of clarity. When intent is already
clear, the correct output is *nothing*: the skip is the no-op that lets the pipeline enter at spec.

## Inputs

Slugify the feature name (lowercase, hyphens) → `<slug>`. Gather the bounded working set — read
only what informs this feature, never the whole project:

- `specs/<slug>/INTENT.md` if it already exists — re-invocation **enriches, never clobbers**:
  re-running triage appends only NEW questions (within the caps), continues Q-numbering at the next
  free `Q<N>`, and never renumbers or rewrites existing entries.
- `ROADMAP.md` if present — this feature's row for its **Boundary** and **depends[]**; a pinned
  boundary is a given, not a question.
- `CONSTITUTION.md` if present — conventions already decided there are never asked about.

**Mode:** an `auto` token in the invocation (mirroring implement's `heal`/`replan` convention)
selects autonomous mode. Token absent → interactive.

## Phase 1 — triage (complete before any answering)

Detection, filtering, and the INTENT write all finish **before** any question is answered, so
detection is never biased by the effort of answering.

1. **Detect adversarially.** For each of the six coverage categories — `goal`, `scope`,
   `success-criteria`, `constraints`, `integration-surface`, `edge/failure` — ask *"what would a
   sharp reviewer say is unspecified here?"* and mark it Clear, Partial, or Missing. Draft a
   candidate question for every gap.

2. **Filter the candidates**, recording per category what dropped each casualty:
   - **Answerability** — keep `route=user` only for questions the user plausibly can answer from
     intent; questions needing investigation get `route=research`; otherwise assume.
   - **Blocklist** — never ask: stack/tooling choices CONSTITUTION or ROADMAP already pins;
     preferences with a platform default (record as an ASSUMPTIONS `(—)` entry instead); anything
     answerable by reading the repo.
   - **Affects-filter** — a question that changes no named downstream artifact (`SPEC`, `PLAN`, a
     section like `SPEC.AC`) is dropped or assumed.
   - **Dedup** — no two questions with the same `split=`.
   - **Caps** — ≤5 questions this gate pass, ≤10 total for the feature (across re-invocations).

   Each survivor carries the schema's required fields: stable `Q<N>` · `[category]` ·
   `route=user|research` · `affects=` · `split="<reading A> vs <reading B>"` · `[irreversible]`
   when reverting a wrong default would be expensive.

3. **Write (or skip).** Three outcomes:
   - **All six categories Clear** → write **nothing**; report "intent clear — proceed to spec".
   - **Gaps found but every candidate filtered or assumed** → still write INTENT — the
     Partial/Missing coverage rows with their drop-notes, plus any ASSUMPTIONS entries — with no
     Q&A round. The coverage record is the point; all-filtered is not all-Clear.
   - **Questions survived** → write INTENT (Goal, Coverage, Questions) now, before any answering.

   Write to the exact schemas in `${CLAUDE_PLUGIN_ROOT}/docs/ARTIFACTS.md` (the INTENT.md and
   ASSUMPTIONS.md sections) — that file is the single source of truth for both formats.

4. **Self-check after every write:**
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/intent-lint.mjs specs/<slug>/INTENT.md` — exit 0 or fix the
   printed violations and re-run before moving on.

## Phase 2 — resolve the route=user questions

**Interactive (default).** Batch every `route=user` question into ONE AskUserQuestion round — ≤4
questions per call, chunked into consecutive calls when more survive; use each question's `split=`
readings as the options. Append the answers as `## Answers` entries (`- **Q<N>**: <answer>`).
Zero `route=user` questions (all routed to research) → no round at all: the INTENT stands and the
handoff goes to research.

**Autonomous degrade.** Trigger: the `auto` token; or AskUserQuestion absent from the available
tools (a call returns `No such tool available: AskUserQuestion`); or the user declines to answer.
Then self-answer each `route=user` question: choose the **reversible** reading as the default and
append an ASSUMPTIONS entry — `- **A<N>** (Q<N>): assume <chosen>, not <rejected> — <one-line
basis>. affects=<artifact>` — propagating `[irreversible]` from the linked question per the schema
DoD. A-numbering is append-only. **Never self-answer a `route=research` question** — those stay
open for the research stage regardless of mode.

Re-run the Phase 1 lint command after every INTENT or ASSUMPTIONS write — the same INTENT-path
invocation also checks the ASSUMPTIONS sibling — and fix violations before handing off.

## Handoff

State the next step: unresolved `route=research` questions remain → `/devloop:research
<feature-name>`; none → `/devloop:spec <feature-name>` (all-Clear also goes to spec). Tell the
user to run `/clear` (or start a new session) for fresh context before the next command.

Summarize: questions asked, answers recorded, assumptions taken (call out `[irreversible]` ones
first), and what research must answer.
