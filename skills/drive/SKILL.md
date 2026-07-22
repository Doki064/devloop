---
name: drive
description: This skill should be used when the user wants to run the whole devloop pipeline for a feature end-to-end in one go — when they say "drive this feature", "run the full loop", "take this from spec to a PR", or invoke /devloop:drive <feature-name>. Sequences discuss → research → spec → plan → implement → verify autonomously — uncertainty-gated front door, the plan-verify + plan-review seam, mid-pipeline REGATE re-entry routing — and stops at the ship boundary (the human checkpoint). Each stage is also runnable standalone via /devloop:<stage>.
argument-hint: "<feature-name>"
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

The devloop driver: a **fat orchestrator** that runs the pipeline stages for one feature in order,
gating each seam on the durable artifact the stage produces — never on a stage's narration (the
same reasoning-blind principle the verifier uses). It drives `discuss → research → spec → plan →
implement → verify` autonomously — the two front-door stages are uncertainty-gated and skip
themselves when intent is already clear — wires the plan-verify + plan-review seam the stages defer
to it, routes mid-pipeline `REGATE` discoveries back to the tier that owns them, then **stops at the
ship boundary**: `ship` is `disable-model-invocation` (the human checkpoint), so drive hands off
with an instruction rather than pushing a branch itself.

Each stage remains runnable standalone (`/devloop:<stage> <feature>`); drive just sequences them.

## Inputs

The feature name is `$ARGUMENTS` (slash-invoked) or inferred from the conversation / asked when empty
(model-invoked). Slugify it (lowercase, hyphens) → `<slug>`. Pass the **raw feature
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
(context limit, Ctrl-C, crash) is continued by running `/devloop:drive <feature>` again. Each stage drops a
write-once `specs/<slug>/<stage>.done` marker (via the same helper) as its gate clears. Compute
**entry = the first of [discuss, research, spec, plan, implement] whose `.done` marker is absent**
(all five present → enter at step 6 to reconfirm), then **skip only the stages strictly before
`entry` and run `entry` onward** — `entry` is the sole governing rule. Do **not** skip a later stage
just because its marker happens to be present: markers are best-effort, so a lost earlier marker can
leave a non-monotonic set (e.g. `spec.done` missing but `plan.done` present); re-running from `entry`
regenerates the downstream artifacts and never runs a stage against a now-stale upstream one.
**Marker semantics — a stated asymmetry:** `discuss.done`/`research.done` are **evaluation markers**
— they assert the stage's requirement was *evaluated and satisfied* at that point, **not** that an
artifact exists (an absent INTENT.md is the legitimate all-Clear state); spec/plan/implement markers
still imply their artifacts. Re-running discuss or research on a lost marker is safe by construction
(both stages enrich, never clobber — the no-op is the good case). **The precondition above and step 2
(feature branch) always run regardless of entry** — they are idempotent and every downstream stage
needs the branch.

**Fail-closed on inconsistent state (never skip into a missing artifact).** Before skipping a completed
stage, confirm its artifact is still on disk — applied *uniformly* by entry point:
- entry ≥ plan ⇒ `specs/<slug>/SPEC.md` must exist.
- entry ≥ implement (incl. all-present) ⇒ `SPEC.md` **and** `PLAN.md` must exist.

No rows for the front-end markers: there is no artifact whose absence invalidates `discuss.done` or
`research.done` (the evaluation-marker asymmetry above).

Any required upstream artifact missing while its `.done` marker is present → **STOP**: `inconsistent
resume state: <file> is missing but <stage>.done is present. Delete specs/<slug>/<stage>.done to force a
clean re-run` (the pre-resume doctor above normally repairs this by deleting the orphaned marker — this
is a cheap secondary guard for the case doctor was unavailable or degraded). Do not guess; do not proceed.

0a. **discuss** — invoke the `discuss` skill (Skill tool) with the feature name. discuss is
    interactive; its questions surface normally here (the same posture as spec below), and its own
    autonomous degrade covers headless runs — drive passes no `auto` token itself.
    Uncertainty-gating stays **inside** discuss (triage decides; all-Clear writes nothing): drive
    adds no second gate on the way in, only the artifact gate on the way out. **Gate:** if
    `specs/<slug>/INTENT.md` exists, `node ${CLAUDE_PLUGIN_ROOT}/scripts/intent-lint.mjs
    specs/<slug>/INTENT.md` must exit 0 — otherwise **stop** and surface the printed violations.
    INTENT absent is the valid all-Clear skip, not a failure. **On pass, drop the marker:** `date -u
    +%Y-%m-%dT%H:%M:%SZ | node ${CLAUDE_PLUGIN_ROOT}/scripts/atomic-write.mjs
    specs/<slug>/discuss.done --once` (nonzero → warn, don't stop). *(Skipped entirely when resuming
    past discuss; the global re-gate below re-runs this gate on a re-entry.)*

