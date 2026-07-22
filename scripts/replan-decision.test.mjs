#!/usr/bin/env node
// Dogfood for replan-decision.mjs — assert-based, no framework. Every case isolated in its own
// os.tmpdir() dir so it NEVER touches the real repo. Covers the absent-file / clean / no-progress /
// replan ordering, plus a self-fed loop simulation (the loop's own output feeding the next decision).
import assert from 'node:assert';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decide, formatDecision } from './replan-decision.mjs';

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
  return fs.mkdtempSync(join(tmpdir(), 'replandecision-'));
}

// count === 0 -> sentinel-only body; otherwise `count` one-line findings (no bullet prefix, deliberately
// prefix-agnostic per the contract).
function writeReview(dir, count) {
  const p = join(dir, 'REVIEW.md');
  const body = count === 0
    ? ['## Findings', '', 'Clean. Nothing to flag.', '']
    : ['## Findings', '', ...Array.from({ length: count }, (_, i) => `Finding ${i + 1} — something to fix.`), ''];
  fs.writeFileSync(p, body.join('\n'));
  return p;
}

// 1. clean REVIEW (sentinel body), prev -1 -> continue 0 clean.
check('1. clean REVIEW, prev -1 -> continue 0 clean', () => {
  const work = mkwork();
  try {
    const p = writeReview(work, 0);
    assert.strictEqual(formatDecision(decide(p, -1)), 'continue 0 clean');
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

// 2. 3 findings, prev -1 (first pass) -> replan 3.
check('2. 3 findings, prev -1 -> replan 3', () => {
  const work = mkwork();
  try {
    const p = writeReview(work, 3);
    assert.strictEqual(formatDecision(decide(p, -1)), 'replan 3');
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

// 3. 3 findings, prev 3 (stalled) -> continue 3 no-progress.
check('3. 3 findings, prev 3 -> continue 3 no-progress', () => {
  const work = mkwork();
  try {
    const p = writeReview(work, 3);
    assert.strictEqual(formatDecision(decide(p, 3)), 'continue 3 no-progress');
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

// 4. 4 findings, prev 3 (grew) -> continue 4 no-progress.
check('4. 4 findings, prev 3 -> continue 4 no-progress', () => {
  const work = mkwork();
  try {
    const p = writeReview(work, 4);
    assert.strictEqual(formatDecision(decide(p, 3)), 'continue 4 no-progress');
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

// 5. 2 findings, prev 3 (shrank) -> replan 2.
check('5. 2 findings, prev 3 -> replan 2', () => {
  const work = mkwork();
  try {
    const p = writeReview(work, 2);
    assert.strictEqual(formatDecision(decide(p, 3)), 'replan 2');
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

// 6. absent REVIEW.md path -> continue 0 no-review (reviewer failed/died, never crash).
check('6. absent REVIEW.md -> continue 0 no-review', () => {
  const work = mkwork();
  try {
    const p = join(work, 'REVIEW.md'); // never written
    assert.strictEqual(formatDecision(decide(p, -1)), 'continue 0 no-review');
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

// 7. present sentinel-only, prev 5 -> continue 0 clean (clean beats no-progress even when prev > 0).
check('7. sentinel-only, prev 5 -> continue 0 clean', () => {
  const work = mkwork();
  try {
    const p = writeReview(work, 0);
    assert.strictEqual(formatDecision(decide(p, 5)), 'continue 0 clean');
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

// 8. Self-fed convergence: the drive loop feeds its own previous decision's count back in as the next
//    prev-count. A strictly-decreasing finding sequence must terminate at clean within the finite bound
//    (<= sequence length); a stalled sequence must terminate at no-progress, not loop forever.
check('8a. self-fed loop: decreasing 5->4->3->2->1->0 terminates at clean within bound', () => {
  const work = mkwork();
  try {
    const sequence = [5, 4, 3, 2, 1, 0];
    let prevCount = -1;
    let last;
    let iterations = 0;
    for (const count of sequence) {
      const p = writeReview(work, count);
      last = decide(p, prevCount);
      iterations++;
      if (last.action !== 'replan') break;
      prevCount = last.count;
    }
    assert.ok(iterations <= sequence.length, `expected termination within ${sequence.length} iterations, took ${iterations}`);
    assert.strictEqual(formatDecision(last), 'continue 0 clean');
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

check('8b. self-fed loop: stalled 3->3 terminates at no-progress', () => {
  const work = mkwork();
  try {
    const sequence = [3, 3];
    let prevCount = -1;
    let last;
    let iterations = 0;
    for (const count of sequence) {
      const p = writeReview(work, count);
      last = decide(p, prevCount);
      iterations++;
      if (last.action !== 'replan') break;
      prevCount = last.count;
    }
    assert.strictEqual(iterations, 2, `expected termination at iteration 2, took ${iterations}`);
    assert.strictEqual(formatDecision(last), 'continue 3 no-progress');
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

// 9. Bulleted sentinel `- Clean. Nothing to flag.` (the reviewer may bullet it to match the REVIEW
//    contract's list style) -> must still read as clean, NOT one spurious finding that wastes a replan.
check('9. bulleted sentinel -> continue 0 clean', () => {
  const work = mkwork();
  try {
    const p = join(work, 'REVIEW.md');
    fs.writeFileSync(p, ['## Findings', '', '- Clean. Nothing to flag.', ''].join('\n'));
    assert.strictEqual(formatDecision(decide(p, -1)), 'continue 0 clean');
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

console.log('----');
if (fails === 0) { console.log('PASS (all fixtures)'); }
else { console.log(`FAILURES: ${fails}`); process.exit(1); }
