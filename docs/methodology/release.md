# Methodology — pre-release smoke round for devloop (the plugin under build)

**Purpose.** devloop's skills/agents are prompts — their real failure modes (instructions drifted past,
model divergence, driver-vs-standalone behavior differences) only surface in a live run, not a read.
This is the method for smoke-testing the shipped bytes before a release tag or marketplace publish.
Load this with `/release-methodology`.

**When.** Before any release tag or marketplace publish — **once per release, not per slice.** Slices
keep using `/plan-methodology` and `/review-methodology`; this catches what reading cannot.

---

## The smoke round procedure (run in order; iterate until green)

### 1. Build a throwaway fixture
A scratch git repo with a small real feature to drive. **Never smoke against the devloop repo itself.**
Keep probe fixtures on a different file/fact than any fix you're about to test — an entangled fixture
grades the fix, not the behavior.

### 2. Run the pipeline end-to-end, both model tiers
One `claude -p "/devloop <feature>"` call per tier, with `--plugin-dir` pointing at the shipped bytes
and `--model <tier>` per run. Add `--permission-mode acceptEdits` (or `--dangerously-skip-permissions`
— the fixture is throwaway): headless runs cannot answer permission prompts. End-to-end means spec→verify
plus the ship-boundary stop — ship itself is out of smoke scope unless the fixture has a remote. Run under
**both** consumer model tiers (sonnet and opus) — they diverge, and a skill that holds under one drifts
under the other. Both must pass.

### 3. Grade the final composed output, not the tool-loop narration
Read the session transcript (`~/.claude/projects/<dir>/*.jsonl`) and grade the final composed output.
`-p` prints only the final message — mid-run stage output, gate denials, and the handoff live only in the
transcript.

### 4. Grade against a fixed checklist written *before* the run
- Stage artifacts match `docs/ARTIFACTS.md` schemas.
- TDD ordering held: `test(<scope>)` commit precedes `feat(<scope>)` in the fixture git log; drive
  stopped without invoking ship.
- Drive's terminal handoff delivered (`/clear` + `/devloop:ship <feature>`); per-stage handoffs absent
  (driver mode suppresses them).
- No invented findings.

Pass = all checked, both models.

### 5. Iterate, with a no-progress abort
Round again on any fail. **If the same instruction is drifted past two rounds running, stop iterating
wording** and escalate up the hardening ladder instead.

---

## The hardening ladder (escalation when a skill instruction keeps being drifted past)
`class ban` (e.g. "never invent findings") < `named exact string` (e.g. require the line "verified PASS")
< `byte-fixed literal` (e.g. the exact bytes to emit, quoted). Escalate one rung per round — except when the
same wording has already drifted two rounds running: then go straight to the byte-fixed literal. Record
which rung each hardened instruction sits on with a `<!-- hardened: <rung> -->` comment at the change site.

## Premises first
Before scoping any fix a smoke round motivates, verify its premise against the shipped bytes — read the
actual skill/hook/script, don't reason from the failure description. A fix built on a misread premise is
the expensive failure; this check is cheaper than any round.

## Done = release-ready
Both models green on the fixed checklist; every failure either fixed (premise-verified, re-smoked) or
recorded as an accepted residual with the release notes; fixture repo deleted.
