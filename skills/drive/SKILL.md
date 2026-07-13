---
name: drive
description: This skill should be used when the user wants to run the whole devloop pipeline for a feature end-to-end in one go — when they say "drive this feature", "run the full loop", "take this from spec to a PR", or invoke /devloop <feature-name>. Sequences spec → plan → implement → verify autonomously, wiring the plan-verify + plan-review seam, and stops at the ship boundary (the human checkpoint). Each stage is also runnable standalone via /devloop:<stage>.
allowed-tools:
  - Skill
  - Task
  - AskUserQuestion
  - Glob
  - Read
  - Bash
  - TodoWrite
---

# drive — sequence the pipeline for one feature (the orchestrator)

The Phase-2 driver: a **fat orchestrator** that runs the Phase-1 stages for one feature in order,
gating each seam on the durable artifact the stage produces — never on a stage's narration (the
same reasoning-blind principle the verifier uses). It drives `spec → plan → implement → verify`
autonomously, wires the plan-verify + plan-review seam the stages defer to it, then **stops at the
ship boundary**: `ship` is `disable-model-invocation` (the human checkpoint), so drive hands off
with an instruction rather than pushing a branch itself.

Each stage remains runnable standalone (`/devloop:<stage> <feature>`); drive just sequences them.

## Inputs

Slugify the feature name you were given (lowercase, hyphens) → `<slug>`. Pass the **raw feature
name** to each stage skill (they slugify themselves identically); use `<slug>` only for drive's own
git/glob operations (branch name, `specs/<slug>/` gates, artifact commit).

## Process

Track the run with **TodoWrite** — one todo per stage below, so the sequence is visible and a
failure shows exactly where it stopped. Mark each done as its gate passes.

**Precondition — fail fast, before step 1.** Confirm a base commit exists:
`git rev-parse --verify --quiet HEAD`. If it fails (unborn HEAD / empty repo), **stop
immediately** — the repo is un-bootstrapped (greenfield bootstrap via `/devloop:init` is out of
scope) and drive needs a base commit to branch from. This runs *before* the interactive spec stage
so an empty repo fails fast, instead of dragging the user through a spec session whose `SPEC.md`
could never be committed or branched from.

1. **spec** — invoke the `spec` skill (Skill tool) with the feature name. spec is interactive; its
   questions surface normally here. **Gate:** confirm `specs/<slug>/SPEC.md` exists (Glob). If not,
   stop and report — spec did not produce a contract.

2. **Feature branch** (must precede any implement commit). Move off the base branch so implement's
   commits don't land on it (else ship later refuses and the run yields no PR). A base commit is
   guaranteed by the precondition above; resolve the default branch the way ship does:
   `git symbolic-ref --short refs/remotes/origin/HEAD` (strip `origin/`), falling back to
   `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`. Then:
   - **default resolved & current branch == default:** move — `git switch <slug> 2>/dev/null ||
     git switch -c <slug>` (the `||` reuses a `<slug>` branch left by a prior run — drive's one
     idempotency concession, not resume).
   - **default resolved & already on a non-default branch:** use it as-is (respect a pre-created
     feature branch).
   - **default unresolvable but the repo has commits** (a **local-only repo with no remote yet** —
     no `origin/HEAD`, `gh` null): *not* un-bootstrapped. The base can't be read from a remote, so
     land on the feature branch by convention: `git switch <slug> 2>/dev/null || git switch -c
     <slug>`. ship (which needs a remote) is the human's next step — a local repo is a valid place
     to drive spec→verify.

3. **plan** — invoke the `plan` skill (Skill tool) with the feature name. **Gate:** confirm
   `specs/<slug>/PLAN.md` exists. The planner's own coverage-gap self-report is an early-exit hint;
   the **mechanical** plan gate is plan-verify (step 4).

4. **plan→implement seam** (the wiring this stage adds). Run **both**:
   - `verify` skill with `stage=plan` — the mechanical coverage check. **This gates:** an
     orphan-requirement / coverage BLOCK stops the run **before implement**. Surface the BLOCK rows.
   - `review` skill with `target=plan` — advisory. **Surface** the one-line findings, then
     **continue regardless** — review never gates (a concern becomes a gate only by being made
     mechanical). Do not loop back to re-plan on findings.
     <!-- DEFERRED(Phase 2): plan-review findings → re-plan loop (review/SKILL.md:50). This stage
          surfaces findings and continues; it does not loop. -->

5. **implement** — invoke the `implement` skill (Skill tool) with the feature name. If the
   implementer reports a task it could **not** drive to GREEN (or a test command that errors),
   **early-exit** here — but the true gate is the next step: a false "success" still fails
   verify(impl).

6. **verify (impl)** — invoke the `verify` skill with `stage=impl` (the default). **This is the
   artifact gate for the implement seam**, not the implementer's word — it reasoning-blindly grades
   real test output + git. **Gate:** `## Verdict` must be `PASS`; on `FAIL` or any BLOCK, report the
   failing rows and stop.
   <!-- DEFERRED(Phase 2): capped self-heal loop back to implement on FAIL + no-progress abort
        (verify/SKILL.md:39). This stage reports and stops. -->

7. **Commit the process artifacts** (before handing off to ship). spec/plan write inline and the
   implementer commits only code+tests, so `SPEC.md`/`PLAN.md`/`VERIFY.md` are still uncommitted —
   ship's PR body links to `specs/<slug>/SPEC.md`, which must be in git history to resolve. Commit
   them onto the feature branch: `git add specs/<slug> && git commit -m "docs(<slug>): pipeline
   artifacts"`. Use a **`docs(` type, never `feat(`** — the TDD hook only scrutinizes
   `feat(<scope>):` subjects. (This runs *after* verify so it never pollutes the verifier's
   git-log TDD-pair scan.)

8. **Stop at the ship boundary.** Do **not** invoke ship — it is `disable-model-invocation` by
   design (pushing the branch + opening the PR is the human checkpoint). Report that the feature is
   verified and ready, and instruct: **run `/devloop:ship <feature-name>`** to push the branch and
   open the PR.

**On any stage failure** (a missing artifact, a BLOCK, a FAIL, a task that won't go GREEN): report
**which stage** stopped the run and the artifact/BLOCK rows behind it, then stop. Do **not** blind-
retry a stage — re-running a deterministic stage on unchanged inputs just re-fails; useful retry is
the self-heal loop (knows *what* to change), which is deferred.
<!-- ponytail: report-and-stop, no retry. Upgrade path: the Phase-2 self-heal slice replaces the
     verify-FAIL stop (step 6) with a capped implement→verify loop. -->
<!-- DEFERRED(Phase 2): resume from artifacts (PROGRESS.md, .done markers, atomic writes, active
     pointer), doctor pre-resume, and fail-closed-unattended posture — drive runs the sequence once,
     start to finish, and each stage self-protects its own precondition. -->

## Handoff

Terminal state is **"verified PASS, ready to ship"** — drive stops one deliberate step short of the
side effect. The human runs `/devloop:ship <feature-name>`; the PR is the checkpoint. If verify
carried any `MANUAL` named-hole rows, name them so the shipper knows what the PR will surface.
