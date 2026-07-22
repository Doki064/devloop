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

**Mark the active feature** (so a later doctor/resume knows what's mid-flight — machine state, `.devloop/`
is gitignored): `printf '%s' <slug> | node ${CLAUDE_PLUGIN_ROOT}/scripts/atomic-write.mjs
.devloop/active` (overwrite; **no** `--once`). A nonzero exit is a **warning, not a stop** — the pointer
aids the pre-resume doctor (below) and a later resume; this run reads markers directly.
`${CLAUDE_PLUGIN_ROOT}` resolves to the plugin dir (the plugin-wide convention), so the shared
`scripts/atomic-write.mjs` is reachable from any target project.

**Pre-resume health check (doctor).** If **any** `specs/<slug>/*.done` marker exists — i.e. this is a
resume; a fresh run has none, so it pays nothing — invoke the `doctor` skill (Skill tool) with the slug,
`--mode auto --fix`, **before** computing entry. doctor reasoning-blindly checks the resume-core state
(marker/artifact consistency, dirty tree, git hygiene) and applies only work-safe fixes (deletes an
orphaned marker, clears a stale pointer — it **preserves** a dirty tree, never discards):
- **`CLEAN`/`ISSUES`** (any safe fixes applied) → continue; compute entry against the now-consistent state.
- **`BLOCK`** → **STOP** and surface doctor's reason (a dirty tree to commit/stash, committed `.done`
  markers to gitignore, or an inconsistency it could not safely repair). Do not resume over a `BLOCK` —
  this is the self-heal-or-fail-closed boundary the raw fail-closed check below used to dead-end at.

**Resume entry — skip stages already completed.** drive is resumable by re-invocation: a run cut short
(context limit, Ctrl-C, crash) is continued by running `/devloop <feature>` again. Each stage drops a
write-once `specs/<slug>/<stage>.done` marker (via the same helper) as its gate clears. Compute
**entry = the first of [spec, plan, implement] whose `.done` marker is absent** (all three present →
enter at step 6 to reconfirm), then **skip only the stages strictly before `entry` and run `entry`
onward** — `entry` is the sole governing rule. Do **not** skip a later stage just because its marker
happens to be present: markers are best-effort, so a lost earlier marker can leave a non-monotonic set
(e.g. `spec.done` missing but `plan.done` present); re-running from `entry` regenerates the downstream
artifacts and never runs a stage against a now-stale upstream one. **The precondition above and step 2
(feature branch) always run regardless of entry** — they are idempotent and every downstream stage
needs the branch.

**Fail-closed on inconsistent state (never skip into a missing artifact).** Before skipping a completed
stage, confirm its artifact is still on disk — applied *uniformly* by entry point:
- entry ≥ plan ⇒ `specs/<slug>/SPEC.md` must exist.
- entry ≥ implement (incl. all-present) ⇒ `SPEC.md` **and** `PLAN.md` must exist.

Any required upstream artifact missing while its `.done` marker is present → **STOP**: `inconsistent
resume state: <file> is missing but <stage>.done is present. Delete specs/<slug>/<stage>.done to force a
clean re-run` (the pre-resume doctor above normally repairs this by deleting the orphaned marker — this
is a cheap secondary guard for the case doctor was unavailable or degraded). Do not guess; do not proceed.

1. **spec** — invoke the `spec` skill (Skill tool) with the feature name. spec is interactive; its
   questions surface normally here. **Gate:** confirm `specs/<slug>/SPEC.md` exists (Glob). If not,
   stop and report — spec did not produce a contract. **On pass, drop the marker:** `date -u
   +%Y-%m-%dT%H:%M:%SZ | node ${CLAUDE_PLUGIN_ROOT}/scripts/atomic-write.mjs
   specs/<slug>/spec.done --once` (nonzero exit → warn, don't stop — a lost marker only re-runs spec
   next resume). *(Skipped entirely when resuming past spec.)*

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

