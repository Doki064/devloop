#!/usr/bin/env node
// devloop intent-lint — deterministic lint for the INTENT.md / ASSUMPTIONS.md / RESEARCH.md / SPEC.md
// artifact contracts (skills/discuss/references/{INTENT,ASSUMPTIONS}.md, skills/research/references/RESEARCH.md,
// skills/spec/references/SPEC.md). First arg is the INTENT.md
// path; the sibling files are derived as `dirname(intent)/<FILE>`. Checks the byte-checkable rules the
// schemas pin — no semantic judgment:
//   • the 13 INTENT/ASSUMPTIONS rules (Goal/Coverage/Questions/Answers shape + the ASSUMPTIONS
//     rejected-alternative, link-resolution, and [irreversible] propagation rules),
//   • the RESEARCH.md sibling rules (header mode, Q-id-per-entry, no cross-section duplicate Q,
//     confidence tags, source shape, greenfield-URL, Unanswered risk:), and
//   • the stage=spec duplicate-AC-N rule (SPEC.md's ## Acceptance criteria section only: two or
//     more bullets carrying the same **AC-<N>** ID → one violation per duplicated ID).
// SOURCE PARSE: a RESEARCH finding's source is the segment after the LINE's LAST ` — ` (answer prose may
// contain interior spaced em dashes — use lastIndexOf/split().pop(), never split()[1]). The ASSUMPTIONS
// basis rule keeps its FIRST-split semantics (pre-existing, documented, unchanged).
//
// STAGE TOKEN (optional 2nd positional `stage=research|stage=spec`; anything else → usage/exit 1): each
// terminal Q-join fires only for the stage that owns satisfying it. Rationale: discuss may re-run and add
// new Qs after RESEARCH/SPEC already exist; a presence-gated join would wedge discuss's self-check loop on
// files it doesn't own, so the RESEARCH/SPEC coverage joins are gated to their owning stage, not to file
// presence. The RESEARCH entry-shape rules above stay presence-gated (RESEARCH exists → check).
//
// EXIT-CODE DEVIATION from the sibling scripts (which exit 0 and print a verdict): this is a GATE, so it
// exits by outcome, not by "did I run" — 0 clean, 1 on any violation OR a missing INTENT.md OR a usage
// error; NEVER 2. A hook/CI can chain it on exit code without parsing stdout. Crucially a MISSING
// INTENT.md is exit 1 (`missing file` message), not a clean pass — a lint that passes on absent input
// lets a broken write look green. Absent siblings are a clean skip when optional; when a stage token
// requires the file it owns (research→RESEARCH, spec→SPEC), an absent file is a `missing file` violation.
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
  const route = line.match(/route=(\w+)/);
  return {
    id: `Q${id[1]}`,
    category: firstBracket && firstBracket[1] !== 'irreversible' ? firstBracket[1] : null,
    hasRoute: line.includes('route='),
    route: route ? route[1] : null,
    hasAffects: line.includes('affects='),
    split: split ? split[1] : null,
    irreversible: /\[irreversible\]/.test(line),
  };
}

