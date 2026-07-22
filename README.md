# devloop

A Claude Code plugin that automates a **spec-driven, test-driven** software lifecycle — from a feature idea to a shipped PR — designed to run **autonomously** on your projects, at high quality.

## Pipeline
Per feature: `discuss → research → SPEC → plan → implement → verify → ship`, with a cross-cutting `doctor` and an advisory `review` lane. The `discuss`/`research` front-end is **uncertainty-gated** (skipped when intent is already clear); the `SPEC → ship` core always runs. A driver sequences it all autonomously; each stage is also runnable on its own.

Key ideas: the **SPEC is a falsifiable contract** every criterion maps to a test; a **defense-in-depth TDD gate** (test-before-feat, enforced in the implement procedure, the verifier, and a commit hook); a **bounded working set** so quality doesn't degrade as the project grows; and **scoped re-entry** (blast-radius re-gating + traceability) so a requirements change re-runs only what it affects — Spec-Kit-grade rigor without Spec-Kit's rigidity.

## Status
Early development, built in phases — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). **Phases 1–3 complete**: the core SDD-TDD loop (`spec` → `ship` stages, advisory `review` lane, tag-aware TDD commit hook); orchestration — the `drive` orchestrator (`/devloop <feature>`), self-heal, resume-from-artifacts, the `doctor` health check, and the plan-review→re-plan loop; and the uncertainty-gated `discuss`/`research` front-end with blast-radius re-gating (`REGATE`) wired through the driver. Next: Phase 4 (brownfield + multi-feature).

## Requirements
`git` and `node` (the commit hooks and gate scripts are cross-platform Node, no shell or `jq`).

## Try it locally
```
claude --plugin-dir .
```

## License
MIT
