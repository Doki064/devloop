---
description: Run the devloop ship stage — gate on the feature's VERIFY.md PASS verdict, then push the current branch and open a PR.
argument-hint: "<feature-name>"
---

Use the `ship` skill to run the ship stage for the feature: **$ARGUMENTS**

The skill gates on `specs/<slug>/VERIFY.md` being PASS, then pushes the **current branch** and opens
a PR (never merges, force-pushes, or pushes to the default branch). If no feature name was given
above, ask for one before proceeding.
