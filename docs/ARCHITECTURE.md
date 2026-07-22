# devloop — Architecture

The design reference for devloop. This is a read-on-demand reference doc (denser than CLAUDE.md by design). Read it before changing pipeline stages, gates, agents, or layout.

## Positioning
devloop takes **Spec Kit's spec-as-contract rigor** but rejects its **linear rigidity**, and is deliberately leaner than gsd (whose doc-sprawl and verifier-context-loss we avoid). Spec Kit is rigid because it lacks traceability + re-gating, so a requirements change regenerates plan→tasks→implement from the top. gsd is flexible but partly via ad-hoc deviation handling, where quality leaks. **devloop's flexibility = scoped re-entry, not loosened rigor:** blast-radius re-gating + contract-down/evidence-up traceability + bounded working set mean a change re-runs only what it affects. The SPEC contract is the invariant; the re-run scope is what flexes.

## Pipeline
Per feature: `discuss → research → SPEC → plan → implement → verify → ship`, with cross-cutting `doctor` (pipeline health) and advisory `review` (quality). `discuss`/`research` are **uncertainty-gated** (skip when intent is clear); `SPEC → ship` always runs. A **driver** sequences it autonomously; each stage is also runnable standalone (`/devloop <feature>` vs `/devloop:<stage> <feature>`).

| Stage | Kind | Notes |
|---|---|---|
| discuss | skill (inline) | Interactive Q&A; degrades to autonomous (self-Q&A, records ASSUMPTIONS). Appends Answers to the triage-seeded INTENT (triage emits the open-questions ledger). |
| research | skill→agent | Isolated, may fan out parallel researchers. Mode-aware (greenfield=external; brownfield=+internal). Bounded by open-questions; unanswered→named risks. |
| spec | skill (inline) | Convergent. DURABLE SPEC.md: mechanically-checkable criteria (Truths/Artifacts/Links) with criterion IDs. |
| plan | skill→agent | SPEC → tasks tagged `tdd|standard`, scope-token, `[P]` parallel marker, deps. Each task fits **one context window** (coherence-cliff law). |
| implement | skill→agent | Per-task; TDD tasks do RED `test(scope)` → GREEN `feat(scope)` → optional REFACTOR. `isolation: worktree` + `baseRef: head` (Phase 5; current build works the current tree). Comprehension-first (query code-graph before writing). |
| verify | skill→agent | **Reasoning-blind**: judges artifacts + real test output + git log, never the implementer's narrative. Parameterized (plan-verify=goal-backward; impl-verify=run tests + TDD-commit check). |
| ship | skill (inline, `disable-model-invocation:true`) | Push branch + open PR **only** — never auto-merge/force-push/push-to-default. PR = the human checkpoint. Idempotent. |
| doctor | skill→agent | Pipeline-health diagnostic (distinct from verify): artifact consistency, staleness/drift, stage coherence, git hygiene. Report + optional `--fix`. On-demand + auto pre-resume. |
| review | skill→agent | Advisory quality lane (reads & judges — the inverse of verify). Parameterized `target=plan\|impl`. plan-review at the plan→implement seam; impl-review on-demand pre-ship. Findings only, never gates. |

**Agents are FUNCTIONAL** (researcher/planner/implementer/verifier/doctor/reviewer), not a persona team — role expertise as concrete in-prompt directives (persona prompting gives no accuracy gain; wins come from task-decomposition + structured artifact handoffs).

