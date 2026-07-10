# CLAUDE.md

Guidance for Claude Code when working in this repo. This file is a **router, not a dump** — it stays lean and points to detail on demand (devloop dogfoods its own doc-authoring invariant).

## What this is
devloop is a Claude Code plugin that runs an autonomous **spec-driven, test-driven** SDLC pipeline: `discuss → research → SPEC → plan → implement → verify → ship`, with a cross-cutting `doctor`. Design rationale and full architecture: **`docs/ARCHITECTURE.md`** (read it before changing pipeline stages, gates, or the agent/skill layout).

## Working here
- **Author skills** with the `skill-creator` skill; **author agents** with `plugin-dev`'s `agent-creator`; **validate** with `plugin-validator`. Don't hand-roll what these generate.
- Skills = `skills/<name>/SKILL.md` (procedure in the skill body or `references/`); agents = `agents/<fn>.md` (functional names, canonical template). Deterministic/must-happen rules → **hooks**, not prose.
- Keep every doc lean (prune test: "would removing this line cause a mistake? if not, cut it"). Point to files with **plain paths, never eager `@`-imports**.

## Build status
Built in phases (see `docs/ARCHITECTURE.md` → Phased roadmap). Currently: **Phase 0 (scaffold)**.
