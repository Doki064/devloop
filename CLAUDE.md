# CLAUDE.md

Guidance for Claude Code when working in this repo. This file is a **router, not a dump** — it stays lean and points to detail on demand (devloop dogfoods its own doc-authoring invariant).

## What this is
devloop is a Claude Code plugin that runs an autonomous **spec-driven, test-driven** SDLC pipeline: `discuss → research → SPEC → plan → implement → verify → ship`, with a cross-cutting `doctor` and an advisory `review` lane. Design rationale and full architecture: **`docs/ARCHITECTURE.md`** (read it before changing pipeline stages, gates, or the agent/skill layout). Stage-transition artifact formats live with their writer stage in `skills/<stage>/references/<ARTIFACT>.md` (writer-owns), indexed by **`docs/ARTIFACTS.md`** — the thin artifact→contract-file→purpose table + shared format philosophy.

## Working here
- **Author with `plugin-dev`** — the toolkit for every component: its `skill-`/`agent-`/`hook-`/`command-development`, `mcp-integration`, `plugin-settings` skills, or the `agent-creator` agent; **validate** with `plugin-validator`. Use `skill-creator` only to benchmark a skill's quality, not to author. Don't hand-roll these.
- Skills = `skills/<name>/SKILL.md` (procedure in the skill body or `references/`); agents = `agents/<fn>.md` (functional names, canonical template). Deterministic/must-happen rules → **hooks**, not prose.
- **Reference bundled files** (docs, `scripts/`) with `${CLAUDE_PLUGIN_ROOT}/<subdir>/<file>` in skill/agent/hook bodies — substituted at load in all three (the official skill-substitution *table* is incomplete; this is verified against the binary, so don't "fix" these refs on the table's say-so). `${CLAUDE_SKILL_DIR}` is for a skill's *own* subdir only; neither is a Bash env var.
- Keep every doc lean (prune test: "would removing this line cause a mistake? if not, cut it"). Point to files with **plain paths, never eager `@`-imports**.
- **Build methodology** (dev tooling, not the shipped plugin) — model-tiered dev-agents in `.claude/agents/` for cost-aware delegation; planning/review playbooks + the routing rule in `docs/methodology/` (loaders: `/plan-methodology`, `/review-methodology`, `/release-methodology`).

## Build status
Built in phases; per-phase deliverables and the full roadmap live in `docs/ARCHITECTURE.md` → Phased build roadmap. **Phases 1 through 3.5 are complete and merged to main:**
- **Phase 1** — the core spec→ship SDD-TDD loop (spec, plan, implement, verify, ship stages) + the advisory `review` lane + the tag-aware TDD hook.
- **Phase 2** — the `drive` orchestrator (`/devloop:drive <feature>`), the self-heal loop, the resume core (`.done` markers + `.devloop/active`), **doctor** (pipeline-health diagnostic), and the plan-review→re-plan loop.
- **Phase 3** — the uncertainty-gated `discuss`/`research` front-end, mid-pipeline blast-radius re-gating (`REGATE`), and the drive integration wiring both through the pipeline.
- **Phase 3.5** — a modernization + hardening batch (artifact-contract split, commands→skills migration) plus riders (reverse-trace audit, plan-exit coverage lint, INTENT decisions ledger, heal-exhaustion escalation, research spikes), merged as PR #15.
