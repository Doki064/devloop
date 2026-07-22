#!/usr/bin/env node
// devloop doctor-scan — Phase-2 pipeline-health scanner + safe-fix. Deterministic, read-only unless
// --fix. Mirrors drive's own consistent-prefix entry rule (skills/drive/SKILL.md's fail-closed resume
// check) so doctor's verdict never disagrees with what drive itself would do. Node built-ins only.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { lint } from './intent-lint.mjs';

function exists(p) {
  try { fs.statSync(p); return true; } catch { return false; }
}

// git signals are best-effort — absent git / non-repo dir never throws, just yields empty/false.
// stdio: ['ignore','pipe','pipe'] — a non-repo dir makes git write a "fatal: not a git repository"
// to stderr; we catch and treat it as "no signal", so don't let it leak to the parent's terminal.
const GIT_STDIO = ['ignore', 'pipe', 'pipe'];

// devloop's own in-flight state is NOT the user's dirty tree. During a mid-pipeline resume the pipeline
// artifacts (`specs/<slug>/SPEC.md`, `PLAN.md`, …) are still untracked (drive commits them only at its
// last step, after verify) and so are the `.done` markers + `.devloop/` machine state (gitignoring them
// is init's job, not yet wired). `git status` always lists all of these, so counting them would BLOCK
// every resume — the very artifacts/markers a resume needs would trip the dirty-tree guard. So drop
// untracked lines under `specs/` and `.devloop/`; any USER change (untracked file elsewhere, or ANY
// tracked modification/deletion — including to a committed artifact) still marks the tree dirty.
function isMachineNoise(porcelainLine) {
  if (porcelainLine.slice(0, 2) !== '??') return false; // only untracked lines are ours to ignore
  const p = porcelainLine.slice(3);
  // ponytail: git quotes porcelain paths with spaces/special chars (`?? "specs/a b.md"`), which would
  // miss this prefix test and count as dirty. devloop's own machine state is always plain ASCII
  // (SPEC.md, *.done, hyphen slugs), so this only mis-fires on a USER's spaced file under specs/ — and
  // fails CLOSED (spurious BLOCK, never a missed dirty tree). Upgrade to `git status --porcelain -z` if
  // that ever bites (NUL-delimited, unquoted — but then handle the rename dual-field split).
  return p.startsWith('.devloop/') || p.startsWith('specs/');
}

function gitDirtyTree(cwd) {
  try {
    const out = execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8', stdio: GIT_STDIO });
    return out.split('\n').some((l) => l.length > 0 && !isMachineNoise(l));
  } catch {
    return false;
  }
}

function gitCommittedMarkers(cwd) {
  try {
    const out = execFileSync('git', ['ls-files', '--', 'specs/**/*.done'], {
      cwd,
      encoding: 'utf8',
      stdio: GIT_STDIO,
    });
    return out.split('\n').filter((l) => l.trim().length > 0).sort();
  } catch {
    return [];
  }
}

