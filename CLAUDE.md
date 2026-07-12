# CLAUDE.md

Guidance for Claude Code when working in this repo. This file is a **router, not a dump** — it stays lean and points to detail on demand (devloop dogfoods its own doc-authoring invariant).

## What this is
devloop is a Claude Code plugin that runs an autonomous **spec-driven, test-driven** SDLC pipeline: `discuss → research → SPEC → plan → implement → verify → ship`, with a cross-cutting `doctor` and an advisory `review` lane. Design rationale and full architecture: **`docs/ARCHITECTURE.md`** (read it before changing pipeline stages, gates, or the agent/skill layout). Stage-transition artifact formats (the single source of truth every stage reads/writes against): **`docs/ARTIFACTS.md`**.

## Working here
- **Author with `plugin-dev`** — the toolkit for every component: its `skill-`/`agent-`/`hook-`/`command-development`, `mcp-integration`, `plugin-settings` skills, or the `agent-creator` agent; **validate** with `plugin-validator`. Use `skill-creator` only to benchmark a skill's quality, not to author. Don't hand-roll these.
- Skills = `skills/<name>/SKILL.md` (procedure in the skill body or `references/`); agents = `agents/<fn>.md` (functional names, canonical template). Deterministic/must-happen rules → **hooks**, not prose.
- Keep every doc lean (prune test: "would removing this line cause a mistake? if not, cut it"). Point to files with **plain paths, never eager `@`-imports**.

## Build status
Built in phases (see `docs/ARCHITECTURE.md` → Phased roadmap). Currently: **Phase 1 (core SDD-TDD loop)** — spec, plan, implement, verify, ship stages built + the advisory `review` lane + the tag-aware TDD hook (`hooks/scripts/tdd-gate.mjs`). Phase 1 core loop complete.