4. **plan→implement seam** (the wiring this stage adds) — a **convergence-terminated re-plan loop**
   wrapping the mechanical plan-verify gate and the advisory plan-review. Track `prev_count = -1` as loop
   state. Each iteration:
   <!-- DEFERRED(Phase 3): route a spec-invalidating REGATE surfaced by re-plan out of this loop (drive-integration slice). -->
   1. **plan-verify** — `verify` skill with `stage=plan`, the mechanical coverage check. **This gates:**
      an orphan-requirement / coverage BLOCK stops the run **before implement** — surface the BLOCK rows
      and stop. Do **not** drop `plan.done` here (see the terminal below): a per-iteration drop on PASS
      would let a *later* re-plan's coverage BLOCK be skipped on resume.
   2. **plan-review** — `review` skill with `target=plan`, advisory. The reviewer writes
      `specs/<slug>/REVIEW.md` and returns findings; **surface** the one-line findings (never a blocker).
   3. **Decide** — `node ${CLAUDE_PLUGIN_ROOT}/scripts/replan-decision.mjs specs/<slug>/REVIEW.md
      <prev_count>` prints one line (it re-plans only while the finding count *strictly shrinks*, which
      bounds the loop structurally — no fixed cap):
      - `replan <count>` → set `prev_count = <count>`, invoke the `plan` skill with a **`replan`** token
        (the planner reads REVIEW.md and revises PLAN.md to resolve the findings), then **loop back to
        sub-step 1** — the new plan is re-verified, so a re-plan-introduced BLOCK is caught next iteration.
      - `continue 0 no-review` → REVIEW.md is **absent** (the reviewer failed to write it; count is
        always 0 here). Warn `review produced no REVIEW.md; continuing` and fall through to the terminal —
        advisory, never blocks.
      - `continue <count> clean|no-progress` → fall through to the terminal (findings converged, or the
        set stopped shrinking; either way review is advisory, so **continue to implement**, never stop —
        the deliberate inverse of the self-heal loop's fail-closed exhaustion in step 6a).
   **Loop terminal (any `continue`).** A `continue` is only reachable *after* this iteration's plan-verify
   PASS (a BLOCK stops the loop above), so the plan stage has cleared its gate. **Drop the marker now:**
   `date -u +%Y-%m-%dT%H:%M:%SZ | node ${CLAUDE_PLUGIN_ROOT}/scripts/atomic-write.mjs specs/<slug>/plan.done
   --once` (nonzero → warn). The marker means *plan stage cleared incl. its gate*; dropping it only here
   (never on a per-iteration PASS) keeps a resume from skipping into implement over a re-plan's live BLOCK.
   Any findings still present are advisory (surfaced + in REVIEW.md) — they never block the seam.

5. **implement** — invoke the `implement` skill (Skill tool) with the feature name. If the
   implementer reports a task it could **not** drive to GREEN (or a test command that errors),
   **early-exit** here — but the true gate is the next step: a false "success" still fails
   verify(impl).

6. **verify (impl)** — invoke the `verify` skill with `stage=impl` (the default). **This is the
   artifact gate for the implement seam**, not the implementer's word — it reasoning-blindly grades
   real test output + git. Read `specs/<slug>/VERIFY.md`: `## Verdict` **PASS** → the seam clears; **drop
   the marker** `date -u +%Y-%m-%dT%H:%M:%SZ | node ${CLAUDE_PLUGIN_ROOT}/scripts/atomic-write.mjs
   specs/<slug>/implement.done --once` (nonzero → warn), then go to step 7. The marker lands on verify
   PASS, not on the implementer returning — implement isn't "done" until GREEN.
   **On FAIL or any BLOCK**, branch on how this run reached step 6:
   - **Resumed with `implement.done` already present** (entered here without running implement this
     invocation): this is a **regression** — the marker asserts the feature *was* GREEN, so a FAIL is a
     broken premise, not a fresh failure. **STOP** (fail-closed): `previously-completed feature now fails
     verify — state changed under resume; inspect, or delete specs/<slug>/implement.done to re-heal`. Do
     **not** silently re-enter the heal loop (auto-healing would misreport a lost-commits regression as a
     re-plan coverage gap).
   - **Otherwise** (implement ran this invocation, `implement.done` absent) → enter the **self-heal
     loop** (6a). Implement is not yet done, so a FAIL is a fresh failure to heal.

6a. **Self-heal loop** (replaces the Phase-1 report-and-stop). Compute the **failing set** = the
    VERIFY.md `## Trace matrix` rows whose `result` is **not** `PASS`/`MANUAL`, plus any BLOCK rows
    under `## Unmapped`. Then loop, **cap 3 attempts**:
    1. **Arm the guard** — `mkdir -p .devloop && : > .devloop/heal-active` (rewrite it fresh each
       attempt; its mtime is the guard's liveness signal). While it exists the `heal-guard` hook
       freezes the SPEC + this feature's tests, so the re-implement can change **only code** — it
       cannot reward-hack the reasoning-blind verifier by weakening a test.
    2. **Re-implement in heal-mode** — invoke the `implement` skill with a **`heal`** token. The
       implementer reads VERIFY.md's failing rows, fixes the code, and commits each fix as
       `feat(<scope>)`. **If it returns stop-and-surface** (a failing AC has **no committed test** — a
       coverage/plan gap it must not paper over): clear the marker (`rm -f .devloop/heal-active`) and
       **early-exit**, reporting the gap as **re-plan territory** (distinct from a no-progress abort).
       Do not re-verify.
       <!-- DEFERRED(Phase 3): tier-route the stop-and-surface early-exit on the REGATE line (plan-only → replan, spec-invalidating → discuss re-entry incl. stale .done marker invalidation) — drive-integration slice. -->
    3. **Disarm the guard** — `rm -f .devloop/heal-active`, on **every** path out of the attempt
       (normal and error), so a later standalone `implement` never inherits a stale freeze.
    4. **Re-verify** — invoke `verify stage=impl` again; recompute the failing set from the new
       VERIFY.md. `## Verdict` **PASS** → healed; **drop `implement.done`** (same command as step 6),
       then go to step 7. New failing set **not a strict subset**
       of the previous (it didn't shrink) → **no-progress abort**: report the still-failing rows and
       stop (a mixed set with one un-healable AC surfaces the whole set here — deliberate fail-closed).
       Otherwise loop, up to the cap.
    **Exhausted** (3 attempts, still failing) → report the remaining failing ACs + "heal exhausted",
    stop. Always leave `.devloop/heal-active` cleared when the loop ends.

7. **Commit the process artifacts** (before handing off to ship). spec/plan write inline and the
   implementer commits only code+tests, so `SPEC.md`/`PLAN.md`/`VERIFY.md` are still uncommitted —
   ship's PR body links to `specs/<slug>/SPEC.md`, which must be in git history to resolve. Commit
   them onto the feature branch — **scope the add to the `.md` artifacts, never `git add specs/<slug>`**,
   so the `*.done` resume markers (machine-local skip-hints) are not swept into git history where a clone
   would see them and skip stages it never ran: `git add specs/<slug>/*.md && git diff --cached --quiet
   || git commit -m "docs(<slug>): pipeline artifacts"`. The `git diff --cached --quiet ||` guard makes
   this idempotent (a resume that re-enters here with nothing new to commit is a no-op, not a `git
   commit` error). Use a **`docs(` type, never `feat(`** — the TDD hook only scrutinizes `feat(<scope>):`
   subjects. (This runs *after* verify so it never pollutes the verifier's git-log TDD-pair scan.)
   *(The target project should gitignore `specs/**/*.done`; doctor flags committed markers as a git-hygiene
   finding, but writing the gitignore entry stays an init-slice concern — not wired here.)*

8. **Stop at the ship boundary.** Do **not** invoke ship — it is `disable-model-invocation` by
   design (pushing the branch + opening the PR is the human checkpoint). Report that the feature is
   verified and ready, and instruct per the Handoff below: run `/clear` (or start a new session) for
   fresh context, then `/devloop:ship <feature-name>` to push the branch and open the PR.

**On any stage failure** (a missing artifact, a BLOCK, a task that won't go GREEN, or a verify FAIL the
self-heal loop could not clear): report **which stage** stopped the run and the artifact/BLOCK/failing
rows behind it, then stop. Do **not** blind-retry a stage — re-running a deterministic stage on
*unchanged* inputs just re-fails. The two principled retries both re-run on *changed* inputs and are
bounded with a no-progress abort: the **re-plan loop** (step 4, re-runs plan on revised REVIEW.md
findings, bounded by strict finding-count decrease — advisory, so it *continues* on no-progress) and the
**self-heal loop** (step 6a, re-implements from VERIFY.md failing rows, capped at 3 — a gate, so it
*stops* on no-progress). Everything else fails closed rather than blind-retrying.
<!-- Resume core + doctor built: `.done` markers (atomic write via scripts/atomic-write.mjs),
     `.devloop/active` pointer, resume-entry, fail-closed on inconsistent state, and the pre-resume doctor
     (marker/artifact consistency + safe-fix, dirty-tree preserve + fail-closed-unattended, git hygiene).
     DEFERRED(Phase 5): PROGRESS.md (a derived per-task snapshot) + PreCompact checklist flush — polish
     over an already-working git-based resume; no consumer yet. -->

## Handoff

Terminal state is **"verified PASS, ready to ship"** — drive stops one deliberate step short of the
side effect. Tell the user: run `/clear` (or start a new session) for fresh context, then
`/devloop:ship <feature-name>`; the PR is the checkpoint. If verify carried any `MANUAL` named-hole
rows, name them so the shipper knows what the PR will surface.
