---
description: Run the whole devloop pipeline for a feature — discuss → research → spec → plan → implement → verify — then hand off to ship.
argument-hint: "<feature-name>"
---

Use the `drive` skill to run the full devloop pipeline for the feature: **$ARGUMENTS**

The skill sequences discuss → research (both uncertainty-gated — skipped when intent is already clear) → spec → plan → (plan-verify + plan-review) → implement → verify autonomously, routes mid-pipeline REGATE discoveries back to the tier that owns them, and stops at the ship boundary, reporting the `/devloop:ship` handoff. If no feature name was given above, ask for one before proceeding.
