#!/usr/bin/env node
// devloop intent-lint — deterministic lint for the INTENT.md / ASSUMPTIONS.md artifact contract
// (docs/ARTIFACTS.md → `## INTENT.md` and `## ASSUMPTIONS.md`). Sole arg is the INTENT.md path; the
// ASSUMPTIONS.md sibling is derived as `dirname(intent)/ASSUMPTIONS.md`. Checks only the 13 byte-checkable
// rules the schema pins (Goal/Coverage/Questions/Answers shape + the ASSUMPTIONS rejected-alternative,
// link-resolution, and [irreversible] propagation rules) — no semantic judgment.
//
// EXIT-CODE DEVIATION from the sibling scripts (which exit 0 and print a verdict): this is a GATE, so it
// exits by outcome, not by "did I run" — 0 clean, 1 on any violation OR a missing INTENT.md OR a usage
// error; NEVER 2. A hook/CI can chain it on exit code without parsing stdout. Crucially a MISSING
// INTENT.md is exit 1 (`missing file` message), not a clean pass — a lint that passes on absent input
// lets a broken write look green. A missing ASSUMPTIONS.md is a clean skip (the file is optional).
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CATEGORIES = ['goal', 'scope', 'success-criteria', 'constraints', 'integration-surface', 'edge/failure'];
const MAX_QUESTIONS = 10;
const BASIS_SEP = ' — '; // space + em dash + space (distinct from the `(—)` no-Q marker)

// Lines of the `## <heading>` section: from the heading to the next `## ` header (or EOF). null = absent.
function section(lines, heading) {
  const idx = lines.findIndex((l) => l.trim() === heading);
  if (idx === -1) return null;
  const out = [];
  for (let i = idx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out;
}

// Parse a markdown table row `| a | b | c |` into trimmed cells (leading/trailing pipe dropped).
function cells(line) {
  const parts = line.split('|');
  return parts.slice(1, -1).map((c) => c.trim());
}

function parseQuestion(line) {
  const id = line.match(/\*\*Q(\d+)\*\*/);
  if (!id) return null;
  const firstBracket = line.match(/\*\*Q\d+\*\*\s+\[([^\]]+)\]/);
  const split = line.match(/split="([^"]*)"/);
  return {
    id: `Q${id[1]}`,
    category: firstBracket && firstBracket[1] !== 'irreversible' ? firstBracket[1] : null,
    hasRoute: line.includes('route='),
    hasAffects: line.includes('affects='),
    split: split ? split[1] : null,
    irreversible: /\[irreversible\]/.test(line),
  };
}

// Returns the violations array (empty = clean). The missing-INTENT case is distinguishable: a single
// violation whose message contains `missing file`.
export function lint(intentPath) {
  let intentText;
  try {
    intentText = fs.readFileSync(intentPath, 'utf8');
  } catch {
    return [`${intentPath}: missing file`];
  }

  const violations = [];
  const lines = intentText.split(/\r?\n/);

  // Rule 1: ## Goal present with non-empty body.
  const goal = section(lines, '## Goal');
  if (goal === null || goal.every((l) => l.trim() === '')) {
    violations.push('INTENT.md: ## Goal section missing or empty');
  }

  // Rules 2 & 3: Coverage table — one row per taxonomy category; Partial/Missing rows need a note.
  const coverage = section(lines, '## Coverage') || [];
  const seen = new Set();
  for (const line of coverage) {
    if (!line.trim().startsWith('|')) continue;
    const c = cells(line);
    const [category, status, note] = [c[0], c[1], c[2]];
    if (!CATEGORIES.includes(category)) continue; // header / separator / stray row
    seen.add(category);
    if ((status === 'Partial' || status === 'Missing') && (!note || note === '')) {
      violations.push(`INTENT.md: Coverage row '${category}' is ${status} with an empty note`);
    }
  }
  for (const category of CATEGORIES) {
    if (!seen.has(category)) violations.push(`INTENT.md: Coverage missing category '${category}'`);
  }

  // Rules 4-9: Questions.
  const questionLines = (section(lines, '## Questions') || []).filter((l) => /^\s*-\s+\*\*Q\d+\*\*/.test(l));
  const questions = questionLines.map(parseQuestion);
  if (questions.length > MAX_QUESTIONS) {
    violations.push(`INTENT.md: ${questions.length} questions exceeds the max of ${MAX_QUESTIONS}`);
  }
  const splitCounts = new Map();
  for (const q of questions) {
    if (!q.category) violations.push(`INTENT.md: ${q.id} missing a [category] token`); // rule 5
    if (!q.hasRoute) violations.push(`INTENT.md: ${q.id} missing route=`); // rule 6
    if (!q.hasAffects) violations.push(`INTENT.md: ${q.id} missing affects=`); // rule 7
    if (q.split === null) violations.push(`INTENT.md: ${q.id} missing split="..."`); // rule 8
    else splitCounts.set(q.split, (splitCounts.get(q.split) || 0) + 1);
  }
  for (const [value, count] of splitCounts) { // rule 9
    if (count > 1) violations.push(`INTENT.md: duplicate split value "${value}" across ${count} questions`);
  }

  // Rule 10: every Answers entry references an existing Q-id.
  const qids = new Set(questions.map((q) => q.id));
  const answerLines = (section(lines, '## Answers') || []).filter((l) => /^\s*-\s+\*\*Q\d+\*\*/.test(l));
  for (const line of answerLines) {
    const id = `Q${line.match(/\*\*Q(\d+)\*\*/)[1]}`;
    if (!qids.has(id)) violations.push(`INTENT.md: Answers references unknown ${id}`);
  }

  // Rules 11-13: ASSUMPTIONS.md (optional — clean skip if absent).
  const assumptionsPath = join(dirname(intentPath), 'ASSUMPTIONS.md');
  let assumptionsText;
  try {
    assumptionsText = fs.readFileSync(assumptionsPath, 'utf8');
  } catch {
    return violations; // optional file absent → skip ASSUMPTIONS checks
  }

  const irreversibleQs = new Set(questions.filter((q) => q.irreversible).map((q) => q.id));
  for (const line of assumptionsText.split(/\r?\n/)) {
    const idMatch = line.match(/\*\*A(\d+)\*\*/);
    if (!/^\s*-\s+\*\*A\d+\*\*/.test(line)) continue;
    const aid = `A${idMatch[1]}`;

    // Rule 11: the clause before the ` — ` basis separator states a rejected alternative.
    const before = line.split(BASIS_SEP)[0];
    if (!before.includes(', not ') && !before.includes(' vs ')) {
      violations.push(`ASSUMPTIONS.md: ${aid} states no rejected alternative (needs ", not " or " vs ")`);
    }

    // Rules 12 & 13: the `(Q<N>)` link. `(—)` has no Q — exempt from both.
    const link = line.match(/\(Q(\d+)\)/);
    if (link) {
      const qid = `Q${link[1]}`;
      if (!qids.has(qid)) {
        violations.push(`ASSUMPTIONS.md: ${aid} links unknown ${qid}`); // rule 12
      } else if (irreversibleQs.has(qid) && !/\[irreversible\]/.test(line)) {
        violations.push(`ASSUMPTIONS.md: ${aid} links irreversible ${qid} but is not marked [irreversible]`); // rule 13
      }
    }
  }

  return violations;
}

function main() {
  const [intentPath] = process.argv.slice(2);
  if (!intentPath) {
    console.log('usage: intent-lint.mjs <path-to-INTENT.md>');
    process.exit(1);
  }
  const violations = lint(intentPath);
  for (const v of violations) console.log(v);
  process.exit(violations.length === 0 ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
