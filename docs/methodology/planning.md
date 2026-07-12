# Methodology — how to plan, plan-review, and refine a devloop slice

**Purpose.** The working *method* for planning a devloop slice, reviewing your own plan, and refining
it until it's review-ready. Not about any one component. The through-line: **ground every claim in the
live artifact, dogfood the plan before trusting it, and leave behind the one test that would catch a
wrong build.** Load this with `/plan-methodology <slice>`.

---

## The loop (run in order; iterate back to earlier steps as findings land)

### 1. Pick the next thing from the repo's own signals — not from memory
Read the build-status line (CLAUDE.md), the roadmap (ARCHITECTURE), and `grep -rn "DEFERRED(Phase <N>"`.
The next component is whatever those name as pending. **Do not trust the session-start git snapshot or
memory** — both can be stale/contradictory (a snapshot showing HEAD behind reality; memory calling a
lane both "uncommitted" and "committed"). Confirm state with a live `git log --oneline` / `git status`
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
a choice has an obvious default, take it and say so — don't ask. One good fork question beats five
reflexive ones.

### 4. Dogfood the plan — fresh reviewer **and** hand-review, then converge
This is the core quality move. Run **both**:
- **A fresh-context adversarial reviewer** (a `general-purpose` subagent told to *be* the devloop
  reviewer — apply its 6 methodology directives: adversarial framing · cross-artifact consistency ·
  verify-don't-trust · parallel-treatment · intent/implied-edge-cases · brittleness). Fresh context
  catches what your own is blind to.
- **Your own hand-review** applying the same directives with project depth the subagent lacks.

**Convergence is the signal.** Where both passes independently flag the same thing, it's real. Fold
those findings into the plan, and record the dogfood provenance in the plan itself (a short "Dogfood
pass" section) so the next reader sees it was pressure-tested.

### 5. Hunt the recurring finding-classes explicitly
Two classes produce most real findings — check them deliberately every time:
- **Parallel-treatment / cross-artifact consistency.** Like items must be treated alike. (Example: a
  predicate that failed *open* on an ambiguous parse but *closed* on an ambiguous lookup — same
  invariant, opposite handling; or a hook that scanned `git log` exactly like the verifier but lacked
  the verifier's `DEFERRED(Phase 5)` marker.) An unjustified asymmetry between structurally-parallel
  things *is* the defect.
- **Verify-don't-trust.** Treat every claim in the plan (and in memory, and in a cited `file:line`) as
  a hypothesis to confirm against the file — grep the markers, run `git log`, read the actual built
  artifact instead of assuming greenfield.

### 6. Break your own assumptions on pushback; research authoritative sources before re-deciding
When the user contradicts you, **do not re-guess**. (Example: asserting "Claude Code guarantees node" →
pushback → instead of swapping to another guess, WebFetch the **official docs** and find *no runtime is
guaranteed*.) Being wrong twice is fine **if** each correction is grounded in an authoritative source,
not a fresh assumption. Third-party blogs ≠ authority; prefer `code.claude.com/docs`.

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

---

## Reflexes that make it work (the invariants under the steps)
- **Live source > snapshot > memory.** Re-derive state; never trust a cached claim about it.
- **Fold findings, then re-validate — refinement introduces new staleness.** Every edit pass can rot a
  premise; after folding, re-read for what the edits broke.
- **Deliberate ≠ accidental.** A gap the artifact explicitly justifies (a marker, an out-of-scope note)
  is not a finding. Don't flag reasoned simplifications; do flag silent ones.
- **Keep the plan lean (prune test) but review-ready.** Enough that a build can be graded against it;
  no filler. Record what's *explicitly NOT done* and why, so scope-creep and "clean bill vs deferred"
  don't get confused.
- **Ponytail on the design too.** Prefer the change that *removes* dependencies; the laziest faithful
  solution is the right one — once you understand the problem.

## Anti-patterns to avoid
- Auto-building the moment a plan is approved when the plan's own scope defers the build to a later
  session — honor it (brainstorm-before-build).
- Spawning cold agents to re-derive held context (only the fresh-reviewer dispatch is worth it).
- Re-guessing after a correction instead of consulting the authority.
- Passing a test suite as proof without the fixture that distinguishes right from plausibly-right.

## Done = review-ready
A plan is ready to hand off when: every factual claim is grounded in a live file; the dogfood pass
(fresh + hand) is recorded with findings folded in; the parallel-treatment and verify-don't-trust
sweeps ran; explicitly-not-doing is stated; and — for a build/convert plan — a guard test exists that a
wrong-but-green build would fail. Then a separate session can grade the build against the plan with
nothing left to interpret.
