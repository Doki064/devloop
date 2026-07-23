# VERIFY.md — artifact contract

- **Purpose:** reasoning-blind evidence that criteria are met — judges artifacts + real test output +
  git log, **never** the implementer's narrative.
- **Location:** `specs/<slug>/VERIFY.md` · **Durability:** EPHEMERAL (ship-time archival is
  `DEFERRED(Phase 4)` — see `skills/ship/SKILL.md`; currently left in place, not archived).
- **Parameterized:** `stage=plan` (goal-backward coverage check) or `stage=impl` (run tests +
  TDD-commit check). Same-path, latest-write-wins — the header records which stage wrote it.

```markdown
# Verify: <feature name>  (stage=plan|impl)

## Trace matrix
| AC | check (test path / command) | result | evidence (output snippet / commit sha) |
|------|------------------------------|--------|-----------------------------------------|
| AC-1 | tests/test_auth.py::test_token | PASS | `1 passed` · a1b2c3d |
| AC-2 | migrations/003_users.sql exists | PASS | file present, creates users table |

## Unmapped
- Orphan requirement (AC with no check) → **BLOCK**
- Orphan test (check with no AC) → **WARN**

## Reverse trace  (stage=impl only)
| finding | spec statement violated | evidence (commit sha / file:line) |
|-------------|--------------------------|------------------------------------|
| contradicts | AC-2 caps retries at 3 | retry loop is unbounded · src/net.js:42 · a1b2c3d |

### Unrequested  (advisory — never blocks)
- src/util/cache.js:10 — LRU cache added, no AC backs it (may be a legitimate helper/refactor)

## Verdict
<PASS | FAIL>
```

A `manual` AC (not mechanically checkable) gets a **named-hole row** — result `MANUAL`, surfaced for
the human checkpoint (ship = PR) — counting as **neither PASS/FAIL nor BLOCK** (never a silent gap).

**Reverse trace (`stage=impl` only)** — beyond "is every AC met?", also "is every implementation
traceable to an AC?". Walk the diff/commits reasoning-blindly and record two finding classes:
- **`contradicts`** — code that violates a SPEC statement (e.g. an AC caps a value the code leaves
  unbounded). Each row names the violated statement and cites concrete evidence (`file:line` +/or
  commit sha). A contradicts finding **gates** — it fails the verdict exactly like a missed AC.
- **`unrequested`** — implementation with no AC backing (scope creep). **Advisory only**: listed
  here and echoed by ship in the PR body, **never blocks**. Refactors, shared helpers, and incidental
  cleanup are legitimate and expected — flag only genuinely unbacked behavior, and when unsure prefer
  a note over a claim (a false positive here wastes a human's attention at the PR).

`stage=plan` writes neither section (no implementation exists to trace).

**Definition of Done:**
- [ ] Every SPEC `AC-N` has a row with a concrete result and evidence (`MANUAL` for `manual` ACs).
- [ ] No `PASS` row lacks evidence.
- [ ] `stage=impl`: the reverse-trace pass ran — every `contradicts` row cites evidence; `unrequested`
      is present (may be empty).
- [ ] Verdict is FAIL if any AC fails, any orphan requirement (BLOCK) exists, **or any `contradicts`
      finding exists** (`MANUAL` and `unrequested` rows are neither).
