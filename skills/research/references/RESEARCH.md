# RESEARCH.md — artifact contract

- **Purpose:** distilled findings answering the INTENT questions routed to research — evidence-up,
  a decision record, never a transcript. Bounded: no finding without a Q-id.
- **Location:** `specs/<slug>/RESEARCH.md` · **Durability:** EPHEMERAL (archived on ship).
- **Writer:** the research stage — researchers *return* findings; the dispatching skill merges
  parallel returns into this one file, section-targeted. Header records mode.

```markdown
# Research: <feature name>  (mode=brownfield)

## Findings
- **Q2** [high]: p95<200ms is the platform norm; adopt it. — docs/slo.md:12

## Unanswered
- **Q4**: queue internals undocumented → risk: PLAN may double-build a worker; flag at plan review.
```

One line per finding: `Q<N>` · confidence `[high|med|low]` · the answer · a concrete source
(external URL for greenfield; `file:line` allowed in brownfield). The source is the text after the
line's **last** ` — ` separator — answer prose may contain spaced em dashes, the source must not.
Unanswered questions become **named risks** — spec converts each to `[NEEDS CLARIFICATION]` or a
`manual` AC citing the `Q<N>`.

**Definition of Done:**
- [ ] Header records `mode`.
- [ ] Every INTENT question with `route=research` appears exactly once — in Findings **or** Unanswered.
- [ ] Every finding has a confidence tag and a concrete source; no finding without a `Q<N>` (no unsolicited research).
- [ ] Every Unanswered entry names its downstream risk.
