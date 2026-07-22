---
name: release-methodology
description: Load the devloop pre-release smoke methodology and run a smoke round
argument-hint: <release tag or none>
allowed-tools: Bash(cat docs/methodology/release.md)
disable-model-invocation: true
---
Pre-release smoke methodology playbook:

!`cat docs/methodology/release.md`

---

If the playbook above is empty (injection didn't resolve), Read `docs/methodology/release.md` before proceeding.

Follow the method to run the pre-release smoke round: **$ARGUMENTS**

## Closing step — required, not conditional
Before you end, emit exactly one line:
`self-assessment: <the one durable learning + its minimal-diff proposal | none>`
`none` is a valid, expected value — the **absence** of the line is the failure, not a `none`. If a
**durable** improvement surfaced (one that would change a future outcome, not a one-off), the line
names it and the **minimal diff** to `docs/methodology/release.md`; apply that diff **only on the
user's confirm** — never silently rewrite. Prune test: tighten/replace a line, don't append unbounded.
Public doc — no secrets, credentials, absolute/personal paths, or session-specific data. On confirm,
commit as a focused `docs(methodology): …` change.
