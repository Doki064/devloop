---
description: Load the devloop planning methodology and apply it to a slice
argument-hint: <slice or planning task>
allowed-tools: Bash(cat docs/methodology/planning.md)
disable-model-invocation: true
---
Planning methodology playbook:

!`cat docs/methodology/planning.md`

---

If the playbook above is empty (injection didn't resolve), Read `docs/methodology/planning.md` before proceeding.

Follow the method to plan / plan-review / refine: **$ARGUMENTS**

## Closing step — required, not conditional
Before you end, emit exactly one line:
`self-assessment: <the one durable learning + its minimal-diff proposal | none>`
`none` is a valid, expected value — the **absence** of the line is the failure, not a `none`. If a
**durable** improvement surfaced (one that would change a future outcome, not a one-off), the line
names it and the **minimal diff** to `docs/methodology/planning.md`; apply that diff **only on the
user's confirm** — never silently rewrite. Prune test: tighten/replace a line, don't append unbounded.
Public doc — no secrets, credentials, absolute/personal paths, or session-specific data. On confirm,
commit as a focused `docs(methodology): …` change.