export function doctorScan(slug, { fix = false, cwd = process.cwd(), mode = 'attended' } = {}) {
  const specDir = join(cwd, 'specs', slug);
  const markerPaths = {
    'spec.done': join(specDir, 'spec.done'),
    'plan.done': join(specDir, 'plan.done'),
    'implement.done': join(specDir, 'implement.done'),
  };
  const relMarkerPaths = {
    'spec.done': `specs/${slug}/spec.done`,
    'plan.done': `specs/${slug}/plan.done`,
    'implement.done': `specs/${slug}/implement.done`,
  };

  const specMdExists = exists(join(specDir, 'SPEC.md'));
  const planMdExists = exists(join(specDir, 'PLAN.md'));

  // Consistent-prefix repair (mirrors drive's fail-closed resume rule):
  //   SPEC.md missing  -> spec/plan/implement.done are all stale (everything derives from SPEC).
  //   PLAN.md missing (SPEC present) -> plan/implement.done are stale.
  //   both present -> nothing stale from this rule (non-monotonic-but-consistent sets are left alone).
  let staleNames = [];
  if (!specMdExists) {
    staleNames = ['spec.done', 'plan.done', 'implement.done'];
  } else if (!planMdExists) {
    staleNames = ['plan.done', 'implement.done'];
  }
  let staleMarkers = staleNames
    .filter((name) => exists(markerPaths[name]))
    .map((name) => relMarkerPaths[name])
    .sort();

  const dirtyTree = gitDirtyTree(cwd);
  const committedMarkers = gitCommittedMarkers(cwd);

  // Front-end awareness: INTENT.md present -> lint it BARE (no stage token). Stage-gated joins
  // (stage=research/spec) are stage-owned self-checks, not doctor's — a stage token here would wedge
  // every other stage's resume on a coverage rule it doesn't own (e.g. a route=research Q with no
  // RESEARCH.md yet, mid-discuss). Absent INTENT.md -> field stays empty, behavior byte-identical to
  // pre-front-end doctor. discuss.done/research.done deliberately do NOT join the consistent-prefix
  // stale-marker rule below (no mandatory artifact of their own) — they're covered by the committed-
  // marker git check above like any other marker.
  const intentPath = join(specDir, 'INTENT.md');
  const intentLintViolations = exists(intentPath) ? lint(intentPath) : [];

  const activePath = join(cwd, '.devloop', 'active');
  let stalePointer = false;
  if (exists(activePath)) {
    const pointedSlug = fs.readFileSync(activePath, 'utf8').trim();
    if (pointedSlug && !exists(join(cwd, 'specs', pointedSlug))) stalePointer = true;
  }

  const fixed = [];
  if (fix && !dirtyTree) {
    // Only mutate on a CLEAN tree. A dirty tree is a BLOCK regardless, so fixing unblocks nothing — and
    // deleting resume markers while the tree is dirty is itself "discarding" (the invariant is preserve,
    // never discard): if the user restores a deleted tracked artifact, a marker we already removed would
    // force a needless re-run of a completed — possibly interactive — stage. So defer all fixes to a
    // clean-tree run. NEVER delete an artifact; NEVER touch a committed marker (guarded below too).
    const stillStale = [];
    for (const rel of staleMarkers) {
      // A committed (tracked) marker is NEVER rm'd — deleting it would dirty a clean tree and mutate
      // committed state; it's a git-hygiene issue for the human to gitignore/remove, not doctor's to
      // silently fix. Leave it in staleMarkers so the verdict stays BLOCK and the marker is surfaced.
      if (committedMarkers.includes(rel)) { stillStale.push(rel); continue; }
      const abs = join(cwd, rel);
      fs.rmSync(abs, { force: true });
      fixed.push(`removed stale marker ${rel}`);
    }
    staleMarkers = stillStale; // post-fix: orphaned markers cleared; any committed stale marker remains

    if (stalePointer) {
      fs.rmSync(activePath, { force: true });
      fixed.push('removed stale .devloop/active pointer');
      stalePointer = false;
    }
  }

  let verdict = 'CLEAN';
  const unresolvedStale = staleMarkers.length > 0;
  const committedInAuto = mode === 'auto' && committedMarkers.length > 0;
  const intentViolationsInAuto = mode === 'auto' && intentLintViolations.length > 0;
  const intentViolationsInAttended = mode === 'attended' && intentLintViolations.length > 0;
  if (dirtyTree || unresolvedStale || committedInAuto || intentViolationsInAuto) {
    // auto: an unfixable prose/shape violation would wedge a downstream self-check on bytes doctor
    // cannot safely rewrite — BLOCK, never worked around.
    verdict = 'BLOCK';
  } else if (
    fixed.length > 0 ||
    (mode === 'attended' && committedMarkers.length > 0) ||
    stalePointer ||
    intentViolationsInAttended
  ) {
    // attended: named remedy is fix INTENT.md per the printed violations, or delete the front-end trio
    // (INTENT.md/RESEARCH.md/ASSUMPTIONS.md) to restart the front door — never doctor-fixable itself.
    verdict = 'ISSUES';
  }

  return { slug, staleMarkers, dirtyTree, stalePointer, committedMarkers, intentLintViolations, fixed, verdict };
}

function main() {
  const args = process.argv.slice(2);
  const fix = args.includes('--fix');
  const modeIdx = args.indexOf('--mode');
  const mode = modeIdx !== -1 ? args[modeIdx + 1] : 'attended';
  const slug = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--mode');
  if (!slug) {
    console.error('usage: doctor-scan.mjs <slug> [--fix] [--mode auto|attended]');
    process.exit(1);
  }
  const result = doctorScan(slug, { fix, mode });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
