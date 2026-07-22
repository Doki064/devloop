#!/usr/bin/env node
// Dogfood for intent-lint.mjs — assert-based, no framework. Every case isolated in its own os.tmpdir()
// dir so it NEVER touches the real repo. The golden PASS pairs/trios are EXTRACTED from the skill-local
// artifact contracts (skills/discuss/references/{INTENT,ASSUMPTIONS}.md, skills/research/references/RESEARCH.md)
// at runtime (the worked INTENT/ASSUMPTIONS/RESEARCH examples), so if a contract drifts from the lint rules
// this test breaks — a living doc-code guard. FAIL fixtures are programmatic mutations of that golden,
// one per byte-checkable rule (the 13 INTENT/ASSUMPTIONS rules + the RESEARCH.md sibling rules + the
// stage-gated RESEARCH/SPEC Q-joins), each asserting exactly the expected violation surfaces.
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lint } from './intent-lint.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'intent-lint.mjs');
const DISCUSS_REF = join(HERE, '..', 'skills', 'discuss', 'references');
const RESEARCH_REF = join(HERE, '..', 'skills', 'research', 'references');

let fails = 0;
function check(label, fn) {
  try {
    fn();
    console.log(`ok   : ${label}`);
  } catch (e) {
    console.log(`FAIL : ${label} — ${e.message}`);
    fails++;
  }
}

function mkwork() {
  return fs.mkdtempSync(join(tmpdir(), 'intentlint-'));
}

// Pull the first ```markdown fenced block from a skill-local artifact contract file (each contract
// file carries exactly one artifact schema — the worked example the lint rules are extracted from).
function firstBlock(path) {
  const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === '```markdown');
  assert.notStrictEqual(start, -1, `no markdown fence in ${path}`);
  let end = -1;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === '```') { end = i; break; }
  }
  assert.notStrictEqual(end, -1, `unclosed fence in ${path}`);
  return lines.slice(start + 1, end).join('\n');
}

const GOLDEN_INTENT = firstBlock(join(DISCUSS_REF, 'INTENT.md'));
const GOLDEN_ASSUMPTIONS = firstBlock(join(DISCUSS_REF, 'ASSUMPTIONS.md'));
const GOLDEN_RESEARCH = firstBlock(join(RESEARCH_REF, 'RESEARCH.md'));

function writePair(dir, intent, assumptions) {
  fs.writeFileSync(join(dir, 'INTENT.md'), intent);
  if (assumptions !== null) fs.writeFileSync(join(dir, 'ASSUMPTIONS.md'), assumptions);
  return join(dir, 'INTENT.md');
}

