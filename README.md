# devloop

A Claude Code plugin that automates a **spec-driven, test-driven** software lifecycle — from a feature idea to a shipped PR — designed to run **autonomously** on your projects, at high quality.

## Pipeline
Per feature: `discuss → research → SPEC → plan → implement → verify → ship`, with a cross-cutting `doctor` and an advisory `review` lane. The `discuss`/`research` front-end is **uncertainty-gated** (skipped when intent is already clear); the `SPEC → ship` core always runs. A driver sequences it all autonomously; each stage is also runnable on its own.

Key ideas: the **SPEC is a falsifiable contract** every criterion maps to a test; a **defense-in-depth TDD gate** (test-before-feat, enforced in the implement procedure, the verifier, and a commit hook); a **bounded working set** so quality doesn't degrade as the project grows; and **scoped re-entry** (blast-radius re-gating + traceability) so a requirements change re-runs only what it affects — Spec-Kit-grade rigor without Spec-Kit's rigidity.

## Status
Early development, built in phases — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). **Phases 1–3.5 complete**: the core SDD-TDD loop (`spec` → `ship` stages, advisory `review` lane, tag-aware TDD commit hook); orchestration — the `drive` orchestrator (`/devloop:drive <feature>`), self-heal, resume-from-artifacts, the `doctor` health check, and the plan-review→re-plan loop; the uncertainty-gated `discuss`/`research` front-end with blast-radius re-gating (`REGATE`) wired through the driver; and a modernization + hardening batch (artifact-contract split, reverse-trace audit, plan-exit coverage lint, heal-exhaustion escalation, research spikes). Next: Phase 4 (brownfield + multi-feature).

## Requirements
`git`, `node`, and the [`gh` CLI](https://cli.github.com/) (ship uses it to open the PR). On **Windows** you also need a POSIX shell — [Git for Windows](https://git-scm.com/downloads/win) (which provides Git Bash) or WSL — because the pipeline skills issue POSIX commands (`date -u`, `sed`, `grep`, `rm -f`, `mkdir -p`) through Claude Code's Bash tool, and [without one Claude Code falls back to PowerShell](https://code.claude.com/docs/en/setup#set-up-on-windows), where they don't run. The commit hooks and gate scripts (`hooks/`, `scripts/`) are **cross-platform Node** — the hook runner exec's `node` directly, so they carry no shell or `jq` dependency and run regardless. (De-shelling the skills so they don't need a POSIX shell either is Phase-5 work.)

## Try it locally
```
claude --plugin-dir .
```
Drive a feature with `/devloop:drive <feature>`; run any stage on its own with `/devloop:<stage> <feature>`.

## License
MIT
