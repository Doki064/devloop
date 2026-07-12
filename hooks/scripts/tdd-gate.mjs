#!/usr/bin/env node
// devloop TDD gate — layer (c) of the TDD defense-in-depth (ARCHITECTURE principle 2c).
// PreToolUse/Bash hook: DENY a `git commit` that skips RED. FAILS OPEN — emit `deny` ONLY on a
// positively-confirmed violation; allow (exit 0, no output) on any uncertainty. A false deny would
// block legitimate/non-devloop commits — worse than a miss, which the reasoning-blind verifier (2b)
// still backstops before ship. Node built-ins only (no npm packages, no external JSON tool, no POSIX
// shell) so it runs the same on Linux/macOS/Windows; devloop requires `git` and `node`.
//
// DEFERRED(Phase 5): baseRef/worktree-bounded git-log range; scan the current branch for now.
// (Twin of verifier.md:15 — a stale test(<scope>) from a prior shipped feature could satisfy the RED
// check; that is a miss in the fail-open direction, never a false deny, and (2b) still backstops it.)
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// Read + parse the tool call. Unreadable stdin / malformed JSON → fail open (allow). Synchronous read
// of fd 0 (not async data events, which could exit before the JSON arrives) mirrors the shell's $(cat).
let command;
try {
  command = JSON.parse(readFileSync(0, 'utf8'))?.tool_input?.command ?? '';
} catch {
  process.exit(0);
}

// Fast path FIRST: not a `git commit` → allow before touching git/fs (matcher fires every Bash call).
if (!command.includes('git commit')) process.exit(0);

// Parse the subject: first -m/-am/--message value, its FIRST line, anchored at the type position.
// Anchoring at the subject start means a feat(x): mention inside another commit's body cannot fire.
// No parseable literal -m value (-F file / editor / --amend without -m / a $(…)-substituted subject
// like `-m "$(cat <<EOF …)"`) → fail open. The implementer commits TDD steps with a literal -m subject
// (agents/implementer.md) so this gate can read it; a heredoc subject is a fail-open miss (2b backstops).
const m = command.match(/(^|\s)(-[A-Za-z]*m|--message)(=|\s+)"([^"]*)"/) ||
          command.match(/(^|\s)(-[A-Za-z]*m|--message)(=|\s+)'([^']*)'/);
if (!m) process.exit(0);
const subject = m[4].split('\n')[0]; // first line only — body lines never gate

const fm = subject.match(/^feat\(([A-Za-z0-9_-]+)\):/);
if (!fm) process.exit(0);
const scope = fm[1];

// PLAN lookup: the scope must resolve to EXACTLY ONE task, and it must be [tdd]. Scope tokens are NOT
// unique across features — multiple / mixed tdd+standard / absent → allow (ambiguous, never a false deny).
// Unreadable specs/ or PLAN → treated as no hit → fail open below.
const needle = 'scope=`' + scope + '`';
const hits = [];
let dirs = [];
try { dirs = readdirSync('specs', { withFileTypes: true }); } catch { dirs = []; }
for (const d of dirs) {
  if (!d.isDirectory()) continue;
  let content;
  try { content = readFileSync(join('specs', d.name, 'PLAN.md'), 'utf8'); } catch { continue; }
  for (const line of content.split('\n')) {
    if (line.includes(needle)) hits.push({ slug: d.name, line });
  }
}
if (hits.length !== 1) process.exit(0);
if (!hits[0].line.includes('[tdd]')) process.exit(0);

// RED check: a preceding test(<scope>) commit on HEAD history → allow. This is the ONE place where
// deny-only-confirmed OUTRANKS fail-open (mirrors the reference gate): a git-log failure/empty (no commits
// yet, not a repo) means no test(<scope>) exists → the confirmed violation → DENY. So degrade the git
// call to '' LOCALLY — never let it reach the fail-open above.
let log = '';
try { log = execFileSync('git', ['log', '--format=%s'], { encoding: 'utf8' }); } catch { log = ''; }
const redRe = new RegExp('^test\\(' + scope + '\\):');
if (log.split('\n').some((l) => redRe.test(l))) process.exit(0);

// Confirmed violation → deny. Write the JSON then fall off the end (no process.exit, which can truncate
// stdout on some platforms); the decision rides in the stdout JSON, exit code stays 0.
const reason = `devloop TDD gate: feat(${scope}) is a [tdd] task with no preceding test(${scope}) commit. Commit the failing test first (RED), then feat (GREEN). See specs/${hits[0].slug}/PLAN.md.`;
console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: reason,
  },
}));
