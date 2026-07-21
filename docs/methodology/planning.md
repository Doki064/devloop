# Methodology — how to plan, plan-review, and refine a devloop slice

**Purpose.** The working *method* for planning a devloop slice, reviewing your own plan, and refining
it until review-ready. Load this with `/plan-methodology <slice>`.

---

## The loop (run in order; iterate back to earlier steps as findings land)

### 1. Pick the next thing from the repo's own signals — not from memory
Read the build-status line (CLAUDE.md), the roadmap (ARCHITECTURE), and `grep -rn "DEFERRED(Phase <N>"`.
The next component is whatever those name as pending. **Do not trust the session-start git snapshot or
memory** — both can be stale or contradictory. Confirm state with a live `git log --oneline` / `git status`
before believing any "X is done / pending" claim.

### 2. Explore the real files before designing
Read the actual artifacts the plan will touch and the closest *cousin* already built (e.g. read
`agents/verifier.md` as the model for a hook's logic, `docs/ARTIFACTS.md` for the schema the code
parses). Design **inline** when you already hold the context — do **not** spawn a cold Plan/Explore
agent that re-derives what you know; that's the expensive path. Spawn an agent only for the one job
that needs *fresh, uncontaminated* context: the plan review (step 4).

### 3. Confirm genuine forks with the user — but only genuine ones
If a decision has **no safe default and changes the artifact**, ask with `AskUserQuestion` and lead
with a recommendation (e.g. a hook's fail-open-vs-fail-closed posture, or a cross-platform runtime). If
a choice has an obvious default, take it and say so — don't ask.

### 4. Dogfood the plan — fresh reviewer **and** hand-review, then converge
This is the core quality move. Run **both**:
- **A fresh-context adversarial reviewer** (a `general-purpose` subagent told to *be* the devloop
  reviewer — have it read and apply the methodology directives in `agents/reviewer.md` § "Review
  methodology"; don't re-list them here, the agent file is the source of truth). Fresh context
  catches what your own is blind to.
- **Your own hand-review** applying the same directives with project depth the subagent lacks.

**Convergence is the signal — but both passes are the same modality.** Where both independently flag
the same thing, it's real; fold it in and record the dogfood provenance in the plan itself (a short
"Dogfood pass" section) so the next reader sees it was pressure-tested. Caveat: fresh + hand are both
*reading a document*, so convergence can be agreement on a **shared** blind spot — reading never
catches a wrong classification of environmental/runtime state; that needs execution (step 7).

### 5. Hunt the recurring finding-classes explicitly
Two classes produce most real findings — check them deliberately every time:
- **Parallel-treatment / cross-artifact consistency.** Like items must be treated alike. (Example: a
  predicate that failed *open* on an ambiguous parse but *closed* on an ambiguous lookup — same
  invariant, opposite handling.) An unjustified asymmetry between structurally-parallel things *is* the
  defect.
- **Verify-don't-trust.** Treat every claim in the plan (and in memory, and in a cited `file:line`) as
  a hypothesis to confirm against the file — grep the markers, run `git log`, read the actual built
  artifact instead of assuming greenfield.

### 6. Break your own assumptions on pushback; research authoritative sources before re-deciding
When the user contradicts you, **do not re-guess** (e.g. "node is guaranteed" → pushback → WebFetch the
official docs: *no* runtime is guaranteed). Being wrong twice is fine **if** each correction is grounded
in an authoritative source, not a fresh assumption. Third-party blogs ≠ authority; prefer
`code.claude.com/docs`.

### 7. Validate the plan against the design idea + the real target — add the guard test
Before calling a plan review-ready (especially a *port/convert* plan a later session grades a build
against): re-read it adversarially one more time against (a) the design principle it serves and (b) the
exact reference it ports. The highest-value catches live here (e.g. a blanket `try/catch → exit 0`
fail-open that silently contradicts the reference's *fall-through-to-deny*, and would break the core
behavior while passing the existing test suite).
**The best validation output is a guard test:** the ONE fixture a faithful-looking-but-wrong build
would fail (e.g. "`feat(foo)` as the first-ever commit, empty `git log` → DENY" when none of the
existing fixtures exercise an empty log). Name the pitfalls a new runtime reintroduces (sync stdin,
flush-before-exit, path separators, spawn-failure degradation) so the reviewer has a checklist.
**When the plan's logic branches on environmental state** (git remote present/absent, unborn HEAD,
dirty tree, path separators), *run that branch logic in isolation against each case before
review-ready* — do not settle for another read. A reading review ratifies a plausible-but-wrong
classification (a plan lumping "no remote" with "no base branch" survived four reading reviews and
broke only on execution).
**But isolation alone is a trap when the feature's own outputs feed the signal:** also run the case
where the feature's *own* artifacts generate the environmental state — a dirty-tree check tripped by
the very untracked markers the pipeline drops — which a synthetic isolated fixture (a lone `dirty.txt`)
sails past; only a run where the system's own state produces the signal exposes it.

---

## Reflexes that make it work (the invariants under the steps)
- **Fold findings, then re-validate — refinement introduces new staleness.** Every edit pass can rot a
  premise; after folding, re-read for what the edits broke — and when the fold *materially rewrites
  logic* (not just wording), re-run the **fresh** reviewer, not just a self re-read: the re-read shares
  the blind spot that wrote the fold (a "fix" that re-opened the bypass it closed survived self-review;
  only a fresh pass caught it).
- **Deliberate ≠ accidental.** A gap the artifact explicitly justifies (a marker, an out-of-scope note)
  is not a finding. Don't flag reasoned simplifications; do flag silent ones.
- **Keep the plan lean (prune test) but review-ready.** Enough that a build can be graded against it;
  no filler. Record what's *explicitly NOT done* and why, so scope-creep and "clean bill vs deferred"
  don't get confused.
- **Ponytail on the design too** — prefer the change that removes dependencies; laziest faithful
  solution wins.

## Done = review-ready
A plan is ready to hand off when: every factual claim is grounded in a live file; the dogfood pass
(fresh + hand) is recorded with findings folded in; the parallel-treatment and verify-don't-trust
sweeps ran; explicitly-not-doing is stated; and — for a build/convert plan — a guard test exists that a
wrong-but-green build would fail. Then a separate session can grade the build against the plan with
nothing left to interpret. Don't auto-build the moment a plan is approved when its own scope defers the
build to a later session — honor it (brainstorm-before-build).
