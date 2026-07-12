---
description: Run the devloop verify stage — reasoning-blindly grade a feature against its SPEC and write VERIFY.md.
argument-hint: "<feature-name> [stage=plan|impl]"
---

Use the `verify` skill to run the verify stage for the feature: **$ARGUMENTS**

The skill dispatches the `verifier` agent to build the VERIFY.md trace matrix from real test output,
artifacts, and the git log (stage defaults to `impl`). If no feature name was given above, ask for one
before proceeding.
