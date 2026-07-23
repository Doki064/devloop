# Methodology — how to cross-review a devloop slice

## Purpose
Every landed slice — built here or arrived committed from another session — gets a **multi-pass
cross-review** before it's "done." This is the *method* + *lessons* for reviewing a slice. Output =
findings, fixes for the substantive ones, re-validation, focused commits, memory update — and
**PR-to-main left to the user**. Load with `/review-methodology <slice>`.

## The repeatable cycle
0. **Discover the landed state.** `git status --porcelain`, `git log --oneline -8`, list the slice's
   files on disk. Is it committed or uncommitted? Which commits are the slice? Did those commits touch
   *other* stages too (they often do — check the diff stat)?
1. **Read the sources of truth, in order** (deepest wins): the design log (`docs/ARCHITECTURE.md`) →
   `docs/ARTIFACTS.md` (the artifact index → the slice's `skills/<stage>/references/` contract it reads/writes) → `CLAUDE.md` → the project's
   persisted memory notes (project conventions + prior-feedback rules). **Also read the
   sibling/template slice** (the closest cousin — e.g. verify is the template for parameterized
   skill→agent stages) **and every file the slice's contract touches cross-stage.**
2. **Two passes — do not stop at Pass 1:**
   - **Pass 1 — correctness/consistency/drift.** Design *kind* correct (inline vs skill→agent per
     ARCHITECTURE)? Frontmatter valid, tools least-privilege, `disable-model-invocation` where the
     stage is a side-effecting/human checkpoint? Does it reference ARTIFACTS (not re-inline schemas)?
     Namespacing/handoffs consistent? Deferral markers correct phase?
   - **Pass 2 — deeper seams (where the real findings live).** Cross-stage interactions, edge cases,
     and the failure modes specific to this component type. **Almost every substantive finding is a
     cross-stage seam**, not a local bug.
3. **Rank findings honestly:** *headline/real* (fix) · *minor/polish* (fix if cheap, else report) ·
   *non-bug* (report so nobody "fixes" a correct thing later). Never invent findings to look thorough —
   "Clean, nothing to flag" is a valid result (the reviewer agent lives by this too).
4. **For deterministic code, VERIFY EMPIRICALLY — don't reason about it.** Run it, test it, feed it the
   edge inputs (e.g. confirm a fail-open by running the gate on literal vs heredoc inputs, not by
   asserting it). Fetch the *authoritative* source when a claim is load-bearing.
5. **Fix the substantive findings** with minimal surgical edits, at the **right layer** (root cause,
   least risk). Defer what can't be finished now as `DEFERRED(Phase N):` markers at the change site.
6. **Re-validate every edited file** (the revalidate-after-edit rule): SKILL.md → `skill-reviewer`;
   agent/command/manifest/structure → `plugin-validator`; code → its own test suite. Non-negotiable.
7. **Commit as focused, logically-separate changesets** (build vs review-fix stay distinct), clear
   messages (the harness supplies the Co-Authored-By trailer — never pin a model name here).
8. **Update the project memory notes**; **surface the PR-to-main decision, never take it.**

## Where the real findings hide — a cross-seam checklist
Run every landed slice against these; headline findings tend to come from here:
- **Parameterized stage → does the consumer distinguish the parameter values?** (e.g. ship gated on any
  VERIFY PASS; a `stage=plan` coverage-only verdict could ship untested code → gate on `stage=impl`.)
- **Shared-path artifact written by two producers → does the consumer check which one?** (same VERIFY.md
  root cause.)
- **"Bounded working set" actually bounded on a *shared* branch?** (e.g. "git diff on the current
  branch" reviews all features on devloop's own multi-feature branch → bound by PLAN `scope=` tokens
  like the verifier. Also: bare `git diff` shows nothing for committed work.)
- **Cross-stage contract tokens match token-for-token?** (`scope=`, `test(scope)→feat(scope)`, commit
  subject format — verifier/implementer/hook must agree exactly.)
- **Producer/consumer *format* assumptions.** (e.g. a TDD hook that parses only a literal `-m` subject;
  a `$(cat <<EOF)` heredoc fails it open — the fix layer is covered in "Lessons" below.)
- **Schema gap in ARTIFACTS surfacing as producer↔consumer drift.** (e.g. a `manual`-AC with no VERIFY
  representation → planner dumps it in Coverage gaps → verifier orphan-BLOCK. Fix by adding one line to
  ARTIFACTS, then re-checking referrers.) — and the **inverse**: a contract line promising a consumer
  behavior no consumer implements (grep the named consumer skill for the artifact's filename).
- **Deferral markers:** right phase, greppable, no current/completed-phase debt (`grep -rn "DEFERRED(Phase <cur>)"`).
- **For code:** which direction does it fail (open vs closed)? regex injection? edge cases (empty input,
  first-ever commit, ambiguous/duplicate matches, non-repo)?

## Lessons that make the reviews good
- **Verify-don't-trust extends to your own tooling.** A validator or skill can declare working config
  broken while the **current official docs** show it's correct and recommended (e.g. a hook's
  `command`+`args` exec form for `${CLAUDE_PLUGIN_ROOT}` placeholders). **Before changing landed,
  working code on a validator's say-so, confirm against the authoritative source.**
- **Fix at the layer that doesn't reintroduce the risk.** (e.g. a heredoc fail-open belongs in the
  implementer's commit contract, **not** the hook — teaching the hook to parse heredocs would create
  the false-denies the whole component is designed to avoid.) Root-cause, least-risk.
- **Know the fail direction and weigh findings by it.** A fail-open *miss* (a backstop catches it) is
  categorically less severe than a false-*deny* (blocks legit work) — and a gate that ships *unverified*
  code is worse than one that over-asks. Judge accordingly. In a **resumable** pipeline, "work-safe"
  means safe for *progress* too: an auto-fix that loses no committed bytes but discards resume state —
  re-running a completed, maybe interactive, stage — is a real cost, not a free cleanup.
- **Surface, don't silently edit, the finalized docs** — but *do* add to ARTIFACTS when there's a real
  schema gap (then re-check referrers). Human-in-the-loop: fix clear findings, surface judgment calls.

## What NOT to do
- Don't spawn review subagents for the reading/analysis **when your context is already fresh** — a new
  session, or a slice that landed from elsewhere — do it inline with your own tools; a fresh agent would
  only cold-start the context you already hold. **But when you *built* this slice in the same session,
  inline review shares the build's blind spots — then dispatch a fresh-context reviewer for the analysis
  (as the planning methodology does) and apply/revalidate/commit the fixes yourself.** The freshness is
  what matters, not the agent boundary. The `skill-reviewer`/`plugin-validator` dispatches stay only for
  the *validate-after-edit* step (the project's sanctioned tooling).
- Don't fix polish that triggers a mandatory re-validation for a marginal wording gain.
- Don't edit finalized ARCHITECTURE to resolve drift without surfacing it.
