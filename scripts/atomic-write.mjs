#!/usr/bin/env node
// devloop atomic-write — Phase-2 resume plumbing. A resume marker/pointer must never be observed
// half-written: write to a same-dir temp file, fsync it, rename (atomic same-dir replace, correct on
// Windows too), then best-effort fsync the parent dir. Node built-ins only.
import fs from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

// once=true → idempotent no-op if target already exists (never overwrite a marker that's already there).
export function atomicWrite(target, content, { once = false } = {}) {
  if (once) {
    try { fs.statSync(target); return; } catch { /* doesn't exist → proceed to write */ }
  }

  const dir = dirname(target);
  fs.mkdirSync(dir, { recursive: true });

  const tmp = `${target}.tmp`;
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, content);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  fs.renameSync(tmp, target);

  // ponytail: best-effort dir fsync — Windows/some FS can't fsync a directory handle; rename is durable
  // enough there. Still call fsyncSync so it fires where supported.
  try {
    const dirfd = fs.openSync(dir, 'r');
    try { fs.fsyncSync(dirfd); } finally { fs.closeSync(dirfd); }
  } catch { /* dir fsync unsupported on this platform — rename already committed */ }
}

function main() {
  const args = process.argv.slice(2);
  const once = args.includes('--once');
  const target = args.find((a) => !a.startsWith('--'));
  if (!target) {
    console.error('usage: atomic-write.mjs <target> [--once]  (content read from stdin)');
    process.exit(1);
  }
  try {
    const buf = fs.readFileSync(0);
    atomicWrite(target, buf, { once });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
