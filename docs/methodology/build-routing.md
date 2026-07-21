# Build routing — model-tiered delegation while developing devloop

Dev tooling for **building devloop itself**, not a product feature. Route each task to the cheapest
role + effort that reliably completes it; the model/effort **pin is deterministic once dispatched** —
*whether* to delegate is the judgment this doc guides.

> Separate from devloop's *product* model-routing (Phase 5, `docs/ARCHITECTURE.md`) — this lives in
> `.claude/` + `docs/methodology/` and ships with nothing.

## The decision rule (do / don't delegate)
- Delegate for concrete gain — a cheaper model reliably suffices, the subwork would flood the parent's
  context, or tasks can run in parallel.
- **Don't** delegate a trivial, known-target one-liner the parent finishes in a couple of tool calls —
  dispatch overhead outweighs the saving. Just do it inline.
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

Tiers are tunable — bump an agent's `model:`/`effort:` in `.claude/agents/` if it under-performs.