// Run lint on a mutated golden and return the violations array.
function run(intent, assumptions) {
  const work = mkwork();
  try {
    const p = writePair(work, intent, assumptions);
    return lint(p);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

// Run lint over an arbitrary sibling set. files = {intent, assumptions?, research?, spec?, plan?};
// null/absent keys are simply not written. Optional stage token is passed through to lint().
function runTrio(files, stage) {
  const work = mkwork();
  try {
    fs.writeFileSync(join(work, 'INTENT.md'), files.intent);
    if (files.assumptions != null) fs.writeFileSync(join(work, 'ASSUMPTIONS.md'), files.assumptions);
    if (files.research != null) fs.writeFileSync(join(work, 'RESEARCH.md'), files.research);
    if (files.spec != null) fs.writeFileSync(join(work, 'SPEC.md'), files.spec);
    if (files.plan != null) fs.writeFileSync(join(work, 'PLAN.md'), files.plan);
    return lint(join(work, 'INTENT.md'), stage);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

// Minimal schema-valid INTENT (all Coverage rows Clear, no other rule fires) — for the spec-join arms
// that need a hand-built ledger rather than a mutated golden.
function minimalIntent(questions, answers) {
  return `# Intent: test feature

## Goal
A test feature for the resolution-source arms.

## Coverage
| category | status | note |
|----------|--------|------|
| goal | Clear | |
| scope | Clear | |
| success-criteria | Clear | |
| constraints | Clear | |
| integration-surface | Clear | |
| edge/failure | Clear | |

## Questions
${questions}

## Answers
${answers}
`;
}

function has(violations, needle) {
  return violations.some((v) => v.includes(needle));
}

// ---- Golden PASS (living doc-code guard) ----
check('golden: extracted INTENT+ASSUMPTIONS pair lints clean (incl. Q3/A1 [irreversible] propagation)', () => {
  // Sanity: the golden actually exercises propagation, else rule 13 is untested by the golden.
  assert.ok(/\*\*Q3\*\*[^\n]*\[irreversible\]/.test(GOLDEN_INTENT), 'golden Q3 must carry [irreversible]');
  assert.ok(/\*\*A1\*\*[^\n]*\(Q3\)[^\n]*\[irreversible\]/.test(GOLDEN_ASSUMPTIONS), 'golden A1 must link Q3 and carry [irreversible]');
  const v = run(GOLDEN_INTENT, GOLDEN_ASSUMPTIONS);
  assert.deepStrictEqual(v, [], `expected clean, got:\n${v.join('\n')}`);
});

// ---- 13 FAIL fixtures ----

// 1. `## Goal` section removed.
check('rule 1: ## Goal removed -> violation', () => {
  const intent = GOLDEN_INTENT.replace(/## Goal\n.*?\n\n/s, '');
  const v = run(intent, GOLDEN_ASSUMPTIONS);
  assert.ok(has(v, '## Goal'), `expected a ## Goal violation, got:\n${v.join('\n')}`);
});

// 2. `| edge/failure | ...` coverage row removed (5 of 6).
check('rule 2: edge/failure coverage row removed -> violation names it', () => {
  const intent = GOLDEN_INTENT.replace(/\| edge\/failure \|[^\n]*\n/, '');
  const v = run(intent, GOLDEN_ASSUMPTIONS);
  assert.ok(has(v, 'edge/failure'), `expected an edge/failure violation, got:\n${v.join('\n')}`);
});

// 3. scope row note `→ Q1` blanked (Partial with empty note).
check('rule 3: scope note blanked -> Partial/Missing empty-note violation', () => {
  const intent = GOLDEN_INTENT.replace('| scope | Partial | → Q1 |', '| scope | Partial |  |');
  const v = run(intent, GOLDEN_ASSUMPTIONS);
  assert.ok(has(v, 'scope'), `expected a scope note violation, got:\n${v.join('\n')}`);
  assert.strictEqual(v.length, 1, `expected only the scope violation, got:\n${v.join('\n')}`);
});

// 4. 7 extra well-formed questions appended (Q5-Q11) -> 11 total.
check('rule 4: 11 questions -> exceeds max 10 (only violation)', () => {
  const extra = Array.from({ length: 7 }, (_, i) => {
    const n = i + 5;
    return `- **Q${n}** [scope] route=user affects=SPEC split="opt-a${n} vs opt-b${n}": filler question ${n}?`;
  }).join('\n');
  const q4 = '- **Q4** [integration-surface] route=research affects=PLAN split="reuse report queue vs new worker": Is the report queue reusable?';
  const intent = GOLDEN_INTENT.replace(q4, `${q4}\n${extra}`);
  const v = run(intent, GOLDEN_ASSUMPTIONS);
  assert.ok(has(v, '11'), `expected an >10 questions violation, got:\n${v.join('\n')}`);
  assert.strictEqual(v.length, 1, `expected only the count violation, got:\n${v.join('\n')}`);
});

// 5-8. Four INDEPENDENT single-field drops on Q1 (never bundled).
check('rule 5: Q1 [scope] removed -> missing category', () => {
  const intent = GOLDEN_INTENT.replace('**Q1** [scope]', '**Q1**');
  const v = run(intent, GOLDEN_ASSUMPTIONS);
  assert.ok(has(v, 'Q1'), `expected Q1 category violation, got:\n${v.join('\n')}`);
  assert.strictEqual(v.length, 1, `expected only the Q1 category violation, got:\n${v.join('\n')}`);
});

check('rule 6: Q1 route=user removed -> missing route', () => {
  const intent = GOLDEN_INTENT.replace('**Q1** [scope] route=user ', '**Q1** [scope] ');
  const v = run(intent, GOLDEN_ASSUMPTIONS);
  assert.ok(has(v, 'route'), `expected Q1 route violation, got:\n${v.join('\n')}`);
  assert.strictEqual(v.length, 1, `expected only the Q1 route violation, got:\n${v.join('\n')}`);
});

check('rule 7: Q1 affects=SPEC removed -> missing affects', () => {
  const intent = GOLDEN_INTENT.replace('route=user affects=SPEC split=', 'route=user split=');
  const v = run(intent, GOLDEN_ASSUMPTIONS);
  assert.ok(has(v, 'affects'), `expected Q1 affects violation, got:\n${v.join('\n')}`);
  assert.strictEqual(v.length, 1, `expected only the Q1 affects violation, got:\n${v.join('\n')}`);
});

check('rule 8: Q1 split="..." removed -> missing split', () => {
  const intent = GOLDEN_INTENT.replace(' split="admins only vs all users"', '');
  const v = run(intent, GOLDEN_ASSUMPTIONS);
  assert.ok(has(v, 'split'), `expected Q1 split violation, got:\n${v.join('\n')}`);
  assert.strictEqual(v.length, 1, `expected only the Q1 split violation, got:\n${v.join('\n')}`);
});

// 9. Q2's split duplicated with Q1's value.
check('rule 9: duplicate split value -> violation', () => {
  const intent = GOLDEN_INTENT.replace('split="p95<200ms vs no target"', 'split="admins only vs all users"');
  const v = run(intent, GOLDEN_ASSUMPTIONS);
  assert.ok(has(v, 'duplicate'), `expected a duplicate-split violation, got:\n${v.join('\n')}`);
  assert.strictEqual(v.length, 1, `expected only the duplicate violation, got:\n${v.join('\n')}`);
});

// 10. Answers entry references a nonexistent Q-id.
check('rule 10: Answers references nonexistent Q9 -> violation', () => {
  const intent = GOLDEN_INTENT.replace('- **Q1**: all users', '- **Q9**: all users');
  const v = run(intent, GOLDEN_ASSUMPTIONS);
  assert.ok(has(v, 'Q9'), `expected an unknown-Q answer violation, got:\n${v.join('\n')}`);
  assert.strictEqual(v.length, 1, `expected only the Answers violation, got:\n${v.join('\n')}`);
});

// 11. A2 loses its rejected alternative.
check('rule 11: A2 rejected-alternative removed -> violation', () => {
  const assumptions = GOLDEN_ASSUMPTIONS.replace('assume CSV output, not XLSX', 'assume CSV output');
  const v = run(GOLDEN_INTENT, assumptions);
  assert.ok(has(v, 'A2'), `expected an A2 rejected-alternative violation, got:\n${v.join('\n')}`);
  assert.strictEqual(v.length, 1, `expected only the A2 violation, got:\n${v.join('\n')}`);
});

// 12. A1's (Q3) link dangles.
check('rule 12: A1 (Q3)->(Q9) dangling link -> violation', () => {
  const assumptions = GOLDEN_ASSUMPTIONS.replace('**A1** (Q3)', '**A1** (Q9)');
  const v = run(GOLDEN_INTENT, assumptions);
  assert.ok(has(v, 'Q9'), `expected a dangling-link violation, got:\n${v.join('\n')}`);
  assert.strictEqual(v.length, 1, `expected only the dangling-link violation, got:\n${v.join('\n')}`);
});

// 13. A1 drops [irreversible] while Q3 still carries it.
check('rule 13: A1 [irreversible] dropped while Q3 carries it -> propagation violation', () => {
  const assumptions = GOLDEN_ASSUMPTIONS.replace('affects=SPEC [irreversible]', 'affects=SPEC');
  const v = run(GOLDEN_INTENT, assumptions);
  assert.ok(has(v, 'irreversible'), `expected a propagation violation, got:\n${v.join('\n')}`);
  assert.strictEqual(v.length, 1, `expected only the propagation violation, got:\n${v.join('\n')}`);
});

// ---- Empty-state edges ----

// (a) missing INTENT.md -> exit 1 AND `missing file` message (NOT a clean 0). Verify the REAL exit code
//     via spawnSync; also spawn the golden dir (exit 0) and a violation fixture (exit 1).
check('edge a: missing INTENT.md -> exit 1 + "missing file"', () => {
  const work = mkwork();
  try {
    const p = join(work, 'INTENT.md'); // never written
    const r = spawnSync('node', [SCRIPT, p], { encoding: 'utf8' });
    assert.strictEqual(r.status, 1, `expected exit 1, got ${r.status}`);
    assert.ok(r.stdout.includes('missing file'), `expected "missing file", got:\n${r.stdout}`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

check('edge a: golden dir -> exit 0; violation fixture -> exit 1 (real process)', () => {
  const good = mkwork();
  const bad = mkwork();
  try {
    const gp = writePair(good, GOLDEN_INTENT, GOLDEN_ASSUMPTIONS);
    const rgood = spawnSync('node', [SCRIPT, gp], { encoding: 'utf8' });
    assert.strictEqual(rgood.status, 0, `expected clean exit 0, got ${rgood.status}\n${rgood.stdout}`);

    const bp = writePair(bad, GOLDEN_INTENT.replace(/## Goal\n.*?\n\n/s, ''), GOLDEN_ASSUMPTIONS);
    const rbad = spawnSync('node', [SCRIPT, bp], { encoding: 'utf8' });
    assert.strictEqual(rbad.status, 1, `expected violation exit 1, got ${rbad.status}\n${rbad.stdout}`);
  } finally {
    fs.rmSync(good, { recursive: true, force: true });
    fs.rmSync(bad, { recursive: true, force: true });
  }
});

// (b) missing ASSUMPTIONS.md alongside valid golden INTENT -> clean skip of the ASSUMPTIONS checks.
check('edge b: missing ASSUMPTIONS.md + valid INTENT -> clean', () => {
  const v = run(GOLDEN_INTENT, null);
  assert.deepStrictEqual(v, [], `expected clean skip, got:\n${v.join('\n')}`);
});

// ============================================================================
// RESEARCH.md sibling rules + stage-gated Q-joins
// ============================================================================

// ---- Golden RESEARCH trio PASS (living doc-code guard) ----
check('golden: RESEARCH trio lints clean with no stage AND with stage=research', () => {
  // Precondition: the golden INTENT's route=research questions are exactly Q2 and Q4 — the two the
  // golden RESEARCH block satisfies (Q2 in Findings, Q4 in Unanswered). Mirrors the [irreversible]
  // precondition the INTENT golden asserts.
  const researchRoutes = [...GOLDEN_INTENT.matchAll(/\*\*(Q\d+)\*\*[^\n]*route=research/g)].map((m) => m[1]).sort();
  assert.deepStrictEqual(researchRoutes, ['Q2', 'Q4'], 'golden INTENT route=research Qs must be Q2,Q4');
  assert.ok(/## Findings\n- \*\*Q2\*\*/.test(GOLDEN_RESEARCH), 'golden RESEARCH must answer Q2 in Findings');
  assert.ok(/## Unanswered\n- \*\*Q4\*\*/.test(GOLDEN_RESEARCH), 'golden RESEARCH must carry Q4 in Unanswered');

  const files = { intent: GOLDEN_INTENT, assumptions: GOLDEN_ASSUMPTIONS, research: GOLDEN_RESEARCH };
  assert.deepStrictEqual(runTrio(files), [], 'expected clean (no stage)');
  assert.deepStrictEqual(runTrio(files, 'research'), [], 'expected clean (stage=research)');
});

// ---- Presence-gated RESEARCH FAIL fixtures (one per new rule) ----

// r1. header carries the placeholder rather than a concrete mode.
check('research r1: header mode placeholder -> mode violation', () => {
  const research = GOLDEN_RESEARCH.replace('(mode=brownfield)', '(mode=greenfield|brownfield)');
  const v = runTrio({ intent: GOLDEN_INTENT, assumptions: GOLDEN_ASSUMPTIONS, research });
  assert.ok(has(v, 'mode'), `expected a mode violation, got:\n${v.join('\n')}`);
});

// r2a. a Findings entry with no **Q<N>** -> "no unsolicited research".
check('research r2a: finding without **Q<N>** -> no-unsolicited-research violation', () => {
  const research = GOLDEN_RESEARCH.replace('- **Q2** [high]:', '- [high]:');
  const v = runTrio({ intent: GOLDEN_INTENT, assumptions: GOLDEN_ASSUMPTIONS, research });
  assert.ok(has(v, 'no unsolicited research'), `expected a no-unsolicited-research violation, got:\n${v.join('\n')}`);
});

// r2b. a Findings entry citing a Q not in INTENT's Questions.
check('research r2b: finding cites unknown Q9 -> violation', () => {
  const research = GOLDEN_RESEARCH.replace('- **Q2** [high]:', '- **Q9** [high]:');
  const v = runTrio({ intent: GOLDEN_INTENT, assumptions: GOLDEN_ASSUMPTIONS, research });
  assert.ok(has(v, 'Q9'), `expected an unknown-Q9 violation, got:\n${v.join('\n')}`);
});

// r3. Q2 appears in both Findings and Unanswered.
check('research r3: Q2 in Findings AND Unanswered -> duplicate violation', () => {
  const research = GOLDEN_RESEARCH.replace(
    '- **Q4**: queue internals undocumented',
    '- **Q2**: also unresolved → risk: double answer; flag.\n- **Q4**: queue internals undocumented',
  );
  const v = runTrio({ intent: GOLDEN_INTENT, assumptions: GOLDEN_ASSUMPTIONS, research });
  assert.ok(has(v, 'duplicate') && has(v, 'Q2'), `expected a Q2 duplicate violation, got:\n${v.join('\n')}`);
});

// r4. Q2 finding drops its confidence tag.
check('research r4: finding missing confidence tag -> violation', () => {
  const research = GOLDEN_RESEARCH.replace('- **Q2** [high]:', '- **Q2**:');
  const v = runTrio({ intent: GOLDEN_INTENT, assumptions: GOLDEN_ASSUMPTIONS, research });
  assert.ok(has(v, 'confidence'), `expected a confidence violation, got:\n${v.join('\n')}`);
});

// r5a. trailing ` — ` with nothing after -> empty source.
check('research r5a: empty source after last em-dash -> violation', () => {
  const research = GOLDEN_RESEARCH.replace(' — docs/slo.md:12', ' — ');
  const v = runTrio({ intent: GOLDEN_INTENT, assumptions: GOLDEN_ASSUMPTIONS, research });
  assert.ok(has(v, 'source'), `expected an empty-source violation, got:\n${v.join('\n')}`);
});

// r5b. no ` — ` separator at all.
check('research r5b: finding missing the em-dash separator -> violation', () => {
  const research = GOLDEN_RESEARCH.replace(' — docs/slo.md:12', ' docs/slo.md:12');
  const v = runTrio({ intent: GOLDEN_INTENT, assumptions: GOLDEN_ASSUMPTIONS, research });
  assert.ok(has(v, 'separator'), `expected a separator violation, got:\n${v.join('\n')}`);
});

// r5c. last segment is prose (neither http nor path:line).
check('research r5c: source is prose, not URL/path:line -> shape violation', () => {
  const research = GOLDEN_RESEARCH.replace('docs/slo.md:12', 'the platform norm');
  const v = runTrio({ intent: GOLDEN_INTENT, assumptions: GOLDEN_ASSUMPTIONS, research });
  assert.ok(has(v, 'source'), `expected a source-shape violation, got:\n${v.join('\n')}`);
});

// r6. greenfield mode requires an http source; a path:line source violates it.
check('research r6: greenfield source without http -> greenfield-URL violation', () => {
  const research = GOLDEN_RESEARCH.replace('(mode=brownfield)', '(mode=greenfield)');
  const v = runTrio({ intent: GOLDEN_INTENT, assumptions: GOLDEN_ASSUMPTIONS, research });
  assert.ok(has(v, 'greenfield'), `expected a greenfield-URL violation, got:\n${v.join('\n')}`);
});

// r7. Unanswered entry without risk:.
check('research r7: Unanswered entry missing risk: -> violation', () => {
  const research = GOLDEN_RESEARCH.replace('→ risk: PLAN may double-build a worker', '→ PLAN may double-build a worker');
  const v = runTrio({ intent: GOLDEN_INTENT, assumptions: GOLDEN_ASSUMPTIONS, research });
  assert.ok(has(v, 'risk'), `expected a missing-risk violation, got:\n${v.join('\n')}`);
});

// Separator-robustness PASS guard — kills a split()[1] implementation (its middle segment is prose and
// would fail source-shape); the true SOURCE is the segment after the LAST ` — `.
check('research: interior em-dashes with URL last segment -> clean (kills split()[1])', () => {
  const research = GOLDEN_RESEARCH
    .replace('(mode=brownfield)', '(mode=greenfield)')
    .replace(
      '- **Q2** [high]: p95<200ms is the platform norm; adopt it. — docs/slo.md:12',
      '- **Q2** [high]: latency target — p95 under 200ms — is the norm; adopt it. — https://example.com/slo',
    );
  const v = runTrio({ intent: GOLDEN_INTENT, assumptions: GOLDEN_ASSUMPTIONS, research });
  assert.deepStrictEqual(v, [], `expected clean, got:\n${v.join('\n')}`);
});

// Independent-optional refactor: INTENT + RESEARCH, NO ASSUMPTIONS -> RESEARCH rules still run.
check('research: INTENT+RESEARCH without ASSUMPTIONS still runs RESEARCH rules', () => {
  const research = GOLDEN_RESEARCH.replace('(mode=brownfield)', '(mode=greenfield|brownfield)');
  const v = runTrio({ intent: GOLDEN_INTENT, research });
  assert.ok(has(v, 'mode'), `expected a mode violation with no ASSUMPTIONS present, got:\n${v.join('\n')}`);
});

// ---- Stage-gated joins ----

// stage=research join: a route=research Q in neither section. No-stage must NOT wedge (discuss re-runs
// the self-check on files it doesn't own); stage=research fires the named join.
check('stage=research: route=research Q absent from RESEARCH -> no-stage passes, stage names Q4', () => {
  const research = GOLDEN_RESEARCH.replace(/\n- \*\*Q4\*\*:[^\n]*/, '');
  const files = { intent: GOLDEN_INTENT, assumptions: GOLDEN_ASSUMPTIONS, research };
  assert.deepStrictEqual(runTrio(files), [], 'no-stage must pass (must not wedge discuss)');
  const v = runTrio(files, 'research');
  assert.ok(has(v, 'Q4'), `expected a Q4 join violation at stage=research, got:\n${v.join('\n')}`);
});

// stage=spec terminal Q-join: golden resolves Q1 (Answers) ∪ Q2 (Finding) ∪ Q3 (ASSUMPTIONS link); Q4 is
// unresolved (only in RESEARCH Unanswered), so it must appear as a `Q4` token in SPEC.md.
check('stage=spec: unresolved Q4 absent from SPEC -> FAILS; SPEC citing Q4 -> passes', () => {
  const base = { intent: GOLDEN_INTENT, assumptions: GOLDEN_ASSUMPTIONS, research: GOLDEN_RESEARCH };
  const specNoQ4 = '# Spec: export\n\n## Goal\nExport feature.\n';
  const vFail = runTrio({ ...base, spec: specNoQ4 }, 'spec');
  assert.ok(has(vFail, 'Q4'), `expected a Q4 spec-join violation, got:\n${vFail.join('\n')}`);

  const specWithQ4 = '# Spec: export\n\n## Open questions\n- [NEEDS CLARIFICATION: queue reusability (Q4)]\n';
  const vPass = runTrio({ ...base, spec: specWithQ4 }, 'spec');
  assert.deepStrictEqual(vPass, [], `expected clean when SPEC cites Q4, got:\n${vPass.join('\n')}`);
});

// stage=spec resolution-source arms — each passes with SPEC NOT citing the Q, because the Q is resolved
// through a distinct channel (Answers / RESEARCH Finding / ASSUMPTIONS link).
check('stage=spec arm A: Q resolved only via INTENT Answers -> clean (SPEC need not cite it)', () => {
  const intent = minimalIntent(
    '- **Q1** [scope] route=user affects=SPEC split="admins only vs all users": Who can trigger?',
    '- **Q1**: all users.',
  );
  const spec = '# Spec: t\n\n## Goal\nA feature.\n';
  assert.deepStrictEqual(runTrio({ intent, spec }, 'spec'), []);
});

check('stage=spec arm B: Q resolved only via a RESEARCH Finding -> clean', () => {
  const intent = minimalIntent(
    '- **Q1** [scope] route=research affects=SPEC split="admins only vs all users": Who can trigger?',
    '',
  );
  const research = '# Research: t  (mode=brownfield)\n\n## Findings\n- **Q1** [high]: all users. — docs/x.md:1\n\n## Unanswered\n';
  const spec = '# Spec: t\n\n## Goal\nA feature.\n';
  assert.deepStrictEqual(runTrio({ intent, research, spec }, 'spec'), []);
});

check('stage=spec arm C: Q resolved only via an ASSUMPTIONS (Q<N>) link -> clean', () => {
  const intent = minimalIntent(
    '- **Q1** [scope] route=user affects=SPEC split="admins only vs all users": Who can trigger?',
    '',
  );
  const assumptions = '# Assumptions: t\n\n- **A1** (Q1): assume all users, not admins only — platform default. affects=SPEC\n';
  const spec = '# Spec: t\n\n## Goal\nA feature.\n';
  assert.deepStrictEqual(runTrio({ intent, assumptions, spec }, 'spec'), []);
});

// stage=spec Q-id boundary guard: unresolved Q1 must NOT be satisfied by SPEC text that only contains
// Q10 (substring match would wrongly treat "Q10" as citing "Q1").
check('stage=spec: unresolved Q1 not satisfied by SPEC citing only Q10 -> flags exactly Q1', () => {
  const intent = minimalIntent(
    [
      '- **Q1** [scope] route=user affects=SPEC split="admins only vs all users": Who can trigger?',
      '- **Q10** [scope] route=user affects=SPEC split="sync vs async": How does it run?',
    ].join('\n'),
    '- **Q10**: async.',
  );
  const spec = '# Spec: t\n\n## Open questions\n- [NEEDS CLARIFICATION: run mode (Q10)]\n';
  const v = runTrio({ intent, spec }, 'spec');
  assert.deepStrictEqual(v, ['SPEC.md: Q1 is unresolved and its Q token appears nowhere in SPEC.md'], `got:\n${v.join('\n')}`);
});

// ---- stage=spec: duplicate-AC-N rule (decision 6) ----

// dup-AC 1: two **AC-2** bullets in ## Acceptance criteria -> stage=spec exit1 with exactly the
// dup violation; the SAME bytes -> bare AND stage=research exit 0 (neither owns SPEC — wedge guard).
// A valid RESEARCH.md is included so the stage=research exit-0 arm tests the join, not the
// missing-RESEARCH-file rule.
check('stage=spec dup-AC: two **AC-2** bullets -> exactly the dup violation; bare/research untouched', () => {
  const specDup = '# Spec: export\n\n## Acceptance criteria\n'
    + '- **AC-1** [truth]: WHEN x THE SYSTEM SHALL y\n'
    + '- **AC-2** [artifact]: THE SYSTEM SHALL z\n'
    + '- **AC-2** [truth]: THE SYSTEM SHALL w\n\n'
    + '## Open questions\n- [NEEDS CLARIFICATION: queue reusability (Q4)]\n';
  const files = { intent: GOLDEN_INTENT, assumptions: GOLDEN_ASSUMPTIONS, research: GOLDEN_RESEARCH, spec: specDup };

  const vSpec = runTrio(files, 'spec');
  assert.deepStrictEqual(vSpec, ['SPEC.md: AC-2 is duplicated in ## Acceptance criteria'], `expected exactly the dup violation, got:\n${vSpec.join('\n')}`);

  assert.deepStrictEqual(runTrio(files), [], 'expected bare invocation to stay clean (SPEC is not its file)');
  assert.deepStrictEqual(runTrio(files, 'research'), [], 'expected stage=research to stay clean (SPEC is not its file)');
});

// dup-AC 2: withdrawal form — `(was AC-2)` under ## Out of scope must not count as a live AC-2,
// and must not collide with an absent AC-2 in ## Acceptance criteria.
check('stage=spec dup-AC: withdrawn (was AC-2) note under Out of scope -> clean', () => {
  const spec = '# Spec: export\n\n## Acceptance criteria\n'
    + '- **AC-1** [truth]: WHEN x THE SYSTEM SHALL y\n\n'
    + '## Out of scope\n- (was AC-2) superseded — no longer needed after the re-gate\n\n'
    + '## Open questions\n- [NEEDS CLARIFICATION: queue reusability (Q4)]\n';
  const files = { intent: GOLDEN_INTENT, assumptions: GOLDEN_ASSUMPTIONS, research: GOLDEN_RESEARCH, spec };
  assert.deepStrictEqual(runTrio(files, 'spec'), [], `expected clean, got:\n${runTrio(files, 'spec').join('\n')}`);
});

// dup-AC 3: section-scope guard — a prose mention of AC-1 in ## Open questions must not double-count
// against the single **AC-1** bullet in ## Acceptance criteria (kills a whole-file or unbolded scan).
check('stage=spec dup-AC: prose "AC-1" mention in Open questions -> not counted, clean', () => {
  const intent = minimalIntent(
    '- **Q1** [scope] route=user affects=SPEC split="admins only vs all users": Who can trigger?',
    '- **Q1**: all users.',
  );
  const spec = '# Spec: t\n\n## Acceptance criteria\n- **AC-1** [manual]: threshold TBD (Q1)\n\n'
    + '## Open questions\n- [NEEDS CLARIFICATION: AC-1 threshold unknown (Q1)]\n';
  const v = runTrio({ intent, spec }, 'spec');
  assert.deepStrictEqual(v, [], `expected clean, got:\n${v.join('\n')}`);
});

// dup-AC 4: unique-ACs clean control.
check('stage=spec dup-AC: AC-1..AC-3 all unique -> clean', () => {
  const spec = '# Spec: export\n\n## Acceptance criteria\n'
    + '- **AC-1** [truth]: WHEN x THE SYSTEM SHALL y\n'
    + '- **AC-2** [artifact]: THE SYSTEM SHALL z\n'
    + '- **AC-3** [truth]: IF c THEN THE SYSTEM SHALL w\n\n'
    + '## Open questions\n- [NEEDS CLARIFICATION: queue reusability (Q4)]\n';
  const files = { intent: GOLDEN_INTENT, assumptions: GOLDEN_ASSUMPTIONS, research: GOLDEN_RESEARCH, spec };
  const v = runTrio(files, 'spec');
  assert.deepStrictEqual(v, [], `expected clean, got:\n${v.join('\n')}`);
});

// ============================================================================
// stage=plan: AC→task coverage trace matrix (framework-steal decision 2)
// ============================================================================

// An empty-Questions INTENT that lints clean on its own — the plan-stage arms care only about
// SPEC↔PLAN, so the INTENT contributes zero base violations.
const PLAN_INTENT = minimalIntent('', '');
const PLAN_SPEC = '# Spec: export\n\n## Acceptance criteria\n'
  + '- **AC-1** [truth]: WHEN x THE SYSTEM SHALL y\n'
  + '- **AC-2** [artifact]: THE SYSTEM SHALL z\n'
  + '- **AC-3** [truth]: IF c THEN THE SYSTEM SHALL w\n';

function planFixture(plan, spec = PLAN_SPEC) {
  return runTrio({ intent: PLAN_INTENT, spec, plan }, 'plan');
}

// pass: every SPEC AC lands in some task's covers=[] (parse tolerant of interior whitespace).
check('stage=plan: all ACs covered by covers=[] -> clean', () => {
  const plan = '# Plan: export\n\n## Tasks\n'
    + '- **T1** [tdd] scope=`a` deps=[] covers=[AC-1, AC-2]: build core\n'
    + '- **T2** [standard] scope=`b` deps=[] covers=[AC-3]: wire config\n\n'
    + '## Coverage gaps\nnone\n';
  assert.deepStrictEqual(planFixture(plan), [], `expected clean, got:\n${planFixture(plan).join('\n')}`);
});

// coverage: an AC in no covers= and no Coverage gaps -> violation. SAME bytes bare (no stage) must NOT
// fire the plan join (wedge guard — mirrors the dup-AC bare/research guard).
check('stage=plan coverage: AC-3 uncovered -> violation; bare invocation untouched', () => {
  const plan = '# Plan: export\n\n## Tasks\n'
    + '- **T1** [tdd] scope=`a` deps=[] covers=[AC-1,AC-2]: build core\n';
  const files = { intent: PLAN_INTENT, spec: PLAN_SPEC, plan };
  const v = runTrio(files, 'plan');
  assert.ok(has(v, 'AC-3 is uncovered'), `expected an AC-3 coverage violation, got:\n${v.join('\n')}`);
  assert.strictEqual(v.length, 1, `expected only the AC-3 violation, got:\n${v.join('\n')}`);
  assert.deepStrictEqual(runTrio(files), [], 'bare invocation must not fire the plan join');
});

// coverage: an uncovered AC explicitly parked under ## Coverage gaps -> clean (recorded non-mapping).
check('stage=plan coverage: AC-3 parked under ## Coverage gaps -> clean', () => {
  const plan = '# Plan: export\n\n## Tasks\n'
    + '- **T1** [tdd] scope=`a` deps=[] covers=[AC-1,AC-2]: build core\n\n'
    + '## Coverage gaps\n- AC-3: needs a human UX judgment; no automatable task\n';
  assert.deepStrictEqual(planFixture(plan), [], `expected clean, got:\n${planFixture(plan).join('\n')}`);
});

// dangling-covers: a covers= id with no matching bolded SPEC AC -> violation (corrupt trace matrix).
check('stage=plan dangling-covers: covers=[AC-9] with no such SPEC AC -> violation', () => {
  const plan = '# Plan: export\n\n## Tasks\n'
    + '- **T1** [tdd] scope=`a` deps=[] covers=[AC-1,AC-2]: build core\n'
    + '- **T2** [standard] scope=`b` deps=[] covers=[AC-3,AC-9]: wire config\n';
  const v = planFixture(plan);
  assert.ok(has(v, 'covers= cites AC-9'), `expected an AC-9 dangling-covers violation, got:\n${v.join('\n')}`);
  assert.strictEqual(v.length, 1, `expected only the AC-9 violation, got:\n${v.join('\n')}`);
});

// A withdrawn `(was AC-3)` note under ## Out of scope is not a live AC: coverage does not require it,
// and citing it in covers= is a dangling reference (it is not a bolded **AC-3** in Acceptance criteria).
const WITHDRAWN_SPEC = '# Spec: export\n\n## Acceptance criteria\n'
  + '- **AC-1** [truth]: WHEN x THE SYSTEM SHALL y\n'
  + '- **AC-2** [artifact]: THE SYSTEM SHALL z\n\n'
  + '## Out of scope\n- (was AC-3) dropped after the re-gate\n';

check('stage=plan: withdrawn (was AC-3) not required in covers= -> clean', () => {
  const plan = '# Plan: export\n\n## Tasks\n'
    + '- **T1** [tdd] scope=`a` deps=[] covers=[AC-1,AC-2]: build core\n';
  assert.deepStrictEqual(planFixture(plan, WITHDRAWN_SPEC), [], `expected clean, got:\n${planFixture(plan, WITHDRAWN_SPEC).join('\n')}`);
});

check('stage=plan: covers= citing withdrawn (was AC-3) -> dangling violation', () => {
  const plan = '# Plan: export\n\n## Tasks\n'
    + '- **T1** [tdd] scope=`a` deps=[] covers=[AC-1,AC-2,AC-3]: build core\n';
  const v = planFixture(plan, WITHDRAWN_SPEC);
  assert.ok(has(v, 'covers= cites AC-3'), `expected an AC-3 dangling-covers violation, got:\n${v.join('\n')}`);
  assert.strictEqual(v.length, 1, `expected only the AC-3 dangling violation, got:\n${v.join('\n')}`);
});

// An indented `e.g.` sub-line under an AC (spec-by-example rider) is not itself an AC — it must not
// inflate the required-coverage set (kills a scan that treats any AC-section line as a criterion).
check('stage=plan: indented e.g. sub-line under an AC is not a criterion -> clean', () => {
  const spec = '# Spec: export\n\n## Acceptance criteria\n'
    + '- **AC-1** [truth]: WHEN x THE SYSTEM SHALL y\n'
    + '  - e.g. WHEN the input is empty THE SYSTEM SHALL return []\n'
    + '- **AC-2** [artifact]: THE SYSTEM SHALL z\n';
  const plan = '# Plan: export\n\n## Tasks\n'
    + '- **T1** [tdd] scope=`a` deps=[] covers=[AC-1,AC-2]: build core\n';
  assert.deepStrictEqual(planFixture(plan, spec), [], `expected clean, got:\n${planFixture(plan, spec).join('\n')}`);
});

// stage=plan required inputs: PLAN present but SPEC absent -> SPEC missing-file violation (a clean skip
// would let a plan with no contract look green).
check('stage=plan: PLAN present but SPEC missing -> SPEC missing-file violation', () => {
  const plan = '# Plan: export\n\n## Tasks\n- **T1** [tdd] scope=`a` deps=[] covers=[AC-1]: x\n';
  const v = runTrio({ intent: PLAN_INTENT, plan }, 'plan');
  assert.ok(v.some((x) => x.includes('SPEC.md') && x.includes('missing file')), `expected a SPEC missing-file violation, got:\n${v.join('\n')}`);
});

// ---- CLI / exit-code edges (real process via spawnSync) ----
check('cli: stage=research w/o RESEARCH -> exit1+missing; stage=spec w/o SPEC -> exit1+missing; stage=bogus -> exit1 usage; INTENT-only no stage -> exit0', () => {
  const work = mkwork();
  try {
    const p = writePair(work, GOLDEN_INTENT, null); // INTENT only, no siblings

    const rResearch = spawnSync('node', [SCRIPT, p, 'stage=research'], { encoding: 'utf8' });
    assert.strictEqual(rResearch.status, 1, `stage=research: expected exit 1, got ${rResearch.status}`);
    assert.ok(rResearch.stdout.includes('missing file'), `stage=research: expected "missing file", got:\n${rResearch.stdout}`);

    const rSpec = spawnSync('node', [SCRIPT, p, 'stage=spec'], { encoding: 'utf8' });
    assert.strictEqual(rSpec.status, 1, `stage=spec: expected exit 1, got ${rSpec.status}`);
    assert.ok(rSpec.stdout.includes('missing file'), `stage=spec: expected "missing file", got:\n${rSpec.stdout}`);

    const rPlan = spawnSync('node', [SCRIPT, p, 'stage=plan'], { encoding: 'utf8' });
    assert.strictEqual(rPlan.status, 1, `stage=plan: expected exit 1, got ${rPlan.status}`);
    assert.ok(rPlan.stdout.includes('PLAN.md') && rPlan.stdout.includes('SPEC.md') && rPlan.stdout.includes('missing file'),
      `stage=plan: expected PLAN+SPEC missing-file lines, got:\n${rPlan.stdout}`);

    const rBogus = spawnSync('node', [SCRIPT, p, 'stage=bogus'], { encoding: 'utf8' });
    assert.strictEqual(rBogus.status, 1, `stage=bogus: expected exit 1, got ${rBogus.status}`);
    assert.ok(rBogus.stdout.includes('usage'), `stage=bogus: expected usage, got:\n${rBogus.stdout}`);

    const rPlain = spawnSync('node', [SCRIPT, p], { encoding: 'utf8' });
    assert.strictEqual(rPlain.status, 0, `INTENT-only no-stage: expected exit 0, got ${rPlain.status}\n${rPlain.stdout}`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

console.log('----');
if (fails === 0) { console.log('PASS (all fixtures)'); }
else { console.log(`FAILURES: ${fails}`); process.exit(1); }
