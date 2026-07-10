# devloop — Architecture

The design reference for devloop. This is a read-on-demand reference doc (denser than CLAUDE.md by design). Read it before changing pipeline stages, gates, agents, or layout.

## Positioning
devloop takes **Spec Kit's spec-as-contract rigor** but rejects its **linear rigidity**, and is deliberately leaner than gsd (whose doc-sprawl and verifier-context-loss we avoid). Spec Kit is rigid because it lacks traceability + re-gating, so a requirements change regenerates plan→tasks→implement from the top. gsd is flexible but partly via ad-hoc deviation handling, where quality leaks. **devloop's flexibility = scoped re-entry, not loosened rigor:** blast-radius re-gating + contract-down/evidence-up traceability + bounded working set mean a change re-runs only what it affects. The SPEC contract is the invariant; the re-run scope is what flexes.

## Pipeline
Per feature: `discuss → research → SPEC → plan → implement → verify → ship`, with cross-cutting `doctor`. `discuss`/`research` are **uncertainty-gated** (skip when intent is clear); `SPEC → ship` always runs. A **driver** sequences it autonomously; each stage is also runnable standalone (`/devloop <feature>` vs `/devloop-<stage> <feature>`).

| Stage | Kind | Notes |
|---|---|---|
| discuss | skill (inline) | Interactive Q&A; degrades to autonomous (self-Q&A, records assumptions). Emits INTENT + open-questions. |
| research | skill→agent | Isolated, may fan out parallel researchers. Mode-aware (greenfield=external; brownfield=+internal). Bounded by open-questions; unanswered→named risks. |
| spec | skill (inline) | Convergent. DURABLE SPEC.md: mechanically-checkable criteria (Truths/Artifacts/Links) with criterion IDs. |
| plan | skill→agent | SPEC → tasks tagged `tdd|standard`, scope-token, `[P]` parallel marker, deps. Each task fits **one context window** (coherence-cliff law). |
| implement | skill→agent | Per-task; TDD tasks do RED `test(scope)` → GREEN `feat(scope)` → optional REFACTOR. `isolation: worktree` + `baseRef: head`. Comprehension-first (query code-graph before writing). |
| verify | skill→agent | **Reasoning-blind**: judges artifacts + real test output + git log, never the implementer's narrative. Parameterized (plan-verify=goal-backward; impl-verify=run tests + TDD-commit check). |
| ship | skill (inline, `disable-model-invocation:true`) | Push branch + open PR **only** — never auto-merge/force-push/push-to-default. PR = the human checkpoint. Idempotent. |
| doctor | skill→agent | Pipeline-health diagnostic (distinct from verify): artifact consistency, staleness/drift, stage coherence, git hygiene. Report + optional `--fix`. On-demand + auto pre-resume. |

**Agents are FUNCTIONAL** (researcher/planner/implementer/verifier/doctor), not a persona team — role expertise as concrete in-prompt directives (persona prompting gives no accuracy gain; wins come from task-decomposition + structured artifact handoffs).

