---
description: Run the devloop doctor stage — diagnose a feature's pipeline health (marker/artifact consistency, dirty tree, git hygiene) and optionally apply work-safe fixes.
argument-hint: "[<feature-name>] [--fix]"
---

Use the `doctor` skill to diagnose pipeline health for the feature: **$ARGUMENTS**

The skill dispatches the `doctor` agent to reasoning-blindly check the resume-core machine state (`.done`
markers, `.devloop/active`) against the artifacts and git, reporting a verdict (CLEAN/ISSUES/BLOCK). Pass
`--fix` to apply the work-safe repairs (delete an orphaned marker, clear a stale pointer) — a dirty tree
is always preserved, never discarded. If no feature name is given, doctor targets the in-flight feature
from `.devloop/active`; if there is none, it asks for one.
