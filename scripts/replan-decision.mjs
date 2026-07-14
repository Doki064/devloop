#!/usr/bin/env node
// devloop replan-decision — Phase-2 drive re-plan loop. Pure decision helper: given a REVIEW.md path
// and the previous finding-count, decide whether to `replan` or `continue`, and why. Node built-ins only.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// Count non-empty, non-sentinel lines inside the `## Findings` section (header to next `##` header or
// EOF). Prefix-agnostic on purpose — findings are one line each, bulleted or not. Section absent or
// empty -> 0 (same as an explicit sentinel-only body). The sentinel check strips an optional leading
// markdown bullet so `- Clean. Nothing to flag.` counts as clean too (the reviewer may bullet it to
// match the ARTIFACTS schema's list style) — a bulleted sentinel must not read as one spurious finding.
// ponytail: assumes one line per finding (the ARTIFACTS DoD) — a wrapped/multi-line finding over-counts;
// harmless for an advisory lane (loop still terminates via strict-decrease), tighten only if it bites.
function countFindings(content) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === '## Findings');
  if (start === -1) return 0;
  let count = 0;
  for (let i = start + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('##')) break; // next section
    if (trimmed.length === 0) continue;
    if (trimmed.replace(/^[-*]\s+/, '') === 'Clean. Nothing to flag.') continue;
    count++;
  }
  return count;
}

// prevCount: -1 means "first pass" (skip the no-progress check — a first pass with findings must
// replan, never no-progress). Ordering matters: absent-file -> clean -> no-progress -> else replan.
export function decide(reviewPath, prevCount) {
  let content;
  try {
    content = fs.readFileSync(reviewPath, 'utf8');
  } catch {
    // Absent file uniquely means the reviewer failed/died (a genuinely-clean review WRITES a sentinel
    // file) — fail open to continue rather than stalling the drive loop on a dead reviewer.
    return { action: 'continue', count: 0, reason: 'no-review' };
  }

  const count = countFindings(content);
  if (count === 0) return { action: 'continue', count: 0, reason: 'clean' };

  // ponytail: finding-count is a progress proxy, not identity — findings lack stable IDs (unlike AC
  // rows), so an identical count with different findings reads as no-progress. Upgrade to fingerprinting
  // (e.g. hash each finding line) only if churn on real reviews shows this false-negative in practice.
  if (prevCount >= 0 && count >= prevCount) {
    return { action: 'continue', count, reason: 'no-progress' };
  }

  // ponytail: iterations are finite (strict-decrease bounds the loop to <= initial count), but cost is
  // unbounded — N findings can mean up to N loop round-trips. Reinstate a high seatbelt cap only if a
  // pathological review (e.g. one finding fixed per pass) shows this churn for real.
  return { action: 'replan', count, reason: null };
}

export function formatDecision({ action, count, reason }) {
  return reason ? `${action} ${count} ${reason}` : `${action} ${count}`;
}

function main() {
  const [reviewPath, prevCountArg] = process.argv.slice(2);
  if (!reviewPath) {
    console.error('usage: replan-decision.mjs <review-md-path> <prev-count>');
    process.exit(1);
  }
  const parsed = Number.parseInt(prevCountArg, 10);
  const prevCount = Number.isNaN(parsed) ? -1 : parsed;
  console.log(formatDecision(decide(reviewPath, prevCount)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
