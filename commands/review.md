---
description: Run the devloop review stage — a qualitative, advisory quality pass over a feature's PLAN or implementation (findings only, never a gate).
argument-hint: "<feature-name> [target=plan|impl]"
---

Use the `review` skill to run the review stage for the feature: **$ARGUMENTS**

The skill dispatches the `reviewer` agent to read the feature's `specs/<slug>/` + its changed code and
return terse, advisory one-line findings (target defaults to `impl`). Findings never gate — verify
gates each seam. If no feature name was given above, ask for one before proceeding.
