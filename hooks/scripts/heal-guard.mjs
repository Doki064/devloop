#!/usr/bin/env node
// devloop heal-guard — heal-scoped readonly path guard. During an active self-heal attempt the driver
// re-runs the implementer autonomously; this PreToolUse hook freezes the SPEC + the feature's tests so the
// implementer can only change CODE to satisfy the reasoning-blind verifier — it cannot reward-hack by
// weakening a test or editing the contract. Active ONLY while `.devloop/heal-active` is a LIVE marker.
//
// Fail polarity is DELIBERATELY split (do NOT copy tdd-gate wholesale):
//  - SPEC freeze is git-independent → stays DENY even when git can't be read. Checked FIRST.
//  - TEST freeze is git-derived (files touched by `test(...)` commits) → FAILS OPEN when git is empty or
//    unreadable (can't confirm the frozen set → allow the code edits heal needs). This is the OPPOSITE of
//    tdd-gate's RED check, which denies on git-empty. Do not port deny-on-git-failure here.
// Everywhere else fail open (allow, no output): a false DENY only annoys (heal falls back to Edit, which
// this checks deterministically); the marker + the verifier backstop the real hacks. Node built-ins only
// (Linux/macOS/Windows); devloop requires git + node.
//
// DEFERRED(Phase 5): baseRef/worktree-bounded git-log range (twin of tdd-gate.mjs:9 / verifier.md:15) —
// scan full HEAD history for now (safe over-freeze: prior features' tests are frozen too, harmless in heal).
// ponytail: Bash coverage is a static verb+frozen-path co-occurrence scan (fail-closed over-block); a helper
// SCRIPT that writes a frozen path slips it — DEFERRED(Phase 5) mutation analysis is the backstop for that.
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { relative } from 'node:path';

// Marker is resolved cwd-relative — deliberately: it keeps the fast path a single cheap statSync (no git
// call on the overwhelmingly common non-heal tool call), and drive arms/clears it at the same cwd the hook
// runs in (project root). Do NOT "unify" this with frozenTests()' git-toplevel base — different purpose.
const MARKER = '.devloop/heal-active';
const STALE_MS = 60 * 60 * 1000; // ponytail: 1h ceiling — one heal attempt (fix + a verify suite run) is
// minutes; an hour-old marker is crash residue → disarm. Upgrade: a drive-run PID/token if it ever misfires.

// A path ending in specs/<feature>/SPEC.md is a frozen SPEC. Anchored form for an exact file_path…
const SPEC_FILE_RE = /(^|\/)specs\/[^/]+\/SPEC\.md$/;
// …and an unanchored form to scan inside a Bash command string.
const SPEC_CMD_RE = /specs\/[^/\s'"]+\/SPEC\.md/;
// Mutating shell verbs/redirects. Only fires when a frozen path also co-occurs (bounds false-DENY).
const MUT_RE = /(\bsed\s+-i)|(\bperl\s+-i)|(>>?)|(\btee\b)|(\bcp\b)|(\bmv\b)|(\brm\b)|(\btruncate\b)|(\bdd\b)|(\bpatch\b)|(\bgit\s+(rm|checkout|restore)\b)/;

// Git-derived frozen test set (toplevel-relative paths). git empty/failure → empty set → tests NOT frozen.
// `top` comes from rev-parse (absolute, cwd-independent) so it matches `--name-only`'s base regardless of the
// process cwd — using process.cwd() here would silently miss when the run started from a subdirectory.
function frozenTests() {
  try {
    // stdio stderr:'ignore' keeps the fail-open path SILENT (honors the header contract) — git still
    // throws on a non-repo/empty log, caught below; we just don't leak its `fatal:` to the user.
    const io = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], io).trim();
    const out = execFileSync('git', ['log', '--name-only', '--format=', '--grep=^test('], io);
    const set = new Set();
    for (const line of out.split('\n')) { const f = line.trim(); if (f) set.add(f); }
    return { top, set };
  } catch {
    return { top: '', set: new Set() };
  }
}

function deny(what) {
  const reason = `devloop heal-guard: ${what} is frozen during the self-heal loop — the implementer may only ` +
    `change CODE to make failing tests pass, never weaken a test or edit the SPEC. If the fix truly needs a ` +
    `test/SPEC change, that is a human decision: stop and surface it (see specs/<slug>/VERIFY.md).`;
  // Print the decision JSON then fall off the end (no process.exit, which can truncate stdout on some
  // platforms); the decision rides in stdout, exit code stays 0.
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
}

function main() {
  // Fast path: guard inactive unless the marker exists AND is fresh → allow (silent). Cheap statSync keeps
  // the hook near-free on the overwhelmingly common non-heal tool call.
  try {
    if (Date.now() - statSync(MARKER).mtimeMs > STALE_MS) return;
  } catch {
    return; // no marker → not healing → allow
  }

  let tool, input;
  try {
    const p = JSON.parse(readFileSync(0, 'utf8'));
    tool = p?.tool_name ?? '';
    input = p?.tool_input ?? {};
  } catch {
    return; // unreadable/malformed → allow
  }

  if (tool === 'Edit' || tool === 'Write') {
    const fp = input?.file_path ?? '';
    if (!fp) return;
    if (SPEC_FILE_RE.test(fp)) return deny('the SPEC');   // SPEC first — git-independent
    const { top, set } = frozenTests();
    if (top && set.has(relative(top, fp))) return deny('that test file');
    return;
  }

  if (tool === 'Bash') {
    const cmd = input?.command ?? '';
    if (!cmd || !MUT_RE.test(cmd)) return;                // no mutating verb → allow (reads, test runs, commits)
    if (SPEC_CMD_RE.test(cmd)) return deny('the SPEC');   // SPEC first — git-independent
    const { set } = frozenTests();
    for (const f of set) {
      const base = f.slice(f.lastIndexOf('/') + 1);
      if (cmd.includes(f) || (base && cmd.includes(base))) return deny('that test file');
    }
    return;
  }

  // Any other tool → allow.
}

main();
