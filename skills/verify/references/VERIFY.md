# VERIFY.md — artifact contract

- **Purpose:** reasoning-blind evidence that criteria are met — judges artifacts + real test output +
  git log, **never** the implementer's narrative.
- **Location:** `specs/<slug>/VERIFY.md` · **Durability:** EPHEMERAL (archived on ship).
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

## Verdict
<PASS | FAIL>
```

A `manual` AC (not mechanically checkable) gets a **named-hole row** — result `MANUAL`, surfaced for
the human checkpoint (ship = PR) — counting as **neither PASS/FAIL nor BLOCK** (never a silent gap).

**Definition of Done:**
- [ ] Every SPEC `AC-N` has a row with a concrete result and evidence (`MANUAL` for `manual` ACs).
- [ ] No `PASS` row lacks evidence.
- [ ] Verdict is FAIL if any AC fails or any orphan requirement (BLOCK) exists (`MANUAL` rows are neither).
