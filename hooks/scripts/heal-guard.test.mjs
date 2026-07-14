#!/usr/bin/env node
// Dogfood for heal-guard.mjs — assert-based, no framework. Runs in isolated os.tmpdir() git repos so it
// NEVER pollutes the real specs/. Deny → valid PreToolUse-deny JSON; allow → nothing. Absolute file_paths
// (as the real Edit tool passes) and a subdirectory-cwd case are deliberate: they catch the two ways the
// path guard silently never-fires (abs-vs-repo-relative; cwd ≠ git toplevel).
import assert from 'node:assert';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GUARD = join(dirname(fileURLToPath(import.meta.url)), 'heal-guard.mjs');
const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'ignore' });

// Build a repo with a committed test file (test(foo)), a code file (feat(foo)), and a SPEC. `top` is the
// canonical toplevel the guard will resolve, so absolute fixtures match the guard's own normalization base.
function makeRepo({ withTest = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'healguard-'));
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 't@t.t');
  git(dir, 'config', 'user.name', 't');
  mkdirSync(join(dir, 'tests'), { recursive: true });
  mkdirSync(join(dir, 'specs', 'fix'), { recursive: true });
  writeFileSync(join(dir, 'tests', 'test_foo.py'), 'def test_x():\n    assert add(2, 3) == 5\n');
  writeFileSync(join(dir, 'dur.py'), 'def add(a, b):\n    return a + b\n');
  writeFileSync(join(dir, 'specs', 'fix', 'SPEC.md'), '# Spec: fix\n- AC-1\n');
  git(dir, 'add', 'specs');
  git(dir, 'commit', '-q', '-m', 'docs(fix): spec');
  if (withTest) { git(dir, 'add', 'tests'); git(dir, 'commit', '-q', '-m', 'test(foo): red'); }
  git(dir, 'add', 'dur.py');
  git(dir, 'commit', '-q', '-m', 'feat(foo): green');
  const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8' }).trim();
  return { dir, top };
}

function marker(cwd) { mkdirSync(join(cwd, '.devloop'), { recursive: true }); writeFileSync(join(cwd, '.devloop', 'heal-active'), ''); }

let fails = 0;
// expect: 'deny' | 'allow'. tool_input is the raw object; rawInput overrides the stdin string (malformed test).
function run(label, expect, toolName, toolInput, cwd, rawInput) {
  const input = rawInput !== undefined ? rawInput : JSON.stringify({ tool_name: toolName, tool_input: toolInput });
  const res = spawnSync('node', [GUARD], { input, encoding: 'utf8', cwd });
  const out = (res.stdout || '').trim();
  const rc = res.status;
  try {
    if (expect === 'deny') {
      assert.ok(rc === 0 && out.length > 0, `no output (rc=${rc})`);
      const h = JSON.parse(out).hookSpecificOutput;
      assert.ok(h && h.permissionDecision === 'deny' && h.hookEventName === 'PreToolUse' &&
        typeof h.permissionDecisionReason === 'string' && h.permissionDecisionReason.length > 0, 'bad deny JSON');
      console.log(`ok   DENY  : ${label}`);
    } else {
      assert.ok(rc === 0 && out.length === 0, `expected silent allow (rc=${rc} out=${out})`);
      console.log(`ok   ALLOW : ${label}`);
    }
  } catch (e) {
    console.log(`FAIL want ${expect}: ${label} (rc=${rc} out=${out}) — ${e.message}`);
    fails++;
  }
}

const { dir: work, top } = makeRepo();
const P = (rel) => join(top, rel);
const edit = (fp) => ({ file_path: fp });

// 1. marker ABSENT → Edit a frozen test file → ALLOW (guard off outside heal).
run('marker absent → Edit test', 'allow', 'Edit', edit(P('tests/test_foo.py')), work);

marker(work); // arm the guard for the rest

// 2. marker present → Edit the committed test file (ABSOLUTE path) → DENY (kills abs/rel exact-match bypass).
run('Edit test (absolute)', 'deny', 'Edit', edit(P('tests/test_foo.py')), work);
// 3. cwd = a repo SUBDIRECTORY, marker present → Edit the absolute test path → DENY (kills cwd≠toplevel bypass).
const sub = join(work, 'tests'); marker(sub);
run('subdir cwd → Edit test', 'deny', 'Edit', edit(P('tests/test_foo.py')), sub);
// 4. Edit the SPEC → DENY.
run('Edit SPEC', 'deny', 'Edit', edit(P('specs/fix/SPEC.md')), work);
// 5. Edit a CODE (feat-only) file → ALLOW (heal must edit code).
run('Edit code', 'allow', 'Edit', edit(P('dur.py')), work);
// 6. Write a brand-new file → ALLOW (not a frozen test).
run('Write new file', 'allow', 'Write', edit(P('new_helper.py')), work);
// 9. Bash mutating a frozen test — each vector → DENY.
for (const cmd of [
  "sed -i 's/== 5/== 999/' tests/test_foo.py",
  'perl -i -pe "s/5/9/" tests/test_foo.py',
  'echo pass > tests/test_foo.py',
  'git checkout tests/test_foo.py',
  'rm tests/test_foo.py',
]) run(`Bash: ${cmd}`, 'deny', 'Bash', { command: cmd }, work);
// Bash that does NOT touch a frozen path → ALLOW (run tests, edit code, commit the heal fix).
run('Bash: run tests', 'allow', 'Bash', { command: 'python -m pytest tests/test_foo.py' }, work);
run('Bash: sed code file', 'allow', 'Bash', { command: "sed -i 's/a/b/' dur.py" }, work);
run('Bash: commit heal fix', 'allow', 'Bash', { command: 'git commit -m "feat(foo): fix"' }, work);
// 11. malformed stdin → ALLOW (fail open).
run('malformed stdin', 'allow', 'Bash', null, work, 'not json at all');
// 10. STALE marker (mtime beyond ceiling) → Edit a test file → ALLOW (crash-residue disarm).
const old = Date.now() / 1000 - 3 * 60 * 60; // 3h ago
utimesSync(join(work, '.devloop', 'heal-active'), old, old);
run('stale marker → Edit test', 'allow', 'Edit', edit(P('tests/test_foo.py')), work);

// 7/8. git-empty for TESTS (no test() commit) — polarity split: test-derivation fails OPEN, SPEC stays DENY.
const { dir: notest, top: ntop } = makeRepo({ withTest: false });
marker(notest);
run('no test() commit → Edit code', 'allow', 'Edit', edit(join(ntop, 'dur.py')), notest);
run('no test() commit → Edit SPEC', 'deny', 'Edit', edit(join(ntop, 'specs', 'fix', 'SPEC.md')), notest);

rmSync(work, { recursive: true, force: true });
rmSync(notest, { recursive: true, force: true });

console.log('----');
if (fails === 0) { console.log('PASS (all fixtures)'); }
else { console.log(`FAILURES: ${fails}`); process.exit(1); }
