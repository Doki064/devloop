# RESEARCH.md — artifact contract

- **Purpose:** distilled findings answering the INTENT questions routed to research — evidence-up,
  a decision record, never a transcript. Bounded: no finding without a Q-id.
- **Location:** `specs/<slug>/RESEARCH.md` · **Durability:** EPHEMERAL (ship-time archival is
  `DEFERRED(Phase 4)` — see `skills/ship/SKILL.md`; currently left in place, not archived).
- **Writer:** the research stage — researchers *return* findings; the dispatching skill merges
  parallel returns into this one file, section-targeted. Header records mode.

```markdown
# Research: <feature name>  (mode=brownfield)

## Findings
- **Q2** [high]: p95<200ms is the platform norm; adopt it. — docs/slo.md:12

## Evidence Against
- **Q2**: none found.

## Unanswered
- **Q4**: queue internals undocumented → risk: PLAN may double-build a worker; flag at plan review.
```

One line per finding: `Q<N>` · confidence `[high|med|low]` · the answer · a concrete source
(external URL for greenfield; `file:line` allowed in brownfield). The source is the text after the
line's **last** ` — ` separator — answer prose may contain spaced em dashes, the source must not.
Unanswered questions become **named risks** — spec converts each to `[NEEDS CLARIFICATION]` or a
`manual` AC citing the `Q<N>`.

**Evidence Against (mandatory section).** A finding records only what it hunted *for*; this section
records what it hunted *against*. Every finding's `Q<N>` gets a line here stating the disconfirming
evidence found, or the literal `none found` when the counter-hunt turned up nothing — the section is
**never absent** and no finding's Q is silently skipped. When counter-evidence exists, cite it
source-last under the same ` — ` rule as a finding. Absence of this section, or a Q with no entry,
means the disconfirming pass was not done.

**No unsourced findings.** A claim you cannot source is never dressed as a sourced finding. It is
either an Unanswered risk, or — when research proceeds on it as a working assumption — tagged
`ASSUMPTION` inline in its finding or evidence line, where downstream readers (spec's existing
ASSUMPTIONS wiring, and the human) see it. The `ASSUMPTION` tag is the honest marker for a belief
without a citation; a fabricated source is a defect.

**Spike verdicts.** A feasibility question reading cannot settle may be answered by a time-boxed
throwaway spike (worktree procedure: see the researcher agent). Its verdict is a normal Findings
line — `VALIDATED:` or `INVALIDATED:` leads the answer, the evidence follows, and the source marks
the spike as `spike: <ref>`, where `<ref>` obeys the mode source rule above (a URL in greenfield; a
`file:line` or URL in brownfield). For example:

    - **Q5** [high]: VALIDATED: a 30-line spike streamed 1e6 rows at constant memory. — spike: src/stream.mjs:31

**Hard rule:** spike code never merges and the worktree is removed regardless of outcome — the
verdict line is the only surviving artifact, so there is no prototype to promote.

**Definition of Done:**
- [ ] Header records `mode`.
- [ ] Every INTENT question with `route=research` appears exactly once — in Findings **or** Unanswered.
- [ ] Every finding has a confidence tag and a concrete source; no finding without a `Q<N>` (no unsolicited research).
- [ ] `## Evidence Against` is present with a line per finding's `Q<N>` (`none found` when empty) — never absent. Presence is byte-checked (`intent-lint … stage=research`); per-finding coverage and the honesty of each entry are author-checked.
- [ ] No sourceless finding: an unsourceable claim is an Unanswered risk or a Finding tagged `ASSUMPTION` inline, never a bare (untagged) Finding.
- [ ] Every Unanswered entry names its downstream risk.
</content>
