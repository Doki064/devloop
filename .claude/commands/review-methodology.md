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

When you finish, self-assess against the playbook: did following it work, or did you deviate, hit a
gap, or find a stale claim? If a **durable** improvement surfaced (one that would change a future
outcome, not a one-off), propose a **minimal diff** to `docs/methodology/review.md` and apply it
**only on the user's confirm** — never silently rewrite. Keep the prune test: prefer tightening or
replacing a line over appending; don't let the playbook grow unbounded. This is a **public** doc —
keep any proposed change generic: never write secrets, credentials, absolute/personal paths, or
session-specific data into it. On confirm, commit it as a focused `docs(methodology): …` change.
