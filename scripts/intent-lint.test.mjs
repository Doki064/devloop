#!/usr/bin/env node
// Dogfood for intent-lint.mjs — assert-based, no framework. Every case isolated in its own os.tmpdir()
// dir so it NEVER touches the real repo. The golden PASS pair is EXTRACTED from docs/ARTIFACTS.md at
// runtime (the worked INTENT/ASSUMPTIONS examples), so if the doc drifts from the 13 lint rules this
// test breaks — a living doc-code guard. The 13 FAIL fixtures are programmatic mutations of that golden,
// one per byte-checkable rule, each asserting exactly the expected violation surfaces.
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lint } from './intent-lint.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'intent-lint.mjs');
const DOC = join(HERE, '..', 'docs', 'ARTIFACTS.md');

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

// Pull the first ```markdown fenced block that follows `heading` in the doc.
function extractBlock(doc, heading) {
  const lines = doc.split(/\r?\n/);
  const h = lines.findIndex((l) => l.trim() === heading);
  assert.notStrictEqual(h, -1, `heading not found: ${heading}`);
  let start = -1;
  for (let i = h + 1; i < lines.length; i++) {
    if (lines[i].trim() === '```markdown') { start = i + 1; break; }
    if (/^##\s/.test(lines[i])) break;
  }
  assert.notStrictEqual(start, -1, `no markdown fence after ${heading}`);
  let end = -1;
  for (let i = start; i < lines.length; i++) {
    if (lines[i].trim() === '```') { end = i; break; }
  }
  assert.notStrictEqual(end, -1, `unclosed fence after ${heading}`);
  return lines.slice(start, end).join('\n');
}

const docText = fs.readFileSync(DOC, 'utf8');
const GOLDEN_INTENT = extractBlock(docText, '## INTENT.md');
const GOLDEN_ASSUMPTIONS = extractBlock(docText, '## ASSUMPTIONS.md');

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

console.log('----');
if (fails === 0) { console.log('PASS (all fixtures)'); }
else { console.log(`FAILURES: ${fails}`); process.exit(1); }
