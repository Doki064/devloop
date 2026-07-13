---
description: Load the devloop cross-review methodology and apply it to a landed slice
argument-hint: <slice that landed>
allowed-tools: Bash(cat docs/methodology/review.md)
disable-model-invocation: true
---
Cross-review methodology playbook:

!`cat docs/methodology/review.md`

---

If the playbook above is empty (injection didn't resolve), Read `docs/methodology/review.md` before proceeding.

Follow the method to cross-review the landed slice: **$ARGUMENTS**

## Closing step — required, not conditional
Before you end, emit exactly one line:
`self-assessment: <the one durable learning + its minimal-diff proposal | none>`
`none` is a valid, expected value — the **absence** of the line is the failure, not a `none`. If a
**durable** improvement surfaced (one that would change a future outcome, not a one-off), the line
names it and the **minimal diff** to `docs/methodology/review.md`; apply that diff **only on the
user's confirm** — never silently rewrite. Prune test: tighten/replace a line, don't append unbounded.
Public doc — no secrets, credentials, absolute/personal paths, or session-specific data. On confirm,
commit as a focused `docs(methodology): …` change.
