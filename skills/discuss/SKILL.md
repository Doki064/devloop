---
name: discuss
description: This skill should be used when the user wants to clarify a feature's intent before speccing it in a devloop project — when they say "discuss this feature", "clarify the requirements", "what's unclear about X", "triage this feature", or when a feature idea is too vague to spec without guessing, or when a later pipeline stage surfaces a REGATE spec-invalidating discovery that must be folded back into intent. Records the surviving questions and their answers or assumptions in specs/<slug>/INTENT.md and ASSUMPTIONS.md; an `auto` token in the invocation selects autonomous mode (reversible assumptions instead of questions).
argument-hint: "<feature-name> [auto]"
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

The feature name is `$ARGUMENTS` (slash-invoked) or inferred from the conversation / asked when empty
(model-invoked). Slugify it (lowercase, hyphens) → `<slug>`. Gather the bounded working set — read
only what informs this feature, never the whole project:

- `specs/<slug>/INTENT.md` if it already exists — re-invocation **enriches, never clobbers**:
  re-running triage appends only NEW questions (within the caps), continues Q-numbering at the next
  free `Q<N>`, and never renumbers or rewrites existing entries.
- `ROADMAP.md` if present — this feature's row for its **Boundary** and **depends[]**; a pinned
  boundary is a given, not a question.
- `CONSTITUTION.md` if present — conventions already decided there are never asked about.
- **A mid-pipeline discovery stated in the invocation** (a re-gate re-entry: a `REGATE
  spec-invalidating` discovery a later stage surfaced and the user forwarded here) — treat it as
  **triage evidence** and walk the taxonomy against it like any other input. It is ledger material by
  definition (the blocklist carve-out below); recording it is the point.

**Mode:** an `auto` token in the invocation (mirroring implement's `heal` token and plan's
`replan` token) selects autonomous mode. Token absent → interactive.

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
     answerable by reading the repo. **Carve-out:** a discovery stated in the invocation (a re-gate
     re-entry) is ledger material — never dropped as "answerable by reading the repo".
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

   **Record decisions.** A choice that is *settled* — not open — lands as a `## Decisions` `D<N>`
   entry (the decision + a one-line rationale), append-only, IDs never reused. This includes a
   choice the **user volunteered without a question being asked**. A `D<N>` is not a `Q<N>` and is
   not derived from one; the stage=plan D-join checks each surfaces in SPEC or PLAN.

   Write to the exact schemas in `${CLAUDE_PLUGIN_ROOT}/skills/discuss/references/INTENT.md` and
   `${CLAUDE_PLUGIN_ROOT}/skills/discuss/references/ASSUMPTIONS.md` — the single source of truth for both formats.

   **A re-gate discovery lands in one of three shapes** (all recorded in this same Phase-1 write).
   **Dedup first:** a discovery whose fact is already recorded in the ledger — as a `Q<N>`, an
   `## Answers` entry, or a prior Coverage landing — is a duplicate: write **nothing** for it (the
   driver's re-gate no-progress bound depends on this). Otherwise:
   - **Open-question discovery** (the discovery opens a genuine gap) → draft it as a normal `Q<N>`
     (route=user or route=research per answerability); Phase 2 resolves it like any other question.
   - **Determined correction** (the discoverer supplied the evidence; nothing is open) → still write
     the `Q<N>` — `route=user` (the user is the veto surface), `split="<what SPEC assumed> vs <what
     was found>"` — **and immediately
     append its `## Answers` entry citing that evidence, in this same write**. Evidence is an Answer,
     never an ASSUMPTIONS entry (assumptions are chosen defaults, evidence is settled fact).
   - **Settled decision** (a determined correction that needs no question — the choice is simply made,
     with no veto surface to open) → a `## Decisions` `D<N>` entry (the decision + rationale), not a
     `Q<N>`; the stage=plan D-join carries it forward. **The test:** no veto surface = the discovery
     settles a choice the user never expressed a preference about — nothing recorded in the ledger is
     overridden. If it corrects or overrides a recorded Answer, Assumption, or anything the user chose
     or could contest, it is a Determined correction (Q+Answer — the user stays the veto surface),
     never a `D<N>`.
   - **At the cap** (ledger already holds 10 Qs): an **open-question** discovery takes the existing
     drop-or-assume valve (an ASSUMPTIONS entry or a Coverage drop-note). A **determined correction**
     can be neither `Q11` (the lint's hard bound) nor an `A<N>` (evidence is not an assumption) nor
     dropped (proceeding against a known-wrong SPEC is the failure a re-gate exists to prevent) — its
     landing is the **Coverage drop-note carrying the fact + evidence**, and the handoff routes to spec
     revision (spec reads the whole INTENT, Coverage included).

4. **Self-check after every write:**
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/intent-lint.mjs specs/<slug>/INTENT.md` — exit 0 or fix the
   printed violations and re-run before moving on.

## Phase 2 — resolve the route=user questions

**Skip-guard (both modes).** Never re-ask (interactive) or re-assume (autonomous) a `route=user`
question that **already carries a `## Answers` entry** — a determined correction seeds its Answer at
triage time (Phase 1), and re-answering it would duplicate a settled answer. In attended mode, the
closing summary instead **surfaces each such recorded correction for veto** rather than re-asking it.

**Interactive (default).** Batch every **unanswered** `route=user` question into ONE AskUserQuestion
round — ≤4 questions per call, chunked into consecutive calls when more survive; use each question's
`split=` readings as the options. Append the answers as `## Answers` entries (`- **Q<N>**: <answer>`).
Zero unanswered `route=user` questions (all routed to research, or already carrying Answers) → no round
at all: the INTENT stands; the Handoff below picks the destination.

**Autonomous degrade.** Trigger: the `auto` token; or AskUserQuestion absent from the available
tools (a call returns `No such tool available: AskUserQuestion`); or the user declines to answer.
Then self-answer each **unanswered** `route=user` question: choose the **reversible** reading as the
default and append an ASSUMPTIONS entry — `- **A<N>** (Q<N>): assume <chosen>, not <rejected> —
<one-line basis>. affects=<artifact>` — propagating `[irreversible]` from the linked question per the
schema DoD. A-numbering is append-only. **Skip any `route=user` question that already carries a
`## Answers` entry** (per the skip-guard above) — self-answering it would write a duplicate `A<N>` for
a settled answer. **Never self-answer a `route=research` question** — those stay open for the research
stage regardless of mode.

Re-run the Phase 1 lint command after every INTENT or ASSUMPTIONS write — the same INTENT-path
invocation also checks the ASSUMPTIONS sibling — and fix violations before handing off.

## Handoff

State the next step: unresolved `route=research` questions remain → `/devloop:research
<feature-name>`; none → `/devloop:spec <feature-name>` (all-Clear also goes to spec). Standalone only
(skip under the driver): tell the user to run `/clear` (or start a new session) for fresh context
before the next devloop command.

Summarize: questions asked, answers recorded, decisions recorded, recorded determined corrections
awaiting veto, assumptions taken (call out `[irreversible]` ones first), and what research must answer.
