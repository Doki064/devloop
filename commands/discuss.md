---
description: Run the devloop discuss stage — triage a feature's uncertainty, ask only the surviving questions, and record them with their answers or assumptions in specs/<slug>/INTENT.md and ASSUMPTIONS.md.
argument-hint: "<feature-name> [auto]"
---

Use the `discuss` skill to run the discuss stage for the feature: **$ARGUMENTS**

The skill triages what is genuinely unclear before any answering, asks only the questions that
survive filtering (an `auto` token selects autonomous mode: reversible assumptions instead of
questions), and writes `specs/<slug>/INTENT.md` + `ASSUMPTIONS.md` — or nothing when intent is
already clear. If no feature name was given above, ask for one before proceeding.
