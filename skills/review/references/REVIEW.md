# REVIEW.md — artifact contract

- **Purpose:** durable, advisory quality findings — the reviewer's qualitative judgment of whether a
  PLAN or the implementation is well-shaped (simple, secure, idiomatic, true to SPEC intent). The
  **deliberate inverse of VERIFY.md**: judgment, not reasoning-blind evidence.
- **Location:** `specs/<slug>/REVIEW.md` · **Durability:** EPHEMERAL (archived on ship, like VERIFY).
- **Parameterized:** `target=plan` (judge the PLAN vs the SPEC) or `target=impl` (judge the changed
  code). Same-path, latest-write-wins — the header records which (mirrors VERIFY.md's `stage=`).
- **Advisory — never a gate.** REVIEW.md carries **no PASS/FAIL verdict**: a verdict would read as a
  blocker, and review never blocks (a concern becomes a gate only by being promoted to a SPEC `AC-N`
  verify grades, or a hook). The driver's plan-review→re-plan loop consumes the *finding count* (it
  re-plans while findings strictly shrink, then continues to implement regardless) — never a verdict.

```markdown
# Review: <feature name>  (target=plan|impl)

## Findings
- <file>:L<line>: <lane/tag> <what>. <fix/replacement>.
- <file>:L<line>: <lane/tag> <what>. <fix/replacement>.

## Summary
<one line>
```

Findings are **most-severe first**, one line each (a leading `- ` bullet is presentational — the
driver's count parser is prefix-agnostic). When there is nothing to flag, the `## Findings` body is the
`Clean. Nothing to flag.` sentinel (bulleted or bare — both read as count zero). The count is
**derived** from the `## Findings` lines — do **not** also record a number in `## Summary` (single
source; no drift for a consumer to reconcile).

**Definition of Done:**
- [ ] Header names the `target` (`plan` or `impl`).
- [ ] Each finding is one line: `<file>:L<line>: <lane/tag> <what>. <fix>.`, most-severe first.
- [ ] No verdict / PASS-FAIL (advisory — never a gate); an empty review is the exact `Clean. Nothing to flag.` sentinel.
- [ ] `## Summary` carries no finding count (derived from `## Findings`).
