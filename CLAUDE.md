# CLAUDE.md

Guidance for Claude Code when working in this repo. This file is a **router, not a dump** — it stays lean and points to detail on demand (devloop dogfoods its own doc-authoring invariant).

## What this is
devloop is a Claude Code plugin that runs an autonomous **spec-driven, test-driven** SDLC pipeline: `discuss → research → SPEC → plan → implement → verify → ship`, with a cross-cutting `doctor` and an advisory `review` lane. Design rationale and full architecture: **`docs/ARCHITECTURE.md`** (read it before changing pipeline stages, gates, or the agent/skill layout). Stage-transition artifact formats (the single source of truth every stage reads/writes against): **`docs/ARTIFACTS.md`**.

## Working here
- **Author with `plugin-dev`** — the toolkit for every component: its `skill-`/`agent-`/`hook-`/`command-development`, `mcp-integration`, `plugin-settings` skills, or the `agent-creator` agent; **validate** with `plugin-validator`. Use `skill-creator` only to benchmark a skill's quality, not to author. Don't hand-roll these.
- Skills = `skills/<name>/SKILL.md` (procedure in the skill body or `references/`); agents = `agents/<fn>.md` (functional names, canonical template). Deterministic/must-happen rules → **hooks**, not prose.
- **Reference bundled files** (docs, `scripts/`) with `${CLAUDE_PLUGIN_ROOT}/<subdir>/<file>` in skill/agent/hook bodies — substituted at load in all three (the official skill-substitution *table* is incomplete; this is verified against the binary, so don't "fix" these refs on the table's say-so). `${CLAUDE_SKILL_DIR}` is for a skill's *own* subdir only; neither is a Bash env var.
- Keep every doc lean (prune test: "would removing this line cause a mistake? if not, cut it"). Point to files with **plain paths, never eager `@`-imports**.
- **Build methodology** (dev tooling, not the shipped plugin) — model-tiered dev-agents in `.claude/agents/` for cost-aware delegation; planning/review playbooks + the routing rule in `docs/methodology/` (loaders: `/plan-methodology`, `/review-methodology`).

## Build status
Built in phases (see `docs/ARCHITECTURE.md` → Phased roadmap). Phase 1 (core SDD-TDD loop) complete — spec, plan, implement, verify, ship stages + the advisory `review` lane + the tag-aware TDD hook (`hooks/scripts/tdd-gate.mjs`). **Phase 2 (orchestration) complete** (lands as a set on `phase2-orchestration`) — the `drive` skill (`/devloop <feature>`, sequences spec→verify, stops at the ship boundary), the self-heal loop, the resume core (atomic `.done` markers + `.devloop/active` pointer + resume-entry), **doctor** (pipeline-health diagnostic: `scripts/doctor-scan.mjs` + `agents/doctor.md`; marker/artifact consistency + safe-fix, dirty-tree preserve, git hygiene; wired into drive pre-resume), and the **plan-review→re-plan loop + durable REVIEW.md** (advisory, convergence-terminated: `scripts/replan-decision.mjs` re-plans while findings strictly shrink, then continues to implement — never gates). (PROGRESS + PreCompact flush re-deferred to Phase 5.)
