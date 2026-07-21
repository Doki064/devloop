---
name: doctor
description: This skill should be used when the user wants to diagnose a devloop project's pipeline health — when they say "run doctor", "check pipeline health", "is the resume state consistent", "diagnose this feature", or invoke /devloop:doctor. Delegates to the doctor agent, which reasoning-blindly checks the resume-core machine state (.done markers, .devloop/active) against artifacts + git and applies only work-safe fixes with --fix. Also called by the driver pre-resume so an inconsistent state self-heals instead of dead-ending.
allowed-tools:
  - Read
  - Task
---

# doctor — diagnose pipeline health (reasoning-blind)

This is a **thin** stage: it delegates the real work to the `doctor` agent, which reads its own bounded
set (the feature's `.done` markers, `SPEC.md`/`PLAN.md`, `.devloop/active`, and git) via a deterministic
scanner and reports a verdict. Keeping the diagnosis in the agent preserves context hygiene — the caller
sees only the verdict + what was fixed, never the scan noise.

## Process

1. **Resolve the slug.** If a feature name was given, slugify it (lowercase, hyphens) → `<slug>`. If
   **none** was given, read `.devloop/active` (the in-flight pointer) and use its trimmed content as the
   slug. If there is no argument **and** no `.devloop/active`, stop and report: *"no active feature —
   pass a feature name (`/devloop:doctor <feature>`)."* Do not guess.

2. **Parse the flags.** `--fix` → apply the safe fixes (default off: diagnose only). `--mode auto` → the
   fail-closed pre-resume posture (default `attended`, for a human-run diagnosis). The driver passes
   `--mode auto --fix`; a human typically runs with neither, or with `--fix` to repair.

3. **Dispatch the `doctor` agent** via Task, passing `<slug>`, `mode`, and whether to `fix`. The agent
   runs the scanner and owns the classification — do not read markers or run git in this context.

4. **On return, surface the verdict.** Report the agent's summary: the verdict (`CLEAN`/`ISSUES`/`BLOCK`),
   anything it fixed, and — for a `BLOCK` — the blocking reason and its remedy (a dirty tree is
   **preserved**, never discarded; committed markers need gitignoring; an unresolved stale marker needs
   `--fix`). Surface a `BLOCK` plainly — never paper over it.

## Handoff

Standalone, doctor just reports (and optionally repairs) — the human acts on it, then runs the
pipeline stage the verdict points to. **Under the driver**, doctor runs pre-resume
(`skills/drive/SKILL.md`): `CLEAN`/`ISSUES` lets the resume proceed against the now-consistent state;
`BLOCK` stops the resume with doctor's reason. Standalone only (skip under the driver): tell the user
to run `/clear` (or start a new session) for fresh context before the next devloop command.