// Read a file, returning null when absent/unreadable (for the optional siblings).
function tryRead(path) {
  try {
    return fs.readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

// An "entry" is a section line starting with `- ` (trimmed). Returns its Q-id (`Q<N>`) or null.
function entryQid(line) {
  const m = line.match(/\*\*Q(\d+)\*\*/);
  return m ? `Q${m[1]}` : null;
}

// Returns the violations array (empty = clean). The missing-INTENT case is distinguishable: a single
// violation whose message contains `missing file`.
export function lint(intentPath, stage) {
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
  const answerQids = new Set();
  const answerLines = (section(lines, '## Answers') || []).filter((l) => /^\s*-\s+\*\*Q\d+\*\*/.test(l));
  for (const line of answerLines) {
    const id = `Q${line.match(/\*\*Q(\d+)\*\*/)[1]}`;
    answerQids.add(id);
    if (!qids.has(id)) violations.push(`INTENT.md: Answers references unknown ${id}`);
  }

  // Each sibling below is INDEPENDENTLY optional: one being absent must not skip another's checks.
  const dir = dirname(intentPath);

  // Rules 11-13: ASSUMPTIONS.md (optional — clean skip if absent). `linkedQids` feeds the spec Q-join.
  const assumptionLinkedQids = new Set();
  const assumptionsText = tryRead(join(dir, 'ASSUMPTIONS.md'));
  if (assumptionsText !== null) {
    const irreversibleQs = new Set(questions.filter((q) => q.irreversible).map((q) => q.id));
    for (const line of assumptionsText.split(/\r?\n/)) {
      const idMatch = line.match(/\*\*A(\d+)\*\*/);
      if (!/^\s*-\s+\*\*A\d+\*\*/.test(line)) continue;
      const aid = `A${idMatch[1]}`;

      // Rule 11: the clause before the ` — ` basis separator states a rejected alternative (FIRST split).
      const before = line.split(BASIS_SEP)[0];
      if (!before.includes(', not ') && !before.includes(' vs ')) {
        violations.push(`ASSUMPTIONS.md: ${aid} states no rejected alternative (needs ", not " or " vs ")`);
      }

      // Rules 12 & 13: the `(Q<N>)` link. `(—)` has no Q — exempt from both.
      const link = line.match(/\(Q(\d+)\)/);
      if (link) {
        const qid = `Q${link[1]}`;
        assumptionLinkedQids.add(qid);
        if (!qids.has(qid)) {
          violations.push(`ASSUMPTIONS.md: ${aid} links unknown ${qid}`); // rule 12
        } else if (irreversibleQs.has(qid) && !/\[irreversible\]/.test(line)) {
          violations.push(`ASSUMPTIONS.md: ${aid} links irreversible ${qid} but is not marked [irreversible]`); // rule 13
        }
      }
    }
  }

  // RESEARCH.md entry-shape rules (presence-gated: RESEARCH exists → check; absent → clean skip).
  // `findingsQids` (Findings only) feeds the spec Q-join; `researchQids` (both sections) the research join.
  const findingsQids = new Set();
  const researchQids = new Set();
  const researchPath = join(dir, 'RESEARCH.md');
  const researchText = tryRead(researchPath);
  if (researchText !== null) {
    const rlines = researchText.split(/\r?\n/);

    // Rule R1: the `# Research:` header must carry a concrete mode, not the placeholder.
    const header = rlines.find((l) => /^#\s+Research:/.test(l)) || '';
    let mode = null;
    if (/\(mode=greenfield\)/.test(header)) mode = 'greenfield';
    else if (/\(mode=brownfield\)/.test(header)) mode = 'brownfield';
    if (mode === null) {
      violations.push('RESEARCH.md: header missing a concrete (mode=greenfield) or (mode=brownfield)');
    }

    const findings = (section(rlines, '## Findings') || []).filter((l) => l.trim().startsWith('- '));
    const unanswered = (section(rlines, '## Unanswered') || []).filter((l) => l.trim().startsWith('- '));
    const qCount = new Map(); // Q-id → occurrences across Findings + Unanswered (rule R3)
    const countQ = (qid) => qCount.set(qid, (qCount.get(qid) || 0) + 1);

    for (const line of findings) {
      const qid = entryQid(line);
      if (!qid) { // rule R2
        violations.push('RESEARCH.md: Findings entry has no **Q<N>** (no unsolicited research)');
        continue;
      }
      if (!qids.has(qid)) violations.push(`RESEARCH.md: Findings entry cites ${qid} not in INTENT Questions`); // rule R2
      findingsQids.add(qid);
      researchQids.add(qid);
      countQ(qid);

      if (!/\[(high|med|low)\]/.test(line)) { // rule R4
        violations.push(`RESEARCH.md: ${qid} finding missing a confidence tag [high|med|low]`);
      }

      // Rules R5 & R6: source = segment after the LINE's LAST ` — ` (never split()[1]).
      if (!line.includes(BASIS_SEP)) {
        violations.push(`RESEARCH.md: ${qid} finding missing the ' — ' source separator`);
      } else {
        const source = line.split(BASIS_SEP).pop().trim();
        if (source === '') {
          violations.push(`RESEARCH.md: ${qid} finding has an empty source after the last ' — '`);
        } else {
          if (!(source.includes('http') || /\S+:\d+/.test(source))) { // rule R5
            violations.push(`RESEARCH.md: ${qid} finding source is not URL- or path:line-shaped`);
          }
          if (mode === 'greenfield' && !source.includes('http')) { // rule R6
            violations.push(`RESEARCH.md: ${qid} finding source must contain an http URL in greenfield mode`);
          }
        }
      }
    }

    for (const line of unanswered) {
      const qid = entryQid(line);
      if (!qid) { // rule R2
        violations.push('RESEARCH.md: Unanswered entry has no **Q<N>** (no unsolicited research)');
        continue;
      }
      if (!qids.has(qid)) violations.push(`RESEARCH.md: Unanswered entry cites ${qid} not in INTENT Questions`); // rule R2
      researchQids.add(qid);
      countQ(qid);
      if (!line.includes('risk:')) violations.push(`RESEARCH.md: ${qid} Unanswered entry missing risk:`); // rule R7
    }

    for (const [qid, count] of qCount) { // rule R3
      if (count > 1) violations.push(`RESEARCH.md: ${qid} is a duplicate — appears in more than one entry`);
    }
  }

  // Stage-gated joins (see header rationale) — each fires only for the stage that owns its file.
  if (stage === 'research') {
    if (researchText === null) {
      violations.push(`${researchPath}: missing file`);
    } else {
      for (const q of questions) {
        if (q.route === 'research' && !researchQids.has(q.id)) {
          violations.push(`RESEARCH.md: route=research ${q.id} appears in neither Findings nor Unanswered`);
        }
      }
    }
  } else if (stage === 'spec') {
    const specPath = join(dir, 'SPEC.md');
    const specText = tryRead(specPath);
    if (specText === null) {
      violations.push(`${specPath}: missing file`);
    } else {
      // Rule S1: no duplicate AC-N within ## Acceptance criteria (section-scoped — a withdrawn
      // `(was AC-N)` note under ## Out of scope, or unbolded prose elsewhere, must not count).
      const acSection = section(specText.split(/\r?\n/), '## Acceptance criteria') || [];
      const acCounts = new Map();
      for (const line of acSection) {
        const m = line.match(/\*\*AC-(\d+)\*\*/);
        if (!m) continue;
        const acid = `AC-${m[1]}`;
        acCounts.set(acid, (acCounts.get(acid) || 0) + 1);
      }
      for (const [acid, count] of acCounts) {
        if (count > 1) violations.push(`SPEC.md: ${acid} is duplicated in ## Acceptance criteria`);
      }

      // Terminal Q-join: resolved = INTENT Answers ∪ RESEARCH Findings (NOT Unanswered) ∪ ASSUMPTIONS links.
      const resolved = new Set([...answerQids, ...findingsQids, ...assumptionLinkedQids]);
      for (const q of questions) {
        if (!resolved.has(q.id) && !new RegExp(`${q.id}(?!\\d)`).test(specText)) {
          violations.push(`SPEC.md: ${q.id} is unresolved and its Q token appears nowhere in SPEC.md`);
        }
      }
    }
  }

  return violations;
}

const USAGE = 'usage: intent-lint.mjs <path-to-INTENT.md> [stage=research|stage=spec]';

function main() {
  const [intentPath, stageArg] = process.argv.slice(2); // extra argv beyond the stage token is ignored
  if (!intentPath) {
    console.log(USAGE);
    process.exit(1);
  }
  let stage;
  if (stageArg !== undefined) {
    const m = stageArg.match(/^stage=(research|spec)$/);
    if (!m) {
      console.log(USAGE);
      process.exit(1);
    }
    stage = m[1];
  }
  const violations = lint(intentPath, stage);
  for (const v of violations) console.log(v);
  process.exit(violations.length === 0 ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
