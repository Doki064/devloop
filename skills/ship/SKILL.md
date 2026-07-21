---
name: ship
description: Run the devloop ship stage for a feature — gate on its VERIFY.md PASS verdict, then push the current branch and open a PR. Invoked explicitly (via /devloop:ship or the driver), never auto-selected; it performs a git side effect, so it stays deterministic.
disable-model-invocation: true
allowed-tools:
  - Read
  - Glob
  - Bash
---

# ship — push the branch and open the PR (the human checkpoint)

The terminal Phase-1 stage. Ship does exactly one thing: once a feature has **verified PASS**, it
pushes the current branch and opens a PR — and stops. The PR *is* the human checkpoint, so ship
deliberately never merges, never force-pushes, and never pushes to the default branch. Any manual
acceptance criteria surface in the PR body for a human to resolve there.

## Inputs

Slugify the feature name you were given (lowercase, hyphens) → `<slug>`. `<slug>` only locates the
spec files; ship pushes the **current git branch**, which is not derived from the slug. Read only
this feature's bounded set — never the whole project:

- `specs/<slug>/VERIFY.md` — the gate. Read its header `stage`, its `## Verdict`, and any `MANUAL`
  trace-matrix rows.
- `specs/<slug>/SPEC.md` — the Goal line, for the PR title/body.

The VERIFY.md format is defined in `${CLAUDE_PLUGIN_ROOT}/docs/ARTIFACTS.md` (the VERIFY.md section);
read the verdict and rows against that schema rather than guessing.

## Process

1. **Preconditions.** Confirm `specs/<slug>/VERIFY.md` exists (via Glob) — if not, stop and tell the
   user to run `/devloop:verify <feature-name>` first (ship needs a verdict to gate on). Then confirm
   the tooling is present with a clear message (not a raw error): `gh` is on PATH (`command -v gh`)
   and the repo has an `origin` remote (`git remote get-url origin`).

2. **Gate on the verdict — hard, fail-closed.** Read VERIFY.md. First confirm it is a **`stage=impl`**
   verdict (the header reads `(stage=impl)`) — a `stage=plan` file is a coverage-only check that does
   **not** attest tests pass, so refuse it and tell the user to run `/devloop:verify <feature-name>`
   (impl) first. Then require `## Verdict` to be `PASS`. On `FAIL` (or any BLOCK row), **refuse to
   ship**: surface the failing / BLOCK rows and stop. This is the "ship blocked on verify PASS" gate
   — never paper over it.

3. **Collect the manual named holes.** Gather every trace-matrix row with result `MANUAL`. These are
   neither PASS nor FAIL — they are the named holes a human resolves at the PR, so they go into the
   PR body as a checklist (step 6). An empty set is fine.

4. **Git safety.** Resolve the current branch (`git branch --show-current`) and the default branch
   (`git symbolic-ref --short refs/remotes/origin/HEAD` → strip `origin/`; if that ref is absent,
   fall back to `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`). **If the current
   branch is the default branch, refuse** — tell the user to create a feature branch
   (`git switch -c <feature>`) and re-run. Never `--force`, never merge.
   <!-- DEFERRED(Phase 5): auto-create the feature branch and move commits off the default when the
        user shipped from it (the eventual product behavior); grouped with ship idempotency +
        worktree isolation. For now, refuse and let the user branch. -->
   <!-- dirty-tree / uncommitted-work handling lives in doctor (pre-resume, preserves the tree) — ship
        pushes only commits, so it does not guard the working tree here. -->

5. **Idempotent push.** Check for an existing PR on this branch:
   `gh pr list --head <current-branch> --json url --jq '.[0].url'`. Push the branch either way with a
   plain (never forced) push: `git push -u origin <current-branch>`. If a PR already exists, report
   its URL and skip creation — the new commits are already pushed.
   <!-- DEFERRED(Phase 5): idempotency hardening beyond this dup-PR check (e.g. reconciling a diverged
        remote, partial-push recovery). -->

6. **Open the PR** (only if none exists). `gh pr create --base <default> --head <current-branch>`
   with:
   - **Title:** the SPEC Goal, one line.
   - **Body**, lean and fixed-shape — no transcript, no ceremony:
     - the verify verdict and AC pass/fail counts;
     - a `## Manual checks` checklist of the `MANUAL` named-hole rows (omit the section if none);
     - a link to `specs/<slug>/SPEC.md`.

7. **Mark shipped + clear the active pointer** (only after the push/PR of step 5–6 succeeds — a failed
   push must not look shipped). Drop the terminal marker and retire the in-flight pointer so a later
   doctor/resume sees this feature as done, not mid-flight:
   `date -u +%Y-%m-%dT%H:%M:%SZ | node ${CLAUDE_PLUGIN_ROOT}/scripts/atomic-write.mjs
   specs/<slug>/ship.done --once` and `rm -f .devloop/active`. Both are best-effort — a nonzero exit is
   a **warning, not a failure** (the PR is already open; markers are only resume hints).

<!-- DEFERRED(Phase 4): archive this feature's ephemeral artifacts (PLAN/VERIFY/…) on successful
     ship; archival machinery is a Phase-4 concern. -->

## Handoff

Report the PR URL and stop. This is the terminal stage — **human PR review is the checkpoint**;
ship does not merge. If any `MANUAL` rows were carried in, name them so the reviewer knows what to
resolve before merging. The pipeline is done: tell the user to run `/clear` (or start a new session)
for fresh context before starting the next feature.