0b. **research** — gate **owed-then-satisfied**: ask whether research is *owed* before whether it is
    *satisfied* — `stage=research` alone cannot distinguish "no research needed" from "research
    missing", so a lint-only gate would wedge on the no-questions case.
    - **Owed?** Research is owed only when `specs/<slug>/INTENT.md` exists **and** its
      `## Questions` section holds a `route=research` entry — checked section-scoped (Bash),
      mirroring the lint's own section semantics: `sed -n '/^## Questions/,/^## /p'
      specs/<slug>/INTENT.md | grep -E '^[[:space:]]*-[[:space:]]+\*\*Q[0-9]+\*\*.*route=research'`
      (POSIX classes — `\s` is GNU-only and would silently miss on BSD grep; section-scoping
      is load-bearing: `## Answers` entries share the exact `- **Q<N>**` line prefix, so a
      whole-file grep would false-trigger on an Answer whose prose cites `route=research` and send
      drive into research with zero coverable questions). No hit, or no INTENT.md → research is
      **not owed**: skip the stage and **drop the marker** — `date -u +%Y-%m-%dT%H:%M:%SZ | node
      ${CLAUDE_PLUGIN_ROOT}/scripts/atomic-write.mjs specs/<slug>/research.done --once` (nonzero →
      warn; the marker records "requirement evaluated", not "artifact produced").
    - **Owed:** run `node ${CLAUDE_PLUGIN_ROOT}/scripts/intent-lint.mjs specs/<slug>/INTENT.md
      stage=research`. Exit 0 (a resume where RESEARCH.md already covers the ledger) → skip the
      invocation and drop the marker. Exit 1 → invoke the `research` skill (Skill tool) with the
      feature name, then re-run that same command as the **gate**: exit 0 → drop the marker; still
      1 → **stop** and surface the violations (a researcher that cannot cover the ledger is a BLOCK
      — the skill's own re-dispatch-once rule already ran inside the invocation). *(Skipped entirely
      when resuming past research; the global re-gate below re-runs this gate on a re-entry.)*

1. **spec** — invoke the `spec` skill (Skill tool) with the feature name. spec is interactive; its
   questions surface normally here. **Gate:** confirm `specs/<slug>/SPEC.md` exists (Glob). If not,
   stop and report — spec did not produce a contract. Then, when `specs/<slug>/INTENT.md` exists,
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/intent-lint.mjs specs/<slug>/INTENT.md stage=spec` must exit
   0 — otherwise **stop** and surface the printed violations (the terminal Q-join, checked
   mechanically at the seam — the same artifact-gate posture as 0a/0b; spec's own self-check is the
   stage's inner loop, this is drive's gate, and it is what confirms a re-gated revision actually
   carried the discovery). INTENT absent → nothing to join, skip the lint. **On pass, drop the marker:** `date -u
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

3. **plan** — invoke the `plan` skill (Skill tool) with the feature name. **REGATE first (return
   site 1 of 4):** if the invocation surfaces a `REGATE spec-invalidating: …` line instead of a plan
   (a first planner run can find the SPEC wrong before writing anything), route to the **global
   re-gate** (below) *before* the existence gate — otherwise the missing PLAN.md would reach
   plan-verify as a confusing anomaly. (The planner never emits `plan-only` — a plan-tier problem
   folds into the plan it owns.) **Gate:** confirm `specs/<slug>/PLAN.md` exists. The planner's own
   coverage-gap self-report is an early-exit hint; the **mechanical** plan gate is plan-verify (step 4).

4. **plan→implement seam** (the wiring this stage adds) — a **convergence-terminated re-plan loop**
   wrapping the mechanical plan-verify gate and the advisory plan-review. Track `prev_count = -1` as loop
   state. Each iteration:
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
        (the planner reads REVIEW.md and revises PLAN.md to resolve the findings). **REGATE (return
        site 2 of 4):** if the re-plan surfaces `REGATE spec-invalidating: …` instead of a revised
        plan, route **out of the loop** to the **global re-gate** (below) — do *not* loop back to
        plan-verify, which would re-verify the unchanged stale PLAN, PASS, and silently drop the
        discovery. Otherwise **loop back to sub-step 1** — the new plan is re-verified, so a
        re-plan-introduced BLOCK is caught next iteration.
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