## Core principles
1. **Spec = contract.** Every criterion falsifiable and **maps to a test**; verify flags unmapped criteria. Untestable → explicit lower-confidence tier / human checkpoint (named holes, not silent).
2. **TDD gate = defense in depth.** (a) implement procedure IS red→green→refactor; (b) verify HARD-FAILs if a `tdd` task lacks `test(scope)→feat(scope)`; (c) tag-aware blocking hook (reads PLAN scope tags, JSON `deny` only on confirmed violations). Ship blocked on verify PASS.
3. **Bounded working set.** A stage reads only `specs/<feature>/` + dependency SPECs + thin CONSTITUTION — never the whole project. Cross-feature regressions caught by **running the full test suite** (executable memory that doesn't rot). SPEC durable; process docs archived on ship.
4. **Autonomy guardrails.** Tests+SPEC **read-only** to the heal loop (path-guard hook) — prevents reward-hacking the verifier. Self-heal capped (3) + no-progress early-abort. **Fail closed** unattended. Reasoning-blind verifier/doctor. Scope-drift guard (re-anchor on frozen SPEC).
5. **Context hygiene.** Subagent isolation + file handoff = external memory; artifacts are distilled decision records, never transcripts; stages prompt a `/clear` between standalone runs.
6. **Docs are routers, not dumps** (honored + enforced). Lean; plain-path pointers not eager `@`-imports; instruction budget ~150–200 lines; prune test. devloop generates structure, prompts human for judgment. Doctor has a doc-hygiene check.
7. **Two-knob gating.** Entry gate = **uncertainty** (skippable); exit gate = **blast-radius/irreversibility** (mandatory when revert is expensive). Never gate every node.
8. **Contract-down / evidence-up** = bidirectional traceability. Orphan requirement = BLOCK; orphan test = WARN. Exit gate = coverage query over the trace matrix.

## Uncertainty-gating (discuss/research)
A cheap **triage** (decoupled detection) emits an open-questions list — the **list is the signal, not a vibe** (LLMs under-ask). Fixed **coverage taxonomy** each Clear/Partial/Missing; **caps ≤5/gate, ≤10/feature**; all-Clear → skip to spec. Each question carries an interpretation-split + the named downstream artifact it changes (else record-as-assumption or drop). Detection framed adversarially. Second axis: irreversibility. Filters: answerability, dedup, blocklist. **Re-gate mid-pipeline** by blast radius: spec-invalidating→research/discuss (global); plan-only→local re-plan; step-local→in-place. Classification lives in the **discovering stage** (planner/implementer surface a `REGATE <tier>:` line; verify stays reasoning-blind — classification is diagnosis; no decision script — it is semantic judgment); the re-gate **record** is the INTENT ledger itself, via discuss's enrichment path (append-only `Q<N>`, caps include re-gating).

## Orchestration, autonomy & resume
- **Driver = fat orchestrator skill** (plugin-dev `create-plugin.md` pattern: Skill+Task+TodoWrite, embedded sequence). Orchestration-Agent pattern (Plan→Prepare→Execute→Monitor→Verify→Report; "phase failure: retry then report and stop"). Deterministic gate checks in `scripts/`/hooks; no literal message-scripting. May use **nested subagents** to keep per-stage output out of driver context.
- **Resume = derive from artifacts** (no global journal). **Atomic writes** (temp-same-dir → fsync file → rename → fsync dir; write-once) + per-stage rename-last `.done` marker. **Implement resumes per-task from git** even on context-limit (PreCompact checklist flush deferred to Phase 5 — resume derives from git alone). **Dirty tree** → doctor preserves (never discards), surfaces attended, fail-closed unattended.

## Bootstrap (greenfield vs brownfield)
Auto-detect is **greenfield-vs-brownfield only**. Stack/config/test-command detection is **brownfield-only** (they only exist to detect there). `/devloop:init` (or driver auto-runs on un-bootstrapped repo).
- **Greenfield:** scaffold only (ROADMAP + thin forward-looking CONSTITUTION); stack chosen in spec/plan; test command established at first implement, then recorded.
- **Brownfield:** refreshable LEARN pass (drift-stamped, incremental) → read-on-demand reference docs (not constitution bulk); code-graph via codebase-memory-mcp for reuse/impact discovery (degrade to grep/read); respect/augment existing CLAUDE.md (never clobber; enforce guideline as discipline, never append as text; doctor flags+offers refactor with confirmation).

## Disk layout
UPPERCASE artifact names (ROADMAP/CONSTITUTION/SPEC/PLAN/INTENT/RESEARCH/VERIFY/REVIEW/PROGRESS/ASSUMPTIONS.md); CLAUDE.md/README.md fixed; hidden markers lowercase. HYBRID metadata (human docs under `specs/<slug>/`; machine state under `.devloop/`). SEPARATE `CONSTITUTION.md`, CLAUDE.md points to it.

**Plugin repo** (will also carry per-project artifacts — dogfooding):
```
.claude-plugin/plugin.json · CLAUDE.md (router→docs/) · docs/ (per prune-test)
skills/ drive + spec|ship (inline) + plan|implement|verify|doctor|review (thin→agent) + discuss|research (Phase 3)
        each: SKILL.md
agents/ planner|implementer|verifier|doctor|reviewer.md + researcher.md (Phase 3)
hooks/ hooks.json + scripts/ (tdd-gate, heal-guard; Phase 5 adds readonly-paths + invariant hooks)
scripts/ deterministic gate checks + tests (atomic-write, doctor-scan, replan-decision)
```
**Per-target-project:** `CLAUDE.md · CONSTITUTION.md · ROADMAP.md (lean index: slug·status·goal·risk·depends[]·Boundary) · src/+tests/ · docs/ · .devloop/ (active, archive/) · specs/<slug>/ (SPEC durable · PLAN · INTENT/RESEARCH/VERIFY/REVIEW/PROGRESS/ASSUMPTIONS ephemeral · <stage>.done)`

Durability: DURABLE (accumulates) = SPEC + ROADMAP + CONSTITUTION. EPHEMERAL (archive on ship) = INTENT/RESEARCH/PLAN/VERIFY/REVIEW/PROGRESS/ASSUMPTIONS. DERIVED (regen) = PROGRESS, trace matrix. Every project (devloop included) has CLAUDE.md → docs/ created on-demand per prune test.

## Phased build roadmap
MVP-first; each phase independently testable; implementation decisions deferred to the phase that needs them.

**Deferral handshake (build-time convention).** A deferral is a `DEFERRED(Phase N):` marker at the change site — greppable, never a separate authored ledger (single source, no drift). The handshake is two-way: the introducing phase writes the marker; a phase is not done until `grep -rn "DEFERRED(Phase <N>)"` for its own number returns nothing unresolved — each match is implemented, or explicitly re-deferred with a *new* phase + reason. A marker **may** name the current phase (a legitimate later-slice deferral within it — e.g. the TDD hook deferred to a later Phase-1 slice — which the phase's own close-gate must clear); a marker naming an **already-completed** phase is drift. This drift is caught by the **phase close-gate grep** itself (`grep -rn "DEFERRED(Phase <N>)"`, run per `docs/methodology/build-routing.md` when closing a phase) — a build-time scaffold for developing devloop. The product `doctor` stage does **not** carry a deferral-drift check: a driven user project has no `DEFERRED(Phase N)` markers (the product surfaces un-done work via verify's `MANUAL`/`BLOCK` rows, not phase markers), so this convention is **not** product runtime behavior.
- **Phase 0 — Scaffold.** **Complete** (merged to main). plugin.json, repo skeleton, CLAUDE.md router. Validate: `claude --plugin-dir .`, `claude plugin validate`.
- **Phase 1 — Core SDD-TDD loop (MVP).** **Complete** (merged to main). spec, plan, implement, verify, ship skills + planner/implementer/verifier agents + tag-aware TDD hook + review skill/reviewer agent (a quality-lane slice added mid-phase — **not** in the original Phase-1 scope). One feature end-to-end per-stage.
- **Phase 2 — Orchestration + autonomy + resume.** **Complete** (merged to main). **Built:** the `drive` skill (`/devloop <feature>`) sequences spec→plan→(plan-verify+plan-review)→implement→verify and stops at the ship boundary (ship stays human-invoked); the **self-heal loop** (heal-scoped readonly guard); the **resume core** — atomic-write helper (`scripts/atomic-write.mjs`), per-stage `.done` markers, `.devloop/active` pointer, drive resume-entry (skip completed stages), fail-closed on inconsistent state; **doctor** — the pipeline-health diagnostic (`scripts/doctor-scan.mjs` + `agents/doctor.md`): marker/artifact consistency + work-safe fix, dirty-tree preserve + fail-closed-unattended, git hygiene, wired into drive pre-resume so an inconsistent state self-heals instead of dead-ending; and the **plan-review→re-plan loop + durable REVIEW.md** — advisory and *convergence-terminated* (`scripts/replan-decision.mjs` re-plans while findings strictly shrink, then continues to implement — the deliberate inverse of self-heal's fail-closed exhaustion, keeping review "findings only, never gates"). (PROGRESS derived + PreCompact flush re-deferred to Phase 5 — polish, no consumer yet.)
- **Phase 3 — Front-end + gating.** **In progress** (`feat/phase3-front-end`, local). **Built:** the INTENT/RESEARCH/ASSUMPTIONS artifact contract; **discuss** (triage embedded as phase 1, `auto` autonomous degrade) + `scripts/intent-lint.mjs` (gate exit semantics); **research** (thin skill → `agents/researcher.md`: skill-side fan-out, single-point section-targeted merge, mode-aware greenfield/brownfield, bounded by the ledger, unanswered→named risks) + the stage-gated Q-join lint extension (`stage=research|spec`) + spec's ASSUMPTIONS wiring and terminal Q-join self-check; and **mid-pipeline re-gating by blast radius** — `REGATE <spec-invalidating|plan-only>` classification in the discovering agents (planner/implementer; verify stays blind), skill-side surface-and-route, discuss's re-gate enrichment (determined-correction Answers seeded at triage, the Phase-2 skip guard, at-cap landings), SPEC revision semantics (amend/add/withdraw + unbolded `(was AC-N)` notes, replace only pre-downstream), the planner's dual-source `replan` (REVIEW.md and/or a stated discovery, fail-closed on neither), and the `stage=spec` dup-AC + Q-id-boundary lint rules. **Remaining:** drive integration of the front-end (incl. `commands/discuss.md`, `.done` markers for discuss/research, and claiming drive's two deferral-marked REGATE-routing seams incl. stale-marker invalidation).
- **Phase 4 — Brownfield + multi-feature.** LEARN pass + code-graph; ROADMAP with risk/depends/Boundary; cross-feature memory; archive-on-ship; CONSTITUTION generation. Consider an optional initiative/epic grouping (co-locating related feature specs + a sub-index between project-root ROADMAP and `specs/<slug>/`) for a single cohesive multi-feature effort.
- **Phase 5 — Hardening.** readonly-paths + invariant hooks; ship idempotency; worktree isolation; doc-hygiene doctor; model/cost config + kill switch.
