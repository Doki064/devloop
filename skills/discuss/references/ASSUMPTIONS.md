# ASSUMPTIONS.md — artifact contract

- **Purpose:** defaults chosen without the user — the audit trail that makes autonomous degrade
  safe. Ship surfaces the whole file in the PR for human confirmation ([irreversible] first).
- **Location:** `specs/<slug>/ASSUMPTIONS.md` · **Durability:** EPHEMERAL (archived on ship).
- **Writers:** discuss in autonomous mode (self-Q&A); triage's record-as-assumption filter.

```markdown
# Assumptions: <feature name>

- **A1** (Q3): assume soft-delete, not hard-delete — reversible default when the user is absent. affects=SPEC [irreversible]
- **A2** (—): assume CSV output, not XLSX — no format stated; CSV is the platform default. affects=PLAN
```

Fields: stable `A<N>` · `(Q<N>)` when it resolves a ledger question, `(—)` for a spot default with
no gate question · chosen **and** rejected reading (mirrors `split=`) · one-line basis ·
`affects=` · optional `[irreversible]`. **A-numbering is append-only:** whichever stage writes next
continues at the next free `A<N>` — one appender at a time (stages run sequentially, including
re-gated re-runs), the same single-writer principle as INTENT's sections.

**Definition of Done:**
- [ ] Every entry: `A<N>`, chosen default + rejected alternative, basis, `affects=`.
- [ ] `(Q<N>)` link present whenever the entry resolves an INTENT question.
- [ ] An entry resolving an `[irreversible]` `Q<N>` carries `[irreversible]` (the tag propagates, so ship surfaces it first — never silently assumed).
- [ ] No entry duplicates a user answer or research finding (those are not assumptions).
