#!/usr/bin/env node
// Dogfood for doctor-scan.mjs — assert-based, no framework. Every case isolated in its own
// os.tmpdir() dir so it NEVER touches the real repo. Covers every branch of the consistent-prefix
// repair rule, the stale-pointer check, and both dirtyTree/committedMarkers git signals.
import assert from 'node:assert';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { doctorScan } from './doctor-scan.mjs';

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
  return fs.mkdtempSync(join(tmpdir(), 'doctorscan-'));
}

function initGit(dir) {
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  fs.writeFileSync(join(dir, '.gitkeep'), '');
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir });
}

function touchMarker(dir, slug, name) {
  const p = join(dir, 'specs', slug, name);
  fs.mkdirSync(join(dir, 'specs', slug), { recursive: true });
  fs.writeFileSync(p, '');
  return p;
}

function touchArtifact(dir, slug, name) {
  fs.mkdirSync(join(dir, 'specs', slug), { recursive: true });
  fs.writeFileSync(join(dir, 'specs', slug, name), '# content');
}

// 1. Consistent: spec.done+plan.done + SPEC.md+PLAN.md present -> CLEAN, staleMarkers empty.
check('1. consistent full prefix -> CLEAN', () => {
  const work = mkwork();
  try {
    touchArtifact(work, 'foo', 'SPEC.md');
    touchArtifact(work, 'foo', 'PLAN.md');
    touchMarker(work, 'foo', 'spec.done');
    touchMarker(work, 'foo', 'plan.done');
    const result = doctorScan('foo', { cwd: work });
    assert.deepStrictEqual(result.staleMarkers, []);
    assert.strictEqual(result.verdict, 'CLEAN');
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

// 2. SPEC-missing: spec.done+plan.done+implement.done present, SPEC.md absent.
check('2. SPEC.md missing -> all three markers stale, --fix deletes all, verdict ISSUES', () => {
  const work = mkwork();
  try {
    const s = touchMarker(work, 'foo', 'spec.done');
    const p = touchMarker(work, 'foo', 'plan.done');
    const i = touchMarker(work, 'foo', 'implement.done');
    // no SPEC.md, no PLAN.md
    const scan = doctorScan('foo', { cwd: work });
    assert.deepStrictEqual(
      scan.staleMarkers,
      ['specs/foo/implement.done', 'specs/foo/plan.done', 'specs/foo/spec.done'].sort()
    );
    assert.strictEqual(scan.verdict, 'BLOCK'); // unresolved (no fix)

    const fixed = doctorScan('foo', { cwd: work, fix: true });
    assert.deepStrictEqual(fixed.staleMarkers, []);
    assert.strictEqual(fixed.verdict, 'ISSUES');
    assert.strictEqual(fs.existsSync(s), false);
    assert.strictEqual(fs.existsSync(p), false);
    assert.strictEqual(fs.existsSync(i), false);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

// 3. PLAN-missing: SPEC.md present, PLAN.md absent, plan.done+implement.done present (no spec.done).
check('3. PLAN.md missing -> plan+implement.done stale (not spec.done)', () => {
  const work = mkwork();
  try {
    touchArtifact(work, 'foo', 'SPEC.md');
    const p = touchMarker(work, 'foo', 'plan.done');
    const i = touchMarker(work, 'foo', 'implement.done');
    const scan = doctorScan('foo', { cwd: work });
    assert.deepStrictEqual(
      scan.staleMarkers,
      ['specs/foo/implement.done', 'specs/foo/plan.done'].sort()
    );
    assert.ok(!scan.staleMarkers.includes('specs/foo/spec.done'));

    const fixed = doctorScan('foo', { cwd: work, fix: true });
    assert.deepStrictEqual(fixed.staleMarkers, []);
    assert.strictEqual(fs.existsSync(p), false);
    assert.strictEqual(fs.existsSync(i), false);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

// 4. Stale marker + fix=false -> BLOCK, nothing deleted.
check('4. stale marker without --fix -> BLOCK, marker untouched', () => {
  const work = mkwork();
  try {
    const s = touchMarker(work, 'foo', 'spec.done');
    // SPEC.md absent -> spec.done stale
    const scan = doctorScan('foo', { cwd: work, fix: false });
    assert.strictEqual(scan.verdict, 'BLOCK');
    assert.ok(scan.staleMarkers.includes('specs/foo/spec.done'));
    assert.strictEqual(fs.existsSync(s), true);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

// 5. Non-monotonic, artifacts present: spec.done absent, plan.done present, SPEC.md+PLAN.md present.
check('5. non-monotonic but artifact-consistent -> CLEAN, staleMarkers empty', () => {
  const work = mkwork();
  try {
    touchArtifact(work, 'foo', 'SPEC.md');
    touchArtifact(work, 'foo', 'PLAN.md');
    touchMarker(work, 'foo', 'plan.done'); // spec.done deliberately absent
    const scan = doctorScan('foo', { cwd: work });
    assert.deepStrictEqual(scan.staleMarkers, []);
    assert.strictEqual(scan.verdict, 'CLEAN');
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

// 6. Stale pointer: .devloop/active -> "ghost-slug" whose specs/ghost-slug/ absent.
check('6. stale .devloop/active pointer -> stalePointer true, --fix clears it', () => {
  const work = mkwork();
  try {
    fs.mkdirSync(join(work, '.devloop'), { recursive: true });
    fs.writeFileSync(join(work, '.devloop', 'active'), 'ghost-slug');
    const scan = doctorScan('foo', { cwd: work });
    assert.strictEqual(scan.stalePointer, true);

    const fixed = doctorScan('foo', { cwd: work, fix: true });
    assert.strictEqual(fixed.stalePointer, false);
    assert.strictEqual(fs.existsSync(join(work, '.devloop', 'active')), false);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

// 7. Dirty tree (git repo, uncommitted change) -> dirtyTree true, BLOCK, --fix does not touch it.
check('7. dirty tree -> BLOCK, --fix never touches uncommitted change', () => {
  const work = mkwork();
  try {
    initGit(work);
    const dirtyFile = join(work, 'dirty.txt');
    fs.writeFileSync(dirtyFile, 'uncommitted');
    const scan = doctorScan('foo', { cwd: work });
    assert.strictEqual(scan.dirtyTree, true);
    assert.strictEqual(scan.verdict, 'BLOCK');

    doctorScan('foo', { cwd: work, fix: true });
    assert.strictEqual(fs.readFileSync(dirtyFile, 'utf8'), 'uncommitted');
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

// 8. Committed markers: git-add + commit a specs/<slug>/spec.done.
check('8. committed markers -> attended WARN (not forced BLOCK), auto BLOCK', () => {
  const work = mkwork();
  try {
    initGit(work);
    touchArtifact(work, 'foo', 'SPEC.md');
    touchArtifact(work, 'foo', 'PLAN.md');
    touchMarker(work, 'foo', 'spec.done'); // consistent -> not stale
    execFileSync('git', ['add', '-A'], { cwd: work });
    execFileSync('git', ['commit', '-q', '-m', 'add marker'], { cwd: work });

    const attended = doctorScan('foo', { cwd: work, mode: 'attended' });
    assert.ok(attended.committedMarkers.length > 0);
    assert.strictEqual(attended.verdict, 'ISSUES');

    const auto = doctorScan('foo', { cwd: work, mode: 'auto' });
    assert.ok(auto.committedMarkers.length > 0);
    assert.strictEqual(auto.verdict, 'BLOCK');
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

// 9. No markers (fresh) -> CLEAN.
check('9. fresh dir, no markers -> CLEAN', () => {
  const work = mkwork();
  try {
    const scan = doctorScan('foo', { cwd: work });
    assert.deepStrictEqual(scan.staleMarkers, []);
    assert.strictEqual(scan.dirtyTree, false);
    assert.strictEqual(scan.stalePointer, false);
    assert.deepStrictEqual(scan.committedMarkers, []);
    assert.strictEqual(scan.verdict, 'CLEAN');
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

// 10. REGRESSION: mid-pipeline resume in a git repo — devloop's own untracked artifacts + markers must
//     NOT count as the user's dirty tree (else doctor BLOCKs every resume). Case 7 proves a real user
//     untracked file DOES still count, so this only suppresses devloop's own specs/ + .devloop/ noise.
check('10. untracked specs/ artifacts + .done markers -> NOT dirty, CLEAN', () => {
  const work = mkwork();
  try {
    initGit(work);
    touchArtifact(work, 'foo', 'SPEC.md'); // untracked (drive commits these only at its last step)
    touchArtifact(work, 'foo', 'PLAN.md');
    touchMarker(work, 'foo', 'spec.done'); // untracked resume markers
    touchMarker(work, 'foo', 'plan.done');
    fs.mkdirSync(join(work, '.devloop'), { recursive: true });
    fs.writeFileSync(join(work, '.devloop', 'active'), 'foo'); // machine state (foo exists -> not stale)
    const scan = doctorScan('foo', { cwd: work, mode: 'auto' });
    assert.strictEqual(scan.dirtyTree, false); // the regression: was true before the machine-noise filter
    assert.deepStrictEqual(scan.staleMarkers, []);
    assert.strictEqual(scan.stalePointer, false);
    assert.strictEqual(scan.verdict, 'CLEAN');
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

// 11. Committed stale marker: a tracked spec.done with SPEC.md absent. --fix must NOT delete it (would
//     dirty a clean tree + mutate committed state) — it stays in staleMarkers, verdict BLOCK, surfaced.
check('11. committed stale marker -> --fix leaves it, verdict BLOCK', () => {
  const work = mkwork();
  try {
    initGit(work);
    const s = touchMarker(work, 'foo', 'spec.done'); // SPEC.md absent -> stale
    execFileSync('git', ['add', '-A'], { cwd: work });
    execFileSync('git', ['commit', '-q', '-m', 'commit stale marker'], { cwd: work });
    const fixed = doctorScan('foo', { cwd: work, fix: true, mode: 'attended' });
    assert.strictEqual(fs.existsSync(s), true); // NOT deleted
    assert.ok(fixed.staleMarkers.includes('specs/foo/spec.done')); // still surfaced
    assert.deepStrictEqual(fixed.fixed, []); // nothing removed
    assert.strictEqual(fixed.verdict, 'BLOCK'); // unresolved stale keeps it blocking
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

// 12. --fix on a DIRTY tree must NOT delete the orphan marker (preserve resume state, never discard):
//     the tree is BLOCK anyway, and if the user restores a deleted artifact the marker must still be
//     there so a completed (maybe interactive) stage isn't needlessly re-run. Defer fixes to a clean run.
check('12. --fix during dirty tree -> orphan marker preserved, verdict BLOCK', () => {
  const work = mkwork();
  try {
    initGit(work);
    const userFile = join(work, 'app.txt');
    fs.writeFileSync(userFile, 'v1');
    execFileSync('git', ['add', '-A'], { cwd: work });
    execFileSync('git', ['commit', '-q', '-m', 'app'], { cwd: work });
    fs.writeFileSync(userFile, 'v2'); // tracked modification -> dirty tree
    const orphan = touchMarker(work, 'foo', 'spec.done'); // untracked orphan (SPEC.md absent)
    const scan = doctorScan('foo', { cwd: work, fix: true, mode: 'auto' });
    assert.strictEqual(scan.dirtyTree, true);
    assert.strictEqual(scan.verdict, 'BLOCK');
    assert.strictEqual(fs.existsSync(orphan), true); // NOT deleted (deferred to a clean-tree run)
    assert.deepStrictEqual(scan.fixed, []);
    assert.ok(scan.staleMarkers.includes('specs/foo/spec.done')); // still surfaced
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

console.log('----');
if (fails === 0) { console.log('PASS (all fixtures)'); }
else { console.log(`FAILURES: ${fails}`); process.exit(1); }
