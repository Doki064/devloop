# Build routing — model-tiered delegation while developing devloop

Dev tooling for **building devloop itself**, not a product feature. Ported from the Codex
`subagents_configs` methodology: route each task to the cheapest role + effort that reliably completes
it. The model/effort **pin is deterministic once a subagent is dispatched**; *whether* to delegate is a
judgment this doc guides. A `UserPromptSubmit` hook (`.claude/settings.json`) surfaces this rule in
context each turn so the harness's "don't spawn agents unless asked" default doesn't silently win — but
no hook can *force* a delegation; treat the shapes below as the default here, not a suggestion.

> Separate from devloop's **product** model-routing (Phase-5 `model/cost config + kill switch`, see
> `docs/ARCHITECTURE.md`). Don't conflate them: this lives in `.claude/` + `docs/methodology/` and
> ships with nothing.

## Core principle
Do heavy reasoning **in the parent (Opus)** by default. Delegate only for concrete gain: a cheaper
model reliably suffices, the subwork would flood the parent's context, or tasks can run in parallel.
Pick the **cheapest role + effort** that still does the job well.

## The decision rule (do / don't delegate)
- **Don't** delegate a trivial, known-target one-liner the parent finishes in a couple of tool calls —
  dispatch overhead outweighs the saving. Just do it inline.
- **Do** delegate when the task is:
  - a **read-heavy sweep** (locate/trace code) → `dev-scout` (or built-in `Explore` for a very broad
    fan-out);
  - a **small, mechanical, well-specified edit** in 1–2 files → `dev-quick`;
  - a **bounded, substantial change + tests** → `dev-impl`.
- **One subagent per task.** Trust its cited findings — don't re-derive what it already reported.

## Task → agent → tier
| Task shape | Route to | model / effort |
|---|---|---|
| Locate / trace code, gather contracts (read-only) | `dev-scout` | sonnet / medium |
| Very broad multi-location fan-out search | `Explore` (built-in) | — |
| Mechanical, well-specified 1–2 file edit | `dev-quick` | haiku / low |
| Multi-file change + tests, needs reasoning | `dev-impl` | sonnet / high |
| Spec / plan / design / architecture / heavy reasoning | **parent** | opus |
| Code review of a change | `pr-review-toolkit:code-reviewer` or parent | opus (top tier) |
| Commit / push | `commit-commands` skills / parent | — |

The tiering mirrors the source's shape: one **Sonnet workhorse** varied by effort (scout medium, impl
high), the **model upgraded to Opus only for review/heavy reasoning**, plus one deliberate **Haiku
floor** for the purely mechanical `dev-quick` tier. Tiers are tunable — bump an agent's `model:`/
`effort:` in `.claude/agents/` if it under-performs.
