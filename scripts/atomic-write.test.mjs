#!/usr/bin/env node
// Dogfood for atomic-write.mjs — assert-based, no framework. Runs in an isolated os.tmpdir() dir so it
// NEVER touches the real repo. The fsync-call-count test is THE guard against a build that drops fsync —
// do not skip it.
import assert from 'node:assert';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomicWrite } from './atomic-write.mjs';

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

const work = fs.mkdtempSync(join(tmpdir(), 'atomicwrite-'));

// 1. fsync is invoked (primary guard) — file fd + dir fd attempt → at least 2 calls.
check('fsyncSync invoked at least twice', () => {
  const target = join(work, 'fsync.txt');
  const original = fs.fsyncSync;
  let calls = 0;
  fs.fsyncSync = (...args) => { calls++; return original.apply(fs, args); };
  try {
    atomicWrite(target, 'x');
  } finally {
    fs.fsyncSync = original;
  }
  assert.ok(calls >= 2, `expected >=2 fsyncSync calls, got ${calls}`);
});

// 2. --once preserves first content.
check('once preserves first content', () => {
  const target = join(work, 'once.txt');
  atomicWrite(target, 'AAA');
  atomicWrite(target, 'BBB', { once: true });
  assert.strictEqual(fs.readFileSync(target, 'utf8'), 'AAA');
});

// 3. byte-exact, no trailing newline.
check('byte-exact write, no trailing newline', () => {
  const target = join(work, 'exact.txt');
  atomicWrite(target, 'my-slug');
  assert.strictEqual(fs.readFileSync(target, 'utf8'), 'my-slug');
});

// 4. non-once overwrites.
check('non-once overwrites', () => {
  const target = join(work, 'overwrite.txt');
  atomicWrite(target, 'AAA');
  atomicWrite(target, 'BBB');
  assert.strictEqual(fs.readFileSync(target, 'utf8'), 'BBB');
});

// 5. no .tmp leftover.
check('no .tmp leftover', () => {
  const target = join(work, 'clean.txt');
  atomicWrite(target, 'content');
  const leftovers = fs.readdirSync(work).filter((f) => f.endsWith('.tmp'));
  assert.deepStrictEqual(leftovers, []);
});

fs.rmSync(work, { recursive: true, force: true });

console.log('----');
if (fails === 0) { console.log('PASS (all fixtures)'); }
else { console.log(`FAILURES: ${fails}`); process.exit(1); }
