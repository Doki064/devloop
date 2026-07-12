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

When you finish, self-assess against the playbook: did following it work, or did you deviate, hit a
gap, or find a stale claim? If a **durable** improvement surfaced (one that would change a future
outcome, not a one-off), propose a **minimal diff** to `docs/methodology/planning.md` and apply it
**only on the user's confirm** — never silently rewrite. Keep the prune test: prefer tightening or
replacing a line over appending; don't let the playbook grow unbounded. This is a **public** doc —
keep any proposed change generic: never write secrets, credentials, absolute/personal paths, or
session-specific data into it. On confirm, commit it as a focused `docs(methodology): …` change.