## Core principles
1. **Spec = contract.** Every criterion falsifiable and **maps to a test**; verify flags unmapped criteria. Untestable → explicit lower-confidence tier / human checkpoint (named holes, not silent).
2. **TDD gate = defense in depth.** (a) implement procedure IS red→green→refactor; (b) verify HARD-FAILs if a `tdd` task lacks `test(scope)→feat(scope)`; (c) tag-aware blocking hook (reads PLAN scope tags, JSON `deny` only on confirmed violations). Ship blocked on verify PASS.
3. **Bounded working set.** A stage reads only `specs/<feature>/` + dependency SPECs + thin CONSTITUTION — never the whole project. Cross-feature regressions caught by **running the full test suite** (executable memory that doesn't rot). SPEC durable; process docs archived on ship.
4. **Autonomy guardrails.** Tests+SPEC **read-only** to the heal loop (path-guard hook) — prevents reward-hacking the verifier. Self-heal capped (3) + no-progress early-abort. **Fail closed** unattended. Reasoning-blind verifier/doctor. Scope-drift guard (re-anchor on frozen SPEC).
5. **Context hygiene.** Subagent isolation + file handoff = external memory; artifacts are distilled decision records, never transcripts.
6. **Docs are routers, not dumps** (honored + enforced). Lean; plain-path pointers not eager `@`-imports; instruction budget ~150–200; prune test. devloop generates structure, prompts human for judgment. Doctor has a doc-hygiene check.
7. **Two-knob gating.** Entry gate = **uncertainty** (skippable); exit gate = **blast-radius/irreversibility** (mandatory when revert is expensive). Never gate every node.
8. **Contract-down / evidence-up** = bidirectional traceability. Orphan requirement = BLOCK; orphan test = WARN. Exit gate = coverage query over the trace matrix.

## Uncertainty-gating (discuss/research)
A cheap **triage** (decoupled detection) emits an open-questions list — the **list is the signal, not a vibe** (LLMs under-ask). Fixed **coverage taxonomy** each Clear/Partial/Missing; **caps ≤5/gate, ≤10/feature**; all-Clear → skip to spec. Each question carries an interpretation-split + the named downstream artifact it changes (else record-as-assumption or drop). Detection framed adversarially. Second axis: irreversibility. Filters: answerability, dedup, blocklist. **Re-gate mid-pipeline** by blast radius: spec-invalidating→research/discuss (global); plan-only→local re-plan; step-local→in-place.

## Orchestration, autonomy & resume
- **Driver = fat orchestrator skill** (plugin-dev `create-plugin.md` pattern: Skill+Task+TodoWrite, embedded sequence). Orchestration-Agent pattern (Plan→Prepare→Execute→Monitor→Verify→Report; "phase failure: retry then report and stop"). Deterministic gate checks in `scripts/`/hooks; no literal message-scripting. May use **nested subagents** to keep per-stage output out of driver context.
- **Resume = derive from artifacts** (no global journal). **Atomic writes** (temp-same-dir → fsync file → rename → fsync dir; write-once) + per-stage rename-last `.done` marker. **Implement resumes per-task from git** even on context-limit (hook `PreCompact` flushes checklist). **Dirty tree** → doctor preserves (never discards), surfaces attended, fail-closed unattended.

## Bootstrap (greenfield vs brownfield)
Auto-detect is **greenfield-vs-brownfield only**. Stack/config/test-command detection is **brownfield-only** (they only exist to detect there). `/devloop-init` (or driver auto-runs on un-bootstrapped repo).
- **Greenfield:** scaffold only (ROADMAP + thin forward-looking CONSTITUTION); stack chosen in spec/plan; test command established at first implement, then recorded.
- **Brownfield:** refreshable LEARN pass (drift-stamped, incremental) → read-on-demand reference docs (not constitution bulk); code-graph via codebase-memory-mcp for reuse/impact discovery (degrade to grep/read); respect/augment existing CLAUDE.md (never clobber; enforce guideline as discipline, never append as text; doctor flags+offers refactor with confirmation).

## Disk layout
UPPERCASE artifact names (ROADMAP/CONSTITUTION/SPEC/PLAN/RESEARCH/VERIFY/PROGRESS/ASSUMPTIONS.md); CLAUDE.md/README.md fixed; hidden markers lowercase. HYBRID metadata (human docs under `specs/<slug>/`; machine state under `.devloop/`). SEPARATE `CONSTITUTION.md`, CLAUDE.md points to it.

**Plugin repo** (also carries per-project artifacts — dogfooding):
```
.claude-plugin/plugin.json · CLAUDE.md (router→docs/) · docs/ (per prune-test)
skills/ drive + discuss|spec|ship (inline) + research|plan|implement|verify|doctor (thin→agent)
        each: SKILL.md (+ references/*.md, scripts/*.sh)
agents/ researcher|planner|implementer|verifier|doctor.md
hooks/ hooks.json + scripts/ (tdd-gate, readonly-paths-guard, invariant hooks)
```
**Per-target-project:** `CLAUDE.md · CONSTITUTION.md · ROADMAP.md (lean index: slug·status·goal·risk·depends[]·Boundary) · src/+tests/ · docs/ · .devloop/ (active, archive/) · specs/<slug>/ (SPEC durable · PLAN · RESEARCH/VERIFY/PROGRESS/ASSUMPTIONS ephemeral · <stage>.done)`

Durability: DURABLE (accumulates) = SPEC + ROADMAP + CONSTITUTION. EPHEMERAL (archive on ship) = RESEARCH/PLAN/VERIFY/PROGRESS/ASSUMPTIONS. DERIVED (regen) = PROGRESS, trace matrix. Every project (devloop included) has CLAUDE.md → docs/ created on-demand per prune test.

## Phased build roadmap
MVP-first; each phase independently testable; implementation decisions deferred to the phase that needs them.
- **Phase 0 — Scaffold.** plugin.json, repo skeleton, CLAUDE.md router. Validate: `claude --plugin-dir .`, `claude plugin validate`. ← current
- **Phase 1 — Core SDD-TDD loop (MVP).** spec, plan, implement, verify, ship skills + verifier agent + tag-aware TDD hook. One feature end-to-end per-stage.
- **Phase 2 — Orchestration + autonomy + resume.** driver, self-heal loop, PROGRESS, active pointer, atomic writes + markers, doctor + resume, fail-closed.
- **Phase 3 — Front-end + gating.** discuss, research; triage; mid-pipeline re-gating.
- **Phase 4 — Brownfield + multi-feature.** LEARN pass + code-graph; ROADMAP with risk/depends/Boundary; cross-feature memory; archive-on-ship; CONSTITUTION generation.
- **Phase 5 — Hardening.** readonly-paths + invariant hooks; ship idempotency; worktree isolation; doc-hygiene doctor; model/cost config + kill switch.
