#!/usr/bin/env node
// Dogfood for tdd-gate.mjs — assert-based, no framework. Runs in an isolated os.tmpdir() git repo so it
// NEVER pollutes the real specs/ (a committed fixture PLAN would make the live hook treat `foo` as a
// real tdd scope forever). Deny → valid PreToolUse-deny JSON; allow → nothing, exit 0.
import assert from 'node:assert';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GATE = join(dirname(fileURLToPath(import.meta.url)), 'tdd-gate.mjs');
const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'ignore' });

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'tddgate-'));
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 't@t.t');
  git(dir, 'config', 'user.name', 't');
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'init');
  return dir;
}

// Fixture: two features, so `foo` is unambiguously one tdd task and `bar` one standard task.
const work = makeRepo();
mkdirSync(join(work, 'specs', 'fix'), { recursive: true });
const canary = join(work, 'specs', 'fix', 'PLAN.md');
writeFileSync(canary,
  '# Plan: fix\n## Tasks\n' +
  '- **T1** [tdd] scope=`foo` deps=[] covers=[AC-1]: behavior\n' +
  '- **T2** [standard] scope=`bar` deps=[] covers=[AC-2]: config\n');

let fails = 0;
// feed <expect> <command> <cwd>; a canary file proves the fast path never reads the fixture.
function run(expect, cmd, cwd = work) {
  const res = spawnSync('node', [GATE], {
    input: JSON.stringify({ tool_input: { command: cmd } }), encoding: 'utf8', cwd,
  });
  const out = (res.stdout || '').trim();
  const rc = res.status;
  try {
    if (expect === 'deny') {
      assert.ok(rc === 0 && out.length > 0, `no output (rc=${rc})`);
      const h = JSON.parse(out).hookSpecificOutput;
      assert.ok(h && h.permissionDecision === 'deny' && h.hookEventName === 'PreToolUse' &&
        typeof h.permissionDecisionReason === 'string' && h.permissionDecisionReason.length > 0, 'bad deny JSON');
      console.log(`ok   DENY  : ${cmd}`);
    } else {
      assert.ok(rc === 0 && out.length === 0, `expected silent allow`);
      console.log(`ok   ALLOW : ${cmd}`);
    }
  } catch (e) {
    console.log(`FAIL want ${expect}: ${cmd} (rc=${rc} out=${out}) — ${e.message}`);
    fails++;
  }
}

// 1. feat(foo), no test(foo) yet → DENY (the core catch).
run('deny', 'git commit -m "feat(foo): x"');
// 5. test(foo) itself (type != feat) → ALLOW.
run('allow', 'git commit -m "test(foo): x"');
// 3. feat(bar) standard task → ALLOW.
run('allow', 'git commit -m "feat(bar): x"');
// 4. feat(baz) in no PLAN → ALLOW.
run('allow', 'git commit -m "feat(baz): x"');
// 8. anchored regex: feat(foo): only in the body of a fix(y) subject → ALLOW.
run('allow', 'git commit -m "fix(y): mention feat(foo): in body"');
// 7. unparseable subject → ALLOW.
run('allow', 'git commit');
run('allow', 'git commit -F msg.txt');
// 6. non-commit command → ALLOW via fast path, without reading the fixture.
chmodSync(canary, 0o000); // any fixture read would error the gate → surface it (best-effort on Windows)
run('allow', 'ls foo');
chmodSync(canary, 0o644);

// 2. after a test(foo) commit exists → ALLOW (RED was done).
git(work, 'commit', '-q', '--allow-empty', '-m', 'test(foo): red');
run('allow', 'git commit -m "feat(foo): x"');

// 9. same scope=foo as BOTH tdd and standard across two PLANs → ALLOW (ambiguous). Fresh repo with no
//    test(foo) so only ambiguity (not the RED check) can produce the allow.
const amb = makeRepo();
mkdirSync(join(amb, 'specs', 'a'), { recursive: true });
mkdirSync(join(amb, 'specs', 'b'), { recursive: true });
writeFileSync(join(amb, 'specs', 'a', 'PLAN.md'), '- **T1** [tdd] scope=`foo` deps=[] covers=[AC-1]: x\n');
writeFileSync(join(amb, 'specs', 'b', 'PLAN.md'), '- **T2** [standard] scope=`foo` deps=[] covers=[AC-2]: y\n');
run('allow', 'git commit -m "feat(foo): x"', amb);

// 10. divergence guard: feat(foo) as the FIRST-EVER commit → empty `git log` → DENY. A wrong blanket
//     try/catch port (allow-on-git-error) would pass fixtures 1-9 but silently break the core catch here.
const fresh = mkdtempSync(join(tmpdir(), 'tddgate-'));
execFileSync('git', ['init', '-q'], { cwd: fresh });
mkdirSync(join(fresh, 'specs', 'fix'), { recursive: true });
writeFileSync(join(fresh, 'specs', 'fix', 'PLAN.md'),
  '- **T1** [tdd] scope=`foo` deps=[] covers=[AC-1]: behavior\n');
run('deny', 'git commit -m "feat(foo): x"', fresh);

rmSync(work, { recursive: true, force: true });
rmSync(amb, { recursive: true, force: true });
rmSync(fresh, { recursive: true, force: true });

console.log('----');
if (fails === 0) { console.log('PASS (all fixtures)'); }
else { console.log(`FAILURES: ${fails}`); process.exit(1); }