5. **implement** — invoke the `implement` skill (Skill tool) with the feature name. **REGATE
   (return site 3 of 4):** if the invocation surfaces a `REGATE <spec-invalidating|plan-only>: …`
   line, route **immediately** on the tier word — `plan-only` → the **plan-only route** (below);
   `spec-invalidating` → the **global re-gate** (below). Do not fall through to verify first: that
   would only self-rescue via step 6a after a wasted verify cycle. Otherwise, if the implementer
   reports a task it could **not** drive to GREEN (or a test command that errors), **early-exit**
   here — but the true gate is the next step: a false "success" still fails verify(impl).

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
       `feat(<scope>)`. **If it returns stop-and-surface (return site 4 of 4)** — a heal-mode BLOCK
       carries a `REGATE` line naming its tier: `plan-only` (e.g. a failing AC with **no committed
       test** — a coverage/plan gap it must not paper over) or `spec-invalidating` (the only
       possible fix is a test/SPEC change) — first disarm the guard (`rm -f .devloop/heal-active`,
       sub-step 3's every-exit rule), then route on the tier word: `plan-only` → the **plan-only
       route** (below); `spec-invalidating` → the **global re-gate** (below). Do not re-verify
       first. A stop-and-surface return carrying **no** REGATE line (e.g. a fix that cannot reach
       GREEN) → disarm the guard and **early-exit**, reporting it verbatim (distinct from a
       no-progress abort).
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

**Plan-only route** (from return sites 3 and 4 — the implementer's `REGATE plan-only`; the planner
never emits it). The SPEC holds; the PLAN is invalidated. Quote the REGATE line **verbatim** when
reporting — drive reads only its tier word and treats the rest as prose (nothing splits on the
interior ` — `):
1. **Invalidate the plan-stage markers:** `rm -f specs/<slug>/plan.done specs/<slug>/implement.done`
   (`implement.done` is normally absent — it drops only on verify PASS — but a non-monotonic resume
   set can leave a stale one; markers only, never artifacts).
2. **Re-plan:** invoke the `plan` skill with the **`replan`** token **plus the REGATE line's
   discovery text** (the planner's dual-source re-plan: REVIEW.md and/or the invocation discovery,
   fail-closed on neither).
3. **Re-enter the step-4 seam loop** afresh (`prev_count = -1`) and continue forward from there —
   `plan.done` re-drops at that loop's terminal as normal.

**Global re-gate** (from return sites 1–4 — any `REGATE spec-invalidating`). The contract itself is
in doubt; fold the discovery back through the front door. Quote the REGATE line **verbatim** in every
report (same prose rule as above):
1. **Invalidate the stale markers:** `rm -f specs/<slug>/spec.done specs/<slug>/plan.done
   specs/<slug>/implement.done` — markers only, never artifacts (doctor's own fix idiom; SPEC.md and
   PLAN.md stay on disk for the revision path). `discuss.done`/`research.done` **stay**: the front
   door was evaluated, and the re-entry below re-evaluates it anyway.
2. **Snapshot the ledger** for the progress check: `mkdir -p .devloop`, then copy
   `specs/<slug>/INTENT.md` and `specs/<slug>/ASSUMPTIONS.md` — each *if present* — to snapshot
   copies under `.devloop/`.
3. **Re-enter discuss** — invoke the `discuss` skill (Skill tool) with the feature name **and the
   REGATE line's discovery text** (discuss records it as triage evidence — its blocklist carve-out).
   Then re-run the **step-0a gate** (bare lint; the `--once` marker re-drop is a silent no-op since
   `discuss.done` still exists) and the **step-0b research gate**.
4. **No-progress abort — the `cmp` is the loop bound.** Compare each snapshot against its live file:
   byte **identity** (`cmp`), not length; absent on both sides = unchanged, absent → present =
   progress. If INTENT.md and ASSUMPTIONS.md are both unchanged after the re-entry, the ledger
   recorded nothing new (discuss's already-recorded dedup dropped a repeat discovery) → **stop** and
   surface: the same discovery is cycling without the ledger moving. This bound is the deliberate
   sibling of replan-decision's strictly-shrinking rule and the heal loop's no-progress abort; the
   ≤10-Q budget bounds Q-growth, so no separate re-gate counter exists. Remove the snapshot copies
   either way.
5. **Continue forward from spec** — step 1 (the spec skill's revise-not-replace rules take over on
   the SPEC.md still on disk) → step 2 (branch, idempotent) → step 3 → the step-4 seam → step 5 →
   step 6. Each marker re-drops only at its stage's normal gate — no special-case drops here.

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
*unchanged* inputs just re-fails. The principled re-runs all happen on *changed* inputs and are
bounded with a no-progress abort: the **re-plan loop** (step 4, re-runs plan on revised REVIEW.md
findings, bounded by strict finding-count decrease — advisory, so it *continues* on no-progress), the
**self-heal loop** (step 6a, re-implements from VERIFY.md failing rows, capped at 3 — a gate, so it
*stops* on no-progress), and the **REGATE re-entries** (the plan-only route and the global re-gate,
re-running stages on a recorded discovery — the global path bounded by the ledger-`cmp` no-progress
abort). Everything else fails closed rather than blind-retrying.
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
