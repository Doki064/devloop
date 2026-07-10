# devloop

A Claude Code plugin that automates a **spec-driven, test-driven** software lifecycle — from a feature idea to a shipped PR — designed to run **autonomously** on your projects, at high quality.

## Pipeline
Per feature: `discuss → research → SPEC → plan → implement → verify → ship`, with a cross-cutting `doctor`. The `discuss`/`research` front-end is **uncertainty-gated** (skipped when intent is already clear); the `SPEC → ship` core always runs. A driver sequences it all autonomously; each stage is also runnable on its own.

Key ideas: the **SPEC is a falsifiable contract** every criterion maps to a test; a **defense-in-depth TDD gate** (test-before-feat, enforced in the implement procedure, the verifier, and a commit hook); a **bounded working set** so quality doesn't degrade as the project grows; and **scoped re-entry** (blast-radius re-gating + traceability) so a requirements change re-runs only what it affects — Spec-Kit-grade rigor without Spec-Kit's rigidity.

## Status
Early development, built in phases — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Currently **Phase 0 (scaffold)**.

## Try it locally
```
claude --plugin-dir .
```

## License
MIT
