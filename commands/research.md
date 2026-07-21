---
description: Run the devloop research stage — answer a feature's open route=research questions from INTENT.md and record sourced findings in RESEARCH.md.
argument-hint: "<feature-name>"
---

Use the `research` skill to run the research stage for the feature: **$ARGUMENTS**

The skill dispatches `researcher` agents (parallel when questions are independent) and merges
their findings into `specs/<slug>/RESEARCH.md`; unanswered questions become named risks for spec.
If no feature name was given above, ask for one before proceeding.
